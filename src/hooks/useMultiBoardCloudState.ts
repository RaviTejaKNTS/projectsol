import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../contexts/AuthProvider';

/**
 * Multi-board cloud state sync
 * Handles syncing board data to the cloud with realtime updates
 */
export function useMultiBoardCloudState(
  boardId: string | null,
  state: any,
  setState: (updater: any) => void
) {
  const { user } = useAuth();
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  // Identify this browser tab to ignore our own realtime events
  const instanceId = useRef<string>(
    (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? (crypto as any).randomUUID() : null) ||
    Math.random().toString(36).slice(2)
  );

  // Refs for coordination
  const lastServerUpdatedAt = useRef<string | null>(null);
  const saveEnabled = useRef(false);
  const applyingRemote = useRef(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const deepEqual = (a: any, b: any) => {
    try { return JSON.stringify(a) === JSON.stringify(b) } catch { return false }
  };

  // Load board data when board changes
  useEffect(() => {
    if (!user || !boardId) {
      saveEnabled.current = false;
      lastServerUpdatedAt.current = null;
      return;
    }

    let canceled = false;
    const load = async () => {
      try {
        setStatus('saving');
        const { data, error } = await supabase
          .from('board_data')
          .select('data, updated_at')
          .eq('board_id', boardId)
          .maybeSingle();

        if (error) throw error;
        
        if (!canceled && data?.data && !deepEqual(data.data, state)) {
          applyingRemote.current = true;
          setState(data.data);
        }
        
        lastServerUpdatedAt.current = data?.updated_at ?? null;
        saveEnabled.current = true;
        setStatus('saved');
      } catch (e) {
        console.warn('board data load failed', e);
        if (!canceled) {
          setStatus('error');
          saveEnabled.current = true;
        }
      }
    };

    load();
    return () => { canceled = true };
  }, [user?.id, boardId, setState]);

  // Subscribe to realtime changes for the current board
  useEffect(() => {
    if (!user || !boardId) return;

    // Clean previous subscription
    channelRef.current?.unsubscribe();

    try {
      const ch = supabase
        .channel(`board_data_changes_${boardId}`)
        .on(
          'postgres_changes',
          { 
            schema: 'public', 
            table: 'board_data', 
            event: '*', 
            filter: `board_id=eq.${boardId}` 
          },
          (payload: any) => {
            const row = (payload.new ?? payload.record) as any;
            if (!row) return;

            // Ignore events from this tab
            if (row.last_write_by && row.last_write_by === instanceId.current) return;

            // Ignore older/equal updates
            if (lastServerUpdatedAt.current && new Date(row.updated_at) <= new Date(lastServerUpdatedAt.current)) return;

            lastServerUpdatedAt.current = row.updated_at;

            // Apply only if content actually differs
            if (!deepEqual(row.data, state)) {
              applyingRemote.current = true;
              setState(row.data);
            }
          }
        )
        .subscribe();

      channelRef.current = ch;
      return () => { ch.unsubscribe() };
    } catch (e) {
      console.warn('Failed to subscribe to board realtime changes:', e);
      return () => {};
    }
  }, [user?.id, boardId, state, setState]);

  // Autosave on state changes
  useEffect(() => {
    if (!user || !boardId || !saveEnabled.current) return;

    // If we're applying a remote change, skip saving it back
    if (applyingRemote.current) {
      applyingRemote.current = false;
      return;
    }

    let canceled = false;
    const save = async () => {
      try {
        setStatus('saving');
        const { data, error } = await supabase
          .from('board_data')
          .upsert(
            { 
              board_id: boardId, 
              data: state, 
              last_write_by: instanceId.current 
            },
            { onConflict: 'board_id' }
          )
          .select('updated_at')
          .single();

        if (error) throw error;
        
        if (!canceled) {
          lastServerUpdatedAt.current = data.updated_at;
          setStatus('saved');
        }
      } catch (e) {
        console.warn('board data save failed', e);
        if (!canceled) {
          setStatus('error');
          setTimeout(() => {
            if (!canceled) setStatus('idle');
          }, 5000);
        }
      }
    };

    const t = setTimeout(save, 250);
    return () => { canceled = true; clearTimeout(t) };
  }, [user?.id, boardId, state]);

  // Force sync function
  const forceSync = async () => {
    if (!user || !boardId || !saveEnabled.current) return;

    try {
      setStatus('saving');
      const { data, error } = await supabase
        .from('board_data')
        .upsert(
          { 
            board_id: boardId, 
            data: state, 
            last_write_by: instanceId.current 
          },
          { onConflict: 'board_id' }
        )
        .select('updated_at')
        .single();

      if (error) throw error;

      lastServerUpdatedAt.current = data.updated_at;
      setStatus('saved');
    } catch (e) {
      console.warn('force sync failed', e);
      setStatus('error');
      setTimeout(() => {
        setStatus('idle');
      }, 5000);
    }
  };

  return { status, forceSync };
}