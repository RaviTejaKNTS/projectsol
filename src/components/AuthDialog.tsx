
/* src/components/AuthDialog.tsx */
import React, { useState } from 'react'
import { useAuth } from '../contexts/AuthProvider'

type Props = {
  open: boolean
  onClose: () => void
}

const Button: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = ({ children, ...rest }) => (
  <button
    {...rest}
    className="w-full rounded-2xl px-4 py-3 text-sm font-medium shadow-sm hover:shadow transition border border-black/10"
  >
    {children}
  </button>
)

export const AuthDialog: React.FC<Props> = ({ open, onClose }) => {
  const { signInWithGoogle, signInWithApple, signInWithEmail } = useAuth()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  if (!open) return null

  const sendLink = async () => {
    setErr(null)
    try {
      await signInWithEmail(email)
      setSent(true)
    } catch (e: any) {
      setErr(e.message ?? 'Failed to send link')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl">
        <div className="mb-4 text-center">
          <div className="mx-auto mb-2 h-12 w-12 rounded-full bg-black/5 flex items-center justify-center">
            <span className="text-xl">👤</span>
          </div>
          <h2 className="text-lg font-semibold">Sign In</h2>
          <p className="text-xs text-black/60">Continue to sync your boards and tasks across devices.</p>
        </div>

        <div className="space-y-2">
          <Button onClick={signInWithGoogle}>Continue with Google</Button>
          <Button onClick={signInWithApple}>Continue with Apple</Button>

          <div className="relative my-3 text-center text-xs text-black/50">
            <span className="bg-white px-2 relative z-10">or</span>
            <div className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-black/10"></div>
          </div>

          {!sent ? (
            <div className="space-y-2">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="w-full rounded-2xl border border-black/10 px-4 py-3 text-sm outline-none focus:border-black/30"
              />
              <Button onClick={sendLink}>Send Magic Link</Button>
            </div>
          ) : (
            <p className="text-xs text-center text-green-600">Check your email for the sign-in link.</p>
          )}

          {err && <p className="text-xs text-center text-red-600">{err}</p>}
        </div>

        <div className="mt-4 text-center">
          <button className="text-xs text-black/60 hover:underline" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}
