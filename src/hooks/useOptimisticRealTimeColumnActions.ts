// src/hooks/useOptimisticRealTimeColumnActions.ts
import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { getCurrentBoardId } from '../state/currentBoard';
import { v4 as uuidv4 } from 'uuid';

export interface UseOptimisticRealTimeColumnActionsProps {
  state: any;
  setState: (updater: (state: any) => any) => void;
  setSaveStatus?: (s: 'idle'|'saving'|'saved'|'error') => void;
}

export const useOptimisticRealTimeColumnActions = ({ 
  state, 
  setState, 
  setSaveStatus
}: UseOptimisticRealTimeColumnActionsProps) => {
  const [isLoading, setIsLoading] = useState(false);

  // Rollback optimistic update on error
  const rollbackState = useCallback((originalState: any) => {
    setState(() => originalState);
  }, [setState]);

  // CREATE COLUMN - Optimistic UI with database sync
  const createColumn = useCallback(async (title: string) => {
    if (!title?.trim()) return;
    
    const originalState = { ...state };
    const optimisticColumnId = uuidv4();
    const boardId = getCurrentBoardId();
    
    if (!boardId) {
      throw new Error('No board ID available for column creation');
    }

    // Optimistic UI update
    const optimisticColumn = {
      id: optimisticColumnId,
      title: title.trim(),
      taskIds: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    setState((s: any) => ({
      ...s,
      columns: [...s.columns, optimisticColumn],
    }));

    // Database sync
    try {
      setIsLoading(true);
      setSaveStatus?.('saving');
      
      // Get next position
      const { data: existingColumns, error: fetchError } = await supabase
        .from('board_columns')
        .select('position')
        .eq('board_id', boardId)
        .is('deleted_at', null)
        .order('position', { ascending: false })
        .limit(1);
      
      if (fetchError) throw fetchError;
      
      const nextPosition = (existingColumns?.[0]?.position || 0) + 1;
      
      const { data, error } = await supabase
        .from('board_columns')
        .insert({
          id: optimisticColumnId,
          board_id: boardId,
          title: title.trim(),
          position: nextPosition,
          deleted_at: null,
        })
        .select('*')
        .single();
      
      if (error) throw error;
      
      setSaveStatus?.('saved');
      console.log('Column created successfully in database:', data);
      
    } catch (error) {
      console.error('Failed to create column in database:', error);
      setSaveStatus?.('error');
      rollbackState(originalState);
      throw error;
    } finally {
      setIsLoading(false);
    }

    return optimisticColumnId;
  }, [state, setState, setSaveStatus, rollbackState]);

  // RENAME COLUMN - Optimistic UI with database sync
  const renameColumn = useCallback(async (columnId: string, newTitle: string) => {
    if (!newTitle?.trim()) return;
    
    const originalState = { ...state };
    
    // Optimistic UI update
    setState((s: any) => ({
      ...s,
      columns: s.columns.map((col: any) => 
        col.id === columnId 
          ? { ...col, title: newTitle.trim(), updatedAt: Date.now() }
          : col
      ),
    }));

    // Database sync
    try {
      setIsLoading(true);
      setSaveStatus?.('saving');
      
      const { error } = await supabase
        .from('board_columns')
        .update({ 
          title: newTitle.trim(),
          updated_at: new Date().toISOString()
        })
        .eq('id', columnId);
      
      if (error) throw error;
      
      setSaveStatus?.('saved');
      console.log('Column renamed successfully in database');
      
    } catch (error) {
      console.error('Failed to rename column in database:', error);
      setSaveStatus?.('error');
      rollbackState(originalState);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [state, setState, setSaveStatus, rollbackState]);

  // DELETE COLUMN - Optimistic UI with database sync
  const deleteColumn = useCallback(async (columnId: string) => {
    const originalState = { ...state };
    
    // Optimistic UI update - remove column and move tasks to deleted
    const columnToDelete = state.columns.find((c: any) => c.id === columnId);
    if (!columnToDelete) return;
    
    setState((s: any) => {
      const deletedTasks = columnToDelete.taskIds.map((taskId: string) => ({
        ...(s.tasks[taskId] || { id: taskId, title: '' }),
        deletedAt: Date.now(),
        originalColumnId: columnId,
        originalPosition: columnToDelete.taskIds.indexOf(taskId),
      }));
      
      return {
        ...s,
        columns: s.columns.filter((c: any) => c.id !== columnId),
        deletedTasks: [...(s.deletedTasks || []), ...deletedTasks],
      };
    });

    // Database sync
    try {
      setIsLoading(true);
      setSaveStatus?.('saving');
      
      // Soft delete column
      const { error: columnError } = await supabase
        .from('board_columns')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', columnId);
      
      if (columnError) throw columnError;
      
      // Soft delete all tasks in the column
      const { error: tasksError } = await supabase
        .from('tasks')
        .update({ deleted_at: new Date().toISOString() })
        .eq('column_id', columnId)
        .is('deleted_at', null);
      
      if (tasksError) throw tasksError;
      
      setSaveStatus?.('saved');
      console.log('Column and its tasks deleted successfully in database');
      
    } catch (error) {
      console.error('Failed to delete column in database:', error);
      setSaveStatus?.('error');
      rollbackState(originalState);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [state, setState, setSaveStatus, rollbackState]);

  // REORDER COLUMNS - Optimistic UI with database sync
  const reorderColumns = useCallback(async (newOrder: string[]) => {
    const originalState = { ...state };
    
    // Optimistic UI update
    setState((s: any) => {
      const reorderedColumns = newOrder.map(id => 
        s.columns.find((c: any) => c.id === id)
      ).filter(Boolean);
      
      return {
        ...s,
        columns: reorderedColumns,
      };
    });

    // Database sync
    try {
      setIsLoading(true);
      setSaveStatus?.('saving');
      
      // Update positions in database
      for (let i = 0; i < newOrder.length; i++) {
        const { error } = await supabase
          .from('board_columns')
          .update({ 
            position: i + 1,
            updated_at: new Date().toISOString()
          })
          .eq('id', newOrder[i]);
        
        if (error) throw error;
      }
      
      setSaveStatus?.('saved');
      console.log('Columns reordered successfully in database');
      
    } catch (error) {
      console.error('Failed to reorder columns in database:', error);
      setSaveStatus?.('error');
      rollbackState(originalState);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [state, setState, setSaveStatus, rollbackState]);

  // MOVE COLUMN - Optimistic UI with database sync
  const moveColumn = useCallback(async (_columnId: string, fromIndex: number, toIndex: number) => {
    const originalState = { ...state };
    
    // Optimistic UI update
    setState((s: any) => {
      const columns = [...s.columns];
      const [movedColumn] = columns.splice(fromIndex, 1);
      columns.splice(toIndex, 0, movedColumn);
      
      return {
        ...s,
        columns,
      };
    });

    // Database sync
    try {
      setIsLoading(true);
      setSaveStatus?.('saving');
      
      // Update all column positions based on new order
      const newOrder = state.columns.map((c: any) => c.id);
      const [movedId] = newOrder.splice(fromIndex, 1);
      newOrder.splice(toIndex, 0, movedId);
      
      for (let i = 0; i < newOrder.length; i++) {
        const { error } = await supabase
          .from('board_columns')
          .update({ 
            position: i + 1,
            updated_at: new Date().toISOString()
          })
          .eq('id', newOrder[i]);
        
        if (error) throw error;
      }
      
      setSaveStatus?.('saved');
      console.log('Column moved successfully in database');
      
    } catch (error) {
      console.error('Failed to move column in database:', error);
      setSaveStatus?.('error');
      rollbackState(originalState);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [state, setState, setSaveStatus, rollbackState]);

  return {
    createColumn,
    renameColumn,
    deleteColumn,
    reorderColumns,
    moveColumn,
    isLoading,
  };
};
