import React, { useEffect, useRef, useState } from 'react'
import { useAuth } from '../contexts/AuthProvider'

/**
 * ProfileButton
 * - Shows profile picture for signed-in users (opens sidebar on click)
 * - Shows guest sign-in dropdown for non-authenticated users
 */
interface ProfileButtonProps {
  onOpenProfile?: () => void;
}

export const ProfileButton: React.FC<ProfileButtonProps> = ({ onOpenProfile }) => {
  const { user, profile, signInWithGoogle, signInWithApple, signInWithEmail } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    const onOpenLogin = () => setMenuOpen(true);
    window.addEventListener('open-login', onOpenLogin as any);

    const onClick = (e: MouseEvent) => {
      if (!ref.current) return
      if (!ref.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('click', onClick)
    return () => { document.removeEventListener('click', onClick); window.removeEventListener('open-login', onOpenLogin as any); }
  }, [])

  const avatarUrl = profile?.avatar_url || user?.user_metadata?.picture
  const name = profile?.display_name || user?.user_metadata?.name || 'Guest'


  const sendMagic = async () => {
    setErr(null)
    try {
      if (!email.trim()) {
        setErr('Enter your email')
        return
      }
      await signInWithEmail(email.trim())
      setSent(true)
    } catch (e: any) {
      setErr(e?.message || 'Failed to send link')
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => user ? onOpenProfile?.() : setMenuOpen(v => !v)}
        title={user ? name : 'Sign in'}
        className="flex h-9 w-9 items-center justify-center rounded-full border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 shadow-sm hover:shadow transition"
      >
        {avatarUrl ? (
          <img src={avatarUrl} className="h-9 w-9 rounded-full object-cover" />
        ) : (
          <span className="text-sm">👤</span>
        )}
      </button>

      {menuOpen && !user && (
        <div
          className="absolute right-0 mt-2 w-72 sm:w-80 rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 shadow-xl"
          style={{ transformOrigin: 'top right' }}
        >
          {/* Pointer caret */}
          <div className="absolute -top-2 right-4 h-0 w-0 border-l-8 border-r-8 border-b-8 border-l-transparent border-r-transparent border-b-black/10"></div>
          <div className="absolute -top-[7px] right-4 h-0 w-0 border-l-7 border-r-7 border-b-7 border-l-transparent border-r-transparent border-b-white"></div>

          <div className="p-3 sm:p-4">
            <div className="mb-2">
              <div className="text-xs text-zinc-600 dark:text-zinc-400">You are using guest mode</div>
              <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Sign in to sync your boards and tasks</div>
            </div>

            <div className="space-y-2">
              <button
                onClick={signInWithGoogle}
                className="w-full rounded-2xl px-4 py-2.5 text-sm font-medium border border-black/10 hover:bg-black/5 transition text-left"
                type="button"
              >
                Continue with Google
              </button>
              <button
                onClick={signInWithApple}
                className="w-full rounded-2xl px-4 py-2.5 text-sm font-medium border border-black/10 hover:bg-black/5 transition text-left"
                type="button"
              >
                Continue with Apple
              </button>

              <div className="relative my-2 text-center text-[10px] text-black/50">
                <span className="bg-white px-2 relative z-10">or</span>
                <div className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-black/10"></div>
              </div>

              {!sent ? (
                <>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="w-full rounded-2xl border border-black/10 px-3 py-2.5 text-sm outline-none focus:border-black/30"
                  />
                  <button
                    onClick={sendMagic}
                    className="w-full rounded-2xl px-4 py-2.5 text-sm font-medium border border-black/10 hover:bg-black/5 transition"
                    type="button"
                  >
                    Send Magic Link
                  </button>
                </>
              ) : (
                <p className="text-xs text-green-600 text-center">Check your email for the sign-in link.</p>
              )}

              {err && <p className="text-xs text-red-600 text-center">{err}</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
