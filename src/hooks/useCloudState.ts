// src/hooks/useCloudState.ts
import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../contexts/AuthProvider'

/**
 * Cloud-only state sync with loop prevention.
 * - Loads from cloud first, then autosaves changes
 * - Realtime subscription for multi-device sync
 * - Avoids ping-pong by ignoring own writes and skipping save during remote apply
 */
export function useCloudState(
  state: any,
  setState: (updater: any) => void,
  _DEFAULT_SHORTCUTS: Record<string, string>,
  _STORAGE_KEY?: string
) {
  const { user } = useAuth()
  const [status, setStatus] = useState<'idle'|'saving'|'saved'|'error'>('idle')

  // Identify this browser tab to ignore our own realtime events
  const instanceId = useRef<string>(
    (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? (crypto as any).randomUUID() : null) ||
    Math.random().toString(36).slice(2)
  )

  // Refs for coordination
  const lastServerUpdatedAt = useRef<string | null>(null)
  const lastLocalUpdatedAt = useRef<string | null>(null)
  const saveEnabled = useRef(false)
  const applyingRemote = useRef(false)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  const deepEqual = (a: any, b: any) => {
    try { return JSON.stringify(a) === JSON.stringify(b) } catch { return false }
  }

  // Load from cloud on login
  useEffect(() => {
    if (!user) {
      saveEnabled.current = false
      lastServerUpdatedAt.current = null
      lastLocalUpdatedAt.current = null
      return
    }
    let canceled = false
    const load = async () => {
      try {
        setStatus('saving')
        const { data, error } = await supabase
          .from('app_state')
          .select('state, updated_at')
          .eq('user_id', user.id)
          .maybeSingle()
        if (error) throw error
        if (!canceled) {
          if (data?.state && !deepEqual(data.state, state)) {
            applyingRemote.current = true
            setState(data.state)
          }
          lastServerUpdatedAt.current = data?.updated_at ?? null
          saveEnabled.current = true
          setStatus('saved')
        }
      } catch (e) {
        console.warn('cloud load failed', e)
        if (!canceled) setStatus('error')
      }
    }
    load()
    return () => { canceled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  // Subscribe to realtime changes for multi-device sync
  useEffect(() => {
    if (!user) return
    // Clean previous
    channelRef.current?.unsubscribe()
    const ch = supabase
      .channel('app_state_changes')
      .on('postgres_changes', { schema: 'public', table: 'app_state', event: '*', filter: `user_id=eq.${user.id}` }, (payload: any) => {
        const row = (payload.new ?? payload.record) as any
        if (!row) return
        // Ignore events from this tab (requires last_write_by column)
        if (row.last_write_by && row.last_write_by === instanceId.current) return
        // Ignore older/equal updates
        if (lastServerUpdatedAt.current && new Date(row.updated_at) <= new Date(lastServerUpdatedAt.current)) return
        lastServerUpdatedAt.current = row.updated_at
        // Apply only if content actually differs
        if (!deepEqual(row.state, state)) {
          applyingRemote.current = true
          setState(row.state)
        }
      })
      .subscribe()
    channelRef.current = ch
    return () => { ch.unsubscribe() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, state])

  // Autosave on local state changes (after initial cloud load)
  useEffect(() => {
    if (!user || !saveEnabled.current) return

    // If we're applying a remote change, skip saving it back (prevents echo)
    if (applyingRemote.current) {
      applyingRemote.current = false
      return
    }

    let canceled = false
    const save = async () => {
      try {
        setStatus('saving')
        const { data, error } = await supabase
          .from('app_state')
          .upsert({ user_id: user.id, state, last_write_by: instanceId.current }, { onConflict: 'user_id' })
          .select('updated_at')
          .single()
        if (error) throw error
        if (!canceled) {
          lastServerUpdatedAt.current = data.updated_at
          lastLocalUpdatedAt.current = data.updated_at
          setStatus('saved')
        }
      } catch (e) {
        console.warn('cloud save failed', e)
        if (!canceled) setStatus('error')
      }
    }
    const t = setTimeout(save, 250) // slightly higher delay to coalesce rapid edits
    return () => { canceled = true; clearTimeout(t) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, state])

  return { status }
}
