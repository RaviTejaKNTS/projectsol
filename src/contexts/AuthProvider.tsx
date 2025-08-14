import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

type Profile = { display_name?: string; avatar_url?: string } | null

type AuthCtx = {
  user: any | null
  profile: Profile
  inGuestMode: boolean
  loading: boolean
  signInWithGoogle: () => Promise<void>
  signInWithApple: () => Promise<void>
  signInWithEmail: (email: string) => Promise<void>
  signOut: () => Promise<void>
}

const Ctx = createContext<AuthCtx | null>(null)

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<any | null>(null)
  const [profile, setProfile] = useState<Profile>(null)
  const [loading, setLoading] = useState(true)

  // bootstrap session
  useEffect(() => {
    let mounted = true
    const init = async () => {
      setLoading(true)
      const { data } = await supabase.auth.getSession()
      if (!mounted) return
      setUser(data.session?.user ?? null)
      setLoading(false)
    }
    init()
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })
    return () => { sub?.subscription?.unsubscribe(); mounted = false }
  }, [])

  // profile upsert on sign-in
  useEffect(() => {
    if (!user) { setProfile(null); return }
    let canceled = false
    const run = async () => {
      // try fetch
      const { data: prof } = await supabase.from('profiles').select('display_name, avatar_url').eq('id', user.id).maybeSingle()
      if (canceled) return
      if (prof) {
        setProfile(prof as Profile)
      } else {
        // create minimal profile
        await supabase.from('profiles').upsert({
          id: user.id,
          display_name: user.user_metadata?.name || user.email?.split('@')[0] || 'User',
          avatar_url: user.user_metadata?.avatar_url || null,
        })
        const { data: prof2 } = await supabase.from('profiles').select('display_name, avatar_url').eq('id', user.id).maybeSingle()
        if (!canceled) setProfile((prof2 as any) ?? null)
      }
    }
    run()
    return () => { canceled = true }
  }, [user?.id])

  const signInWithGoogle = async () => {
    await supabase.auth.signInWithOAuth({ provider: 'google', options: { scopes: 'email profile', redirectTo: window.location.origin } })
  }
  const signInWithApple = async () => {
    await supabase.auth.signInWithOAuth({ provider: 'apple', options: { scopes: 'name email', redirectTo: window.location.origin } })
  }
  const signInWithEmail = async (email: string) => {
    await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin } })
  }
  const signOut = async () => { await supabase.auth.signOut() }

  const value: AuthCtx = useMemo(() => ({
    user,
    profile,
    loading,
    inGuestMode: !user, // app is cloud-only; treat no-user as guest mode off
    signInWithGoogle,
    signInWithApple,
    signInWithEmail,
    signOut,
  }), [user, profile, loading])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export const useAuth = () => {
  const v = useContext(Ctx)
  if (!v) throw new Error('useAuth must be used within AuthProvider')
  return v
}
