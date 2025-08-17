import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

type Profile = { display_name?: string; avatar_url?: string } | null

interface AuthCtx {
  user: any | null
  profile: Profile | null
  inGuestMode: boolean
  loading: boolean
  error: string | null
  signInWithGoogle: () => Promise<void>
  signInWithApple: () => Promise<void>
  signInWithEmail: (email: string) => Promise<void>
  signOut: () => Promise<void>
  updateProfile: (updates: { display_name?: string; avatar_url?: string }) => Promise<void>
  deleteAccount: () => Promise<void>
  linkGoogleAccount: () => Promise<void>
  linkAppleAccount: () => Promise<void>
  linkEmailAccount: (email: string) => Promise<void>
  unlinkProvider: (provider: string) => Promise<void>
}

const Ctx = createContext<AuthCtx | null>(null)

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<any | null>(null)
  const [profile, setProfile] = useState<Profile>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // bootstrap session
  useEffect(() => {
    let mounted = true
    const init = async () => {
      try {
        setLoading(true)
        setError(null)
        const { data, error: sessionError } = await supabase.auth.getSession()
        if (sessionError) throw sessionError
        if (!mounted) return
        setUser(data.session?.user ?? null)
        setLoading(false)
      } catch (e: any) {
        console.error('Auth initialization failed:', e)
        if (mounted) {
          setError(e?.message || 'Failed to initialize authentication')
          setLoading(false)
        }
      }
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
      try {
        // try fetch
        const { data: prof, error: profileError } = await supabase.from('profiles').select('display_name, avatar_url').eq('id', user.id).maybeSingle()
        if (profileError) throw profileError
        if (canceled) return
        if (prof) {
          setProfile(prof as Profile)
        } else {
          // create minimal profile
          const { error: upsertError } = await supabase.from('profiles').upsert({
            id: user.id,
            display_name: user.user_metadata?.name || user.email?.split('@')[0] || 'User',
            avatar_url: user.user_metadata?.avatar_url || null,
          })
          if (upsertError) throw upsertError
          const { data: prof2, error: fetchError } = await supabase.from('profiles').select('display_name, avatar_url').eq('id', user.id).maybeSingle()
          if (fetchError) throw fetchError
          if (!canceled) setProfile((prof2 as any) ?? null)
        }
      } catch (e: any) {
        console.error('Profile fetch/creation failed:', e)
        if (!canceled) {
          setError(e?.message || 'Failed to load profile')
        }
      }
    }
    run()
    return () => { canceled = true }
  }, [user?.id])

  const signInWithGoogle = async () => {
    try {
      setError(null)
      await supabase.auth.signInWithOAuth({ provider: 'google', options: { scopes: 'email profile', redirectTo: window.location.origin } })
    } catch (e: any) {
      console.error('Google sign-in failed:', e)
      setError(e?.message || 'Failed to sign in with Google')
    }
  }
  
  const signInWithApple = async () => {
    try {
      setError(null)
      await supabase.auth.signInWithOAuth({ provider: 'apple', options: { scopes: 'name email', redirectTo: window.location.origin } })
    } catch (e: any) {
      console.error('Apple sign-in failed:', e)
      setError(e?.message || 'Failed to sign in with Apple')
    }
  }
  
  const signInWithEmail = async (email: string) => {
    try {
      setError(null)
      await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin } })
    } catch (e: any) {
      console.error('Email sign-in failed:', e)
      setError(e?.message || 'Failed to send magic link')
    }
  }
  
  const signOut = async () => { 
    try {
      setError(null)
      await supabase.auth.signOut() 
    } catch (e: any) {
      console.error('Sign out failed:', e)
      setError(e?.message || 'Failed to sign out')
    }
  }

  const updateProfile = async (updates: { display_name?: string; avatar_url?: string }) => {
    if (!user) throw new Error('Must be signed in to update profile')
    try {
      setError(null)
      const { error } = await supabase.from('profiles').update(updates).eq('id', user.id)
      if (error) throw error
      // Update local profile state
      setProfile(prev => ({ ...prev, ...updates }))
    } catch (e: any) {
      console.error('Profile update failed:', e)
      setError(e?.message || 'Failed to update profile')
      throw e
    }
  }

  const deleteAccount = async () => {
    if (!user) throw new Error('Must be signed in to delete account')
    try {
      setError(null)
      // Delete profile first
      await supabase.from('profiles').delete().eq('id', user.id)
      // Delete user account
      const { error } = await supabase.auth.admin.deleteUser(user.id)
      if (error) throw error
    } catch (e: any) {
      console.error('Account deletion failed:', e)
      setError(e?.message || 'Failed to delete account')
      throw e
    }
  }

  const linkGoogleAccount = async () => {
    if (!user) throw new Error('Must be signed in to link account')
    try {
      setError(null)
      const { error } = await supabase.auth.linkIdentity({ provider: 'google', options: { scopes: 'email profile', redirectTo: window.location.origin } })
      if (error) throw error
    } catch (e: any) {
      console.error('Google account linking failed:', e)
      setError(e?.message || 'Failed to link Google account')
      throw e
    }
  }

  const linkAppleAccount = async () => {
    if (!user) throw new Error('Must be signed in to link account')
    try {
      setError(null)
      const { error } = await supabase.auth.linkIdentity({ provider: 'apple', options: { scopes: 'name email', redirectTo: window.location.origin } })
      if (error) throw error
    } catch (e: any) {
      console.error('Apple account linking failed:', e)
      setError(e?.message || 'Failed to link Apple account')
      throw e
    }
  }

  const linkEmailAccount = async (email: string) => {
    if (!user) throw new Error('Must be signed in to link account')
    try {
      setError(null)
      // Send magic link to the email for account linking
      const { error } = await supabase.auth.signInWithOtp({ 
        email, 
        options: { 
          shouldCreateUser: false,
          emailRedirectTo: window.location.origin 
        }
      })
      if (error) throw error
      // Note: User will need to click the magic link to complete the linking
    } catch (e: any) {
      console.error('Email account linking failed:', e)
      setError(e?.message || 'Failed to link email account')
      throw e
    }
  }

  const unlinkProvider = async (provider: string) => {
    if (!user) throw new Error('Must be signed in to unlink account')
    try {
      setError(null)
      const identity = user.identities?.find((id: any) => id.provider === provider)
      if (!identity) throw new Error(`${provider} account not found`)
      
      const { error } = await supabase.auth.unlinkIdentity(identity)
      if (error) throw error
    } catch (e: any) {
      console.error(`${provider} account unlinking failed:`, e)
      setError(e?.message || `Failed to unlink ${provider} account`)
      throw e
    }
  }

  const value: AuthCtx = useMemo(() => ({
    user,
    profile,
    loading,
    error,
    inGuestMode: !user, // app is cloud-only; treat no-user as guest mode off
    signInWithGoogle,
    signInWithApple,
    signInWithEmail,
    signOut,
    updateProfile,
    deleteAccount,
    linkGoogleAccount,
    linkAppleAccount,
    linkEmailAccount,
    unlinkProvider,
  }), [user, profile, loading, error])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export const useAuth = () => {
  const v = useContext(Ctx)
  if (!v) throw new Error('useAuth must be used within AuthProvider')
  return v
}
