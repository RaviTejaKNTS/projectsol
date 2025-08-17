import React, { useRef, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sun, Moon, Upload, Download, Settings, ChevronRight, Trash2 } from 'lucide-react';
import { CustomDropdown } from '../common/CustomDropdown';
import { serializeCombo } from '../../utils/helpers';

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

interface SettingsSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onToggleTheme: () => void;
  isDark: boolean;
  onExport: () => void;
  onImport: (file: File) => void;
  shortcuts: any;
  onChangeShortcut: (key: string, value: string) => void;
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
  onToggleTheme,
  isDark,
  onExport,
  onImport,
  shortcuts,
  onChangeShortcut,
  deletedTasksSettings,
  onChangeDeletedTasksSetting,
  onOpenDeletedTasks,
  theme
}) => {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [showShortcuts, setShowShortcuts] = useState(false);

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

  useEffect(() => {
    if (isOpen) {
      setShowShortcuts(false);
    }
  }, [isOpen]);

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
              {/* Theme Settings */}
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
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
