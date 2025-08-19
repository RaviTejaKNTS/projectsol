import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../contexts/AuthProvider';
import { defaultState } from '../utils/helpers';

export interface Board {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface BoardWithData extends Board {
  data?: any;
}

export function useBoardsManager() {
  const { user } = useAuth();
  const [boards, setBoards] = useState<Board[]>([]);
  const [currentBoard, setCurrentBoard] = useState<BoardWithData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load user's boards
  const loadBoards = useCallback(async () => {
    if (!user) {
      setBoards([]);
      setCurrentBoard(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data: boardsData, error: boardsError } = await supabase
        .from('boards')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });

      if (boardsError) throw boardsError;

      setBoards(boardsData || []);

      // If no boards exist, create a default one
      if (!boardsData || boardsData.length === 0) {
        await createDefaultBoard();
        return;
      }

      // Load the default board or first board
      const defaultBoard = boardsData.find(b => b.is_default) || boardsData[0];
      await loadBoardData(defaultBoard);

    } catch (err: any) {
      console.error('Failed to load boards:', err);
      setError(err.message || 'Failed to load boards');
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Create default board (migration from single board)
  const createDefaultBoard = useCallback(async () => {
    if (!user) return;

    try {
      // Check if user has existing app_state data to migrate
      const { data: existingState } = await supabase
        .from('app_state')
        .select('state')
        .eq('user_id', user.id)
        .maybeSingle();

      const boardData = existingState?.state || defaultState();

      // Create default board
      const { data: newBoard, error: boardError } = await supabase
        .from('boards')
        .insert({
          user_id: user.id,
          name: 'My Board',
          description: 'Your main task board',
          is_default: true
        })
        .select()
        .single();

      if (boardError) throw boardError;

      // Create board data
      const { error: dataError } = await supabase
        .from('board_data')
        .insert({
          board_id: newBoard.id,
          data: boardData,
          last_write_by: crypto.randomUUID()
        });

      if (dataError) throw dataError;

      // Update state
      setBoards([newBoard]);
      setCurrentBoard({ ...newBoard, data: boardData });

    } catch (err: any) {
      console.error('Failed to create default board:', err);
      setError(err.message || 'Failed to create default board');
    }
  }, [user]);

  // Load board data
  const loadBoardData = useCallback(async (board: Board) => {
    try {
      const { data: boardData, error } = await supabase
        .from('board_data')
        .select('data')
        .eq('board_id', board.id)
        .maybeSingle();

      if (error) throw error;

      const data = boardData?.data || defaultState();
      setCurrentBoard({ ...board, data });

    } catch (err: any) {
      console.error('Failed to load board data:', err);
      setError(err.message || 'Failed to load board data');
    }
  }, []);

  // Switch to a different board
  const switchBoard = useCallback(async (boardId: string) => {
    const board = boards.find(b => b.id === boardId);
    if (!board) return;

    await loadBoardData(board);
  }, [boards, loadBoardData]);

  // Create new board
  const createBoard = useCallback(async (name: string, description?: string) => {
    if (!user) return null;

    try {
      const { data: newBoard, error: boardError } = await supabase
        .from('boards')
        .insert({
          user_id: user.id,
          name: name.trim(),
          description: description?.trim() || null,
          is_default: false
        })
        .select()
        .single();

      if (boardError) throw boardError;

      // Create empty board data
      const { error: dataError } = await supabase
        .from('board_data')
        .insert({
          board_id: newBoard.id,
          data: defaultState(),
          last_write_by: crypto.randomUUID()
        });

      if (dataError) throw dataError;

      // Update local state
      setBoards(prev => [...prev, newBoard]);
      
      return newBoard;
    } catch (err: any) {
      console.error('Failed to create board:', err);
      setError(err.message || 'Failed to create board');
      return null;
    }
  }, [user]);

  // Update board metadata
  const updateBoard = useCallback(async (boardId: string, updates: Partial<Pick<Board, 'name' | 'description'>>) => {
    try {
      const { data: updatedBoard, error } = await supabase
        .from('boards')
        .update(updates)
        .eq('id', boardId)
        .select()
        .single();

      if (error) throw error;

      // Update local state
      setBoards(prev => prev.map(b => b.id === boardId ? updatedBoard : b));
      
      if (currentBoard?.id === boardId) {
        setCurrentBoard(prev => prev ? { ...prev, ...updatedBoard } : null);
      }

      return updatedBoard;
    } catch (err: any) {
      console.error('Failed to update board:', err);
      setError(err.message || 'Failed to update board');
      return null;
    }
  }, [currentBoard]);

  // Delete board
  const deleteBoard = useCallback(async (boardId: string) => {
    if (!user) return false;

    try {
      // Don't allow deleting the last board
      if (boards.length <= 1) {
        setError('Cannot delete your last board');
        return false;
      }

      // Don't allow deleting default board if it's the only default
      const boardToDelete = boards.find(b => b.id === boardId);
      if (boardToDelete?.is_default) {
        // Set another board as default first
        const otherBoard = boards.find(b => b.id !== boardId);
        if (otherBoard) {
          await supabase
            .from('boards')
            .update({ is_default: true })
            .eq('id', otherBoard.id);
        }
      }

      const { error } = await supabase
        .from('boards')
        .delete()
        .eq('id', boardId);

      if (error) throw error;

      // Update local state
      setBoards(prev => prev.filter(b => b.id !== boardId));

      // If we deleted the current board, switch to another one
      if (currentBoard?.id === boardId) {
        const remainingBoards = boards.filter(b => b.id !== boardId);
        if (remainingBoards.length > 0) {
          await loadBoardData(remainingBoards[0]);
        }
      }

      return true;
    } catch (err: any) {
      console.error('Failed to delete board:', err);
      setError(err.message || 'Failed to delete board');
      return false;
    }
  }, [user, boards, currentBoard, loadBoardData]);

  // Set board as default
  const setDefaultBoard = useCallback(async (boardId: string) => {
    if (!user) return false;

    try {
      // Remove default from all boards first
      await supabase
        .from('boards')
        .update({ is_default: false })
        .eq('user_id', user.id);

      // Set new default
      const { error } = await supabase
        .from('boards')
        .update({ is_default: true })
        .eq('id', boardId);

      if (error) throw error;

      // Update local state
      setBoards(prev => prev.map(b => ({ ...b, is_default: b.id === boardId })));

      return true;
    } catch (err: any) {
      console.error('Failed to set default board:', err);
      setError(err.message || 'Failed to set default board');
      return false;
    }
  }, [user]);

  // Initialize on user change
  useEffect(() => {
    loadBoards();
  }, [loadBoards]);

  return {
    boards,
    currentBoard,
    loading,
    error,
    switchBoard,
    createBoard,
    updateBoard,
    deleteBoard,
    setDefaultBoard,
    refreshBoards: loadBoards
  };
}