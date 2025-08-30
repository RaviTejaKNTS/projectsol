// src/utils/realTimeTaskActions.ts
import { supabase } from '../lib/supabaseClient';
import { ensureLabelIds, setTaskLabels, deleteLabelEverywhere } from '../data/labels';
import { replaceSubtasks } from '../data/tasks';
import type { UUID } from '../types/db';
import confetti from 'canvas-confetti';
import { getCurrentBoardId } from '../state/currentBoard';
import { v4 as uuidv4 } from 'uuid';

export interface RealTimeTaskActionsProps {
  setSaveStatus?: (s: 'idle'|'saving'|'saved'|'error') => void;
  onRefresh?: () => Promise<void>;
  setLoading?: (operation: string, loading: boolean) => void;
}

export class RealTimeTaskActions {
  private setSaveStatus?: (s: 'idle'|'saving'|'saved'|'error') => void;
  private onRefresh?: () => Promise<void>;
  private setLoading?: (operation: string, loading: boolean) => void;

  constructor({ setSaveStatus, onRefresh, setLoading }: RealTimeTaskActionsProps) {
    this.setSaveStatus = setSaveStatus;
    this.onRefresh = onRefresh;
    this.setLoading = setLoading;
  }

  // Generate a real UUID for new tasks
  private generateTaskId(): string {
    return uuidv4();
  }

