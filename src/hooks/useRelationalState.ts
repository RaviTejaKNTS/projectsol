import { useEffect, useMemo, useState } from 'react';
import { getBoardsByUser, createBoard, getBoardById } from '../data/boards';
import { listColumns, createColumn } from '../data/columns';
import { listTasksByBoard, listSubtasksByTasks, listDeletedTasksByBoard, createTask } from '../data/tasks';
import { listLabels, listTaskLabels } from '../data/labels';
import { getBoardSettings, getUserSettings, getCurrentBoardId, updateUserSettings } from '../data/settings';
import { toLegacyState } from '../data/adapter';
import { useCurrentBoard } from '../state/currentBoard';
import { defaultState } from '../utils/helpers';
import { supabase } from '../lib/supabaseClient';
import type { LegacyState, UUID, Board } from '../types/db';

export type RelationalLoad = {
  board: Board | null;
  state: LegacyState | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

export function useRelationalState(userId: UUID | null): RelationalLoad {
  const [board, setBoard] = useState<Board | null>(null);
  const [state, setState] = useState<LegacyState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Helper function to load board data
  const loadBoardData = async (board: Board, userId: UUID) => {
    console.log('Loading board data for board:', board.id, board.title);
    
    // Ensure the board ID is set in the store
    const currentStoreBoardId = useCurrentBoard.getState().boardId;
    if (currentStoreBoardId !== board.id) {
      console.log('Updating store board ID from', currentStoreBoardId, 'to', board.id);
      useCurrentBoard.getState().setCurrentBoardId(board.id);
    }
    
    const [cols, tasksOpen] = await Promise.all([
      listColumns(board.id),
      listTasksByBoard(board.id),
    ]);
    const [subs, labels, tlabels, cfg, tasksDeleted] = await Promise.all([
      listSubtasksByTasks(tasksOpen.map((t) => t.id)),
      listLabels(board.id),
      listTaskLabels(tasksOpen.map((t) => t.id)),
      getBoardSettings(board.id),
      listDeletedTasksByBoard(board.id),
    ]);

    // Load user settings
    const settings = await getUserSettings(userId);

    const legacy = toLegacyState(board, cols, tasksOpen, subs, labels, tlabels, tasksDeleted, cfg);
    
    // Merge settings into legacy state
    const stateWithSettings = {
      ...legacy,
      theme: settings?.theme || 'light',
      shortcuts: settings?.shortcuts || { newTask: "n", newColumn: "shift+n", search: "/", completeTask: "space" }
    };
    
    console.log('Setting legacy state for board:', board.id);
    setState(stateWithSettings);
  };

  const refresh = useMemo(() => async () => {
    if (!userId) {
      console.log('Skipping refresh - no userId');
      return;
    }
    
    setLoading(true);
    setError(null);
    try {
      // Get the current board ID from the database (user settings)
      const dbCurrentBoardId = await getCurrentBoardId(userId);
      console.log('Database current board ID:', dbCurrentBoardId);
      
      if (dbCurrentBoardId) {
        // Load the specific board from database
        console.log('Loading specific board from database:', dbCurrentBoardId);
        const specificBoard = await getBoardById(dbCurrentBoardId);
        if (specificBoard && specificBoard.user_id === userId) {
          console.log('Loading specific board data:', specificBoard);
          setBoard(specificBoard);
          // Update the Zustand store to match the database
          useCurrentBoard.getState().setCurrentBoardId(specificBoard.id);
          await loadBoardData(specificBoard, userId);
          return;
        } else {
          console.log('Database board not found or not accessible, clearing from settings');
          // Clear the invalid board ID from database
          await updateUserSettings(userId, { current_board_id: null });
          // Also clear the Zustand store
          useCurrentBoard.getState().setCurrentBoardId(null);
        }
      } else {
        console.log('No database current board ID found, will load first available board');
      }
      
      // Fall back to loading user's boards
      const boards = await getBoardsByUser(userId);
      if (boards.length === 0) {
        console.log('No boards found for user, creating default board...');
        try {
          // Create default board for new user
          console.log('Creating default board for user:', userId);
          const newBoard = await createBoard(userId, 'My Board');
          console.log('Board created successfully:', newBoard);
          console.log('Setting board state to:', newBoard);
          setBoard(newBoard);
          console.log('Setting current board ID to:', newBoard.id);
          useCurrentBoard.getState().setCurrentBoardId(newBoard.id);
          // Also save to database
          await updateUserSettings(userId, { current_board_id: newBoard.id });
          
          // Create default columns with positions 1..N
          const defaultColumns = [
            { title: 'Backlog', position: 1 },
            { title: 'In Progress', position: 2 },
            { title: 'Review', position: 3 },
            { title: 'Done', position: 4 }
          ];
          
          console.log('Creating default columns...');
          for (const col of defaultColumns) {
            await createColumn(newBoard.id, col.title, col.position);
          }
          console.log('Default columns created successfully');
          
          // Seed a couple of sample tasks to prove reads/writes work
          console.log('Creating sample tasks...');
          try {
            const sampleTasks = [
              {
                title: 'Welcome to Project Sol! 🎉',
                description: 'This is your first task. You can edit it, move it between columns, or delete it.',
                priority: 'Medium' as const,
                column_id: newBoard.id, // Will be updated to actual column ID
                position: 1
              },
              {
                title: 'Get started with your project',
                description: 'Create your own tasks and organize your workflow.',
                priority: 'High' as const,
                column_id: newBoard.id, // Will be updated to actual column ID
                position: 2
              }
            ];
            
            // Get the actual column IDs to assign tasks properly
            const createdColumns = await listColumns(newBoard.id);
            if (createdColumns.length > 0) {
              // Assign first task to Backlog column
              if (createdColumns[0]) {
                await createTask({
                  board_id: newBoard.id,
                  column_id: createdColumns[0].id,
                  title: sampleTasks[0].title,
                  description: sampleTasks[0].description,
                  priority: sampleTasks[0].priority,
                  due_at: null,
                  completed: false,
                  completed_at: null,
                  position: 1,
                  deleted_at: null
                });
              }
              
              // Assign second task to In Progress column
              if (createdColumns[1]) {
                await createTask({
                  board_id: newBoard.id,
                  column_id: createdColumns[1].id,
                  title: sampleTasks[1].title,
                  description: sampleTasks[1].description,
                  priority: sampleTasks[1].priority,
                  due_at: null,
                  completed: false,
                  completed_at: null,
                  position: 2,
                  deleted_at: null
                });
              }
            }
          } catch (taskError) {
            console.error('Failed to create sample tasks:', taskError);
          }
          
          await loadBoardData(newBoard, userId);
          return;
        } catch (boardError: any) {
          console.error('Failed to create default board:', boardError);
          // If board creation fails due to profile FK constraint, let's try to wait and retry
          if (boardError?.message?.includes('foreign key') || boardError?.message?.includes('violates')) {
            console.log('Board creation failed due to FK constraint, retrying in 1 second...');
            setTimeout(async () => {
              try {
                await refresh();
              } catch (retryError) {
                console.error('Retry failed:', retryError);
                setError('Failed to create board. Please refresh the page and try again.');
              }
            }, 1000);
            return;
          }
          throw boardError;
        }
      }
      
      // If no specific board ID, load the first board
      const b = boards[0];
      console.log('No database current board ID, loading first available board:', { board: b, boardId: b.id });
      setBoard(b);
      useCurrentBoard.getState().setCurrentBoardId(b.id);
      console.log('Current board ID set to first board:', b.id);
      // Also save to database
      await updateUserSettings(userId, { current_board_id: b.id });

      await loadBoardData(b, userId);
    } catch (e: any) {
      console.error('Failed to load board data:', e);
      setError(e?.message ?? 'Failed to load board data');
      // Fallback to default state
      setState(defaultState());
      // Clear the board ID if there was an error
      if (board) {
        console.log('Clearing board due to error');
        setBoard(null);
        useCurrentBoard.getState().setCurrentBoardId(null);
      }
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // Debug board changes
  useEffect(() => {
    console.log('Board state changed to:', board?.id, board?.title);
    if (board?.id) {
      // Ensure the store is in sync
      const storeBoardId = useCurrentBoard.getState().boardId;
      if (storeBoardId !== board.id) {
        console.log('Syncing store board ID from', storeBoardId, 'to', board.id);
        useCurrentBoard.getState().setCurrentBoardId(board.id);
      }
    } else if (board === null) {
      // Clear the store if board is null
      const storeBoardId = useCurrentBoard.getState().boardId;
      if (storeBoardId !== null) {
        console.log('Clearing store board ID from', storeBoardId, 'to null');
        useCurrentBoard.getState().setCurrentBoardId(null);
      }
    } else {
      console.log('Board is undefined, not syncing store');
    }
  }, [board?.id, board?.title]);

  // Watch for currentBoardId changes and refresh when it changes
  useEffect(() => {
    const checkBoardChange = () => {
      const currentBoardId = useCurrentBoard.getState().boardId;
      console.log('Checking board change - store boardId:', currentBoardId, 'local board:', board?.id);
      if (currentBoardId && (!board || board.id !== currentBoardId)) {
        console.log('Current board ID changed, refreshing data...');
        refresh();
      } else if (!currentBoardId && board) {
        console.log('Store board ID cleared, clearing local board');
        setBoard(null);
        setState(null);
      } else if (currentBoardId === board?.id) {
        console.log('Board IDs are in sync:', currentBoardId);
      } else {
        console.log('No board change detected');
      }
    };

    // Check immediately
    checkBoardChange();

    // Set up an interval to check for changes
    const interval = setInterval(checkBoardChange, 100);

    return () => clearInterval(interval);
  }, [board?.id, refresh]);

  // Add real-time subscriptions
  useEffect(() => {
    if (!board?.id) return;
    
    const subscription = supabase
      .channel(`board-${board.id}`)
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'tasks' },
        () => { refresh(); }
      )
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'board_columns' },
        () => { refresh(); }
      )
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'labels' },
        () => { refresh(); }
      )
      .subscribe();
      
    return () => {
      subscription.unsubscribe();
    };
  }, [board?.id, refresh]);

  useEffect(() => { 
    console.log('useRelationalState refresh effect triggered for userId:', userId);
    if (userId) {
      console.log('UserId ready, calling refresh');
      refresh(); 
    } else {
      console.log('Not ready to refresh yet - userId:', userId);
    }
  }, [refresh, userId]);

  return { board, state, loading, error, refresh };
}
