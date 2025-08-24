import { supabase } from '../lib/supabaseClient';
import { createColumn } from './columns';
import { ensureProfileExists } from '../utils/profileUtils';
import type { Board, UUID } from '../types/db';

export async function getBoardsByUser(userId: UUID): Promise<Board[]> {
  const { data, error } = await supabase
    .from('boards')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function createBoard(userId: UUID, title = 'Board'): Promise<Board> {
  try {
    const { data: board, error: boardError } = await supabase
      .from('boards')
      .insert({ user_id: userId, title })
      .select('*')
      .single();
    
    if (boardError) {
      // If it's a foreign key constraint error, try to create the profile first
      if (boardError.message?.includes('foreign key') || boardError.message?.includes('violates')) {
        console.log('Board creation failed due to missing profile, creating profile first...');
        await ensureProfileExists(userId);
        
        // Retry board creation
        const { data: retryBoard, error: retryError } = await supabase
          .from('boards')
          .insert({ user_id: userId, title })
          .select('*')
          .single();
        
        if (retryError) throw retryError;
        
        // Create default columns
        const defaultColumns = [
          { title: 'To Do', position: 1 },
          { title: 'In Progress', position: 2 },
          { title: 'Done', position: 3 }
        ];
        
        for (const col of defaultColumns) {
          await createColumn(retryBoard.id, col.title, col.position);
        }
        
        return retryBoard;
      }
      throw boardError;
    }
    
    // Create default columns
    const defaultColumns = [
      { title: 'Backlog', position: 1 },
      { title: 'In Progress', position: 2 },
      { title: 'Review', position: 3 },
      { title: 'Done', position: 4 }
    ];
    
    for (const col of defaultColumns) {
      await createColumn(board.id, col.title, col.position);
    }
    
    return board;
  } catch (error) {
    console.error('createBoard failed:', error);
    throw error;
  }
}
