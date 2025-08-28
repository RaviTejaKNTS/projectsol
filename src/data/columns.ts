import { supabase } from '../lib/supabaseClient';
import type { BoardColumn, UUID } from '../types/db';

export async function listColumns(boardId: UUID): Promise<BoardColumn[]> {
  const { data, error } = await supabase
    .from('board_columns')
    .select('*')
    .eq('board_id', boardId)
    .order('position', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function createColumn(boardId: UUID, title: string, position: number): Promise<BoardColumn> {
  const { data, error } = await supabase
    .from('board_columns')
    .insert({ board_id: boardId, title, position })
    .select('*')
    .single();
  if (error) throw error;
  return data as BoardColumn;
}

export async function updateColumnTitle(id: UUID, title: string): Promise<void> {
  const { error } = await supabase
    .from('board_columns')
    .update({ title })
    .eq('id', id);
  if (error) throw error;
}

export async function reorderColumns(_boardId: UUID, orderedIds: UUID[]): Promise<void> {
  // Update column positions in database
  const updates = orderedIds.map((id, idx) => ({ id, position: idx + 1 }));
  const { error } = await supabase.from('board_columns').upsert(updates, { onConflict: 'id' });
  if (error) throw error;
}

export async function deleteColumn(id: UUID): Promise<void> {
  const { error } = await supabase
    .from('board_columns')
    .delete()
    .eq('id', id);
  if (error) throw error;
}
