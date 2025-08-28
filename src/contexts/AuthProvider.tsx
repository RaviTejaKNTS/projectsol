import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

type Profile = { display_name?: string; avatar_url?: string } | null

interface AuthCtx {
  user: any | null
  profile: Profile | null
  inGuestMode: boolean
  loading: boolean
  error: string | null
  showAccountLinkingModal: boolean
  accountLinkingInfo: { email: string; provider: 'google' | 'email' } | null
  signInWithGoogle: () => Promise<void>
  signInWithEmail: (email: string) => Promise<void>
  signOut: () => Promise<void>
  updateProfile: (updates: { display_name?: string; avatar_url?: string }) => Promise<void>
  deleteAccount: () => Promise<void>
  linkGoogleAccount: () => Promise<void>
  linkEmailAccount: (email: string) => Promise<void>
  unlinkProvider: (provider: string) => Promise<void>
  linkAccountWithProvider: (provider: 'google' | 'email', email?: string) => Promise<void>
  closeAccountLinkingModal: () => void
}

const Ctx = createContext<AuthCtx | null>(null)

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<any | null>(null)
  const [profile, setProfile] = useState<Profile>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAccountLinkingModal, setShowAccountLinkingModal] = useState(false)
  const [accountLinkingInfo, setAccountLinkingInfo] = useState<{ email: string; provider: 'google' | 'email' } | null>(null)

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

  useEffect(() => {
    if (!user) { setProfile(null); return }
    let canceled = false
    const run = async () => {
      try {
        console.log('Loading profile for user:', user.id)
        const { data: prof, error: profileError } = await supabase.from('profiles').select('display_name, avatar_url').eq('id', user.id).maybeSingle()
        if (profileError) throw profileError
        if (canceled) return
        
        if (prof) {
          console.log('Profile found:', prof)
          setProfile(prof as Profile)
        } else {
          console.log('Profile not found, creating new profile for user:', user.id)
          // Create profile with explicit fields to ensure it works
          const profileData = {
            id: user.id,
            display_name: user.user_metadata?.name || user.email?.split('@')[0] || 'User',
            avatar_url: user.user_metadata?.avatar_url || null,
          }
          console.log('Creating profile with data:', profileData)
          
          const { data: newProfile, error: upsertError } = await supabase
            .from('profiles')
            .upsert(profileData, { onConflict: 'id' })
            .select('display_name, avatar_url')
            .single()
          
          if (upsertError) {
            console.error('Profile upsert error:', upsertError)
            throw upsertError
          }
          
          console.log('Profile created successfully:', newProfile)
          if (!canceled) setProfile(newProfile as Profile)
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
      
      // Sign in with Google - Supabase will handle account linking automatically
      const { error } = await supabase.auth.signInWithOAuth({ 
        provider: 'google', 
        options: { 
          scopes: 'email profile', 
          redirectTo: window.location.origin,
          // This ensures the user is redirected back to link accounts if needed
          queryParams: {
            access_type: 'offline',
            prompt: 'consent'
          }
        } 
      })
      
      if (error) {
        // Check if this is a duplicate account error
        if (error.message.includes('already exists') || error.message.includes('duplicate') || error.message.includes('email')) {
          // Extract email from error message or use a default
          const email = error.message.match(/email\s+([^\s]+)/i)?.[1] || 'this email';
          setAccountLinkingInfo({ email, provider: 'google' });
          setShowAccountLinkingModal(true);
        } else {
          throw error;
        }
      }
    } catch (e: any) {
      console.error('Google sign-in failed:', e)
      setError(e?.message || 'Failed to sign in with Google')
    }
  }
  
  
  const signInWithEmail = async (email: string) => {
    try {
      setError(null)
      
      // First, check if a user with this email already exists
      // We'll use a custom function to check this
      const { data: existingUser, error: checkError } = await supabase
        .rpc('get_user_by_email', { user_email: email });
      
      if (existingUser && !checkError) {
        // User exists, show account linking modal
        setAccountLinkingInfo({ email, provider: 'email' });
        setShowAccountLinkingModal(true);
        return;
      }
      
      // Send magic link - Supabase will automatically handle existing vs new users
      const { error } = await supabase.auth.signInWithOtp({ 
        email, 
        options: { 
          emailRedirectTo: window.location.origin
        } 
      })
      
      if (error) {
        // Check if this is a duplicate account error
        if (error.message.includes('already exists') || error.message.includes('duplicate')) {
          setAccountLinkingInfo({ email, provider: 'email' });
          setShowAccountLinkingModal(true);
        } else {
          throw error;
        }
      }
    } catch (e: any) {
      console.error('Email sign-in failed:', e)
      setError(e?.message || 'Failed to send magic link')
    }
  }
  
  const signOut = async () => {
    try {
      setError(null)
      
      // Clear local state immediately to provide immediate feedback
      setUser(null)
      setProfile(null)
      
      const { error } = await supabase.auth.signOut()
      if (error) {
        // Don't throw here - we've already cleared local state
        // Just log the error but consider the sign out successful locally
        setError(null) // Clear any error since we're handling it gracefully
      }
    } catch (e: any) {
      // Even if Supabase fails, we've cleared local state
      // This ensures the user appears signed out in the UI
      setError(null) // Don't show error to user for sign out
    }
  }

  const updateProfile = async (updates: { display_name?: string; avatar_url?: string }) => {
    try {
      setError(null)
      const { error } = await supabase.from('profiles').update(updates).eq('id', user?.id)
      if (error) throw error
      setProfile(prev => prev ? { ...prev, ...updates } : null)
    } catch (e: any) {
      console.error('Profile update failed:', e)
      setError(e?.message || 'Failed to update profile')
    }
  }

  const deleteAccount = async () => {
    try {
      setError(null)
      const { error: profileError } = await supabase.from('profiles').delete().eq('id', user?.id)
      if (profileError) throw profileError
      const { error: deleteError } = await supabase.auth.admin.deleteUser(user?.id!)
      if (deleteError) throw deleteError
      setUser(null)
      setProfile(null)
    } catch (e: any) {
      console.error('Account deletion failed:', e)
      setError(e?.message || 'Failed to delete account')
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


  const linkEmailAccount = async (email: string) => {
    try {
      setError(null)
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: window.location.origin
        }
      })
      if (error) throw error
    } catch (e: any) {
      console.error('Email account linking failed:', e)
      setError(e?.message || 'Failed to send magic link')
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

  const linkAccountWithProvider = async (provider: 'google' | 'email', email?: string) => {
    if (!user) throw new Error('Must be signed in to link account')
    try {
      setError(null)
      if (provider === 'google') {
        await linkGoogleAccount()
      } else if (provider === 'email') {
        if (!email) throw new Error('Email is required for email account linking')
        await linkEmailAccount(email)
      }
    } catch (e: any) {
      console.error(`Linking ${provider} account failed:`, e)
      setError(e?.message || `Failed to link ${provider} account`)
      throw e
    }
  }

  const closeAccountLinkingModal = () => {
    setShowAccountLinkingModal(false)
    setAccountLinkingInfo(null)
  }

  const value = useMemo(() => ({
    user,
    profile,
    inGuestMode: !user,
    loading,
    error,
    showAccountLinkingModal,
    accountLinkingInfo,
    signInWithGoogle,
    signInWithEmail,
    signOut,
    updateProfile,
    deleteAccount,
    linkGoogleAccount,
    linkEmailAccount,
    unlinkProvider,
    linkAccountWithProvider,
    closeAccountLinkingModal
  }), [user, profile, loading, error, showAccountLinkingModal, accountLinkingInfo, signInWithGoogle, signInWithEmail, signOut, updateProfile, deleteAccount, linkGoogleAccount, linkEmailAccount, unlinkProvider, linkAccountWithProvider, closeAccountLinkingModal])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export const useAuth = () => {
  const v = useContext(Ctx)
  if (!v) throw new Error('useAuth must be used within AuthProvider')
  return v
}
