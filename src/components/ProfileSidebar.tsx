import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, User, Mail, Calendar, Trash2, Save, ArrowLeft, Link, Unlink, LogOut, RefreshCw, Plus, Grid3X3, Edit3, Star, MoreHorizontal } from 'lucide-react';
import { useAuth } from '../contexts/AuthProvider';
import { useBoardsManager } from '../hooks/useBoardsManager';

interface ProfileSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  saveStatus?: 'idle' | 'saving' | 'saved' | 'error';
  onForceSync?: () => void;
  theme: {
    surface: string;
    border: string;
    input: string;
    subtle: string;
    muted: string;
  };
}

export const ProfileSidebar: React.FC<ProfileSidebarProps> = ({ isOpen, onClose, saveStatus = 'idle', onForceSync, theme }) => {
  const { user, profile, signOut, updateProfile, deleteAccount, linkGoogleAccount, linkEmailAccount, unlinkProvider } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [currentPage, setCurrentPage] = useState<'profile' | 'delete' | 'connect-email' | 'boards' | 'create-board'>('profile');
  const [isLinking, setIsLinking] = useState<string | null>(null);
  const [emailToLink, setEmailToLink] = useState('');
  
  // Board management
  const { boards, currentBoard, loading: boardsLoading, createBoard, switchBoard, updateBoard, deleteBoard, setDefaultBoard } = useBoardsManager();
  const [newBoardName, setNewBoardName] = useState('');
  const [newBoardDescription, setNewBoardDescription] = useState('');
  const [editingBoard, setEditingBoard] = useState<string | null>(null);
  const [editBoardName, setEditBoardName] = useState('');
  const [editBoardDescription, setEditBoardDescription] = useState('');

  const getSyncIcon = () => {
    switch (saveStatus) {
      case 'idle':
        return <div className="h-2.5 w-2.5 rounded-full bg-zinc-400" />;
      case 'saving':
        return <div className="h-2.5 w-2.5 rounded-full bg-zinc-400 animate-pulse" />;
      case 'saved':
        return <div className="h-2.5 w-2.5 rounded-full bg-emerald-500" />;
      case 'error':
        return <div className="h-2.5 w-2.5 rounded-full bg-red-500" />;
      default:
        return <div className="h-2.5 w-2.5 rounded-full bg-zinc-400" />;
    }
  };

  const getSyncText = () => {
    switch (saveStatus) {
      case 'idle':
        return 'Offline';
      case 'saving':
        return 'Syncing...';
      case 'saved':
        return 'Synced';
      case 'error':
        return 'Sync error';
      default:
        return 'Offline';
    }
  };

  const isSyncClickable = saveStatus === 'idle' || saveStatus === 'error';

  const avatarUrl = profile?.avatar_url || user?.user_metadata?.picture;
  const currentName = profile?.display_name || user?.user_metadata?.name || 'User';
  const email = user?.email || 'No email';
  const createdAt = user?.created_at ? new Date(user.created_at).toLocaleDateString() : 'Unknown';

  useEffect(() => {
    if (isOpen) {
      setDisplayName(currentName);
      setIsEditing(false);
      setDeleteConfirmation('');
      setCurrentPage('profile');
      setIsLinking(null);
      setEmailToLink('');
      setNewBoardName('');
      setNewBoardDescription('');
      setEditingBoard(null);
    }
  }, [isOpen, currentName]);

  const connectedProviders = user?.identities?.map((identity: any) => identity.provider) || [];
  const hasGoogle = connectedProviders.includes('google');
  const hasEmail = connectedProviders.includes('email');

  const handleSaveName = async () => {
    if (!displayName.trim() || displayName === currentName) {
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    try {
      await updateProfile({ display_name: displayName.trim() });
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to update profile:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmation !== 'DELETE') return;
    
    setIsDeleting(true);
    try {
      await deleteAccount();
      onClose();
    } catch (error) {
      console.error('Failed to delete account:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleLinkAccount = async (provider: 'google') => {
    setIsLinking(provider);
    try {
      if (provider === 'google') {
        await linkGoogleAccount();
      }
    } catch (error) {
      console.error(`Failed to link ${provider} account:`, error);
    } finally {
      setIsLinking(null);
    }
  };

  const handleUnlinkAccount = async (provider: string) => {
    if (connectedProviders.length <= 1) {
      alert('Cannot disconnect your only sign-in method. Please connect another account first.');
      return;
    }
    
    if (!confirm(`Disconnect your ${provider} account?`)) return;
    
    try {
      await unlinkProvider(provider);
    } catch (error) {
      console.error(`Failed to unlink ${provider} account:`, error);
    }
  };

  const handleCreateBoard = async () => {
    if (!newBoardName.trim()) return;
    
    const board = await createBoard(newBoardName, newBoardDescription);
    if (board) {
      setNewBoardName('');
      setNewBoardDescription('');
      setCurrentPage('boards');
      // Optionally switch to the new board immediately
      await switchBoard(board.id);
    }
  };

  const handleEditBoard = (board: any) => {
    setEditingBoard(board.id);
    setEditBoardName(board.name);
    setEditBoardDescription(board.description || '');
  };

  const handleSaveEditBoard = async () => {
    if (!editingBoard || !editBoardName.trim()) return;
    
    await updateBoard(editingBoard, {
      name: editBoardName,
      description: editBoardDescription || undefined
    });
    
    setEditingBoard(null);
    setEditBoardName('');
    setEditBoardDescription('');
  };

  const handleDeleteBoard = async (boardId: string) => {
    if (!confirm('Are you sure you want to delete this board? This action cannot be undone.')) return;
    
    const success = await deleteBoard(boardId);
    if (success && currentPage === 'boards') {
      // Stay on boards page to see updated list
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm"
            onClick={onClose}
          />
          
          {/* Sidebar */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className={`fixed right-0 top-0 bottom-0 z-[101] w-full max-w-md ${theme.surface} border-l ${theme.border} shadow-2xl overflow-y-auto`}
          >
            {/* Header */}
            <div className="sticky top-0 z-10 flex items-center justify-between p-6 pb-4 bg-inherit border-b border-black/5 dark:border-white/5">
              <div className="flex items-center gap-3">
                {(currentPage === 'delete' || currentPage === 'connect-email') && (
                  <button
                    onClick={() => setCurrentPage('profile')}
                    className={`p-2 rounded-xl ${theme.subtle} transition-colors`}
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                )}
                <h2 className="text-lg font-semibold">
                  {currentPage === 'profile' ? 'Account Settings' : 
                   currentPage === 'delete' ? 'Delete Account' : 
                   'Connect Email Account'}
                </h2>
              </div>
              <button
                onClick={onClose}
                className={`p-2 rounded-xl ${theme.subtle} transition-colors`}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              {currentPage === 'profile' ? (
                <>
                  {/* Avatar & Basic Info */}
                  <div className="flex items-center gap-4">
                    <div className="h-16 w-16 rounded-full overflow-hidden border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/10 flex items-center justify-center">
                      {avatarUrl ? (
                        <img src={avatarUrl} className="h-16 w-16 object-cover" alt="Avatar" />
                      ) : (
                        <User className="h-8 w-8 text-zinc-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      {isEditing ? (
                        <div className="space-y-2">
                          <input
                            type="text"
                            value={displayName}
                            onChange={(e) => setDisplayName(e.target.value)}
                            className={`w-full rounded-xl ${theme.input} px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40`}
                            placeholder="Display name"
                            autoFocus
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={handleSaveName}
                              disabled={isSaving}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/25 disabled:opacity-50"
                            >
                              <Save className="h-3 w-3" />
                              {isSaving ? 'Saving...' : 'Save'}
                            </button>
                            <button
                              onClick={() => {
                                setIsEditing(false);
                                setDisplayName(currentName);
                              }}
                              className={`px-3 py-1.5 rounded-lg text-xs border ${theme.border} ${theme.subtle}`}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <button
                            onClick={() => setIsEditing(true)}
                            className="text-lg font-medium hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors text-left"
                          >
                            {currentName}
                          </button>
                          <p className={`text-sm ${theme.muted} truncate`}>Click to edit</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Account Details */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <Mail className={`h-4 w-4 ${theme.muted}`} />
                      <div>
                        <p className="text-sm font-medium">Email</p>
                        <p className={`text-xs ${theme.muted}`}>{email}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <Calendar className={`h-4 w-4 ${theme.muted}`} />
                      <div>
                        <p className="text-sm font-medium">Member since</p>
                        <p className={`text-xs ${theme.muted}`}>{createdAt}</p>
                      </div>
                    </div>
                  </div>

                  {/* Sync Status */}
                  <div className="flex items-center justify-between p-3 rounded-xl border border-black/10 dark:border-white/10">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center">
                        {getSyncIcon()}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{getSyncText()}</p>
                        <p className={`text-xs ${theme.muted}`}>
                          {saveStatus === 'saved' ? 'All changes saved to cloud' : 
                           saveStatus === 'saving' ? 'Saving changes...' :
                           saveStatus === 'error' ? 'Failed to sync - click to retry' :
                           'Click to sync with cloud'}
                        </p>
                      </div>
                    </div>
                    {isSyncClickable && onForceSync && (
                      <button
                        onClick={onForceSync}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/25 transition-colors"
                      >
                        <RefreshCw className="h-3 w-3" />
                        Sync Now
                      </button>
                    )}
                  </div>

                  {/* Connected Accounts */}
                  <div className="p-4 rounded-xl border border-black/10 dark:border-white/10">
                    <h3 className="text-sm font-medium mb-3">Connected Accounts</h3>
                    
                    <div className="space-y-3">
                      {/* Google Account */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-white flex items-center justify-center shadow-sm border border-gray-200">
                            <svg className="h-5 w-5" viewBox="0 0 24 24">
                              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                            </svg>
                          </div>
                          <div>
                            <p className="text-sm font-medium">Google</p>
                            <p className={`text-xs ${theme.muted}`}>
                              {hasGoogle ? 'Connected' : 'Not connected'}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => hasGoogle ? handleUnlinkAccount('google') : handleLinkAccount('google')}
                          disabled={isLinking === 'google'}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors ${
                            hasGoogle 
                              ? 'bg-red-500/15 border border-red-500/30 text-red-600 dark:text-red-400 hover:bg-red-500/25'
                              : 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/25'
                          } disabled:opacity-50`}
                        >
                          {isLinking === 'google' ? (
                            'Connecting...'
                          ) : hasGoogle ? (
                            <><Unlink className="h-3 w-3" /> Disconnect</>
                          ) : (
                            <><Link className="h-3 w-3" /> Connect</>
                          )}
                        </button>
                      </div>


                      {/* Email Account */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-blue-500/10 flex items-center justify-center">
                            <Mail className="h-5 w-5 text-blue-600" />
                          </div>
                          <div>
                            <p className="text-sm font-medium">Email</p>
                            <p className={`text-xs ${theme.muted}`}>
                              {hasEmail ? 'Connected' : 'Not connected'}
                            </p>
                          </div>
                        </div>
                        {hasEmail ? (
                          <button
                            onClick={() => handleUnlinkAccount('email')}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-red-500/15 border border-red-500/30 text-red-600 dark:text-red-400 hover:bg-red-500/25 transition-colors"
                          >
                            <Unlink className="h-3 w-3" />
                            Disconnect
                          </button>
                        ) : (
                          <button
                            onClick={() => setCurrentPage('connect-email')}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/25 transition-colors"
                          >
                            <Link className="h-3 w-3" />
                            Connect
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Boards Management */}
                  <div className="p-4 rounded-xl border border-black/10 dark:border-white/10">
                    <h3 className="text-sm font-medium mb-3">Boards</h3>
                    
                    <div className="space-y-3">
                      {/* Current Board Display */}
                      <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-emerald-500/10 flex items-center justify-center">
                            <Grid3X3 className="h-5 w-5 text-emerald-600" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                              {currentBoard?.name || 'Loading...'}
                            </p>
                            <p className={`text-xs ${theme.muted}`}>Current board</p>
                          </div>
                        </div>
                        {currentBoard?.is_default && (
                          <Star className="h-4 w-4 text-emerald-500 fill-current" />
                        )}
                      </div>

                      {/* Manage Boards Button */}
                      <button
                        onClick={() => setCurrentPage('boards')}
                        className="w-full flex items-center justify-between p-3 rounded-xl border border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <Grid3X3 className="h-4 w-4 text-blue-600" />
                          <span className="text-sm font-medium">Manage Boards</span>
                          <span className={`text-xs px-2 py-1 rounded-full ${theme.muted} bg-black/5 dark:bg-white/10`}>
                            {boards.length}
                          </span>
                        </div>
                        <ArrowLeft className="h-4 w-4 text-zinc-400 rotate-180" />
                      </button>

                      {/* Create New Board Button */}
                      <button
                        onClick={() => setCurrentPage('create-board')}
                        className="w-full flex items-center justify-center gap-2 p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                      >
                        <Plus className="h-4 w-4" />
                        <span className="text-sm font-medium">Create New Board</span>
                      </button>
                    </div>
                  </div>

                  {/* Sign Out */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-3 rounded-xl border border-black/10 dark:border-white/10">
                      <div className="flex items-center gap-3">
                        <LogOut className={`h-4 w-4 ${theme.muted}`} />
                        <div>
                          <p className="text-sm font-medium">Sign Out</p>
                          <p className={`text-xs ${theme.muted}`}>Sign out of your account</p>
                        </div>
                      </div>
                      <button
                        onClick={async () => {
                          try {
                            console.log('Sign out button clicked');
                            onClose(); // Close sidebar immediately for better UX
                            await signOut();
                            console.log('Sign out completed');
                          } catch (error) {
                            console.error('Sign out failed:', error);
                            // Don't show error to user - signOut method handles this gracefully
                          }
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                      >
                        Sign Out
                      </button>
                    </div>
                  </div>

                  {/* Delete Account */}
                  <div className="p-4 rounded-xl border border-red-500/20">
                    <h3 className="text-sm font-medium text-red-600 dark:text-red-400 mb-3">Danger Zone</h3>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-red-500/10 flex items-center justify-center">
                          <Trash2 className="h-5 w-5 text-red-500" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-red-600 dark:text-red-400">Delete Account</p>
                          <p className={`text-xs ${theme.muted}`}>
                            Permanently delete your account and all data
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => setCurrentPage('delete')}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-red-500/15 border border-red-500/30 text-red-600 dark:text-red-400 hover:bg-red-500/25 transition-colors"
                      >
                        <Trash2 className="h-3 w-3" />
                        Delete
                      </button>
                    </div>
                  </div>
                </>
              ) : currentPage === 'boards' ? (
                /* Boards Management Page */
                <div className="space-y-6">
                  <div className="text-center">
                    <div className="h-16 w-16 rounded-full bg-blue-500/10 flex items-center justify-center mx-auto mb-4">
                      <Grid3X3 className="h-8 w-8 text-blue-600" />
                    </div>
                    <h3 className="text-lg font-semibold text-blue-600 dark:text-blue-400 mb-2">My Boards</h3>
                    <p className={`text-sm ${theme.muted} mb-6`}>
                      Manage your task boards and switch between them.
                    </p>
                  </div>

                  {boardsLoading ? (
                    <div className="text-center py-8">
                      <div className="animate-spin h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto"></div>
                      <p className={`text-sm ${theme.muted} mt-2`}>Loading boards...</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {boards.map((board) => (
                        <div
                          key={board.id}
                          className={`p-4 rounded-xl border transition-all ${
                            currentBoard?.id === board.id
                              ? 'border-emerald-500/30 bg-emerald-500/5'
                              : 'border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5'
                          }`}
                        >
                          {editingBoard === board.id ? (
                            <div className="space-y-3">
                              <input
                                type="text"
                                value={editBoardName}
                                onChange={(e) => setEditBoardName(e.target.value)}
                                className={`w-full rounded-xl ${theme.input} px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40`}
                                placeholder="Board name"
                                autoFocus
                              />
                              <textarea
                                value={editBoardDescription}
                                onChange={(e) => setEditBoardDescription(e.target.value)}
                                className={`w-full rounded-xl ${theme.input} px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 resize-none h-20`}
                                placeholder="Board description (optional)"
                              />
                              <div className="flex gap-2">
                                <button
                                  onClick={handleSaveEditBoard}
                                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/25"
                                >
                                  <Save className="h-3 w-3" />
                                  Save
                                </button>
                                <button
                                  onClick={() => setEditingBoard(null)}
                                  className={`px-3 py-1.5 rounded-lg text-xs border ${theme.border} ${theme.subtle}`}
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3 flex-1 min-w-0">
                                <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                                  currentBoard?.id === board.id 
                                    ? 'bg-emerald-500/20' 
                                    : 'bg-blue-500/10'
                                }`}>
                                  <Grid3X3 className={`h-5 w-5 ${
                                    currentBoard?.id === board.id 
                                      ? 'text-emerald-600' 
                                      : 'text-blue-600'
                                  }`} />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <h4 className="font-medium text-sm truncate">{board.name}</h4>
                                    {board.is_default && (
                                      <Star className="h-3 w-3 text-amber-500 fill-current flex-shrink-0" />
                                    )}
                                    {currentBoard?.id === board.id && (
                                      <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex-shrink-0">
                                        Active
                                      </span>
                                    )}
                                  </div>
                                  {board.description && (
                                    <p className={`text-xs ${theme.muted} truncate`}>
                                      {board.description}
                                    </p>
                                  )}
                                  <p className={`text-xs ${theme.muted}`}>
                                    Created {new Date(board.created_at).toLocaleDateString()}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-1">
                                {currentBoard?.id !== board.id && (
                                  <button
                                    onClick={() => switchBoard(board.id)}
                                    className="px-3 py-1.5 rounded-lg text-xs bg-blue-500/15 border border-blue-500/30 text-blue-600 dark:text-blue-400 hover:bg-blue-500/25 transition-colors"
                                  >
                                    Switch
                                  </button>
                                )}
                                <div className="relative group">
                                  <button className={`p-1.5 rounded-lg ${theme.subtle} hover:bg-black/10 dark:hover:bg-white/10 transition-colors`}>
                                    <MoreHorizontal className="h-4 w-4" />
                                  </button>
                                  <div className="absolute right-0 top-full mt-1 w-32 bg-white dark:bg-zinc-800 border border-black/10 dark:border-white/10 rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                                    <button
                                      onClick={() => handleEditBoard(board)}
                                      className="w-full text-left px-3 py-2 text-xs hover:bg-black/5 dark:hover:bg-white/5 flex items-center gap-2"
                                    >
                                      <Edit3 className="h-3 w-3" />
                                      Edit
                                    </button>
                                    {!board.is_default && (
                                      <button
                                        onClick={() => setDefaultBoard(board.id)}
                                        className="w-full text-left px-3 py-2 text-xs hover:bg-black/5 dark:hover:bg-white/5 flex items-center gap-2"
                                      >
                                        <Star className="h-3 w-3" />
                                        Set Default
                                      </button>
                                    )}
                                    {boards.length > 1 && (
                                      <button
                                        onClick={() => handleDeleteBoard(board.id)}
                                        className="w-full text-left px-3 py-2 text-xs hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 flex items-center gap-2"
                                      >
                                        <Trash2 className="h-3 w-3" />
                                        Delete
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : currentPage === 'create-board' ? (
                /* Create New Board Page */
                <div className="space-y-6">
                  <div className="text-center">
                    <div className="h-16 w-16 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-4">
                      <Plus className="h-8 w-8 text-emerald-600" />
                    </div>
                    <h3 className="text-lg font-semibold text-emerald-600 dark:text-emerald-400 mb-2">Create New Board</h3>
                    <p className={`text-sm ${theme.muted} mb-6`}>
                      Create a new board to organize different projects or workflows.
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Board Name</label>
                      <input
                        type="text"
                        value={newBoardName}
                        onChange={(e) => setNewBoardName(e.target.value)}
                        placeholder="e.g., Work Projects, Personal Tasks"
                        className={`w-full rounded-xl ${theme.input} px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40`}
                        maxLength={50}
                        autoFocus
                      />
                      <p className={`text-xs ${theme.muted} mt-1`}>
                        {newBoardName.length}/50 characters
                      </p>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium mb-2">Description (Optional)</label>
                      <textarea
                        value={newBoardDescription}
                        onChange={(e) => setNewBoardDescription(e.target.value)}
                        placeholder="Brief description of what this board is for..."
                        className={`w-full rounded-xl ${theme.input} px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40 resize-none h-20`}
                        maxLength={200}
                      />
                      <p className={`text-xs ${theme.muted} mt-1`}>
                        {newBoardDescription.length}/200 characters
                      </p>
                    </div>
                    
                    <button
                      onClick={handleCreateBoard}
                      disabled={!newBoardName.trim()}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-medium bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <Plus className="h-4 w-4" />
                      Create Board
                    </button>
                  </div>
                </div>
              ) : currentPage === 'connect-email' ? (
                /* Connect Email Account Page */
                <div className="space-y-6">
                  <div className="text-center">
                    <div className="h-16 w-16 rounded-full bg-blue-500/10 flex items-center justify-center mx-auto mb-4">
                      <Mail className="h-8 w-8 text-blue-600" />
                    </div>
                    <h3 className="text-lg font-semibold text-blue-600 dark:text-blue-400 mb-2">Connect Email Account</h3>
                    <p className={`text-sm ${theme.muted} mb-6`}>
                      Enter your email address to link it to your account. You'll receive a magic link to complete the connection.
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Email Address</label>
                      <input
                        type="email"
                        value={emailToLink}
                        onChange={(e) => setEmailToLink(e.target.value)}
                        placeholder="email@example.com"
                        className={`w-full rounded-xl ${theme.input} px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40`}
                      />
                    </div>
                    
                    <button
                      onClick={async () => {
                        if (!emailToLink.trim()) return;
                        setIsLinking('email');
                        try {
                          await linkEmailAccount(emailToLink.trim());
                          setEmailToLink('');
                          setCurrentPage('profile');
                        } catch (error) {
                          console.error('Failed to link email account:', error);
                        } finally {
                          setIsLinking(null);
                        }
                      }}
                      disabled={!emailToLink.trim() || isLinking === 'email'}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-medium bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <Mail className="h-4 w-4" />
                      {isLinking === 'email' ? 'Sending Magic Link...' : 'Send Magic Link'}
                    </button>
                  </div>
                </div>
              ) : (
                /* Delete Account Page */
                <div className="space-y-6">
                  <div className="text-center">
                    <div className="h-16 w-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
                      <Trash2 className="h-8 w-8 text-red-500" />
                    </div>
                    <h3 className="text-lg font-semibold text-red-600 dark:text-red-400 mb-2">Delete Your Account</h3>
                    <p className={`text-sm ${theme.muted} mb-6`}>
                      This action cannot be undone. All your tasks, data, and account information will be permanently deleted.
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Type DELETE to confirm</label>
                      <input
                        type="text"
                        value={deleteConfirmation}
                        onChange={(e) => setDeleteConfirmation(e.target.value)}
                        placeholder="DELETE"
                        className={`w-full rounded-xl ${theme.input} px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/40`}
                      />
                    </div>
                    
                    <button
                      onClick={handleDeleteAccount}
                      disabled={deleteConfirmation !== 'DELETE' || isDeleting}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-medium bg-red-500 text-white hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                      {isDeleting ? 'Deleting Account...' : 'Permanently Delete Account'}
                    </button>
                  </div>
                </div>
              )}
              {(currentPage === 'boards' || currentPage === 'create-board') && (
                <button
                  onClick={() => setCurrentPage(currentPage === 'create-board' ? 'boards' : 'profile')}
                  className={`p-2 rounded-xl ${theme.subtle} transition-colors`}
                >
                  <ArrowLeft className="h-4 w-4" />
                 currentPage === 'connect-email' ? 'Connect Email Account' :
                 currentPage === 'boards' ? 'My Boards' :
                 'Create New Board'}
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
