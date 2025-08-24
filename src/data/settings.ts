import { supabase } from '../lib/supabaseClient';
import type { BoardSettings, UUID } from '../types/db';

export async function getBoardSettings(boardId: UUID): Promise<BoardSettings> {
  const { data, error } = await supabase
    .from('board_settings')
    .select('*')
    .eq('board_id', boardId)
    .single();
  if (error) throw error;
  return data as BoardSettings;
}

export async function updateBoardSettings(boardId: UUID, patch: Partial<BoardSettings>): Promise<void> {
  const { error } = await supabase
    .from('board_settings')
    .update(patch)
    .eq('board_id', boardId);
  if (error) throw error;
}

export function retentionKeyToInterval(key: '1hour'|'24hours'|'7days'|'30days'|'forever'): string {
  switch (key) {
    case '1hour': return '1 hour';
    case '24hours': return '24 hours';
    case '7days': return '7 days';
    case '30days': return '30 days';
    case 'forever': return '100 years';
  }
}

export function intervalToRetentionKey(interval: string): '1hour'|'24hours'|'7days'|'30days'|'forever' {
  const s = interval.toLowerCase();
  if (s.includes('100 year')) return 'forever';
  if (s.startsWith('1 hour') || s.startsWith('01:00')) return '1hour';
  if (s.startsWith('24 hours') || s.startsWith('1 day')) return '24hours';
  if (s.startsWith('7 days')) return '7days';
  if (s.startsWith('30 days')) return '30days';
  return '7days';
}

export async function getUserSettings(userId: UUID): Promise<any> {
  const { data, error } = await supabase
    .from('user_settings')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function updateUserSettings(userId: UUID, patch: any): Promise<void> {
  const { error } = await supabase
    .from('user_settings')
    .upsert({ user_id: userId, ...patch })
    .eq('user_id', userId);
  if (error) throw error;
}


