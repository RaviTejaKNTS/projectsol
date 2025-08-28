import { useState } from 'react';
import { AlertCircle, Link, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthProvider';

interface AccountLinkingModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingEmail: string;
  newProvider: 'google' | 'email';
}

export function AccountLinkingModal({
  isOpen,
  onClose,
  existingEmail,
  newProvider
}: AccountLinkingModalProps) {
  const [isLinking, setIsLinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { linkAccountWithProvider } = useAuth();

  if (!isOpen) return null;

  const handleLinkAccount = async () => {
    try {
      setIsLinking(true);
      setError(null);
      
      if (newProvider === 'email') {
        await linkAccountWithProvider('email', existingEmail);
      } else {
        await linkAccountWithProvider('google');
      }
      
      onClose();
    } catch (e: any) {
      setError(e?.message || 'Failed to link account');
    } finally {
      setIsLinking(false);
    }
  };

  const handleSignInExisting = () => {
    // Redirect to sign in with existing account
    window.location.href = '/auth/signin';
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 max-w-md w-full mx-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Account Already Exists</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl">
            <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-amber-800 dark:text-amber-200">
              An account with the email <strong>{existingEmail}</strong> already exists.
              You can either link this new sign-in method to your existing account or sign in to your existing account.
            </div>
          </div>

          <div className="space-y-3">
            <button
              onClick={handleLinkAccount}
              disabled={isLinking}
              className="w-full flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-300 text-white px-4 py-2 rounded-xl font-medium transition-colors"
            >
              <Link className="h-4 w-4" />
              {isLinking ? 'Linking...' : `Link ${newProvider === 'google' ? 'Google' : 'Email'} Account`}
            </button>

            <button
              onClick={handleSignInExisting}
              className="w-full bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-900 dark:text-zinc-100 px-4 py-2 rounded-xl font-medium transition-colors"
            >
              Sign In to Existing Account
            </button>
          </div>

          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
              <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
