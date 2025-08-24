// src/utils/taskActions.ts
import { supabase } from '../lib/supabaseClient';
import { ensureLabelIds, setTaskLabels, deleteLabelEverywhere } from '../data/labels';
import { replaceSubtasks, syncTaskPositionsAfterMove } from '../data/tasks';
import type { UUID } from '../types/db';
import confetti from 'canvas-confetti';
import { getCurrentBoardId } from '../state/currentBoard';

async function resolveBoardIdByColumn(columnId: string): Promise<string> {
  const { data, error } = await supabase.from('board_columns').select('board_id').eq('id', columnId).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('Column not found');
  return data.board_id as string;
}

async function resolveBoardIdByTask(taskId: string): Promise<string> {
  const { data, error } = await supabase.from('tasks').select('board_id').eq('id', taskId).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('Task not found');
  return data.board_id as string;
}

export interface TaskActionsProps {
  state: any;
  setState: (updater: (state: any) => any) => void;
  setSaveStatus?: (s: 'idle'|'saving'|'saved'|'error') => void;
}

export class TaskActions {
  private state: any;
  private setState: (updater: (state: any) => any) => void;
  private setSaveStatus?: (s: 'idle'|'saving'|'saved'|'error') => void;

  constructor({ state, setState, setSaveStatus }: TaskActionsProps) {
    this.state = state;
    this.setState = setState;
    this.setSaveStatus = setSaveStatus;
    
    // Debug logging
    console.log('TaskActions initialized with state:', { 
      hasState: !!state, 
      columnsCount: state?.columns?.length,
      tasksCount: state?.tasks ? Object.keys(state.tasks).length : 0,
      currentBoardId: getCurrentBoardId()
    });
  }

  private saving = async <T>(fn: () => Promise<T>): Promise<T> => {
    this.setSaveStatus?.('saving');
    try { const out = await fn(); this.setSaveStatus?.('saved'); return out; }
    catch (e) { this.setSaveStatus?.('error'); throw e; }
  };

  private async getBoardIdForCreate(columnId: string | null): Promise<string> {
    const globalId = getCurrentBoardId();
    if (globalId) return globalId;
    if (!columnId) throw new Error('Missing columnId');
    return resolveBoardIdByColumn(columnId);
  }

  private async getBoardIdForTask(taskId: string): Promise<string> {
    const globalId = getCurrentBoardId();
    if (globalId) return globalId;
    return resolveBoardIdByTask(taskId);
  }

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
        
