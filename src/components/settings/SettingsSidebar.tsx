import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Trash2, ChevronRight, Edit3, Save, X as XIcon, Check } from 'lucide-react';
import { CustomDropdown } from '../common/CustomDropdown';

interface SettingsSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  board: {
    id: string;
    title: string;
  } | null;
  onRenameBoard: (boardId: string, newTitle: string) => Promise<void>;
  showCompleted: boolean;
  onChangeShowCompleted: (value: boolean) => Promise<void>;
  deletedTasksSettings: {
    enabled: boolean;
    retentionPeriod: string;
  };
  onChangeDeletedTasksSetting: (key: string, value: any) => void;
  onOpenDeletedTasks: () => void;
  theme: {
    surface: string;
    border: string;
    input: string;
    subtle: string;
    muted: string;
  };
}

export const SettingsSidebar: React.FC<SettingsSidebarProps> = ({
  isOpen,
  onClose,
  board,
  onRenameBoard,
  showCompleted,
  onChangeShowCompleted,
  deletedTasksSettings,
  onChangeDeletedTasksSetting,
  onOpenDeletedTasks,
  theme
}) => {
  const [isEditingBoard, setIsEditingBoard] = useState(false);
  const [boardTitle, setBoardTitle] = useState('');
  const [isSavingBoard, setIsSavingBoard] = useState(false);

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
                <h2 className="text-lg font-semibold">Settings</h2>
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
              {/* Board Settings */}
              {board && (
                <div className="p-4 rounded-xl border border-black/10 dark:border-white/10">
                  <h3 className="text-sm font-medium mb-3">Board Settings</h3>
                  
                  <div className="space-y-4">
                    {/* Board Name */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-blue-500/10 flex items-center justify-center">
                          <Edit3 className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">Board Name</p>
                          <p className={`text-xs ${theme.muted}`}>
                            {isEditingBoard ? 'Click save to update the board name' : 'Rename your current board'}
                          </p>
                        </div>
                      </div>
                      {!isEditingBoard ? (
                        <button
                          onClick={() => {
                            setIsEditingBoard(true);
                            setBoardTitle(board.title);
                          }}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border ${theme.border} ${theme.subtle} hover:bg-black/5 dark:hover:bg-white/10 transition-colors`}
                        >
                          <Edit3 className="h-3 w-3" />
                          Rename
                        </button>
                      ) : (
                        <div className="flex gap-1">
                          <button
                            onClick={async () => {
                              const newTitle = boardTitle.trim();
                              if (!newTitle || newTitle === board.title) {
                                setIsEditingBoard(false);
                                return;
                              }
                              setIsSavingBoard(true);
                              try {
                                await onRenameBoard(board.id, newTitle);
                                setIsEditingBoard(false);
                              } catch (error) {
                                console.error('Failed to rename board:', error);
                                // Keep editing mode on error
                              } finally {
                                setIsSavingBoard(false);
                              }
                            }}
                            disabled={isSavingBoard || !boardTitle.trim() || boardTitle.trim() === board.title}
                            className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/25 disabled:opacity-50 transition-colors"
                          >
                            <Save className="h-3 w-3" />
                            {isSavingBoard ? 'Saving...' : 'Save'}
                          </button>
                          <button
                            onClick={() => {
                              setIsEditingBoard(false);
                              setBoardTitle('');
                            }}
                            className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs border border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                          >
                            <XIcon className="h-3 w-3" />
                            Cancel
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Board Name Input */}
                    {isEditingBoard && (
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Board Name</label>
                        <input
                          type="text"
                          value={boardTitle}
                          onChange={(e) => setBoardTitle(e.target.value)}
                          className={`w-full rounded-xl ${theme.input} px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40`}
                          placeholder="Enter board name"
                          autoFocus
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Completed Tasks Settings */}
              <div className="p-4 rounded-xl border border-black/10 dark:border-white/10">
                <h3 className="text-sm font-medium mb-3">Completed Tasks</h3>
                
                <div className="space-y-4">
                  {/* Show/Hide Completed Tasks */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-green-500/10 flex items-center justify-center">
                        <Check className="h-5 w-5 text-green-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">Show Completed Tasks</p>
                        <p className={`text-xs ${theme.muted}`}>
                          {showCompleted ? 'Completed tasks are visible in columns' : 'Completed tasks are hidden from columns'}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => onChangeShowCompleted(!showCompleted)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        showCompleted ? 'bg-emerald-500' : 'bg-zinc-300 dark:bg-zinc-600'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          showCompleted ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </div>

              {/* Deleted Tasks */}
              <div className="p-4 rounded-xl border border-black/10 dark:border-white/10">
                <h3 className="text-sm font-medium mb-3">Deleted Tasks</h3>
                
                <div className="space-y-4">
                  {/* Enable/Disable Deleted Tasks */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-red-500/10 flex items-center justify-center">
                        <Trash2 className="h-5 w-5 text-red-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">Enable Deleted Tasks</p>
                        <p className={`text-xs ${theme.muted}`}>
                          Store deleted tasks for recovery
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => onChangeDeletedTasksSetting('enabled', !deletedTasksSettings.enabled)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        deletedTasksSettings.enabled ? 'bg-emerald-500' : 'bg-zinc-300 dark:bg-zinc-600'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          deletedTasksSettings.enabled ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Retention Period */}
                  {deletedTasksSettings.enabled && (
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Retention Period</label>
                      <CustomDropdown
                        value={deletedTasksSettings.retentionPeriod}
                        onChange={(value) => onChangeDeletedTasksSetting('retentionPeriod', value)}
                        options={[
                          { value: '1hour', label: '1 hour' },
                          { value: '24hours', label: '24 hours' },
                          { value: '7days', label: '7 days' },
                          { value: '30days', label: '30 days' },
                          { value: 'forever', label: 'Forever' }
                        ]}
                        placeholder="Select retention period"
                        theme={theme}
                      />
                      <p className={`text-xs ${theme.muted}`}>
                        Tasks will be permanently deleted after this period
                      </p>
                    </div>
                  )}

                  {/* View Deleted Tasks */}
                  {deletedTasksSettings.enabled && (
                    <button
                      onClick={onOpenDeletedTasks}
                      className="w-full flex items-center justify-between p-3 rounded-xl border border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <Trash2 className="h-4 w-4 text-red-600" />
                        <span className="text-sm font-medium">View Deleted Tasks</span>
                      </div>
                      <ChevronRight className="h-4 w-4 text-zinc-400" />
                    </button>
                  )}
                </div>
              </div>


            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
