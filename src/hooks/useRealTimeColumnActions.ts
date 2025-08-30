// src/hooks/useRealTimeColumnActions.ts
import { createColumn, deleteColumn as dbDeleteColumn, reorderColumns, updateColumnTitle } from '../data/columns';
import { supabase } from '../lib/supabaseClient';
import type { UUID } from '../types/db';
import { getCurrentBoardId } from '../state/currentBoard';

export interface RealTimeColumnActionsProps {
  setSaveStatus?: (s: 'idle'|'saving'|'saved'|'error') => void;
  onRefresh?: () => Promise<void>;
}

export function useRealTimeColumnActions({ setSaveStatus, onRefresh }: RealTimeColumnActionsProps) {
  

  const startAddColumn = () => {
    // No state changes - just trigger UI state in parent component
    return { action: 'startAdd' };
  };

  const commitAddColumn = async (title: string) => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      throw new Error('Column title is required');
    }
    
    setSaveStatus?.('saving');
    
    try {
      const boardId = getCurrentBoardId();
      
      if (!boardId) {
        throw new Error('No board ID available for column creation');
      }

      // Get current column count for position
      const { data: existingColumns } = await supabase
        .from('board_columns')
        .select('position')
        .eq('board_id', boardId)
        .order('position', { ascending: false })
        .limit(1);
      
      const nextPosition = (existingColumns?.[0]?.position || 0) + 1;

      // Create column in database first
      const col = await createColumn(boardId as UUID, trimmedTitle, nextPosition);
      
      console.log('Column created successfully in database:', col);
      
      // Refresh data from server to update UI
      await onRefresh?.();
      setSaveStatus?.('saved');
      
      return col;
      
    } catch (error) {
      console.error('Failed to create column:', error);
      setSaveStatus?.('error');
      throw error;
    }
  };

  const cancelAddColumn = () => {
    // No state changes - just trigger UI state in parent component
    return { action: 'cancelAdd' };
  };

  const startRenameColumn = (id: string, currentTitle: string) => {
    // No state changes - just trigger UI state in parent component
    return { action: 'startRename', columnId: id, title: currentTitle };
  };

  const cancelRenameColumn = () => {
    // No state changes - just trigger UI state in parent component
    return { action: 'cancelRename' };
  };

  const commitRenameColumn = async (id: string, title: string) => {
    const trimmedTitle = title.trim();
    if (!id || !trimmedTitle) {
      throw new Error('Column ID and title are required');
    }

    setSaveStatus?.('saving');
    
    try {
      // Update column in database first
      await updateColumnTitle(id as UUID, trimmedTitle);
      
      console.log('Column updated successfully in database');
      
      // Refresh data from server to update UI
      await onRefresh?.();
      setSaveStatus?.('saved');
      
    } catch (error) {
      console.error('Failed to update column:', error);
      setSaveStatus?.('error');
      throw error;
    }
  };

  const deleteColumn = async (id: string) => {
    setSaveStatus?.('saving');
    
    try {
      // Delete column in database first
      await dbDeleteColumn(id as UUID);
      
      console.log('Column deleted successfully in database');
      
      // Refresh data from server to update UI
      await onRefresh?.();
      setSaveStatus?.('saved');
      
    } catch (error) {
      console.error('Failed to delete column:', error);
      setSaveStatus?.('error');
      throw error;
    }
  };

  const moveColumn = async (newOrder: string[]) => {
    setSaveStatus?.('saving');
    
    try {
      const boardId = getCurrentBoardId();
      if (!boardId) {
        throw new Error('No board ID available');
      }
      
      // Reorder columns in database first
      await reorderColumns(boardId as UUID, newOrder);
      
      console.log('Columns reordered successfully in database');
      
      // Refresh data from server to update UI
      await onRefresh?.();
      setSaveStatus?.('saved');
      
    } catch (error) {
      console.error('Failed to reorder columns:', error);
      setSaveStatus?.('error');
      throw error;
    }
  };

  return { 
    startAddColumn, 
    commitAddColumn, 
    cancelAddColumn, 
    startRenameColumn, 
    cancelRenameColumn, 
    commitRenameColumn, 
    deleteColumn, 
    moveColumn
  };
}
