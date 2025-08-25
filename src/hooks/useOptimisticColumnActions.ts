// src/hooks/useOptimisticColumnActions.ts
import { createColumn, deleteColumn as dbDeleteColumn, reorderColumns, updateColumnTitle } from '../data/columns';
import { updateTaskPosition } from '../data/tasks';
import type { UUID } from '../types/db';
import { getCurrentBoardId } from '../state/currentBoard';
import { v4 as uuidv4 } from 'uuid';

// Queue for background operations
interface BackgroundColumnOperation {
  id: string;
  type: 'create' | 'update' | 'delete' | 'reorder';
  payload: any;
  timestamp: number;
  retries: number;
  maxRetries: number;
}

export function useOptimisticColumnActions(
  state: any, 
  setState: (updater: (state: any) => any) => void, 
  opts?: { setSaveStatus?: (s: 'idle'|'saving'|'saved'|'error') => void }
) {
  const setSaveStatus = opts?.setSaveStatus;
  const backgroundQueue: BackgroundColumnOperation[] = [];
  let isProcessingQueue = false;
  let processingInterval: NodeJS.Timeout | null = null;
  
  // Debug logging
  console.log('useOptimisticColumnActions initialized with state:', { 
    hasState: !!state, 
    columnsCount: state?.columns?.length,
    currentBoardId: getCurrentBoardId()
  });

  const startBackgroundProcessing = () => {
    if (processingInterval) return;
    
    processingInterval = setInterval(() => {
      processBackgroundQueue();
    }, 1000); // Process every second
  };

  const stopBackgroundProcessing = () => {
    if (processingInterval) {
      clearInterval(processingInterval);
      processingInterval = null;
    }
  };

  const processBackgroundQueue = async () => {
    if (isProcessingQueue || backgroundQueue.length === 0) return;
    
    isProcessingQueue = true;
    setSaveStatus?.('saving');
    
    try {
      const operation = backgroundQueue.shift();
      if (!operation) return;
      
      await executeBackgroundColumnOperation(operation);
      
      // Remove successful operation
      setSaveStatus?.('saved');
      
    } catch (error) {
      console.error('Background column operation failed:', error);
      
      // Re-queue failed operation with retry logic
      const failedOperation = backgroundQueue.shift();
      if (failedOperation && failedOperation.retries < failedOperation.maxRetries) {
        failedOperation.retries++;
        failedOperation.timestamp = Date.now();
        backgroundQueue.unshift(failedOperation);
      }
      
      setSaveStatus?.('error');
    } finally {
      isProcessingQueue = false;
    }
  };

  const executeBackgroundColumnOperation = async (operation: BackgroundColumnOperation) => {
    switch (operation.type) {
      case 'create':
        await executeCreateColumn(operation.payload);
        break;
      case 'update':
        await executeUpdateColumn(operation.payload);
        break;
      case 'delete':
        await executeDeleteColumn(operation.payload);
        break;
      case 'reorder':
        await executeReorderColumns(operation.payload);
        break;
    }
  };



  // Generate a real UUID for new columns
  const generateColumnId = (): string => {
    return uuidv4();
  };

  const startAddColumn = () => setState((s: any) => ({ ...s, addingColumn: true, tempTitle: '' }));

  const commitAddColumn = async () => {
    const title = (state.tempTitle || '').trim();
    if (!title) return;
    
    // Generate real UUID for the column
    const optimisticColumnId = generateColumnId();
    const boardId = getCurrentBoardId();
    
    if (!boardId) {
      console.error('No board ID available for column creation');
      return;
    }

    const position = state.columns.length + 1;

    // Create optimistic column object
    const optimisticColumn = {
      id: optimisticColumnId,
      title: title,
      taskIds: [],
      position: position
    };

    // Update local state immediately with optimistic column
    setState((s: any) => ({ 
      ...s, 
      columns: [...s.columns, optimisticColumn], 
      addingColumn: false, 
      tempTitle: '' 
    }));

    // Update database immediately
    try {
      setSaveStatus?.('saving');
      
      const col = await createColumn(boardId as UUID, title, position);
      
      setSaveStatus?.('saved');
      console.log('Column created successfully in database:', col);
      
    } catch (error) {
      console.error('Failed to create column in database:', error);
      setSaveStatus?.('error');
      throw error;
    }
  };

  const cancelAddColumn = () => setState((s: any) => ({ ...s, addingColumn: false, tempTitle: '' }));

  const startRenameColumn = (id: string) => setState((s: any) => ({ ...s, renamingColumnId: id, tempTitle: s.columns.find((c: any) => c.id === id)?.title || '' }));

  const cancelRenameColumn = () => setState((s: any) => ({ ...s, renamingColumnId: null, tempTitle: '' }));

  const commitRenameColumn = async () => {
    const id = state.renamingColumnId;
    const title = (state.tempTitle || '').trim();
    if (!id || !title) return;

    // Update local state immediately
    setState((s: any) => ({ 
      ...s, 
      columns: s.columns.map((c: any) => (c.id === id ? { ...c, title } : c)), 
      renamingColumnId: null, 
      tempTitle: '' 
    }));

    // Update database immediately
    try {
      setSaveStatus?.('saving');
      
      await updateColumnTitle(id as UUID, title);
      
      setSaveStatus?.('saved');
      console.log('Column updated successfully in database');
      
    } catch (error) {
      console.error('Failed to update column in database:', error);
      setSaveStatus?.('error');
      throw error;
    }
  };

  const deleteColumn = async (id: string) => {
    // Get column info before deletion for background operation
    const col = state.columns.find((c: any) => c.id === id);
    if (!col) return;

    // Update local state immediately
    setState((s: any) => {
      const tasks = { ...s.tasks } as any;
      col.taskIds.forEach((tid: string) => delete tasks[tid]);
      return { ...s, columns: s.columns.filter((c: any) => c.id !== id), tasks };
    });

    // Update database immediately
    try {
      setSaveStatus?.('saving');
      
      await dbDeleteColumn(id as UUID);
      
      setSaveStatus?.('saved');
      console.log('Column deleted successfully in database');
      
    } catch (error) {
      console.error('Failed to delete column in database:', error);
      setSaveStatus?.('error');
      throw error;
    }
  };

  const moveColumn = async (fromId: string, toId: string) => {
    // Update local state immediately for better UX
    setState((s: any) => {
      const fromIndex = s.columns.findIndex((c: any) => c.id === fromId);
      const toIndex = s.columns.findIndex((c: any) => c.id === toId);
      if (fromIndex === -1 || toIndex === -1) return s;
      
      const newColumns = [...s.columns];
      const [moved] = newColumns.splice(fromIndex, 1);
      newColumns.splice(toIndex, 0, moved);
      
      return { ...s, columns: newColumns };
    });

    // Update database immediately
    try {
      setSaveStatus?.('saving');
      
      const boardId = getCurrentBoardId();
      if (boardId) {
        // Get the exact order from our local state after the move
        const orderedIds = state.columns.map((c: any) => c.id);
        await reorderColumns(boardId as UUID, orderedIds);
        
        // Update all task positions to match local state exactly
        for (const col of state.columns) {
          if (col.taskIds.length > 0) {
            const taskUpdates = col.taskIds.map((taskId: string, index: number) => ({
              id: taskId,
              position: index + 1
            }));
            
            // Update each task position individually to ensure accuracy
            for (const update of taskUpdates) {
              await updateTaskPosition(update.id as UUID, update.position);
            }
          }
        }
      }
      
      setSaveStatus?.('saved');
      console.log('Columns reordered successfully in database with exact position sync');
      
    } catch (error) {
      console.error('Failed to reorder columns in database:', error);
      setSaveStatus?.('error');
      throw error;
    }
  };

  // Background operation executors
  const executeCreateColumn = async (payload: any) => {
    const { boardId, title, position } = payload;
    
    try {
      const col = await createColumn(boardId as UUID, title, position);
      console.log('Column created successfully in database:', col);
    } catch (error) {
      console.error('Failed to create column in database:', error);
      throw error;
    }
  };

  const executeUpdateColumn = async (payload: any) => {
    const { columnId, title } = payload;
    
    try {
      await updateColumnTitle(columnId as UUID, title);
      console.log('Column updated successfully in database');
    } catch (error) {
      console.error('Failed to update column in database:', error);
      throw error;
    }
  };

  const executeDeleteColumn = async (payload: any) => {
    const { columnId } = payload;
    
    try {
      await dbDeleteColumn(columnId as UUID);
      console.log('Column deleted successfully in database');
    } catch (error) {
      console.error('Failed to delete column in database:', error);
      throw error;
    }
  };

  const executeReorderColumns = async (payload: any) => {
    const { orderedIds, taskPositions } = payload;
    
    try {
      const boardId = getCurrentBoardId();
      if (boardId) {
        await reorderColumns(boardId as UUID, orderedIds);
        
        // Update all task positions to maintain order
        for (const taskPos of taskPositions) {
          await updateTaskPosition(taskPos.taskId as UUID, taskPos.position);
        }
      }
      
      console.log('Columns reordered successfully in database');
    } catch (error) {
      console.error('Failed to reorder columns in database:', error);
      throw error;
    }
  };

  // Start background processing
  startBackgroundProcessing();

  // Return cleanup function
  const cleanup = () => {
    stopBackgroundProcessing();
  };

  return { 
    startAddColumn, 
    commitAddColumn, 
    cancelAddColumn, 
    startRenameColumn, 
    cancelRenameColumn, 
    commitRenameColumn, 
    deleteColumn, 
    moveColumn,
    cleanup
  };
}
