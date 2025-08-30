// src/utils/optimisticRealTimeTaskActions.ts
import { supabase } from '../lib/supabaseClient';
import { ensureLabelIds, setTaskLabels, deleteLabelEverywhere } from '../data/labels';
import { replaceSubtasks } from '../data/tasks';
import type { UUID } from '../types/db';
import confetti from 'canvas-confetti';
import { getCurrentBoardId } from '../state/currentBoard';
import { v4 as uuidv4 } from 'uuid';

export interface OptimisticRealTimeTaskActionsProps {
  state: any;
  setState: (updater: (state: any) => any) => void;
  setSaveStatus?: (s: 'idle'|'saving'|'saved'|'error') => void;
}

export class OptimisticRealTimeTaskActions {
  private state: any;
  private setState: (updater: (state: any) => any) => void;
  private setSaveStatus?: (s: 'idle'|'saving'|'saved'|'error') => void;

  constructor({ state, setState, setSaveStatus }: OptimisticRealTimeTaskActionsProps) {
    this.state = state;
    this.setState = setState;
    this.setSaveStatus = setSaveStatus;
  }

  // Generate a real UUID for new tasks
  private generateTaskId(): string {
    return uuidv4();
  }

  // Rollback optimistic update on error
  private rollbackState = (originalState: any) => {
    this.setState(() => originalState);
  };

  // CREATE OR UPDATE TASK - Optimistic UI with database sync
  createOrUpdateTask = async (payload: any, columnId: string | null, taskId: string | null = null, metadataOnly = false) => {
    console.log('createOrUpdateTask called with:', { payload, columnId, taskId, metadataOnly });
    
    if (metadataOnly) {
      // Handle metadata-only updates (like adding new labels to board)
      if (payload.labels) {
        // Optimistic update
        this.setState((s: any) => {
          const newLabels = payload.labels || [];
          const existing = new Set(s.labels || []);
          const uniq = newLabels.filter((l: string) => l && !existing.has(l));
          return uniq.length ? { ...s, labels: [...(s.labels || []), ...uniq] } : s;
        });
        
        // Database sync
        try {
          this.setSaveStatus?.('saving');
          const currentBoardId = getCurrentBoardId();
          if (currentBoardId && payload.labels.length > 0) {
            for (const labelName of payload.labels) {
              const { error } = await supabase
                .from('labels')
                .insert({
                  board_id: currentBoardId,
                  name: labelName,
                  color: null
                });
              if (error) throw error;
            }
          }
          this.setSaveStatus?.('saved');
        } catch (error) {
          console.error('Failed to save labels:', error);
          this.setSaveStatus?.('error');
          // Real-time sync will correct the state
        }
      }
      return;
    }

    // Store original state for rollback
    const originalState = { ...this.state };

    if (!taskId) {
      // CREATE NEW TASK - Optimistic UI
      if (!columnId) {
        throw new Error('Column ID is required for task creation');
      }
      
      const optimisticTaskId = this.generateTaskId();
      const boardId = getCurrentBoardId();
      
      if (!boardId) {
        throw new Error('No board ID available for task creation');
      }

      // Optimistic task object
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

      // Optimistic UI update - add task at top
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

      // Database sync
      try {
        this.setSaveStatus?.('saving');
        
        // Shift existing tasks down
        const { data: existingTasks, error: fetchError } = await supabase
          .from('tasks')
          .select('id, position')
          .eq('column_id', columnId)
          .is('deleted_at', null)
          .order('position', { ascending: true });
        
        if (fetchError) throw fetchError;
        
        for (const task of existingTasks || []) {
          const { error: updateError } = await supabase
            .from('tasks')
            .update({ position: task.position + 1 })
            .eq('id', task.id);
          
          if (updateError) throw updateError;
        }

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

        // Handle subtasks and labels
        if (payload.subtasks && payload.subtasks.length > 0) {
          await replaceSubtasks(optimisticTaskId as UUID, payload.subtasks);
        }

        if (payload.labels && payload.labels.length > 0) {
          const labelIds = await ensureLabelIds(boardId as UUID, payload.labels);
          await setTaskLabels(optimisticTaskId as UUID, labelIds);
        }

        this.setSaveStatus?.('saved');
        console.log('Task created successfully in database:', data);
        
      } catch (error) {
        console.error('Failed to create task in database:', error);
        this.setSaveStatus?.('error');
        this.rollbackState(originalState);
        throw error;
      }

      return optimisticTaskId;
    }

    // UPDATE EXISTING TASK - Optimistic UI
    // Optimistic update
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

    // Database sync
    try {
      this.setSaveStatus?.('saving');
      
      const { error } = await supabase.from('tasks').update({
        title: (payload.title || 'Untitled').trim(),
        description: payload.description?.trim() || '',
        priority: payload.priority || 'Medium',
        due_at: payload.dueDate || null,
        updated_at: new Date().toISOString()
      }).eq('id', taskId);
      
      if (error) throw error;

      if (payload.subtasks && payload.subtasks.length > 0) {
        await replaceSubtasks(taskId as UUID, payload.subtasks);
      }

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
      this.rollbackState(originalState);
      throw error;
    }
  };

