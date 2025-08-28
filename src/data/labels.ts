import { supabase } from '../lib/supabaseClient';
import type { Label, TaskLabel, UUID } from '../types/db';

export async function listLabels(boardId: UUID): Promise<Label[]> {
  const { data, error } = await supabase
    .from('labels')
    .select('*')
    .eq('board_id', boardId)
    .order('name', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function findLabelByName(boardId: UUID, name: string): Promise<Label | null> {
  const { data, error } = await supabase
    .from('labels')
    .select('*')
    .eq('board_id', boardId)
    .ilike('name', name)
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}

export async function createLabel(boardId: UUID, name: string, color?: string | null): Promise<Label> {
  const { data, error } = await supabase
    .from('labels')
    .insert({ board_id: boardId, name, color: color ?? null })
    .select('*')
    .single();
  if (error) throw error;
  return data as Label;
}

export async function ensureLabelIds(boardId: UUID, names: string[]): Promise<UUID[]> {
  console.log('ensureLabelIds called with:', { boardId, names });
  const ids: UUID[] = [];
  for (const raw of names) {
    const name = raw.trim().slice(0, 20);
    if (!name) continue;
    console.log('Processing label name:', name);
    
    const existing = await findLabelByName(boardId, name);
    if (existing) {
      console.log('Found existing label:', existing);
      ids.push(existing.id);
      continue;
    }
    
    console.log('Creating new label:', name);
    const created = await createLabel(boardId, name, null);
    console.log('Created label:', created);
    ids.push(created.id);
  }
  console.log('Returning label IDs:', ids);
  return ids;
}

export async function listTaskLabels(taskIds: UUID[]): Promise<TaskLabel[]> {
  if (taskIds.length === 0) return [];
  const { data, error } = await supabase
    .from('task_labels')
    .select('*')
    .in('task_id', taskIds);
  if (error) throw error;
  return data ?? [];
}

export async function setTaskLabels(taskId: UUID, labelIds: UUID[]): Promise<void> {
  console.log('setTaskLabels called with:', { taskId, labelIds });
  
  let { error } = await supabase.from('task_labels').delete().eq('task_id', taskId);
  if (error) {
    console.error('Error deleting existing task labels:', error);
    throw error;
  }
  console.log('Deleted existing task labels for task:', taskId);
  
  if (labelIds.length === 0) {
    console.log('No labels to insert, returning early');
    return;
  }
  
  const rows = labelIds.map((label_id) => ({ task_id: taskId, label_id }));
  console.log('Inserting task labels:', rows);
  
  ({ error } = await supabase.from('task_labels').insert(rows));
  if (error) {
    console.error('Error inserting task labels:', error);
    throw error;
  }
  
  console.log('Task labels inserted successfully');
}

export async function deleteLabelEverywhere(boardId: UUID, name: string): Promise<void> {
  const { data: label, error: e1 } = await supabase
    .from('labels')
    .select('*')
    .eq('board_id', boardId)
    .ilike('name', name)
    .maybeSingle();
  if (e1) throw e1;
  if (!label) return;
  const { error } = await supabase.from('labels').delete().eq('id', label.id);
  if (error) throw error;
}
