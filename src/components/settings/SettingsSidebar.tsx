import React, { useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Upload, Download, Trash2, ChevronRight } from 'lucide-react';
import { CustomDropdown } from '../common/CustomDropdown';

interface SettingsSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onExport: () => void;
  onImport: (file: File) => void;
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
  onExport,
  onImport,
  deletedTasksSettings,
  onChangeDeletedTasksSetting,
  onOpenDeletedTasks,
  theme
}) => {
  const fileRef = useRef<HTMLInputElement | null>(null);

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

              {/* Import/Export Settings */}
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
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
