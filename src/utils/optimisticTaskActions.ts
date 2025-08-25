// src/utils/optimisticTaskActions.ts
import { supabase } from '../lib/supabaseClient';
import { ensureLabelIds, setTaskLabels, deleteLabelEverywhere } from '../data/labels';
import { replaceSubtasks, syncTaskPositionsAfterMove } from '../data/tasks';
import type { UUID } from '../types/db';
import confetti from 'canvas-confetti';
import { getCurrentBoardId } from '../state/currentBoard';
import { v4 as uuidv4 } from 'uuid';

// Queue for background operations
interface BackgroundOperation {
  id: string;
  type: 'create' | 'update' | 'delete' | 'move' | 'complete' | 'restore' | 'updateLabels';
  payload: any;
  timestamp: number;
  retries: number;
  maxRetries: number;
}

export interface OptimisticTaskActionsProps {
  state: any;
  setState: (updater: (state: any) => any) => void;
  setSaveStatus?: (s: 'idle'|'saving'|'saved'|'error') => void;
}

export class OptimisticTaskActions {
  private state: any;
  private setState: (updater: (state: any) => any) => void;
  private setSaveStatus?: (s: 'idle'|'saving'|'saved'|'error') => void;
  private backgroundQueue: BackgroundOperation[] = [];
  private isProcessingQueue = false;
  private processingInterval: NodeJS.Timeout | null = null;

  constructor({ state, setState, setSaveStatus }: OptimisticTaskActionsProps) {
    this.state = state;
    this.setState = setState;
    this.setSaveStatus = setSaveStatus;
    
    // Start background processing
    this.startBackgroundProcessing();
  }

  private startBackgroundProcessing() {
    if (this.processingInterval) return;
    
    this.processingInterval = setInterval(() => {
      this.processBackgroundQueue();
    }, 1000); // Process every second
  }

  private stopBackgroundProcessing() {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
  }

  private async processBackgroundQueue() {
    if (this.isProcessingQueue || this.backgroundQueue.length === 0) return;
    
    this.isProcessingQueue = true;
    this.setSaveStatus?.('saving');
    
    try {
      const operation = this.backgroundQueue.shift();
      if (!operation) return;
      
      await this.executeBackgroundOperation(operation);
      
      // Remove successful operation
      this.setSaveStatus?.('saved');
      
    } catch (error) {
      console.error('Background operation failed:', error);
      
      // Re-queue failed operation with retry logic
      const failedOperation = this.backgroundQueue.shift();
      if (failedOperation && failedOperation.retries < failedOperation.maxRetries) {
        failedOperation.retries++;
        failedOperation.timestamp = Date.now();
        this.backgroundQueue.unshift(failedOperation);
      }
      
      this.setSaveStatus?.('error');
    } finally {
      this.isProcessingQueue = false;
    }
  }

  private async executeBackgroundOperation(operation: BackgroundOperation) {
    switch (operation.type) {
      case 'create':
        await this.executeCreateTask(operation.payload);
        break;
      case 'update':
        await this.executeUpdateTask(operation.payload);
        break;
      case 'delete':
        await this.executeDeleteTask(operation.payload);
        break;
      case 'move':
        await this.executeMoveTask(operation.payload);
        break;
      case 'complete':
        await this.executeCompleteTask(operation.payload);
        break;
      case 'restore':
        await this.executeRestoreTask(operation.payload);
        break;
      case 'updateLabels':
        await this.executeUpdateLabels(operation.payload);
        break;
    }
  }



  // Generate a real UUID for new tasks
  private generateTaskId(): string {
    return uuidv4();
  }

