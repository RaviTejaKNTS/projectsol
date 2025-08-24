import { supabase } from '../lib/supabaseClient';
import type { Task, Subtask, UUID } from '../types/db';

export async function listTasksByBoard(boardId: UUID): Promise<Task[]> {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('board_id', boardId)
    .is('deleted_at', null)
    .order('position', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function listDeletedTasksByBoard(boardId: UUID): Promise<Task[]> {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('board_id', boardId)
    .not('deleted_at', 'is', null)
    .order('deleted_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function listSubtasksByTasks(taskIds: UUID[]): Promise<Subtask[]> {
  if (taskIds.length === 0) return [];
  const { data, error } = await supabase
    .from('subtasks')
    .select('*')
    .in('task_id', taskIds)
    .order('position', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function createTask(params: Omit<Task, 'id' | 'created_at' | 'updated_at'>): Promise<Task> {
  const { data, error } = await supabase
    .from('tasks')
    .insert(params)
    .select('*')
    .single();
  if (error) throw error;
  return data as Task;
}

export async function updateTask(id: UUID, patch: Partial<Omit<Task, 'id' | 'board_id'>>): Promise<void> {
  const { error } = await supabase
    .from('tasks')
    .update(patch)
    .eq('id', id);
  if (error) throw error;
}

export async function softDeleteTask(id: UUID): Promise<void> {
  const { error } = await supabase
    .from('tasks')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function restoreTask(id: UUID): Promise<void> {
  const { error } = await supabase
    .from('tasks')
    .update({ deleted_at: null })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteTaskHard(id: UUID): Promise<void> {
  const { error } = await supabase
    .from('tasks')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

export async function moveTask(taskId: UUID, toColumnId: UUID, toPosition: number): Promise<void> {
  const { error } = await supabase
    .from('tasks')
    .update({ column_id: toColumnId, position: toPosition })
    .eq('id', taskId);
  if (error) throw error;
}

export async function createSubtask(taskId: UUID, title: string, position: number): Promise<Subtask> {
  const { data, error } = await supabase
    .from('subtasks')
    .insert({ task_id: taskId, title, position })
    .select('*')
    .single();
  if (error) throw error;
  return data as Subtask;
}

export async function updateSubtask(id: UUID, patch: Partial<Subtask>): Promise<void> {
  const { error } = await supabase
    .from('subtasks')
    .update(patch)
    .eq('id', id);
  if (error) throw error;
}

export async function replaceSubtasks(taskId: UUID, items: { title: string; completed: boolean }[]): Promise<void> {
  let { error } = await supabase.from('subtasks').delete().eq('task_id', taskId);
  if (error) throw error;
  if (items.length === 0) return;
  const rows = items.map((it, idx) => ({ task_id: taskId, title: it.title, completed: it.completed, position: idx + 1 }));
  ({ error } = await supabase.from('subtasks').insert(rows));
  if (error) throw error;
}

export async function reorderSubtasks(_taskId: UUID, orderedIds: UUID[]): Promise<void> {
  // Update subtask positions for a specific task
  const updates = orderedIds.map((id, idx) => ({ id, position: idx + 1 }));
  const { error } = await supabase.from('subtasks').upsert(updates, { onConflict: 'id' });
  if (error) throw error;
}

export async function updateTaskPosition(taskId: UUID, position: number): Promise<void> {
  const { error } = await supabase
    .from('tasks')
    .update({ position, updated_at: new Date().toISOString() })
    .eq('id', taskId);
  if (error) throw error;
}

export async function updateTaskPositions(_columnId: UUID, taskIds: UUID[]): Promise<void> {
  // Update positions for all tasks in the column
  const updates = taskIds.map((taskId, index) => ({
    id: taskId,
    position: index + 1,
    updated_at: new Date().toISOString()
  }));

  const { error } = await supabase
    .from('tasks')
    .upsert(updates, { onConflict: 'id' });
  
  if (error) throw error;
}

export async function reorderTasksInColumn(columnId: UUID, taskIds: UUID[]): Promise<void> {
  // This function reorders tasks within a column
  await updateTaskPositions(columnId, taskIds);
}

export async function moveTaskBetweenColumns(
  taskId: UUID, 
  fromColumnId: UUID, 
  toColumnId: UUID, 
  toPosition: number
): Promise<void> {
  // First, get all tasks in the destination column
  const { data: destTasks, error: destError } = await supabase
    .from('tasks')
    .select('id, position')
    .eq('column_id', toColumnId)
    .is('deleted_at', null)
    .order('position', { ascending: true });
  
  if (destError) throw destError;

  // Remove the task from source column and update positions
  const { data: sourceTasks, error: sourceError } = await supabase
    .from('tasks')
    .select('id, position')
    .eq('column_id', fromColumnId)
    .is('deleted_at', null)
    .order('position', { ascending: true });
  
  if (sourceError) throw sourceError;

  // Update source column positions (remove the moved task)
  const sourceTaskIds = sourceTasks
    .filter(t => t.id !== taskId)
    .map((_, index) => ({ id: sourceTasks[index].id, position: index + 1, updated_at: new Date().toISOString() }));

  // Update destination column positions (insert the moved task)
  const destTaskIds = [...destTasks];
  destTaskIds.splice(toPosition, 0, { id: taskId, position: toPosition + 1 });
  
  const finalDestTaskIds = destTaskIds.map((_, index) => ({ 
    id: destTaskIds[index].id, 
    position: index + 1, 
    updated_at: new Date().toISOString() 
  }));

  // Update the moved task's column
  const { error: moveError } = await supabase
    .from('tasks')
    .update({ 
      column_id: toColumnId, 
      position: toPosition + 1,
      updated_at: new Date().toISOString()
    })
    .eq('id', taskId);
  
  if (moveError) throw moveError;

  // Update all positions in both columns
  await Promise.all([
    updateTaskPositions(fromColumnId, sourceTaskIds.map(t => t.id)),
    updateTaskPositions(toColumnId, finalDestTaskIds.map(t => t.id))
  ]);
}

export async function bulkUpdateTaskPositions(updates: Array<{ id: UUID; column_id: UUID; position: number }>): Promise<void> {
  // Update all task positions in a single operation
  const { error } = await supabase
    .from('tasks')
    .upsert(
      updates.map(update => ({
        ...update,
        updated_at: new Date().toISOString()
      })),
      { onConflict: 'id' }
    );
  
  if (error) throw error;
}

export async function syncTaskPositionsAfterMove(
  movedTaskId: UUID,
  fromColumnId: UUID,
  toColumnId: UUID,
  newPosition: number
): Promise<void> {
  console.log('syncTaskPositionsAfterMove called:', { movedTaskId, fromColumnId, toColumnId, newPosition });
  
  try {
    if (fromColumnId === toColumnId) {
      // Same column reordering
      const { data: tasks, error } = await supabase
        .from('tasks')
        .select('id, position')
        .eq('column_id', fromColumnId)
        .is('deleted_at', null)
        .order('position', { ascending: true });
      
      if (error) throw error;
      
      // Create new order array
      const taskIds = tasks.map(t => t.id);
      const currentIndex = taskIds.indexOf(movedTaskId);
      
      if (currentIndex === -1) {
        console.error('Task not found in column');
        return;
      }
      
      // Remove from current position and insert at new position
      taskIds.splice(currentIndex, 1);
      taskIds.splice(newPosition, 0, movedTaskId);
      
      // Update all positions
      const updates = taskIds.map((id, index) => ({
        id,
        column_id: fromColumnId,
        position: index + 1
      }));
      
      await bulkUpdateTaskPositions(updates);
      
    } else {
      // Moving between different columns - simpler approach
      
      // Step 1: Move the task to the new column
      const { error: moveError } = await supabase
        .from('tasks')
        .update({ 
          column_id: toColumnId, 
          position: newPosition + 1,
          updated_at: new Date().toISOString()
        })
        .eq('id', movedTaskId);
      
      if (moveError) throw moveError;
      
      // Step 2: Fix positions in source column
      const { data: sourceTasks, error: sourceError } = await supabase
        .from('tasks')
        .select('id')
        .eq('column_id', fromColumnId)
        .is('deleted_at', null)
        .order('position', { ascending: true });
      
      if (sourceError) throw sourceError;
      
      const sourceUpdates = sourceTasks.map((task, index) => ({
        id: task.id,
        column_id: fromColumnId,
        position: index + 1
      }));
      
      // Step 3: Fix positions in destination column
      const { data: destTasks, error: destError } = await supabase
        .from('tasks')
        .select('id')
        .eq('column_id', toColumnId)
        .is('deleted_at', null)
        .order('position', { ascending: true });
      
      if (destError) throw destError;
      
      const destUpdates = destTasks.map((task, index) => ({
        id: task.id,
        column_id: toColumnId,
        position: index + 1
      }));
      
      // Update all positions
      await Promise.all([
        sourceUpdates.length > 0 ? bulkUpdateTaskPositions(sourceUpdates) : Promise.resolve(),
        destUpdates.length > 0 ? bulkUpdateTaskPositions(destUpdates) : Promise.resolve()
      ]);
    }
    
    console.log('syncTaskPositionsAfterMove completed successfully');
    
  } catch (error) {
    console.error('Error in syncTaskPositionsAfterMove:', error);
    throw error;
  }
}


