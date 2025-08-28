import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, User, Mail, Calendar, Trash2, Save, ArrowLeft, Link, Unlink, LogOut, RefreshCw, Sun, Moon, Settings, ChevronRight, Upload, Download, Plus, Kanban } from 'lucide-react';
import { useAuth } from '../contexts/AuthProvider';

function ShortcutInput({ value, onChange, theme }: any) {
  return (
    <input
      readOnly
      value={value}
      onKeyDown={(e) => {
        e.preventDefault();
        const combo = serializeCombo(e.nativeEvent as any);
        onChange(combo);
      }}
      className={`w-32 text-xs px-2 py-1 rounded-xl border ${theme.border} ${theme.surface}`}
    />
  );
}

function serializeCombo(e: { key: string; altKey: boolean; shiftKey: boolean; ctrlKey: boolean; metaKey: boolean }) {
  const parts: string[] = [];
  if (e.altKey) parts.push("alt");
  if (e.shiftKey) parts.push("shift");
  if (e.ctrlKey || e.metaKey) parts.push("ctrl");
  parts.push(e.key.toLowerCase());
  return parts.join("+");
}

interface ProfileSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  saveStatus?: 'idle' | 'saving' | 'saved' | 'error';
  onForceSync?: () => void;
  onToggleTheme: () => void;
  isDark: boolean;
  shortcuts: any;
  onChangeShortcut: (key: string, value: string) => void;
  onExport: () => void;
  onImport: (file: File) => void;
  onCreateBoard?: (name: string) => Promise<void>;
  onSwitchBoard?: (boardId: string) => void;
  currentBoardId?: string | null;
  userBoards?: Array<{ id: string; title: string }>;
  isCreatingBoard?: boolean;
  theme: {
    surface: string;
    border: string;
    input: string;
    subtle: string;
    muted: string;
  };
}