  // CREATE TASK - Optimistic with real ID and immediate database sync
  createOrUpdateTask = async (payload: any, columnId: string | null, taskId: string | null = null, metadataOnly = false) => {
    console.log('createOrUpdateTask called with:', { payload, columnId, taskId, metadataOnly });
    
    if (metadataOnly) {
      // Handle metadata-only updates (like adding new labels to board)
      if (payload.labels) {
        console.log('Processing metadata-only labels update:', payload.labels);
        
        // Update local state first
        this.setState((s: any) => {
          const newLabels = payload.labels || [];
          const existing = new Set(s.labels || []);
          const uniq = newLabels.filter((l: string) => l && !existing.has(l));
          return uniq.length ? { ...s, labels: [...(s.labels || []), ...uniq] } : s;
        });
        
        // Update database immediately for labels
        try {
          const currentBoardId = getCurrentBoardId();
          if (currentBoardId && payload.labels.length > 0) {
            console.log('Creating new labels in database immediately:', payload.labels);
            for (const labelName of payload.labels) {
              const { error } = await supabase
                .from('labels')
                .insert({
                  board_id: currentBoardId,
                  name: labelName,
                  color: null
                });
              if (error) {
                console.error('Error creating label:', labelName, error);
              } else {
                console.log('Successfully created label:', labelName);
              }
            }
          }
        } catch (error) {
          console.error('Error saving labels to database:', error);
        }
      }
      return;
    }

    if (!taskId) {
      // CREATE NEW TASK
      if (!columnId) return;
      
      // Generate real UUID for the task
      const optimisticTaskId = this.generateTaskId();
      const boardId = getCurrentBoardId();
      
      if (!boardId) {
        console.error('No board ID available for task creation');
        return;
      }

      // Create optimistic task object
      const optimisticTask = {
        id: optimisticTaskId,
        title: (payload.title || 'Untitled').trim(),
        description: payload.description?.trim() || '',
        labels: (payload.labels || []).slice().sort(),
        priority: payload.priority || 'Medium',
        dueDate: payload.dueDate || null,
        subtasks: (payload.subtasks || []).map((st: any) => ({ 
          id: st.id || this.generateTaskId(), 
          title: st.title, 
          completed: !!st.completed 
        })),
        completed: false,
        completedAt: null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      // Update local state immediately with optimistic task
      this.setState((s: any) => ({
        ...s,
        labels: Array.from(new Set([...(s.labels || []), ...(payload.labels || [])])),
        tasks: {
          ...s.tasks,
          [optimisticTaskId]: optimisticTask,
        },
        columns: s.columns.map((c: any) => 
          c.id === columnId 
            ? { ...c, taskIds: [optimisticTaskId, ...c.taskIds] } 
            : c
        ),
      }));

      // Update database immediately
      try {
        this.setSaveStatus?.('saving');
        
        // Create task in database
        const { data, error } = await supabase.from('tasks').insert({
          id: optimisticTaskId,
          board_id: boardId,
          column_id: columnId,
          title: optimisticTask.title,
          description: optimisticTask.description,
          priority: optimisticTask.priority,
          due_at: optimisticTask.dueDate,
          completed: false,
          completed_at: null,
          position: 1,
          deleted_at: null,
        }).select('*').single();
        
        if (error) throw error;

        // Handle subtasks immediately
        if (payload.subtasks && payload.subtasks.length > 0) {
          await replaceSubtasks(optimisticTaskId as UUID, payload.subtasks);
        }

        // Handle labels immediately
        if (payload.labels && payload.labels.length > 0) {
          const labelIds = await ensureLabelIds(boardId as UUID, payload.labels);
          await setTaskLabels(optimisticTaskId as UUID, labelIds);
        }

        this.setSaveStatus?.('saved');
        console.log('Task created successfully in database:', data);
        
      } catch (error) {
        console.error('Failed to create task in database:', error);
        this.setSaveStatus?.('error');
        throw error;
      }

      return optimisticTaskId;
    }

    // UPDATE EXISTING TASK
    // Update local state immediately
    this.setState((s: any) => ({
      ...s,
      tasks: {
        ...s.tasks,
        [taskId]: {
          ...s.tasks[taskId],
          title: (payload.title || 'Untitled').trim(),
          description: payload.description?.trim() || '',
          labels: (payload.labels || []).slice().sort(),
          priority: payload.priority || 'Medium',
          dueDate: payload.dueDate || '',
          subtasks: (payload.subtasks || []).map((st: any) => ({ 
            id: st.id || this.generateTaskId(), 
            title: st.title, 
            completed: !!st.completed 
          })),
          updatedAt: Date.now(),
        },
      },
    }));

    // Update database immediately
    try {
      this.setSaveStatus?.('saving');
      
      // Update task in database
      const { error } = await supabase.from('tasks').update({
        title: (payload.title || 'Untitled').trim(),
        description: payload.description?.trim() || '',
        priority: payload.priority || 'Medium',
        due_at: payload.dueDate || null,
        updated_at: new Date().toISOString()
      }).eq('id', taskId);
      
      if (error) throw error;

      // Handle subtasks immediately
      if (payload.subtasks && payload.subtasks.length > 0) {
        await replaceSubtasks(taskId as UUID, payload.subtasks);
      }

      // Handle labels immediately
      if (payload.labels && payload.labels.length > 0) {
        const boardId = getCurrentBoardId();
        if (boardId) {
          const labelIds = await ensureLabelIds(boardId as UUID, payload.labels);
          await setTaskLabels(taskId as UUID, labelIds);
        }
      }

      this.setSaveStatus?.('saved');
      console.log('Task updated successfully in database');
      
    } catch (error) {
      console.error('Failed to update task in database:', error);
      this.setSaveStatus?.('error');
      throw error;
    }
  };

  // DELETE TASK - Optimistic with immediate database sync
  deleteTask = async (taskId: string) => {
    const { columnId, position } = (() => {
      for (const c of this.state.columns) {
        const idx = c.taskIds.indexOf(taskId);
        if (idx !== -1) return { columnId: c.id, position: idx };
      }
      return { columnId: this.state.columns[0]?.id, position: 0 };
    })();

    // Update local state immediately
    this.setState((s: any) => ({
      ...s,
      columns: s.columns.map((c: any) => 
        c.id === columnId 
          ? { ...c, taskIds: c.taskIds.filter((id: string) => id !== taskId) } 
          : c
      ),
      deletedTasks: [
        {
          ...(s.tasks[taskId] || { id: taskId, title: '' }),
          id: taskId,
          deletedAt: Date.now(),
          originalColumnId: columnId,
          originalPosition: position,
        },
        ...(s.deletedTasks || []),
      ],
    }));

    // Update database immediately
    try {
      this.setSaveStatus?.('saving');
      
      const { error } = await supabase.from('tasks').update({ 
        deleted_at: new Date().toISOString() 
      }).eq('id', taskId);
      
      if (error) throw error;
      
      this.setSaveStatus?.('saved');
      console.log('Task deleted successfully in database');
      
    } catch (error) {
      console.error('Failed to delete task in database:', error);
      this.setSaveStatus?.('error');
      throw error;
    }
  };

  // MOVE TASK - Optimistic with immediate database sync
  moveTask = async (taskId: string, fromColumnId: string, toColumnId: string, position?: number) => {
    console.log('moveTask called with:', { taskId, fromColumnId, toColumnId, position });
    
    const toPos = position ?? (this.state.columns.find((c: any) => c.id === toColumnId)?.taskIds.length ?? 0);
    
    // Check if this is same-column reordering
    if (fromColumnId === toColumnId) {
      // Same column reordering - handle this specially
      const currentColumn = this.state.columns.find((c: any) => c.id === fromColumnId);
      if (!currentColumn) {
        console.error('Column not found for same-column reordering');
        return;
      }
      
      const currentIndex = currentColumn.taskIds.indexOf(taskId);
      if (currentIndex === -1) {
        console.error('Task not found in column for reordering');
        return;
      }
      
      // Create new order array
      const newOrder = [...currentColumn.taskIds];
      newOrder.splice(currentIndex, 1); // Remove from current position
      newOrder.splice(toPos, 0, taskId); // Insert at new position
      
      // Update local state immediately for same-column reordering
      this.setState((s: any) => ({
        ...s,
        columns: s.columns.map((col: any) => 
          col.id === fromColumnId 
            ? { ...col, taskIds: newOrder }
            : col
        ),
      }));
      
      // Update database immediately for same-column reordering
      try {
        this.setSaveStatus?.('saving');
        
        const updates = newOrder.map((taskId: string, index: number) => ({
          id: taskId,
          column_id: fromColumnId,
          position: index + 1
        }));
        
        await this.bulkUpdateTaskPositions(updates);
        
        this.setSaveStatus?.('saved');
        console.log('Same-column task reordering completed successfully');
        
      } catch (error) {
        console.error('Failed to reorder tasks in same column:', error);
        this.setSaveStatus?.('error');
        throw error;
      }
      
      return;
    }
    
    // Cross-column move - existing logic
    // Update local state immediately for better UX
    this.setState((s: any) => {
      const newColumns = s.columns.map((col: any) => {
        if (col.id === fromColumnId) {
          return { ...col, taskIds: col.taskIds.filter((id: string) => id !== taskId) };
        }
        if (col.id === toColumnId) {
          const ids = [...col.taskIds];
          const toIdx = Math.min(toPos, ids.length);
          ids.splice(toIdx, 0, taskId);
          return { ...col, taskIds: ids };
        }
        return col;
      });
      return { ...s, columns: newColumns };
    });
    
    // Update database immediately
    try {
      this.setSaveStatus?.('saving');
      
      // Get the exact order from our local state after the move
      const sourceColumn = this.state.columns.find((c: any) => c.id === fromColumnId);
      const destColumn = this.state.columns.find((c: any) => c.id === toColumnId);
      
      if (!sourceColumn || !destColumn) {
        throw new Error('Column not found in local state');
      }
      
      // Update the moved task's column and position
      const { error: moveError } = await supabase
        .from('tasks')
        .update({ 
          column_id: toColumnId, 
          position: toPos + 1,
          updated_at: new Date().toISOString()
        })
        .eq('id', taskId);
      
      if (moveError) throw moveError;
      
      // Update all positions in source column to match local state exactly
      const sourceUpdates = sourceColumn.taskIds.map((taskId: string, index: number) => ({
        id: taskId,
        column_id: fromColumnId,
        position: index + 1
      }));
      
      // Update all positions in destination column to match local state exactly
      const destUpdates = destColumn.taskIds.map((taskId: string, index: number) => ({
        id: taskId,
        column_id: toColumnId,
        position: index + 1
      }));
      
      // Update all positions in both columns
      await Promise.all([
        sourceUpdates.length > 0 ? this.bulkUpdateTaskPositions(sourceUpdates) : Promise.resolve(),
        destUpdates.length > 0 ? this.bulkUpdateTaskPositions(destUpdates) : Promise.resolve()
      ]);
      
      this.setSaveStatus?.('saved');
      console.log('Task moved successfully in database with exact position sync');
      
    } catch (error) {
      console.error('Failed to move task in database:', error);
      this.setSaveStatus?.('error');
      throw error;
    }
  };

  // COMPLETE TASK - Optimistic with immediate database sync
  completeTask = async (taskId: string) => {
    const t = this.state.tasks[taskId];
    const next = !t?.completed;
    
    // Update local state immediately
    this.setState((s: any) => ({
      ...s,
      tasks: { 
        ...s.tasks, 
        [taskId]: { 
          ...s.tasks[taskId], 
          completed: next, 
          completedAt: next ? Date.now() : null 
        } 
      },
    }));

    // Show confetti immediately for better UX
    if (next) confetti({ 
      particleCount: 60, 
      spread: 50, 
      origin: { y: 0.8 },
      colors: ['#10b981', '#059669', '#047857', '#065f46'] // Green color palette
    });

    // Update database immediately
    try {
      this.setSaveStatus?.('saving');
      
      const { error } = await supabase.from('tasks').update({ 
        completed: next, 
        completed_at: next ? new Date().toISOString() : null 
      }).eq('id', taskId);
      
      if (error) throw error;
      
      this.setSaveStatus?.('saved');
      console.log('Task completion updated successfully in database');
      
    } catch (error) {
      console.error('Failed to update task completion in database:', error);
      this.setSaveStatus?.('error');
      throw error;
    }
  };

  // RESTORE TASK - Optimistic with immediate database sync
  restoreTask = async (taskId: string) => {
    // Update local state immediately
    this.setState((s: any) => ({ 
      ...s, 
      tasks: { 
        ...s.tasks, 
        [taskId]: { 
          ...s.tasks[taskId], 
          completed: false, 
          completedAt: null 
        } 
      } 
    }));

    // Update database immediately
    try {
      this.setSaveStatus?.('saving');
      
      const { error } = await supabase.from('tasks').update({ 
        completed: false, 
        completed_at: null 
      }).eq('id', taskId);
      
      if (error) throw error;
      
      this.setSaveStatus?.('saved');
      console.log('Task restored successfully in database');
      
    } catch (error) {
      console.error('Failed to restore task in database:', error);
      this.setSaveStatus?.('error');
      throw error;
    }
  };

  // RESTORE DELETED TASK - Optimistic with immediate database sync
  restoreDeletedTask = async (taskId: string) => {
    // Update local state immediately
    this.setState((s: any) => {
      const deletedTask = (s.deletedTasks || []).find((t: any) => t.id === taskId);
      const targetColumnId = deletedTask?.originalColumnId || s.columns[0]?.id;
      const insertPos = Math.min(deletedTask?.originalPosition ?? 0, (s.columns.find((c: any) => c.id === targetColumnId)?.taskIds.length ?? 0));
      
      const cols = s.columns.map((c: any) => {
        if (c.id !== targetColumnId) return c;
        const ids = [...c.taskIds];
        ids.splice(insertPos, 0, taskId);
        return { ...c, taskIds: ids };
      });
      
      return { 
        ...s, 
        columns: cols, 
        deletedTasks: (s.deletedTasks || []).filter((t: any) => t.id !== taskId) 
      };
    });

    // Update database immediately
    try {
      this.setSaveStatus?.('saving');
      
      const { error } = await supabase.from('tasks').update({ 
        deleted_at: null 
      }).eq('id', taskId);
      
      if (error) throw error;
      
      this.setSaveStatus?.('saved');
      console.log('Deleted task restored successfully in database');
      
    } catch (error) {
      console.error('Failed to restore deleted task in database:', error);
      this.setSaveStatus?.('error');
      throw error;
    }
  };

  // PERMANENTLY DELETE TASK - Optimistic with immediate database sync
  permanentlyDeleteTask = async (taskId: string) => {
    // Update local state immediately
    this.setState((s: any) => ({ 
      ...s, 
      deletedTasks: (s.deletedTasks || []).filter((t: any) => t.id !== taskId) 
    }));

    // Update database immediately
    try {
      this.setSaveStatus?.('saving');
      
      const { error } = await supabase.from('tasks').delete().eq('id', taskId);
      
      if (error) throw error;
      
      this.setSaveStatus?.('saved');
      console.log('Task permanently deleted successfully in database');
      
    } catch (error) {
      console.error('Failed to permanently delete task in database:', error);
      this.setSaveStatus?.('error');
      throw error;
    }
  };

  // UPDATE TASK LABELS - Optimistic with immediate database sync
  updateTaskLabels = async (taskId: string, labels: string[]) => {
    console.log('updateTaskLabels called with:', { taskId, labels });
    
    // Update local state immediately
    this.setState((s: any) => ({
      ...s,
      tasks: {
        ...s.tasks,
        [taskId]: {
          ...s.tasks[taskId],
          labels: labels.slice().sort(),
          updatedAt: Date.now(),
        },
      },
    }));

    // Update database immediately
    try {
      this.setSaveStatus?.('saving');
      
      const boardId = getCurrentBoardId();
      if (boardId) {
        if (labels.length > 0) {
          const labelIds = await ensureLabelIds(boardId as UUID, labels);
          await setTaskLabels(taskId as UUID, labelIds);
        } else {
          await setTaskLabels(taskId as UUID, []);
        }
      }
      
      this.setSaveStatus?.('saved');
      console.log('Task labels updated successfully in database');
      
    } catch (error) {
      console.error('Failed to update task labels in database:', error);
      this.setSaveStatus?.('error');
      throw error;
    }
  };

  // DELETE LABEL - Optimistic with immediate database sync
  deleteLabel = async (name: string) => {
    // Update local state immediately
    this.setState((s: any) => {
      const newLabels = (s.labels || []).filter((l: string) => l.toLowerCase() !== name.toLowerCase());
      const newTasks: any = { ...s.tasks };
      Object.keys(newTasks).forEach((id) => {
        const t = newTasks[id];
        if (t.labels?.some((l: string) => l.toLowerCase() === name.toLowerCase())) {
          newTasks[id] = { ...t, labels: t.labels.filter((l: string) => l.toLowerCase() !== name.toLowerCase()) };
        }
      });
      return { ...s, labels: newLabels, tasks: newTasks };
    });

    // Update database immediately
    try {
      this.setSaveStatus?.('saving');
      
      const boardId = getCurrentBoardId();
      if (boardId) {
        await deleteLabelEverywhere(boardId as UUID, name);
      }
      
      this.setSaveStatus?.('saved');
      console.log('Label deleted successfully in database');
      
    } catch (error) {
      console.error('Failed to delete label in database:', error);
      this.setSaveStatus?.('error');
      throw error;
    }
  };

  // Background operation executors
  private async executeCreateTask(payload: any) {
    const { taskId, boardId, columnId, taskData, labels, subtasks } = payload;
    
    try {
      // Create task in database
      const { data, error } = await supabase.from('tasks').insert({
        id: taskId,
        board_id: boardId,
        column_id: columnId,
        title: taskData.title,
        description: taskData.description,
        priority: taskData.priority,
        due_at: taskData.dueDate,
        completed: false,
        completed_at: null,
        position: 1,
        deleted_at: null,
      }).select('*').single();
      
      if (error) throw error;

      // Handle subtasks
      if (subtasks.length > 0) {
        await replaceSubtasks(taskId as UUID, subtasks);
      }

      // Handle labels
      if (labels.length > 0) {
        const labelIds = await ensureLabelIds(boardId as UUID, labels);
        await setTaskLabels(taskId as UUID, labelIds);
      }

      console.log('Task created successfully in database:', data);
    } catch (error) {
      console.error('Failed to create task in database:', error);
      throw error;
    }
  }

  private async executeUpdateTask(payload: any) {
    const { taskId, taskData, labels, subtasks } = payload;
    
    try {
      // Update task in database
      const { error } = await supabase.from('tasks').update({
        title: taskData.title,
        description: taskData.description,
        priority: taskData.priority,
        due_at: taskData.dueDate,
        updated_at: new Date().toISOString()
      }).eq('id', taskId);
      
      if (error) throw error;

      // Handle subtasks
      if (subtasks.length > 0) {
        await replaceSubtasks(taskId as UUID, subtasks);
      }

      // Handle labels
      if (labels.length > 0) {
        const boardId = getCurrentBoardId();
        if (boardId) {
          const labelIds = await ensureLabelIds(boardId as UUID, labels);
          await setTaskLabels(taskId as UUID, labelIds);
        }
      }

      console.log('Task updated successfully in database');
    } catch (error) {
      console.error('Failed to update task in database:', error);
      throw error;
    }
  }

  private async executeDeleteTask(payload: any) {
    const { taskId, permanent } = payload;
    
    try {
      if (permanent) {
        const { error } = await supabase.from('tasks').delete().eq('id', taskId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('tasks').update({ 
          deleted_at: new Date().toISOString() 
        }).eq('id', taskId);
        if (error) throw error;
      }
      
      console.log('Task deleted successfully in database');
    } catch (error) {
      console.error('Failed to delete task in database:', error);
      throw error;
    }
  }

  private async executeMoveTask(payload: any) {
    const { taskId, fromColumnId, toColumnId, position } = payload;
    
    try {
      await syncTaskPositionsAfterMove(
        taskId as UUID,
        fromColumnId as UUID,
        toColumnId as UUID,
        position
      );
      
      console.log('Task moved successfully in database');
    } catch (error) {
      console.error('Failed to move task in database:', error);
      throw error;
    }
  }

  private async executeCompleteTask(payload: any) {
    const { taskId, completed } = payload;
    
    try {
      const { error } = await supabase.from('tasks').update({ 
        completed, 
        completed_at: completed ? new Date().toISOString() : null 
      }).eq('id', taskId);
      
      if (error) throw error;
      
      console.log('Task completion updated successfully in database');
    } catch (error) {
      console.error('Failed to update task completion in database:', error);
      throw error;
    }
  }

  private async executeRestoreTask(payload: any) {
    const { taskId, restoreDeleted } = payload;
    
    try {
      if (restoreDeleted) {
        const { error } = await supabase.from('tasks').update({ 
          deleted_at: null 
        }).eq('id', taskId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('tasks').update({ 
          completed: false, 
          completed_at: null 
        }).eq('id', taskId);
        if (error) throw error;
      }
      
      console.log('Task restored successfully in database');
    } catch (error) {
      console.error('Failed to restore task in database:', error);
      throw error;
    }
  }

  private async executeUpdateLabels(payload: any) {
    const { taskId, labels, deleteLabel, boardId } = payload;
    
    try {
      if (deleteLabel) {
        // Delete label from everywhere
        const boardId = getCurrentBoardId();
        if (boardId) {
          await deleteLabelEverywhere(boardId as UUID, deleteLabel);
        }
      } else if (taskId && labels) {
        // Update task labels
        const boardId = getCurrentBoardId();
        if (boardId) {
          if (labels.length > 0) {
            const labelIds = await ensureLabelIds(boardId as UUID, labels);
            await setTaskLabels(taskId as UUID, labelIds);
          } else {
            await setTaskLabels(taskId as UUID, []);
          }
        }
      } else if (labels && boardId) {
        // Create new labels for board
        for (const labelName of labels) {
          const { error } = await supabase
            .from('labels')
            .insert({
              board_id: boardId,
              name: labelName,
              color: null
            });
          if (error) {
            console.error('Error creating label:', labelName, error);
          }
        }
      }
      
      console.log('Labels updated successfully in database');
    } catch (error) {
      console.error('Failed to update labels in database:', error);
      throw error;
    }
  }

  // Helper method to bulk update task positions
  private async bulkUpdateTaskPositions(updates: Array<{ id: string; column_id: string; position: number }>) {
    if (updates.length === 0) return;
    
    try {
      // Update each task position individually to ensure accuracy
      for (const update of updates) {
        const { error } = await supabase
          .from('tasks')
          .update({ 
            position: update.position,
            updated_at: new Date().toISOString()
          })
          .eq('id', update.id);
        
        if (error) {
          console.error('Failed to update task position:', update, error);
          throw error;
        }
      }
      
      console.log('Bulk position updates completed successfully');
    } catch (error) {
      console.error('Failed to bulk update task positions:', error);
      throw error;
    }
  }

  // Method to reorder tasks within the same column (drag and drop)
  reorderTasksInColumn = async (columnId: string, taskIds: string[]) => {
    console.log('reorderTasksInColumn called with:', { columnId, taskIds });
    
    // Update local state immediately
    this.setState((s: any) => ({
      ...s,
      columns: s.columns.map((c: any) => 
        c.id === columnId 
          ? { ...c, taskIds: [...taskIds] }
          : c
      ),
    }));

    // Update database immediately to match local state exactly
    try {
      this.setSaveStatus?.('saving');
      
      const updates = taskIds.map((taskId: string, index: number) => ({
        id: taskId,
        column_id: columnId,
        position: index + 1
      }));
      
      await this.bulkUpdateTaskPositions(updates);
      
      this.setSaveStatus?.('saved');
      console.log('Tasks reordered successfully in column with exact position sync');
      
    } catch (error) {
      console.error('Failed to reorder tasks in column:', error);
      this.setSaveStatus?.('error');
      throw error;
    }
  };

  // Cleanup method
  destroy() {
    this.stopBackgroundProcessing();
  }
}
