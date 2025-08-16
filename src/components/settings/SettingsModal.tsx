import { useRef } from 'react';
import { motion } from 'framer-motion';
import { Sun, Moon, Upload, Download } from 'lucide-react';
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

export function SettingsModal({ onClose, onToggleTheme, isDark, onExport, onImport, shortcuts, onChangeShortcut, theme }: any) {
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
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.98 }}
        className={`relative w-full max-w-md rounded-3xl border ${theme.border} ${theme.surface} p-3 sm:p-4`}
      >
        <div className="flex items-center gap-2 mb-3">
          <h3 className="text-base font-semibold">Settings</h3>
          <button type="button" onClick={onClose} className={`ml-auto p-2 rounded-xl ${theme.subtle}`}>
            ✕
          </button>
        </div>
        <div className="space-y-3 text-sm max-h-[70vh] overflow-y-auto pr-1">
          <div className="flex items-center justify-between">
            <span>Theme</span>
            <button
              type="button"
              onClick={onToggleTheme}
              className={`inline-flex items-center gap-1 sm:gap-2 rounded-xl border ${theme.border} px-2 sm:px-3 py-2 ${theme.subtle} text-xs sm:text-sm`}
            >
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />} {isDark ? "Light" : "Dark"} mode
            </button>
          </div>

          <div className="flex items-center justify-between">
            <span>Import / Export</span>
            <div className="flex items-center gap-1 sm:gap-2">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className={`inline-flex items-center gap-1 sm:gap-2 rounded-xl border ${theme.border} px-2 sm:px-3 py-2 ${theme.subtle} text-xs sm:text-sm`}
              >
                <Upload className="h-4 w-4" /> Import
              </button>
              <button
                type="button"
                onClick={onExport}
                className={`inline-flex items-center gap-1 sm:gap-2 rounded-xl border ${theme.border} px-2 sm:px-3 py-2 ${theme.subtle} text-xs sm:text-sm`}
              >
                <Download className="h-4 w-4" /> Export
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="application/json"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && onImport(e.target.files[0])}
              />
            </div>
          </div>

          <div>
            <div className="mb-1">Keyboard shortcuts</div>
            <div className="space-y-2">
              {shortcutItems.map((it) => (
                <div key={it.key} className="flex items-center justify-between gap-2">
                  <span>{it.label}</span>
                  <ShortcutInput
                    value={shortcuts[it.key]}
                    onChange={(v: string) => onChangeShortcut(it.key, v)}
                    theme={theme}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
