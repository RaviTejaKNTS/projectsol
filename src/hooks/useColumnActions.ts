// src/hooks/useColumnActions.ts
import { createColumn, deleteColumn as dbDeleteColumn, reorderColumns, updateColumnTitle } from '../data/columns';
import { updateTaskPosition } from '../data/tasks';
import type { UUID } from '../types/db';
import { getCurrentBoardId } from '../state/currentBoard';
import { supabase } from '../lib/supabaseClient';

async function resolveBoardIdByColumn(columnId: string): Promise<string> {
  const { data, error } = await supabase.from('board_columns').select('board_id').eq('id', columnId).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('Column not found');
  return data.board_id as string;
}

export function useColumnActions(state: any, setState: (updater: (state: any) => any) => void, opts?: { setSaveStatus?: (s: 'idle'|'saving'|'saved'|'error') => void }) {
  const setSaveStatus = opts?.setSaveStatus;
  
  // Debug logging
  console.log('useColumnActions initialized with state:', { 
    hasState: !!state, 
    columnsCount: state?.columns?.length,
    currentBoardId: getCurrentBoardId()
  });

  const saving = async <T,>(fn: () => Promise<T>): Promise<T> => {
    setSaveStatus?.('saving');
    try { const out = await fn(); setSaveStatus?.('saved'); return out; } catch (e) { setSaveStatus?.('error'); throw e; }
  };

  const startAddColumn = () => setState((s: any) => ({ ...s, addingColumn: true, tempTitle: '' }));

  const commitAddColumn = async () => {
    const title = (state.tempTitle || '').trim();
    if (!title) return;
    // Try global board id first; if unknown, infer from first existing column
    let boardId = getCurrentBoardId();
    if (!boardId) {
      const firstCol = state.columns?.[0];
      if (firstCol) boardId = await resolveBoardIdByColumn(firstCol.id);
    }
    if (!boardId) throw new Error('Cannot determine board id to add column');
    const position = state.columns.length + 1;
    const col = await saving(() => createColumn(boardId as UUID, title, position));
    setState((s: any) => ({ ...s, columns: [...s.columns, { id: col.id, title: col.title, taskIds: [] }], addingColumn: false, tempTitle: '' }));
  };

  const cancelAddColumn = () => setState((s: any) => ({ ...s, addingColumn: false, tempTitle: '' }));

  const startRenameColumn = (id: string) => setState((s: any) => ({ ...s, renamingColumnId: id, tempTitle: s.columns.find((c: any) => c.id === id)?.title || '' }));

  const cancelRenameColumn = () => setState((s: any) => ({ ...s, renamingColumnId: null, tempTitle: '' }));

  const commitRenameColumn = async () => {
    const id = state.renamingColumnId;
    const title = (state.tempTitle || '').trim();
    if (!id || !title) return;
    await saving(() => updateColumnTitle(id as UUID, title));
    setState((s: any) => ({ ...s, columns: s.columns.map((c: any) => (c.id === id ? { ...c, title } : c)), renamingColumnId: null, tempTitle: '' }));
  };

  const deleteColumn = async (id: string) => {
    await saving(() => dbDeleteColumn(id as UUID));
    setState((s: any) => {
      const col = s.columns.find((c: any) => c.id === id);
      if (!col) return s;
      const tasks = { ...s.tasks } as any;
      col.taskIds.forEach((tid: string) => delete tasks[tid]);
      return { ...s, columns: s.columns.filter((c: any) => c.id !== id), tasks };
    });
  };

  const moveColumn = async (fromId: string, toId: string) => {
    setState((s: any) => {
      const fromIndex = s.columns.findIndex((c: any) => c.id === fromId);
      const toIndex = s.columns.findIndex((c: any) => c.id === toId);
      if (fromIndex === -1 || toIndex === -1) return s;
      const newColumns = [...s.columns];
      const [moved] = newColumns.splice(fromIndex, 1);
      newColumns.splice(toIndex, 0, moved);
      return { ...s, columns: newColumns };
    });
    const boardId = getCurrentBoardId();
    if (boardId) {
      const orderedIds = state.columns.map((c: any) => c.id);
      await saving(() => reorderColumns(boardId as UUID, orderedIds));
      
      // Update all task positions to maintain order
      for (const col of state.columns) {
        for (let i = 0; i < col.taskIds.length; i++) {
          await saving(() => updateTaskPosition(col.taskIds[i] as UUID, i + 1));
        }
      }
    }
  };

  return { startAddColumn, commitAddColumn, cancelAddColumn, startRenameColumn, cancelRenameColumn, commitRenameColumn, deleteColumn, moveColumn };
}
