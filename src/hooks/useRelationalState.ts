import { useEffect, useMemo, useState } from 'react';
import { getBoardsByUser, createBoard } from '../data/boards';
import { listColumns, createColumn } from '../data/columns';
import { listTasksByBoard, listSubtasksByTasks, listDeletedTasksByBoard, createTask } from '../data/tasks';
import { listLabels, listTaskLabels } from '../data/labels';
import { getBoardSettings, getUserSettings } from '../data/settings';
import { toLegacyState } from '../data/adapter';
import { setCurrentBoardId } from '../state/currentBoard';
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

  const refresh = useMemo(() => async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
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
        setCurrentBoardId(newBoard.id);
          
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
                  position: 1,
                  deleted_at: null
                });
              }
            }
            console.log('Sample tasks created successfully');
          } catch (taskError) {
            console.warn('Failed to create sample tasks:', taskError);
            // Don't fail the entire bootstrap process for sample task creation
          }
          
          // Instead of recursive refresh, load the data directly
          console.log('Loading newly created board data...');
          
          const [cols, tasksOpen] = await Promise.all([
            listColumns(newBoard.id),
            listTasksByBoard(newBoard.id),
          ]);
          const [subs, labels, tlabels, cfg, tasksDeleted] = await Promise.all([
            listSubtasksByTasks(tasksOpen.map((t) => t.id)),
            listLabels(newBoard.id),
            listTaskLabels(tasksOpen.map((t) => t.id)),
            getBoardSettings(newBoard.id),
            listDeletedTasksByBoard(newBoard.id),
          ]);

          // Load user settings
          const settings = await getUserSettings(userId);

          const legacy = toLegacyState(newBoard, cols, tasksOpen, subs, labels, tlabels, tasksDeleted, cfg);
          
          // Merge settings into legacy state
          const stateWithSettings = {
            ...legacy,
            theme: settings?.theme || 'light',
            shortcuts: settings?.shortcuts || { newTask: "n", newColumn: "shift+n", search: "/", completeTask: "space" }
          };
          
          setState(stateWithSettings);
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
      const b = boards[0];
      console.log('Setting board:', { board: b, boardId: b.id });
      setBoard(b);
      setCurrentBoardId(b.id);
      console.log('Current board ID set to:', b.id);

      const [cols, tasksOpen] = await Promise.all([
        listColumns(b.id),
        listTasksByBoard(b.id),
      ]);
      const [subs, labels, tlabels, cfg, tasksDeleted] = await Promise.all([
        listSubtasksByTasks(tasksOpen.map((t) => t.id)),
        listLabels(b.id),
        listTaskLabels(tasksOpen.map((t) => t.id)),
        getBoardSettings(b.id),
        listDeletedTasksByBoard(b.id),
      ]);

      // Load user settings
      const settings = await getUserSettings(userId);

      const legacy = toLegacyState(b, cols, tasksOpen, subs, labels, tlabels, tasksDeleted, cfg);
      
      // Merge settings into legacy state
      const stateWithSettings = {
        ...legacy,
        theme: settings?.theme || 'light',
        shortcuts: settings?.shortcuts || { newTask: "n", newColumn: "shift+n", search: "/", completeTask: "space" }
      };
      
      setState(stateWithSettings);
    } catch (e: any) {
      console.error('Failed to load board data:', e);
      setError(e?.message ?? 'Failed to load board data');
      // Fallback to default state
      setState(defaultState());
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { 
    console.log('useRelationalState refresh effect triggered for userId:', userId);
    refresh(); 
  }, [refresh]);

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

  return { board, state, loading, error, refresh };
}
