import { useState } from 'react';

export function InlineEmailSignIn({ onSend }: { onSend: (email: string) => Promise<void> }) {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const submit = async () => {
    setErr(null)
    try {
      if (!email.trim()) { setErr('Enter your email'); return }
      await onSend(email.trim())
      setSent(true)
    } catch (e: any) {
      setErr(e?.message || 'Failed to send link')
    }
  }

  return (
    <div className="space-y-2">
      {!sent ? (
        <>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@example.com"
            className="w-full rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 px-3 py-2.5 text-sm text-zinc-900 dark:text-zinc-100 outline-none focus:border-black/30 dark:focus:border-white/30"
          />
          <button
            onClick={submit}
            type="button"
            className="w-full rounded-2xl px-4 py-2.5 text-sm font-medium border border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/10 transition text-zinc-900 dark:text-zinc-100"
          >
            Send Magic Link
          </button>
        </>
      ) : (
        <p className="text-xs text-emerald-600 dark:text-emerald-400 text-center">Check your email for the sign-in link.</p>
      )}
      {err && <p className="text-xs text-red-600 text-center">{err}</p>}
    </div>
  )
}
