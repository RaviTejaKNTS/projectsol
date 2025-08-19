import { InlineEmailSignIn } from "./InlineEmailSignIn";

interface AuthOverlayProps {
  loading: boolean;
  user: any;
  signInWithGoogle: () => void;
  signInWithEmail: (email: string) => Promise<void>;
}

export function AuthOverlay({ loading, user, signInWithGoogle, signInWithEmail }: AuthOverlayProps) {
  if (loading) {
    return <div className="absolute inset-0 z-[120] flex items-center justify-center" />;
  }

  if (user) {
    return null;
  }

  return (
    <div className="absolute inset-0 z-[120] bg-white/85 dark:bg-black/70 backdrop-blur-sm flex items-center justify-center">
      <div className="w-full max-w-sm rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 p-5 shadow-2xl">
        <div className="mb-3 text-center">
          <div className="mx-auto mb-2 h-12 w-12 rounded-full bg-black/5 dark:bg-white/10 flex items-center justify-center">🔐</div>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Sign in to use Project Sol</h2>
          <p className="text-xs text-zinc-600 dark:text-zinc-400">Create, sync and access your tasks anywhere.</p>
        </div>
        <div className="space-y-2">
          <button
            onClick={signInWithGoogle}
            type="button"
            className="w-full rounded-2xl px-4 py-2.5 text-sm font-medium border border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/10 transition text-left text-zinc-900 dark:text-zinc-100"
          >
            Continue with Google
          </button>
          <div className="relative my-2 text-center text-[10px] text-zinc-500 dark:text-zinc-400">
            <span className="bg-white dark:bg-zinc-900 px-2 relative z-10">or</span>
            <div className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-black/10 dark:bg-white/10"></div>
          </div>
          <InlineEmailSignIn onSend={signInWithEmail} />
        </div>
      </div>
    </div>
  );
}
