import { useState, useEffect, useRef, useMemo } from "react";
import { defaultState, STORAGE_KEY } from "../utils/helpers";

export function useAppState() {
  const [state, setState] = useState<any>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return defaultState();
  });

  const [shouldAnimateColumns, setShouldAnimateColumns] = useState(true);
  const [showProfileSidebar, setShowProfileSidebar] = useState(false);
  const [showSettingsSidebar, setShowSettingsSidebar] = useState(false);
  const [showDeletedTasks, setShowDeletedTasks] = useState(false);
  const [showCompletedTasks, setShowCompletedTasks] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [editingTask, setEditingTask] = useState<any>(null);
  const [newTaskColumnId, setNewTaskColumnId] = useState<string | null>(null);
  const [undoState, setUndoState] = useState<{
    isVisible: boolean;
    message: string;
    type: 'delete' | 'complete';
    onUndo: () => void;
  } | null>(null);
  const undoTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Persist state to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.warn("Failed to save state to localStorage", e);
    }
  }, [state]);

  // Theme only (cloud-only mode)
  useEffect(() => {
    document.documentElement.classList.toggle("dark", state.theme === "dark");
  }, [state.theme]);

  // Cleanup old deleted tasks based on retention period
  useEffect(() => {
    const deletedTasksSettings = state.deletedTasksSettings || { enabled: false, retentionPeriod: '7days' };
    
    if (deletedTasksSettings.enabled && state.deletedTasks?.length > 0) {
      const now = Date.now();
      let cutoffTime = 0;
      
      switch (deletedTasksSettings.retentionPeriod) {
        case '1hour':
          cutoffTime = now - (60 * 60 * 1000);
          break;
        case '24hours':
          cutoffTime = now - (24 * 60 * 60 * 1000);
          break;
        case '7days':
          cutoffTime = now - (7 * 24 * 60 * 60 * 1000);
          break;
        case '30days':
          cutoffTime = now - (30 * 24 * 60 * 60 * 1000);
          break;
        case 'forever':
          return; // Don't cleanup
        default:
          cutoffTime = now - (7 * 24 * 60 * 60 * 1000); // Default to 7 days
      }
      
      const filteredDeletedTasks = state.deletedTasks.filter((task: any) => 
        (task.deletedAt || 0) > cutoffTime
      );
      
      if (filteredDeletedTasks.length !== state.deletedTasks.length) {
        setState((s: any) => ({
          ...s,
          deletedTasks: filteredDeletedTasks
        }));
      }
    }
  }, [state.deletedTasks, state.deletedTasksSettings]);

  // Theme computation
  const theme = useMemo(() => {
    const isDark = state.theme === 'dark';
    return {
      bg: isDark ? 'bg-zinc-950 text-zinc-100' : 'bg-zinc-50 text-zinc-900',
      card: isDark ? 'bg-zinc-900' : 'bg-white',
      surface: isDark ? 'bg-zinc-900' : 'bg-white',
      text: isDark ? 'text-zinc-100' : 'text-zinc-900',
      textSecondary: isDark ? 'text-zinc-400' : 'text-zinc-600',
      border: isDark ? 'border-zinc-800' : 'border-zinc-200',
      hover: isDark ? 'hover:bg-zinc-800' : 'hover:bg-zinc-100',
      input: isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-300',
      subtle: isDark ? 'text-zinc-400' : 'text-zinc-600',
      muted: isDark ? 'text-zinc-500' : 'text-zinc-500'
    };
  }, [state.theme]);

  return {
    state,
    setState,
    shouldAnimateColumns,
    setShouldAnimateColumns,
    showProfileSidebar,
    setShowProfileSidebar,
    showSettingsSidebar,
    setShowSettingsSidebar,
    showDeletedTasks,
    setShowDeletedTasks,
    showCompletedTasks,
    setShowCompletedTasks,
    showTaskModal,
    setShowTaskModal,
    editingTask,
    setEditingTask,
    newTaskColumnId,
    setNewTaskColumnId,
    undoState,
    setUndoState,
    undoTimeoutRef,
    theme
  };
}