  // DELETE TASK - Optimistic UI with database sync
  deleteTask = async (taskId: string) => {
    const originalState = { ...this.state };
    
    // Find task position for rollback
    const { columnId, position } = (() => {
      for (const c of this.state.columns) {
        const idx = c.taskIds.indexOf(taskId);
        if (idx !== -1) return { columnId: c.id, position: idx };
      }
      return { columnId: this.state.columns[0]?.id, position: 0 };
    })();

    // Optimistic UI update
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

    // Database sync
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
      this.rollbackState(originalState);
      throw error;
    }
  };

  // MOVE TASK - Optimistic UI with database sync
  moveTask = async (taskId: string, fromColumnId: string, toColumnId: string, position?: number) => {
    console.log('moveTask called with:', { taskId, fromColumnId, toColumnId, position });
    
    const originalState = { ...this.state };
    
    // Optimistic UI update
    if (fromColumnId === toColumnId) {
      // Same column reordering
      const currentColumn = this.state.columns.find((c: any) => c.id === fromColumnId);
      if (!currentColumn) return;
      
      const currentIndex = currentColumn.taskIds.indexOf(taskId);
      if (currentIndex === -1) return;
      
      const newOrder = [...currentColumn.taskIds];
      newOrder.splice(currentIndex, 1);
      newOrder.splice(position || 0, 0, taskId);
      
      this.setState((s: any) => ({
        ...s,
        columns: s.columns.map((col: any) => 
          col.id === fromColumnId 
            ? { ...col, taskIds: newOrder }
            : col
        ),
      }));
    } else {
      // Cross-column move
      this.setState((s: any) => {
        const newColumns = s.columns.map((col: any) => {
          if (col.id === fromColumnId) {
            return { ...col, taskIds: col.taskIds.filter((id: string) => id !== taskId) };
          }
          if (col.id === toColumnId) {
            const ids = [...col.taskIds];
            const toIdx = Math.min(position || 0, ids.length);
            ids.splice(toIdx, 0, taskId);
            return { ...col, taskIds: ids };
          }
          return col;
        });
        return { ...s, columns: newColumns };
      });
    }

    // Database sync (simplified for performance)
    try {
      this.setSaveStatus?.('saving');
      
      if (fromColumnId === toColumnId) {
        // Same column - just update positions
        const column = this.state.columns.find((c: any) => c.id === fromColumnId);
        if (column) {
          for (let i = 0; i < column.taskIds.length; i++) {
            const { error } = await supabase
              .from('tasks')
              .update({ position: i + 1 })
              .eq('id', column.taskIds[i]);
            
            if (error) throw error;
          }
        }
      } else {
        // Cross-column move
        const targetPosition = (position !== undefined ? position + 1 : 1);
        
        const { error } = await supabase
          .from('tasks')
          .update({ 
            column_id: toColumnId, 
            position: targetPosition,
            updated_at: new Date().toISOString()
          })
          .eq('id', taskId);
        
        if (error) throw error;
      }
      
      this.setSaveStatus?.('saved');
      console.log('Task moved successfully in database');
      
    } catch (error) {
      console.error('Failed to move task in database:', error);
      this.setSaveStatus?.('error');
      this.rollbackState(originalState);
      throw error;
    }
  };

  // COMPLETE TASK - Optimistic UI with database sync
  completeTask = async (taskId: string, currentCompleted: boolean) => {
    const originalState = { ...this.state };
    const next = !currentCompleted;
    
    // Optimistic UI update
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
    if (next) {
      confetti({ 
        particleCount: 60, 
        spread: 50, 
        origin: { y: 0.8 },
        colors: ['#10b981', '#059669', '#047857', '#065f46']
      });
    }

    // Database sync
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
      this.rollbackState(originalState);
      throw error;
    }
  };

  // RESTORE DELETED TASK - Optimistic UI with database sync
  restoreDeletedTask = async (taskId: string) => {
    const originalState = { ...this.state };
    
    // Optimistic UI update
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

    // Database sync
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
      this.rollbackState(originalState);
      throw error;
    }
  };

  // UPDATE TASK LABELS - Optimistic UI with database sync
  updateTaskLabels = async (taskId: string, labels: string[]) => {
    const originalState = { ...this.state };
    
    // Optimistic UI update
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

    // Database sync
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
      this.rollbackState(originalState);
      throw error;
    }
  };

  // DELETE LABEL - Optimistic UI with database sync
  deleteLabel = async (name: string) => {
    const originalState = { ...this.state };
    
    // Optimistic UI update
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

    // Database sync
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
      this.rollbackState(originalState);
      throw error;
    }
  };

  // RESTORE TASK (alias for restoreDeletedTask for compatibility)
  restoreTask = this.restoreDeletedTask;

  // PERMANENTLY DELETE TASK - Optimistic UI with database sync
  permanentlyDeleteTask = async (taskId: string) => {
    const originalState = { ...this.state };
    
    // Optimistic UI update - remove from deleted tasks
    this.setState((s: any) => ({
      ...s,
      deletedTasks: (s.deletedTasks || []).filter((t: any) => t.id !== taskId),
    }));

    // Database sync - permanently delete from database
    try {
      this.setSaveStatus?.('saving');
      
      // Delete task labels first
      const { error: labelsError } = await supabase
        .from('task_labels')
        .delete()
        .eq('task_id', taskId);
      
      if (labelsError) throw labelsError;
      
      // Delete subtasks
      const { error: subtasksError } = await supabase
        .from('subtasks')
        .delete()
        .eq('task_id', taskId);
      
      if (subtasksError) throw subtasksError;
      
      // Delete the task itself
      const { error: taskError } = await supabase
        .from('tasks')
        .delete()
        .eq('id', taskId);
      
      if (taskError) throw taskError;
      
      this.setSaveStatus?.('saved');
      console.log('Task permanently deleted from database');
      
    } catch (error) {
      console.error('Failed to permanently delete task from database:', error);
      this.setSaveStatus?.('error');
      this.rollbackState(originalState);
      throw error;
    }
  };
}