  // CREATE OR UPDATE TASK - Server-first approach
  createOrUpdateTask = async (payload: any, columnId: string | null, taskId: string | null = null, metadataOnly = false) => {
    console.log('createOrUpdateTask called with:', { payload, columnId, taskId, metadataOnly });
    
    this.setSaveStatus?.('saving');
    
    try {
      if (metadataOnly) {
        // Handle metadata-only updates (like adding new labels to board)
        if (payload.labels) {
          console.log('Processing metadata-only labels update:', payload.labels);
          
          const currentBoardId = getCurrentBoardId();
          if (currentBoardId && payload.labels.length > 0) {
            console.log('Creating new labels in database:', payload.labels);
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
          
          // Refresh data from server
          await this.onRefresh?.();
        }
        this.setSaveStatus?.('saved');
        return;
      }

      if (!taskId) {
        // CREATE NEW TASK
        if (!columnId) {
          this.setSaveStatus?.('error');
          throw new Error('Column ID is required for task creation');
        }
        
        const optimisticTaskId = this.generateTaskId();
        const boardId = getCurrentBoardId();
        
        if (!boardId) {
          this.setSaveStatus?.('error');
          throw new Error('No board ID available for task creation');
        }

        // First, get all existing tasks in the column and shift them down
        const { data: existingTasks, error: fetchError } = await supabase
          .from('tasks')
          .select('id, position')
          .eq('column_id', columnId)
          .is('deleted_at', null)
          .order('position', { ascending: true });
        
        if (fetchError) throw fetchError;
        
        // Shift all existing tasks down by 1 position
        for (const task of existingTasks || []) {
          const { error: updateError } = await supabase
            .from('tasks')
            .update({ position: task.position + 1 })
            .eq('id', task.id);
          
          if (updateError) throw updateError;
        }

        // Create task in database at position 1 (top)
        const { data, error } = await supabase.from('tasks').insert({
          id: optimisticTaskId,
          board_id: boardId,
          column_id: columnId,
          title: (payload.title || 'Untitled').trim(),
          description: payload.description?.trim() || '',
          priority: payload.priority || 'Medium',
          due_at: payload.dueDate || null,
          completed: false,
          completed_at: null,
          position: 1, // Always add new tasks at the top
          deleted_at: null,
        }).select('*').single();
        
        if (error) throw error;

        // Handle subtasks
        if (payload.subtasks && payload.subtasks.length > 0) {
          await replaceSubtasks(optimisticTaskId as UUID, payload.subtasks);
        }

        // Handle labels
        if (payload.labels && payload.labels.length > 0) {
          const labelIds = await ensureLabelIds(boardId as UUID, payload.labels);
          await setTaskLabels(optimisticTaskId as UUID, labelIds);
        }

        console.log('Task created successfully in database:', data);
        
        // Refresh data from server to update UI
        await this.onRefresh?.();
        this.setSaveStatus?.('saved');
        return optimisticTaskId;
      }

      // UPDATE EXISTING TASK
      // Update task in database first
      const { error } = await supabase.from('tasks').update({
        title: (payload.title || 'Untitled').trim(),
        description: payload.description?.trim() || '',
        priority: payload.priority || 'Medium',
        due_at: payload.dueDate || null,
        updated_at: new Date().toISOString()
      }).eq('id', taskId);
      
      if (error) throw error;

      // Handle subtasks
      if (payload.subtasks && payload.subtasks.length > 0) {
        await replaceSubtasks(taskId as UUID, payload.subtasks);
      }

      // Handle labels
      if (payload.labels && payload.labels.length > 0) {
        const boardId = getCurrentBoardId();
        if (boardId) {
          const labelIds = await ensureLabelIds(boardId as UUID, payload.labels);
          await setTaskLabels(taskId as UUID, labelIds);
        }
      }

      console.log('Task updated successfully in database');
      
      // Refresh data from server to update UI
      await this.onRefresh?.();
      this.setSaveStatus?.('saved');
      
    } catch (error) {
      console.error('Failed to create/update task:', error);
      this.setSaveStatus?.('error');
      throw error;
    }
  };

  // DELETE TASK - Server-first approach
  deleteTask = async (taskId: string) => {
    this.setSaveStatus?.('saving');
    
    try {
      const { error } = await supabase.from('tasks').update({ 
        deleted_at: new Date().toISOString() 
      }).eq('id', taskId);
      
      if (error) throw error;
      
      console.log('Task deleted successfully in database');
      
      // Refresh data from server to update UI
      await this.onRefresh?.();
      this.setSaveStatus?.('saved');
      
    } catch (error) {
      console.error('Failed to delete task:', error);
      this.setSaveStatus?.('error');
      throw error;
    }
  };

  // MOVE TASK - Server-first approach with proper position management
  moveTask = async (taskId: string, fromColumnId: string, toColumnId: string, position?: number) => {
    console.log('moveTask called with:', { taskId, fromColumnId, toColumnId, position });
    
    this.setSaveStatus?.('saving');
    
    try {
      if (fromColumnId === toColumnId) {
        // Same column reordering
        if (position !== undefined) {
          // Get all tasks in the column
          const { data: columnTasks, error: fetchError } = await supabase
            .from('tasks')
            .select('id, position')
            .eq('column_id', toColumnId)
            .is('deleted_at', null)
            .order('position', { ascending: true });
          
          if (fetchError) throw fetchError;
          
          // Remove the moving task from the list
          const tasksWithoutMoving = columnTasks?.filter(t => t.id !== taskId) || [];
          
          // Insert the moving task at the new position
          tasksWithoutMoving.splice(position, 0, { id: taskId, position: 0 });
          
          // Update all positions
          for (let i = 0; i < tasksWithoutMoving.length; i++) {
            const { error: updateError } = await supabase
              .from('tasks')
              .update({ position: i + 1 })
              .eq('id', tasksWithoutMoving[i].id);
            
            if (updateError) throw updateError;
          }
        }
      } else {
        // Cross-column move
        // First, get all tasks in target column
        const { data: targetTasks, error: targetError } = await supabase
          .from('tasks')
          .select('id, position')
          .eq('column_id', toColumnId)
          .is('deleted_at', null)
          .order('position', { ascending: true });
        
        if (targetError) throw targetError;
        
        // Calculate target position
        let targetPosition = position !== undefined ? position + 1 : 1; // Convert 0-based to 1-based
        
        // If no specific position, add to top
        if (position === undefined) {
          targetPosition = 1;
          
          // Shift all existing tasks in target column down
          for (const task of targetTasks || []) {
            const { error: shiftError } = await supabase
              .from('tasks')
              .update({ position: task.position + 1 })
              .eq('id', task.id);
            
            if (shiftError) throw shiftError;
          }
        } else {
          // Shift tasks at and after target position down
          for (const task of targetTasks || []) {
            if (task.position >= targetPosition) {
              const { error: shiftError } = await supabase
                .from('tasks')
                .update({ position: task.position + 1 })
                .eq('id', task.id);
              
              if (shiftError) throw shiftError;
            }
          }
        }
        
        // Move the task to new column and position
        const { error: moveError } = await supabase
          .from('tasks')
          .update({ 
            column_id: toColumnId, 
            position: targetPosition,
            updated_at: new Date().toISOString()
          })
          .eq('id', taskId);
        
        if (moveError) throw moveError;
        
        // Clean up positions in source column
        const { data: sourceTasks, error: sourceError } = await supabase
          .from('tasks')
          .select('id, position')
          .eq('column_id', fromColumnId)
          .is('deleted_at', null)
          .order('position', { ascending: true });
        
        if (sourceError) throw sourceError;
        
        // Reorder source column positions
        for (let i = 0; i < (sourceTasks?.length || 0); i++) {
          const { error: reorderError } = await supabase
            .from('tasks')
            .update({ position: i + 1 })
            .eq('id', sourceTasks![i].id);
          
          if (reorderError) throw reorderError;
        }
      }
      
      console.log('Task moved successfully in database');
      
      // Refresh data from server to update UI
      await this.onRefresh?.();
      this.setSaveStatus?.('saved');
      
    } catch (error) {
      console.error('Failed to move task:', error);
      this.setSaveStatus?.('error');
      throw error;
    }
  };

  // COMPLETE TASK - Server-first approach
  completeTask = async (taskId: string, currentCompleted: boolean) => {
    const next = !currentCompleted;
    
    this.setSaveStatus?.('saving');
    
    try {
      const { error } = await supabase.from('tasks').update({ 
        completed: next, 
        completed_at: next ? new Date().toISOString() : null 
      }).eq('id', taskId);
      
      if (error) throw error;
      
      // Show confetti for completion
      if (next) {
        confetti({ 
          particleCount: 60, 
          spread: 50, 
          origin: { y: 0.8 },
          colors: ['#10b981', '#059669', '#047857', '#065f46']
        });
      }
      
      console.log('Task completion updated successfully in database');
      
      // Refresh data from server to update UI
      await this.onRefresh?.();
      this.setSaveStatus?.('saved');
      
    } catch (error) {
      console.error('Failed to update task completion:', error);
      this.setSaveStatus?.('error');
      throw error;
    }
  };

  // RESTORE TASK - Server-first approach
  restoreTask = async (taskId: string) => {
    this.setSaveStatus?.('saving');
    
    try {
      const { error } = await supabase.from('tasks').update({ 
        completed: false, 
        completed_at: null 
      }).eq('id', taskId);
      
      if (error) throw error;
      
      console.log('Task restored successfully in database');
      
      // Refresh data from server to update UI
      await this.onRefresh?.();
      this.setSaveStatus?.('saved');
      
    } catch (error) {
      console.error('Failed to restore task:', error);
      this.setSaveStatus?.('error');
      throw error;
    }
  };

  // RESTORE DELETED TASK - Server-first approach
  restoreDeletedTask = async (taskId: string) => {
    this.setSaveStatus?.('saving');
    
    try {
      const { error } = await supabase.from('tasks').update({ 
        deleted_at: null 
      }).eq('id', taskId);
      
      if (error) throw error;
      
      console.log('Deleted task restored successfully in database');
      
      // Refresh data from server to update UI
      await this.onRefresh?.();
      this.setSaveStatus?.('saved');
      
    } catch (error) {
      console.error('Failed to restore deleted task:', error);
      this.setSaveStatus?.('error');
      throw error;
    }
  };

  // PERMANENTLY DELETE TASK - Server-first approach
  permanentlyDeleteTask = async (taskId: string) => {
    this.setSaveStatus?.('saving');
    
    try {
      const { error } = await supabase.from('tasks').delete().eq('id', taskId);
      
      if (error) throw error;
      
      console.log('Task permanently deleted successfully in database');
      
      // Refresh data from server to update UI
      await this.onRefresh?.();
      this.setSaveStatus?.('saved');
      
    } catch (error) {
      console.error('Failed to permanently delete task:', error);
      this.setSaveStatus?.('error');
      throw error;
    }
  };

  // UPDATE TASK LABELS - Server-first approach
  updateTaskLabels = async (taskId: string, labels: string[]) => {
    console.log('updateTaskLabels called with:', { taskId, labels });
    
    this.setSaveStatus?.('saving');
    
    try {
      const boardId = getCurrentBoardId();
      if (boardId) {
        if (labels.length > 0) {
          const labelIds = await ensureLabelIds(boardId as UUID, labels);
          await setTaskLabels(taskId as UUID, labelIds);
        } else {
          await setTaskLabels(taskId as UUID, []);
        }
      }
      
      console.log('Task labels updated successfully in database');
      
      // Refresh data from server to update UI
      await this.onRefresh?.();
      this.setSaveStatus?.('saved');
      
    } catch (error) {
      console.error('Failed to update task labels:', error);
      this.setSaveStatus?.('error');
      throw error;
    }
  };

  // DELETE LABEL - Server-first approach
  deleteLabel = async (name: string) => {
    this.setSaveStatus?.('saving');
    
    try {
      const boardId = getCurrentBoardId();
      if (boardId) {
        await deleteLabelEverywhere(boardId as UUID, name);
      }
      
      console.log('Label deleted successfully in database');
      
      // Refresh data from server to update UI
      await this.onRefresh?.();
      this.setSaveStatus?.('saved');
      
    } catch (error) {
      console.error('Failed to delete label:', error);
      this.setSaveStatus?.('error');
      throw error;
    }
  };

  // REORDER TASKS IN COLUMN - Server-first approach
  reorderTasksInColumn = async (columnId: string, taskIds: string[]) => {
    console.log('reorderTasksInColumn called with:', { columnId, taskIds });
    
    this.setSaveStatus?.('saving');
    
    try {
      // Update each task position individually
      for (let i = 0; i < taskIds.length; i++) {
        const { error } = await supabase
          .from('tasks')
          .update({ 
            position: i + 1,
            updated_at: new Date().toISOString()
          })
          .eq('id', taskIds[i])
          .eq('column_id', columnId);
        
        if (error) throw error;
      }
      
      console.log('Tasks reordered successfully in column');
      
      // Refresh data from server to update UI
      await this.onRefresh?.();
      this.setSaveStatus?.('saved');
      
    } catch (error) {
      console.error('Failed to reorder tasks in column:', error);
      this.setSaveStatus?.('error');
      throw error;
    }
  };
}