        // Also save new labels to database for the current board
        const currentBoardId = getCurrentBoardId();
        console.log('Current board ID for label creation:', currentBoardId);
        if (currentBoardId && payload.labels.length > 0) {
          try {
            console.log('Saving new labels to database for board:', currentBoardId);
            // Get existing labels from state to find new ones
            const existingLabels = this.state.labels || [];
            const newLabels = payload.labels.filter((l: string) => !existingLabels.includes(l));
            
            if (newLabels.length > 0) {
              console.log('Creating new labels in database:', newLabels);
              // Create new labels in database
              for (const labelName of newLabels) {
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
      }
      return;
    }

    if (!taskId) {
      if (!columnId) return;
      const boardId = await this.getBoardIdForCreate(columnId);
      // New tasks always go to position 1 (top of column)
      const created = await this.saving(async () => {
        const { data, error } = await supabase.from('tasks').insert({
          board_id: boardId,
          column_id: columnId,
          title: (payload.title || 'Untitled').trim(),
          description: payload.description?.trim() || null,
          priority: payload.priority || 'Medium',
          due_at: payload.dueDate || null,
          completed: false,
          completed_at: null,
          position: 1, // Always position 1 for new tasks
          deleted_at: null,
        }).select('*').single();
        if (error) throw error;
        return data;
      });

      console.log('Creating task with labels:', { labels: payload.labels, boardId });
      
      await this.saving(() => replaceSubtasks(created.id as UUID, payload.subtasks || []));
      
      if (payload.labels && payload.labels.length > 0) {
        console.log('Processing labels for new task:', payload.labels);
        const labelIds = await this.saving(() => ensureLabelIds(boardId as UUID, payload.labels || []));
        console.log('Label IDs obtained:', labelIds);
        await this.saving(() => setTaskLabels(created.id as UUID, labelIds));
        console.log('Task labels set successfully');
      } else {
        console.log('No labels to process for new task');
      }

      this.setState((s: any) => ({
        ...s,
        labels: Array.from(new Set([...(s.labels || []), ...(payload.labels || [])])),
        tasks: {
          ...s.tasks,
          [created.id]: {
            id: created.id,
            title: created.title,
            description: created.description || undefined,
            labels: (payload.labels || []).slice().sort(),
            priority: created.priority,
            dueDate: created.due_at,
            createdAt: Date.parse(created.created_at) / 1000,
            updatedAt: Date.parse(created.updated_at) / 1000,
            subtasks: (payload.subtasks || []).map((st: any) => ({ id: st.id || '', title: st.title, completed: !!st.completed })),
            completed: false,
            completedAt: null,
          },
        },
        columns: s.columns.map((c: any) => c.id === columnId ? { ...c, taskIds: [created.id, ...c.taskIds] } : c),
      }));
      return;
    }

    // UPDATE - Preserve current position
    await this.saving(async () => {
      // Get current task to preserve position
      const { data: currentTask, error: fetchError } = await supabase
        .from('tasks')
        .select('position, column_id')
        .eq('id', taskId!)
        .single();
      
      if (fetchError) throw fetchError;
      
      const patch: any = {
        title: (payload.title || 'Untitled').trim(),
        description: payload.description?.trim() || null,
        priority: payload.priority || 'Medium',
        due_at: payload.dueDate || null,
        // Explicitly preserve the current position and column
        position: currentTask.position,
        column_id: currentTask.column_id,
      };
      
      console.log('Updating task while preserving position:', { 
        taskId: taskId, 
        currentPosition: currentTask.position, 
        currentColumn: currentTask.column_id 
      });
      
      const { error } = await supabase.from('tasks').update(patch).eq('id', taskId!);
      if (error) throw error;
    });

    const boardId = await this.getBoardIdForTask(taskId!);
    console.log('Updating task with labels:', { labels: payload.labels, boardId, taskId });
    
    await this.saving(() => replaceSubtasks(taskId as UUID, payload.subtasks || []));
    
    if (payload.labels && payload.labels.length > 0) {
      console.log('Processing labels for task update:', payload.labels);
      const labelIds = await this.saving(() => ensureLabelIds(boardId as UUID, payload.labels || []));
      console.log('Label IDs obtained for update:', labelIds);
      await this.saving(() => setTaskLabels(taskId as UUID, labelIds));
      console.log('Task labels updated successfully');
    } else {
      console.log('No labels to process for task update');
    }

    this.setState((s: any) => {
      // Log the current column structure before update
      const currentColumn = s.columns.find((c: any) => c.taskIds.includes(taskId!));
      console.log('State update - preserving task position:', {
        taskId: taskId!,
        currentColumnId: currentColumn?.id,
        currentPosition: currentColumn?.taskIds.indexOf(taskId!),
        taskTitle: payload.title
      });
      
      return {
        ...s,
        tasks: {
          ...s.tasks,
          [taskId!]: {
            ...s.tasks[taskId!],
            title: (payload.title || 'Untitled').trim(),
            description: payload.description?.trim() || '',
            labels: (payload.labels || []).slice().sort(),
            priority: payload.priority || 'Medium',
            dueDate: payload.dueDate || '',
            subtasks: (payload.subtasks || []).map((st: any) => ({ id: st.id || '', title: st.title, completed: !!st.completed })),
            updatedAt: Date.now(),
          },
        },
      };
    });
  };

  deleteTask = async (taskId: string) => {
    const { columnId, position } = (() => {
      for (const c of this.state.columns) {
        const idx = c.taskIds.indexOf(taskId);
        if (idx !== -1) return { columnId: c.id, position: idx };
      }
      return { columnId: this.state.columns[0]?.id, position: 0 };
    })();

    await this.saving(async () => {
      const { error } = await supabase.from('tasks').update({ deleted_at: new Date().toISOString() }).eq('id', taskId as any);
      if (error) throw error;
    });

    this.setState((s: any) => ({
      ...s,
      columns: s.columns.map((c: any) => (c.id === columnId ? { ...c, taskIds: c.taskIds.filter((id: string) => id !== taskId) } : c)),
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
  };

  restoreDeletedTask = async (taskId: string) => {
    await this.saving(async () => {
      const { error } = await supabase.from('tasks').update({ deleted_at: null }).eq('id', taskId as any);
      if (error) throw error;
    });

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
      return { ...s, columns: cols, deletedTasks: (s.deletedTasks || []).filter((t: any) => t.id !== taskId) };
    });
  };

  permanentlyDeleteTask = async (taskId: string) => {
    await this.saving(async () => {
      const { error } = await supabase.from('tasks').delete().eq('id', taskId as any);
      if (error) throw error;
    });
    this.setState((s: any) => ({ ...s, deletedTasks: (s.deletedTasks || []).filter((t: any) => t.id !== taskId) }));
  };

  moveTask = async (taskId: string, fromColumnId: string, toColumnId: string, position?: number) => {
    console.log('moveTask called with:', { taskId, fromColumnId, toColumnId, position });
    console.log('Current board ID:', getCurrentBoardId());
    
    const toPos = position ?? (this.state.columns.find((c: any) => c.id === toColumnId)?.taskIds.length ?? 0);
    
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
    
    try {
      // Use the new sync function for all task moves
      await this.saving(() => syncTaskPositionsAfterMove(
        taskId as UUID,
        fromColumnId as UUID,
        toColumnId as UUID,
        toPos
      ));
      
      console.log('Task move completed successfully');
      
    } catch (error) {
      console.error('Error moving task:', error);
      
      // Revert local state on error
      this.setState((s: any) => {
        const newColumns = s.columns.map((col: any) => {
          if (col.id === toColumnId) {
            return { ...col, taskIds: col.taskIds.filter((id: string) => id !== taskId) };
          }
          if (col.id === fromColumnId) {
            const ids = [...col.taskIds];
            ids.push(taskId); // Add back to original position (simplified)
            return { ...col, taskIds: ids };
          }
          return col;
        });
        return { ...s, columns: newColumns };
      });
      
      // Use fallback: simple database update
      try {
        console.log('Attempting fallback move...');
        await this.saving(async () => {
          const { error } = await supabase.from('tasks').update({ 
            column_id: toColumnId as any, 
            position: toPos + 1,
            updated_at: new Date().toISOString()
          }).eq('id', taskId as any);
          if (error) throw error;
        });
        
        // Re-apply the UI update
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
        
        console.log('Fallback move successful');
        
      } catch (fallbackError) {
        console.error('Fallback move also failed:', fallbackError);
        throw fallbackError;
      }
    }
  };

  completeTask = async (taskId: string) => {
    const t = this.state.tasks[taskId];
    const next = !t?.completed;
    await this.saving(async () => {
      const { error } = await supabase.from('tasks').update({ completed: next, completed_at: next ? new Date().toISOString() : null }).eq('id', taskId as any);
      if (error) throw error;
    });
    this.setState((s: any) => ({
      ...s,
      tasks: { ...s.tasks, [taskId]: { ...s.tasks[taskId], completed: next, completedAt: next ? Date.now() : null } },
    }));
    if (next) confetti({ particleCount: 60, spread: 50, origin: { y: 0.8 } });
  };

  restoreTask = async (taskId: string) => {
    await this.saving(async () => {
      const { error } = await supabase.from('tasks').update({ completed: false, completed_at: null }).eq('id', taskId as any);
      if (error) throw error;
    });
    this.setState((s: any) => ({ ...s, tasks: { ...s.tasks, [taskId]: { ...s.tasks[taskId], completed: false, completedAt: null } } }));
  };

  updateTaskLabels = async (taskId: string, labels: string[]) => {
    console.log('updateTaskLabels called with:', { taskId, labels });
    
    const boardId = await this.getBoardIdForTask(taskId);
    
    try {
      if (labels.length > 0) {
        console.log('Processing labels for task label update:', labels);
        const labelIds = await this.saving(() => ensureLabelIds(boardId as UUID, labels));
        console.log('Label IDs obtained for label update:', labelIds);
        await this.saving(() => setTaskLabels(taskId as UUID, labelIds));
        console.log('Task labels updated successfully');
      } else {
        console.log('Clearing all labels for task');
        await this.saving(() => setTaskLabels(taskId as UUID, []));
      }

      // Update local state
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
      
    } catch (error) {
      console.error('Error updating task labels:', error);
      throw error;
    }
  };

  deleteLabel = async (name: string) => {
    // Prefer global board id; otherwise fall back to the board of the first column
    let boardId = getCurrentBoardId();
    if (!boardId) {
      const firstCol = this.state.columns?.[0];
      if (firstCol) boardId = await resolveBoardIdByColumn(firstCol.id);
    }
    if (!boardId) throw new Error('Cannot determine board id for label deletion');
    await this.saving(() => deleteLabelEverywhere(boardId as UUID, name));
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
  };
}