export const ProfileSidebar: React.FC<ProfileSidebarProps> = ({ 
  isOpen, 
  onClose, 
  saveStatus = 'idle', 
  onForceSync, 
  onToggleTheme,
  isDark,
  shortcuts,
  onChangeShortcut,
  onExport,
  onImport,
  onCreateBoard,
  onSwitchBoard,
  currentBoardId,
  userBoards = [],
  isCreatingBoard,
  theme 
}) => {
  const { user, profile, signOut, updateProfile, deleteAccount, linkGoogleAccount, linkEmailAccount, unlinkProvider } = useAuth();
  
  // Debug logging for board switching
  console.log('ProfileSidebar render - currentBoardId:', currentBoardId);
  console.log('ProfileSidebar render - userBoards:', userBoards);
  
  const [displayName, setDisplayName] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [currentPage, setCurrentPage] = useState<'profile' | 'delete' | 'connect-email' | 'create-board'>('profile');
  const [isLinking, setIsLinking] = useState<string | null>(null);
  const [emailToLink, setEmailToLink] = useState('');
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [newBoardName, setNewBoardName] = useState('');
  const fileRef = useRef<HTMLInputElement | null>(null);

  const shortcutItems = [
    { key: "newTask", label: "New task" },
    { key: "newColumn", label: "New list/column" },
    { key: "search", label: "Focus search" },
    { key: "toggleFilters", label: "Toggle filters panel" },
    { key: "moveTaskUp", label: "Move task within column ↑" },
    { key: "moveTaskDown", label: "Move task within column ↓" },
    { key: "moveTaskLeft", label: "Move task across columns ←" },
    { key: "deleteTask", label: "Delete task" },
    { key: "completeTask", label: "Mark completed" },
    { key: "priority1", label: "Set priority Urgent" },
    { key: "priority2", label: "Set priority High" },
    { key: "priority3", label: "Set priority Medium" },
    { key: "priority4", label: "Set priority Low" },
    { key: "setDueDate", label: "Set due date" },
  ];

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

  const handleLinkAccount = async (provider: string) => {
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
    setIsLinking(provider);
    try {
      await unlinkProvider(provider);
    } catch (error) {
      console.error(`Failed to unlink ${provider} account:`, error);
    } finally {
      setIsLinking(null);
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
            <div className="flex items-center justify-between p-6 border-b border-black/10 dark:border-white/10">
              <div className="flex items-center gap-3">
                {currentPage !== 'profile' && (
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
                   currentPage === 'create-board' ? 'Create New Board' :
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
                          {saveStatus === 'saved' ? 'All changes saved' : 
                           saveStatus === 'saving' ? 'Saving changes...' :
                           saveStatus === 'error' ? 'Failed to sync - click to retry' :
                           'Click to sync'}
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

                  {/* Appearance Settings */}
                  <div className="p-4 rounded-xl border border-black/10 dark:border-white/10">
                    <h3 className="text-sm font-medium mb-3">Appearance</h3>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-amber-500/10 flex items-center justify-center">
                          {isDark ? <Sun className="h-5 w-5 text-amber-600" /> : <Moon className="h-5 w-5 text-slate-600" />}
                        </div>
                        <div>
                          <p className="text-sm font-medium">Theme</p>
                          <p className={`text-xs ${theme.muted}`}>
                            {isDark ? 'Switch to light mode' : 'Switch to dark mode'}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={onToggleTheme}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border ${theme.border} ${theme.subtle} hover:bg-black/5 dark:hover:bg-white/10 transition-colors`}
                      >
                        {isDark ? <Sun className="h-3 w-3" /> : <Moon className="h-3 w-3" />}
                        {isDark ? "Light" : "Dark"} mode
                      </button>
                    </div>
                  </div>

                  {/* Keyboard Shortcuts */}
                  <div className="p-4 rounded-xl border border-black/10 dark:border-white/10">
                    <div 
                      className="flex items-center justify-between cursor-pointer"
                      onClick={() => setShowShortcuts(!showShortcuts)}
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-purple-500/10 flex items-center justify-center">
                          <Settings className="h-5 w-5 text-purple-600" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">Keyboard Shortcuts</p>
                          <p className={`text-xs ${theme.muted}`}>
                            Customize keyboard shortcuts
                          </p>
                        </div>
                      </div>
                      <button className={`p-2 rounded-lg ${theme.subtle} transition-colors`}>
                        <ChevronRight className={`h-4 w-4 transition-transform ${showShortcuts ? 'rotate-90' : ''}`} />
                      </button>
                    </div>

                    {showShortcuts && (
                      <div className="mt-4 pt-4 border-t border-black/10 dark:border-white/10">
                        <div className="space-y-3">
                          {shortcutItems.map((item) => (
                            <div key={item.key} className="flex items-center justify-between gap-3">
                              <span className="text-sm flex-1">{item.label}</span>
                              <ShortcutInput
                                value={shortcuts[item.key]}
                                onChange={(v: string) => onChangeShortcut(item.key, v)}
                                theme={theme}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Data Management */}
                  <div className="p-4 rounded-xl border border-black/10 dark:border-white/10">
                    <h3 className="text-sm font-medium mb-3">Data Management</h3>
                    
                    <div className="space-y-3">
                      {/* Import */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-green-500/10 flex items-center justify-center">
                            <Upload className="h-5 w-5 text-green-600" />
                          </div>
                          <div>
                            <p className="text-sm font-medium">Import Data</p>
                            <p className={`text-xs ${theme.muted}`}>
                              Import tasks from JSON file
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => fileRef.current?.click()}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border ${theme.border} ${theme.subtle} hover:bg-black/5 dark:hover:bg-white/10 transition-colors`}
                        >
                          <Upload className="h-3 w-3" />
                          Import
                        </button>
                      </div>

                      {/* Export */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-blue-500/10 flex items-center justify-center">
                            <Download className="h-5 w-5 text-blue-600" />
                          </div>
                          <div>
                            <p className="text-sm font-medium">Export Data</p>
                            <p className={`text-xs ${theme.muted}`}>
                              Download tasks as JSON file
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={onExport}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border ${theme.border} ${theme.subtle} hover:bg-black/5 dark:hover:bg-white/10 transition-colors`}
                        >
                          <Download className="h-3 w-3" />
                          Export
                        </button>
                      </div>
                    </div>

                    <input
                      ref={fileRef}
                      type="file"
                      accept="application/json"
                      className="hidden"
                      onChange={(e) => e.target.files?.[0] && onImport(e.target.files[0])}
                    />
                  </div>

                  {/* Board Management */}
                  <div className="p-4 rounded-xl border border-black/10 dark:border-white/10">
                    <h3 className="text-sm font-medium mb-3">Board Management</h3>
                    
                    <div className="space-y-3">
                      {/* Create New Board */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-purple-500/10 flex items-center justify-center">
                            <Plus className="h-5 w-5 text-purple-600" />
                          </div>
                          <div>
                            <p className="text-sm font-medium">Create New Board</p>
                            <p className={`text-xs ${theme.muted}`}>
                              Start a new board for organizing your tasks
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => setCurrentPage('create-board')}
                          disabled={isCreatingBoard}
                          className={`flex items-center justify-center h-8 w-8 rounded-lg text-emerald-500 border border-emerald-500/30 hover:bg-emerald-500/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      </div>

                      {/* Switch Boards */}
                      <div className="space-y-2">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                            <Kanban className="h-5 w-5 text-gray-600 dark:text-gray-300" />
                          </div>
                          <div>
                            <p className="text-sm font-medium">Switch Boards</p>
                            <p className={`text-xs ${theme.muted}`}>
                              {userBoards.length > 0 
                                ? `You have ${userBoards.length} board${userBoards.length > 1 ? 's' : ''}`
                                : 'No boards yet - create your first one!'
                              }
                            </p>
                          </div>
                        </div>
                        
                        {userBoards.length > 0 && (
                          <div className="ml-11 space-y-2">
                            {userBoards.map((board) => (
                              <button
                                key={board.id}
                                onClick={() => onSwitchBoard?.(board.id)}
                                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm border transition-colors ${
                                  currentBoardId === board.id
                                    ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                                    : `${theme.border} ${theme.subtle} hover:bg-black/5 dark:hover:bg-white/10`
                                }`}
                              >
                                <Kanban className="h-4 w-4" />
                                <span className="truncate">{board.title}</span>
                                {currentBoardId === board.id && (
                                  <div className="ml-auto h-2 w-2 rounded-full bg-emerald-500" />
                                )}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
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
                            onClose();
                            await signOut();
                          } catch (error) {
                            // Error handled gracefully by signOut method
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
              ) : currentPage === 'create-board' ? (
                /* Create New Board Page */
                <div className="space-y-6">
                  <div className="text-center">
                    <div className="h-16 w-16 rounded-full bg-purple-500/10 flex items-center justify-center mx-auto mb-4">
                      <Plus className="h-8 w-8 text-purple-600" />
                    </div>
                    <h3 className="text-lg font-semibold text-purple-600 dark:text-purple-400 mb-2">Create New Board</h3>
                    <p className={`text-sm ${theme.muted} mb-6`}>
                      Enter a name for your new board.
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Board Name</label>
                      <input
                        type="text"
                        value={newBoardName}
                        onChange={(e) => setNewBoardName(e.target.value)}
                        placeholder="My New Board"
                        className={`w-full rounded-xl ${theme.input} px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/40`}
                      />
                    </div>
                    
                    <button
                      onClick={async () => {
                        if (!newBoardName.trim()) return;
                        setIsLinking('create-board');
                        try {
                          await onCreateBoard?.(newBoardName.trim());
                          setNewBoardName('');
                          setCurrentPage('profile');
                        } catch (error) {
                          console.error('Failed to create board:', error);
                        } finally {
                          setIsLinking(null);
                        }
                      }}
                      disabled={!newBoardName.trim() || isLinking === 'create-board'}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-medium bg-purple-500 text-white hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <Plus className="h-4 w-4" />
                      {isLinking === 'create-board' ? 'Creating Board...' : 'Create Board'}
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
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};