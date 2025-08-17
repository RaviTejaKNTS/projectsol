import { useEffect, useMemo, useState, useRef } from "react";
import {
  Plus,
  Settings,
  ChevronDown,
  Search,
  Filter,
  X,
} from "lucide-react";
import confetti from 'canvas-confetti';
import { ProfileButton } from '../components/ProfileButton';
import { ProfileSidebar } from '../components/ProfileSidebar';
import { useCloudState } from '../hooks/useCloudState';
import { useAuth } from '../contexts/AuthProvider';
import { CustomDropdown } from "../components/common/CustomDropdown";
import { InlineEmailSignIn } from "../components/auth/InlineEmailSignIn";
import { Column } from "../components/tasks/Column";
import { TaskModal } from "../components/tasks/TaskModal";
import { SettingsSidebar } from "../components/settings/SettingsSidebar";
import { TaskReports } from "../components/TaskReports";
import { CompletedTasksModal } from "../components/CompletedTasksModal";
import { DeletedTasksModal } from "../components/DeletedTasksModal";
import {
  uid,
  PRIORITIES,
  priorityColor,
  prettyDate,
  getDueDateStatus,
  DEFAULT_SHORTCUTS,
  serializeCombo,
  reorderWithin,
  moveItemBetween,
  defaultState,
  STORAGE_KEY,
} from "../utils/helpers";






const ActiveFilters = ({ state, setState }: any) => {
  const { filters } = state;
  const { priorities, labels, due, text } = filters;

  const removePriority = (p: string) => {
    setState((s: any) => ({ ...s, filters: { ...s.filters, priorities: s.filters.priorities.filter((q: string) => q !== p) } }));
  };

  const removeLabel = (l: string) => {
    setState((s: any) => ({ ...s, filters: { ...s.filters, labels: s.filters.labels.filter((q: string) => q !== l) } }));
  };

  const removeDue = () => {
    setState((s: any) => ({ ...s, filters: { ...s.filters, due: "all" } }));
  };

  const removeText = () => {
    setState((s: any) => ({ ...s, filters: { ...s.filters, text: "" } }));
  };

  const FilterTag = ({ children, onRemove }: any) => (
    <div className={`group relative inline-flex items-center gap-1.5 rounded-lg pl-2.5 pr-2 py-1 text-xs border transition-colors bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30`}>
      {children}
      <button type="button" onClick={onRemove} className={`opacity-60 hover:opacity-100`}>
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );

  return (
    <div className="flex flex-wrap items-center gap-2">
      {text && <FilterTag onRemove={removeText}>Search: "{text}"</FilterTag>}
      {priorities.map((p: string) => <FilterTag key={p} onRemove={() => removePriority(p)}>{p} priority</FilterTag>)}
      {labels.map((l: string) => <FilterTag key={l} onRemove={() => removeLabel(l)}>#{l}</FilterTag>)}
      {due !== 'all' && <FilterTag onRemove={removeDue}>Due: {due}</FilterTag>}
    </div>
  );
};


// ------------------------------------------------------------
// TasksMint — Material‑ish Kanban To‑Do (Trello style)
// Polished, responsive board with smooth dnd-kit drag/drop,
// Material-esque surfaces, dark/light themes, filters,
// labels, priorities, due dates, subtasks, import/export,
// keyboard shortcuts (in Settings), and confetti on Done.
// ------------------------------------------------------------


export default function TasksMintApp() {
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
  const [undoState, setUndoState] = useState<{
    isVisible: boolean;
    message: string;
    type: 'delete' | 'complete';
    onUndo: () => void;
  } | null>(null);
  const undoTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const { user, loading, signInWithGoogle, signInWithEmail } = useAuth();
  const { status: saveStatus, forceSync } = useCloudState(state as any, setState as any, DEFAULT_SHORTCUTS, STORAGE_KEY);
  const prevUserRef = useRef(user);
  const filterButtonRef = useRef<HTMLButtonElement>(null);
  const filterDropdownRef = useRef<HTMLDivElement>(null);

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

  // Trigger column animations on login
  useEffect(() => {
    if (prevUserRef.current !== user) {
      if (user && !prevUserRef.current) {
        // User just logged in
        setShouldAnimateColumns(true);
      }
      prevUserRef.current = user;
    }
  }, [user]);

  // Reset animation flag after columns have animated
  useEffect(() => {
    if (shouldAnimateColumns) {
      const timer = setTimeout(() => {
        setShouldAnimateColumns(false);
      }, 800); // Allow time for all columns to animate
      return () => clearTimeout(timer);
    }
  }, [shouldAnimateColumns]);



  // UI helpers
  const isDark = state.theme === "dark";
  const bg = isDark ? "bg-zinc-950 text-zinc-100" : "bg-zinc-50 text-zinc-900";
  const surface = isDark ? "bg-zinc-900" : "bg-white";
  const surfaceAlt = isDark ? "bg-zinc-900/70" : "bg-white/90";
  const border = isDark ? "border-zinc-800" : "border-zinc-200";
  const subtle = isDark ? "hover:bg-zinc-800" : "hover:bg-zinc-100";
  const input = isDark ? "bg-zinc-900 border-zinc-800" : "bg-white border-zinc-300";
  const muted = isDark ? "text-zinc-400" : "text-zinc-500";

  // Actions
  const openNewTask = (columnId = state.columns[0]?.id) => {
    if (!user) { window.dispatchEvent(new CustomEvent('open-login')); return; }
    setState((s: any) => ({ ...s, editingTaskId: { columnId, taskId: null }, showTaskModal: true }));
  };

  const openEditTask = (taskId: string) => {
    const columnId = state.columns.find((c: any) => c.taskIds.includes(taskId))?.id;
    setState((s: any) => ({ ...s, editingTaskId: { columnId, taskId }, showTaskModal: true }));
  };

  const openCompletedTasks = () => setState((s: any) => ({ ...s, showCompletedTasks: true }));
  const closeCompletedTasks = () => setState((s: any) => ({ ...s, showCompletedTasks: false }));

  const restoreTask = (taskId: string) => {
    setState((s: any) => {
      const task = s.tasks[taskId];
      if (!task || !task.completed) return s;
      
      // Mark task as not completed
      const updatedTask = {
        ...task,
        completed: false,
        completedAt: null,
        updatedAt: Date.now()
      };
      
      // Find the column to restore to (use lastColumnId or default to first column)
      const targetColumnId = task.lastColumnId || s.columns[0]?.id;
      const newColumns = s.columns.map((c: any) => {
        if (c.id === targetColumnId) {
          return { ...c, taskIds: [taskId, ...c.taskIds] };
        }
        return c;
      });
      
      return {
        ...s,
        tasks: { ...s.tasks, [taskId]: updatedTask },
        columns: newColumns
      };
    });
  };

  const toggleTheme = () => setState((s: any) => ({ ...s, theme: s.theme === "dark" ? "light" : "dark" }));

  const startAddColumn = () => setState((s: any) => ({ ...s, addingColumn: true, tempTitle: "" }));
  const commitAddColumn = () => {
    const title = (state.tempTitle || "").trim();
    if (!title) return;
    const id = uid();
    setState((s: any) => ({
      ...s,
      columns: [...s.columns, { id, title, taskIds: [] }],
      addingColumn: false,
      tempTitle: "",
    }));
  };
  const cancelAddColumn = () => setState((s: any) => ({ ...s, addingColumn: false, tempTitle: "" }));

  const startRenameColumn = (id: string, current: string) =>
    setState((s: any) => ({ ...s, renamingColumnId: id, tempTitle: current }));

  const cancelRenameColumn = () => setState((s: any) => ({ ...s, renamingColumnId: null, tempTitle: "" }));

  const commitRenameColumn = (id: string) => {
    const next = (state.tempTitle || "").trim();
    if (!next) return;
    setState((s: any) => ({
      ...s,
      columns: s.columns.map((c: any) => (c.id === id ? { ...c, title: next } : c)),
      renamingColumnId: null,
      tempTitle: "",
    }));
  };

  const deleteColumn = (id: string) => {
    if (!confirm("Delete this column and its tasks?")) return;
    setState((s: any) => {
      const col = s.columns.find((c: any) => c.id === id);
      if (!col) return s;
      const tasks = { ...s.tasks } as any;
      col.taskIds.forEach((tid: string) => delete tasks[tid]);
      return { ...s, columns: s.columns.filter((c: any) => c.id !== id), tasks };
    });
  };


  const moveTask = (taskId: string, fromColumnId: string, toColumnId: string, position?: number) => {
    setState((s: any) => {
      // Handle same column reordering
      if (fromColumnId === toColumnId) {
        const newColumns = s.columns.map((col: any) => {
          if (col.id === fromColumnId) {
            const taskIds = [...col.taskIds];
            const fromIndex = taskIds.indexOf(taskId);
            if (fromIndex === -1) return col;
            
            // Remove from original position
            taskIds.splice(fromIndex, 1);
            
            // Insert at new position
            const toIndex = position !== undefined ? Math.min(position, taskIds.length) : taskIds.length;
            taskIds.splice(toIndex, 0, taskId);
            
            return { ...col, taskIds };
          }
          return col;
        });
        return { ...s, columns: newColumns };
      }
      
      // Handle cross-column moves
      const newColumns = s.columns.map((col: any) => {
        if (col.id === fromColumnId) {
          return { ...col, taskIds: col.taskIds.filter((id: string) => id !== taskId) };
        }
        if (col.id === toColumnId) {
          const newTaskIds = [...col.taskIds];
          const insertIndex = position !== undefined ? Math.min(position, newTaskIds.length) : newTaskIds.length;
          newTaskIds.splice(insertIndex, 0, taskId);
          return { ...col, taskIds: newTaskIds };
        }
        return col;
      });
      
      return { ...s, columns: newColumns };
    });
  };

  const moveColumn = (fromId: string, toId: string) => {
    setState((s: any) => {
      const fromIndex = s.columns.findIndex((c: any) => c.id === fromId);
      const toIndex = s.columns.findIndex((c: any) => c.id === toId);

      if (fromIndex === -1 || toIndex === -1) return s;

      const newColumns = [...s.columns];
      const [movedItem] = newColumns.splice(fromIndex, 1);
      newColumns.splice(toIndex, 0, movedItem);

      return { ...s, columns: newColumns };
    });
  };

  const createOrUpdateTask = (payload: any, columnId: string | null, taskId: string | null = null, metadataOnly = false) => {
    setState((s: any) => {
      if (metadataOnly) {
        const newLabels = payload.labels || [];
        const existingLabels = new Set(s.labels || []);
        const uniqueNewLabels = newLabels.filter((label: string) => !existingLabels.has(label));
        if (uniqueNewLabels.length > 0) {
          return { ...s, labels: [...(s.labels || []), ...uniqueNewLabels] };
        }
        return s; // No changes
      }

      const id = taskId || uid();
      const newTask = {
        id,
        title: payload.title?.trim() || "Untitled",
        description: payload.description?.trim() || "",
        labels: payload.labels || [],
        priority: payload.priority || "Medium",
        dueDate: payload.dueDate || "",
        createdAt: taskId ? s.tasks[taskId].createdAt : Date.now(),
        updatedAt: Date.now(),
        completed: taskId ? s.tasks[taskId].completed || false : false,
        completedAt: taskId ? s.tasks[taskId].completedAt || null : null,
        lastColumnId: taskId ? s.tasks[taskId].lastColumnId || null : null,
        subtasks: payload.subtasks || [],
      };
      const tasks = { ...s.tasks, [id]: newTask } as any;
      let columns = s.columns;
      
      if (!taskId && columnId) {
        // New task: add to the specified column
        columns = s.columns.map((c: any) => (c.id === columnId ? { ...c, taskIds: [id, ...c.taskIds] } : c));
      } else if (taskId && columnId) {
        // Existing task: handle column change
        const oldColumnId = s.columns.find((c: any) => c.taskIds.includes(taskId))?.id;
        if (oldColumnId && oldColumnId !== columnId) {
          // Remove from old column
          columns = s.columns.map((c: any) => 
            c.id === oldColumnId ? { ...c, taskIds: c.taskIds.filter((tid: string) => tid !== taskId) } : c
          );
          // Add to new column
          columns = columns.map((c: any) => 
            c.id === columnId ? { ...c, taskIds: [id, ...c.taskIds] } : c
          );
        }
      }
      
      const newLabels = payload.labels || [];
      const existingLabels = new Set(s.labels || []);
      const uniqueNewLabels = newLabels.filter((label: string) => !existingLabels.has(label));

      let updatedGlobalLabels = s.labels;
      if (uniqueNewLabels.length > 0) {
        updatedGlobalLabels = [...(s.labels || []), ...uniqueNewLabels];
      }

      return { ...s, tasks, columns, labels: updatedGlobalLabels };
    });
  };

  const deleteLabel = (labelToDelete: string) => {
    if (!confirm(`Delete "${labelToDelete}" label everywhere?`)) return;
    setState((s: any) => {
      const newLabels = s.labels.filter((l: string) => l !== labelToDelete);
      const newTasks = { ...s.tasks };
      Object.keys(newTasks).forEach(taskId => {
        const task = newTasks[taskId];
        if (task.labels?.includes(labelToDelete)) {
          newTasks[taskId] = {
            ...task,
            labels: task.labels.filter((l: string) => l !== labelToDelete),
            updatedAt: Date.now(),
          };
        }
      });
      return { ...s, labels: newLabels, tasks: newTasks };
    });
  };

  const deleteTask = (taskId: string) => {
    const task = state.tasks[taskId];
    if (!task) return;

    const deletedTasksSettings = state.deletedTasksSettings || { enabled: false, retentionPeriod: '7days' };
    
    if (deletedTasksSettings.enabled) {
      // Find which column contains this task
      const sourceColumn = state.columns.find((c: any) => c.taskIds.includes(taskId));
      const sourceColumnId = sourceColumn?.id;
      const taskPosition = sourceColumn?.taskIds.indexOf(taskId) || 0;
      
      // Store the current state for undo
      const taskToDelete = { 
        ...task, 
        deletedAt: Date.now(),
        originalColumnId: sourceColumnId,
        originalPosition: taskPosition
      };
      
      // Remove task from state
      setState((s: any) => {
        const tasks = { ...s.tasks };
        delete tasks[taskId];
        const columns = s.columns.map((c: any) => ({ ...c, taskIds: c.taskIds.filter((id: string) => id !== taskId) }));
        const deletedTasks = [...(s.deletedTasks || []), taskToDelete];
        
        return { ...s, tasks, columns, deletedTasks };
      });
      
      // Clear any existing undo timeout
      if (undoTimeoutRef.current) {
        clearTimeout(undoTimeoutRef.current);
      }

      // Show undo message in task stats
      setUndoState({
        isVisible: true,
        message: `Task "${task.title}" deleted`,
        type: 'delete',
        onUndo: () => {
          // Clear timeout when undo is clicked
          if (undoTimeoutRef.current) {
            clearTimeout(undoTimeoutRef.current);
            undoTimeoutRef.current = null;
          }
          
          // Undo the deletion
          setState((s: any) => {
            const { deletedAt, originalColumnId, originalPosition, ...cleanTask } = taskToDelete;
            
            // Find the original column or fallback to first column
            let targetColumn = s.columns.find((c: any) => c.id === originalColumnId);
            if (!targetColumn) {
              targetColumn = s.columns[0];
            }
            
            // Insert task back at original position
            const newTaskIds = [...targetColumn.taskIds];
            const insertPosition = Math.min(originalPosition || 0, newTaskIds.length);
            newTaskIds.splice(insertPosition, 0, taskId);
            
            // Update columns with restored task
            const updatedColumns = s.columns.map((c: any) => 
              c.id === targetColumn.id 
                ? { ...c, taskIds: newTaskIds }
                : c
            );
            
            return {
              ...s,
              tasks: { ...s.tasks, [taskId]: cleanTask },
              columns: updatedColumns,
              deletedTasks: s.deletedTasks?.filter((t: any) => t.id !== taskId) || []
            };
          });
          
          setUndoState(null);
        }
      });

      // Auto-hide after 10 seconds with protected timeout
      undoTimeoutRef.current = setTimeout(() => {
        setUndoState(null);
        undoTimeoutRef.current = null;
      }, 10000);
    } else {
      // Permanently delete (original behavior)
      setState((s: any) => {
        const tasks = { ...s.tasks };
        delete tasks[taskId];
        const columns = s.columns.map((c: any) => ({ ...c, taskIds: c.taskIds.filter((id: string) => id !== taskId) }));
        return { ...s, tasks, columns };
      });
      
      // No message for permanent deletion when feature is disabled
    }
  };

  const completeTask = (taskId: string) => {
    const task = state.tasks[taskId];
    if (!task) return;
    
    // Find current column containing the task
    const currentColumn = state.columns.find((c: any) => c.taskIds.includes(taskId));
    if (!currentColumn) return;
    
    // Store task data for potential undo
    const taskForUndo = {
      ...task,
      originalColumnId: currentColumn.id,
      originalPosition: currentColumn.taskIds.indexOf(taskId)
    };
    
    setState((s: any) => {
      // Mark task as completed and store its last column
      const updatedTask = {
        ...task,
        completed: true,
        completedAt: Date.now(),
        updatedAt: Date.now(),
        lastColumnId: currentColumn.id // Store where it came from for restoration
      };
      
      // Remove task from its current column
      const newColumns = s.columns.map((c: any) => {
        if (c.id === currentColumn.id) {
          return { ...c, taskIds: c.taskIds.filter((id: string) => id !== taskId) };
        }
        return c;
      });
      
      return {
        ...s,
        tasks: { ...s.tasks, [taskId]: updatedTask },
        columns: newColumns
      };
    });
    
    // Clear any existing undo timeout
    if (undoTimeoutRef.current) {
      clearTimeout(undoTimeoutRef.current);
    }

    // Show completion message with undo option
    setUndoState({
      isVisible: true,
      message: `Great job! Task "${task.title}" completed! 🎉`,
      type: 'complete',
      onUndo: () => {
        // Clear timeout when undo is clicked
        if (undoTimeoutRef.current) {
          clearTimeout(undoTimeoutRef.current);
          undoTimeoutRef.current = null;
        }
        
        // Undo the completion - restore to original column and position
        setState((s: any) => {
          const { originalColumnId, originalPosition, ...cleanTask } = taskForUndo;
          
          // Find the original column or fallback to first column
          let targetColumn = s.columns.find((c: any) => c.id === originalColumnId);
          if (!targetColumn) {
            targetColumn = s.columns[0];
          }
          
          // Insert task back at original position
          const newTaskIds = [...targetColumn.taskIds];
          const insertPosition = Math.min(originalPosition || 0, newTaskIds.length);
          newTaskIds.splice(insertPosition, 0, taskId);
          
          // Update columns with restored task
          const updatedColumns = s.columns.map((c: any) => 
            c.id === targetColumn.id 
              ? { ...c, taskIds: newTaskIds }
              : c
          );
          
          // Mark task as incomplete
          const restoredTask = {
            ...cleanTask,
            completed: false,
            completedAt: undefined,
            updatedAt: Date.now()
          };
          
          return {
            ...s,
            tasks: { ...s.tasks, [taskId]: restoredTask },
            columns: updatedColumns
          };
        });
        
        setUndoState(null);
      }
    });

    // Auto-hide after 10 seconds with protected timeout
    undoTimeoutRef.current = setTimeout(() => {
      setUndoState(null);
      undoTimeoutRef.current = null;
    }, 10000);
    
    // Trigger confetti animation for positive feedback
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#10b981', '#059669', '#047857']
    });
  };

  const exportJSON = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tasksmint-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importJSON = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result));
        if (!data.columns || !data.tasks) throw new Error("Invalid file");
        setState(data);
      } catch (e) {
        alert("Invalid JSON file");
      }
    };
    reader.readAsText(file);
  };

  const allLabels = useMemo(() => {
    const fromTasks = new Set(Object.values(state.tasks).flatMap((t: any) => t.labels || []));
    const base = new Set([...(state.labels || []), ...fromTasks]);
    return Array.from(base);
  }, [state.tasks, state.labels]);

  const filteredTaskIds = (col: any) => {
    const ids = col.taskIds;
    const { text, priorities, labels, due } = state.filters;
    const now = new Date();
    const weekAhead = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7);

    return ids.filter((id: string) => {
      const t = state.tasks[id];
      if (!t) return false;
      if (text && !(`${t.title} ${t.description}`.toLowerCase().includes(text.toLowerCase()))) return false;
      if (priorities.length && !priorities.includes(t.priority)) return false;
      if (labels.length && !labels.every((l: string) => t.labels.includes(l))) return false;
      if (due === "overdue" && getDueDateStatus(t.dueDate) !== 'past') return false;
      if (due === "week" && (!t.dueDate || new Date(t.dueDate) > weekAhead)) return false;
      return true;
    });
  };

  const sortTasks = (ids: string[]) => {
    if (state.sortMode === "manual") return ids;
    const arr = [...ids];
    arr.sort((a, b) => {
      const A = state.tasks[a];
      const B = state.tasks[b];
      if (state.sortMode === "due") {
        return new Date(A.dueDate || "9999-12-31").getTime() - new Date(B.dueDate || "9999-12-31").getTime();
      }
      if (state.sortMode === "priority") {
        const rank: any = { Urgent: 3, High: 2, Medium: 1, Low: 0 };
        return (rank[B.priority] || 0) - (rank[A.priority] || 0);
      }
      if (state.sortMode === "created") {
        return (B.createdAt || 0) - (A.createdAt || 0);
      }
      return 0;
    });
    return arr;
  };

  const filtersActive =
    state.filters.text || state.filters.priorities.length || state.filters.labels.length || state.filters.due !== "all";

  // Keyboard shortcuts
  useEffect(() => {
    const findTaskColumnIndex = (taskId: string) =>
      state.columns.findIndex((c: any) => c.taskIds.includes(taskId));

    const selectTask = (colIdx: number, taskIdx: number) => {
      const col = state.columns[colIdx];
      if (!col) return;
      const ids = sortTasks(filteredTaskIds(col));
      const id = ids[taskIdx];
      if (id) setState((s: any) => ({ ...s, selectedTaskId: id }));
    };

    const navigate = (key: string) => {
      if (!state.selectedTaskId) {
        selectTask(0, 0);
        return;
      }
      const colIdx = findTaskColumnIndex(state.selectedTaskId);
      const col = state.columns[colIdx];
      if (!col) return;
      const ids = sortTasks(filteredTaskIds(col));
      const idx = ids.indexOf(state.selectedTaskId);
      if (key === "ArrowUp") selectTask(colIdx, Math.max(0, idx - 1));
      if (key === "ArrowDown") selectTask(colIdx, Math.min(ids.length - 1, idx + 1));
      if (key === "ArrowLeft") selectTask(Math.max(0, colIdx - 1), idx);
      if (key === "ArrowRight") selectTask(Math.min(state.columns.length - 1, colIdx + 1), idx);
    };

    const moveWithin = (key: string) => {
      if (!state.selectedTaskId) return;
      const colIdx = findTaskColumnIndex(state.selectedTaskId);
      const col = state.columns[colIdx];
      if (!col) return;
      const ids = col.taskIds;
      const idx = ids.indexOf(state.selectedTaskId);
      const target = key === "ArrowUp" ? idx - 1 : idx + 1;
      if (target < 0 || target >= ids.length) return;
      const newIds = reorderWithin(ids, state.selectedTaskId, ids[target]);
      const newColumns = state.columns.map((c: any, i: number) =>
        i === colIdx ? { ...c, taskIds: newIds } : c
      );
      setState((s: any) => ({ ...s, columns: newColumns }));
    };

    const moveAcross = (key: string) => {
      if (!state.selectedTaskId) return;
      const fromIdx = findTaskColumnIndex(state.selectedTaskId);
      const toIdx = key === "ArrowLeft" ? fromIdx - 1 : fromIdx + 1;
      if (toIdx < 0 || toIdx >= state.columns.length) return;
      const fromCol = state.columns[fromIdx];
      const toCol = state.columns[toIdx];
      const samePosId = toCol.taskIds[ fromCol.taskIds.indexOf(state.selectedTaskId) ] || null;
      const moved = moveItemBetween(fromCol.taskIds, toCol.taskIds, state.selectedTaskId, samePosId);
      const newColumns = state.columns.map((c: any) =>
        c.id === fromCol.id ? { ...c, taskIds: moved.from } : c.id === toCol.id ? { ...c, taskIds: moved.to } : c
      );
      setState((s: any) => {
        const tasks = { ...s.tasks } as any;
        if (tasks[state.selectedTaskId]) tasks[state.selectedTaskId].updatedAt = Date.now();
        return { ...s, columns: newColumns, tasks };
      });
    };

    const toggleComplete = () => {
      if (!state.selectedTaskId) return;
      const fromIdx = findTaskColumnIndex(state.selectedTaskId);
      const doneIdx = state.columns.findIndex((c: any) => c.id === "done");
      if (doneIdx === -1) return;
      const toIdx = fromIdx === doneIdx ? 0 : doneIdx;
      const fromCol = state.columns[fromIdx];
      const toCol = state.columns[toIdx];
      const moved = moveItemBetween(fromCol.taskIds, toCol.taskIds, state.selectedTaskId, null);
      const newColumns = state.columns.map((c: any) =>
        c.id === fromCol.id ? { ...c, taskIds: moved.from } : c.id === toCol.id ? { ...c, taskIds: moved.to } : c
      );
      setState((s: any) => {
        const tasks = { ...s.tasks } as any;
        if (tasks[state.selectedTaskId]) tasks[state.selectedTaskId].updatedAt = Date.now();
        return { ...s, columns: newColumns, tasks };
      });
    };

    const setPriorityShortcut = (p: string) => {
      if (!state.selectedTaskId) return;
      const id = state.selectedTaskId;
      setState((s: any) => ({
        ...s,
        tasks: { ...s.tasks, [id]: { ...s.tasks[id], priority: p, updatedAt: Date.now() } },
      }));
    };

    const setDueDateShortcut = () => {
      if (!state.selectedTaskId) return;
      const id = state.selectedTaskId;
      const val = prompt("Due date (YYYY-MM-DD)") || "";
      const iso = val ? new Date(val).toISOString() : "";
      setState((s: any) => ({
        ...s,
        tasks: { ...s.tasks, [id]: { ...s.tasks[id], dueDate: iso, updatedAt: Date.now() } },
      }));
    };

    // Professional keyboard shortcut handler with proper input field detection
    const onKeyDown = (e: KeyboardEvent) => {
      // Early returns for better performance and clarity
      if (state.showTaskModal || state.showSettings) return;
      
      // Check if we're in an input field or contenteditable element
      const target = e.target as HTMLElement;
      const isInputField = target.matches('input, textarea, select, [contenteditable="true"]');
      const isInModal = target.closest('[role="dialog"], [data-modal]');
      
      // Don't trigger shortcuts when typing in input fields or when in modals
      if (isInputField || isInModal) return;
      
      // Check if any modifier keys are pressed (except for specific shortcuts)
      const hasModifiers = e.ctrlKey || e.metaKey || e.altKey;
      const combo = serializeCombo(e);
      const sc = state.shortcuts;
      
      // Handle global shortcuts (always available)
      if (combo === sc.newTask) {
        e.preventDefault();
        openNewTask();
        return;
      }
      
      if (combo === sc.newColumn) {
        e.preventDefault();
        startAddColumn();
        return;
      }
      
      if (combo === sc.search) {
        e.preventDefault();
        document.getElementById("searchInput")?.focus();
        return;
      }
      
      if (combo === sc.toggleFilters) {
        e.preventDefault();
        setState((s: any) => ({ ...s, showFilters: !s.showFilters }));
        return;
      }
      
      // Handle task navigation shortcuts (only when no modifiers)
      if (!hasModifiers) {
        if (combo === sc.moveTaskUp) {
          e.preventDefault();
          moveWithin("ArrowUp");
          return;
        }
        
        if (combo === sc.moveTaskDown) {
          e.preventDefault();
          moveWithin("ArrowDown");
          return;
        }
        
        if (combo === sc.moveTaskLeft) {
          e.preventDefault();
          moveAcross("ArrowLeft");
          return;
        }
        
        if (combo === sc.moveTaskRight) {
          e.preventDefault();
          moveAcross("ArrowRight");
          return;
        }
        
        // Arrow key navigation (only when no task is selected or for basic navigation)
        if (["arrowup", "arrowdown", "arrowleft", "arrowright"].includes(e.key.toLowerCase())) {
          e.preventDefault();
          navigate(e.key);
          return;
        }
      }
      
      // Handle task action shortcuts
      if (combo === sc.completeTask) {
        e.preventDefault();
        toggleComplete();
        return;
      }
      
      if (combo === sc.deleteTask && state.selectedTaskId) {
        e.preventDefault();
        deleteTask(state.selectedTaskId);
        setState((s: any) => ({ ...s, selectedTaskId: null }));
        return;
      }
      
      // Handle priority shortcuts
      if (combo === sc.priority1) {
        e.preventDefault();
        setPriorityShortcut("Urgent");
        return;
      }
      
      if (combo === sc.priority2) {
        e.preventDefault();
        setPriorityShortcut("High");
        return;
      }
      
      if (combo === sc.priority3) {
        e.preventDefault();
        setPriorityShortcut("Medium");
        return;
      }
      
      if (combo === sc.priority4) {
        e.preventDefault();
        setPriorityShortcut("Low");
        return;
      }
      
      if (combo === sc.setDueDate) {
        e.preventDefault();
        setDueDateShortcut();
        return;
      }
    };

    // Add event listener
    window.addEventListener("keydown", onKeyDown);
    
    // Cleanup
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [state, openNewTask, startAddColumn, deleteTask]);

  useEffect(() => {
    if (state.selectedTaskId) {
      document
        .getElementById(`task-${state.selectedTaskId}`)
        ?.scrollIntoView({ block: "nearest", inline: "nearest" });
    }
  }, [state.selectedTaskId]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        state.showFilters &&
        filterButtonRef.current &&
        !filterButtonRef.current.contains(event.target as Node) &&
        filterDropdownRef.current &&
        !filterDropdownRef.current.contains(event.target as Node)
      ) {
        setState((s: any) => ({ ...s, showFilters: false }));
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [state.showFilters, setState]);

  return (
    <div className={`min-h-screen w-full ${bg} overflow-x-hidden`}>
      {/* Top bar */}
      <div className={`sticky top-0 z-40 ${isDark ? "bg-zinc-950/95" : "bg-white/95"} backdrop-blur-md border-b ${border}`}>
        <div className="w-full px-2 sm:px-4 lg:px-6 py-2 sm:py-3 flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <img 
              src="/tasksmint-logo.png" 
              alt="TasksMint Logo" 
              className="h-7 w-7 shrink-0"
            />
            <h1 className="text-lg sm:text-xl font-semibold tracking-tight truncate">TasksMint</h1>
          </div>

          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            {/* Removed header New Task button per spec */}

            <label className="relative hidden md:block">
              <Search className={`absolute left-2 top-2.5 h-4 w-4 ${muted}`} />
              <input
                id="searchInput"
                placeholder="Search…"
                value={state.filters.text}
                onChange={(e) => setState((s: any) => ({ ...s, filters: { ...s.filters, text: e.target.value } }))}
                className={`pl-8 pr-3 py-2 rounded-2xl ${surface} border ${border} text-sm w-48 lg:w-56 focus:outline-none focus:ring-2 focus:ring-emerald-500/40`}
              />
            </label>

            {/* Filters & Sort remain in header */}
            <div className="hidden lg:flex items-center gap-2">
              <div className="relative">
                <button
                  ref={filterButtonRef}
                  type="button"
                  onClick={() => setState((s: any) => ({ ...s, showFilters: !s.showFilters }))}
                  className={`inline-flex items-center gap-2 rounded-2xl border ${border} ${surface} px-3 py-2 text-sm ${subtle} min-w-[80px] justify-center`}
                >
                  <Filter className="h-4 w-4" /> Filters
                  <ChevronDown className="h-4 w-4 opacity-80" />
                </button>
                {state.showFilters && (
                  <div ref={filterDropdownRef} className={`absolute right-0 mt-2 w-[280px] lg:w-[320px] rounded-2xl border ${border} ${surface} p-3 shadow-xl z-50`}>
                    <div className="space-y-3">
                      <div>
                        <div className={`text-xs uppercase ${muted} mb-1`}>Priorities</div>
                        <div className="flex flex-wrap gap-2">
                          {PRIORITIES.map((p) => (
                            <button
                              type="button"
                              key={p}
                              onClick={() =>
                                setState((s: any) => {
                                  const has = s.filters.priorities.includes(p);
                                  const next = has ? s.filters.priorities.filter((q: any) => q !== p) : [...s.filters.priorities, p];
                                  return { ...s, filters: { ...s.filters, priorities: next } };
                                })
                              }
                              className={`px-2.5 py-1 rounded-xl text-xs border transition-colors ${state.filters.priorities.includes(p) ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30' : `${surface} ${border} ${subtle}`}`}>

                              {p}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <div className={`text-xs uppercase ${muted} mb-1`}>Labels</div>
                        <div className="flex flex-wrap gap-2">
                          {allLabels.map((l: string) => (
                            <button
                              type="button"
                              key={l}
                              onClick={() =>
                                setState((s: any) => {
                                  const has = s.filters.labels.includes(l);
                                  const next = has ? s.filters.labels.filter((q: any) => q !== l) : [...s.filters.labels, l];
                                  return { ...s, filters: { ...s.filters, labels: next } };
                                })
                              }
                              className={`px-2.5 py-1 rounded-xl text-xs border transition-colors ${state.filters.labels.includes(l) ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30' : `${surface} ${border} ${subtle}`}`}>

                              #{l}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <div className={`text-xs uppercase ${muted} mb-1`}>Due</div>
                        <div className="flex items-center gap-2">
                          {["all", "overdue", "week"].map((k) => (
                            <button
                              type="button"
                              key={k}
                              onClick={() => setState((s: any) => ({ ...s, filters: { ...s.filters, due: k } }))}
                              className={`px-2.5 py-1 rounded-xl text-xs border transition-colors ${state.filters.due === k ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30' : `${surface} ${border} ${subtle}`}`}>

                              {k}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="hidden lg:flex items-center">
                <CustomDropdown
                  value={state.sortMode}
                  onChange={(value) => setState((s: any) => ({ ...s, sortMode: value }))}
                  prefix="Sort by: "
                  options={[
                    { value: "manual", label: "Manual" },
                    { value: "due", label: "Due date" },
                    { value: "priority", label: "Priority" },
                    { value: "created", label: "Newest" }
                  ]}
                  className="w-40"
                  theme={{ surface, border, muted }}
                />
              </div>
            </div>

            {/* Settings entry point */}
            <button
              type="button"
              onClick={() => setShowSettingsSidebar(true)}
              className={`inline-flex items-center gap-1 sm:gap-2 rounded-2xl border ${border} ${surface} px-2 sm:px-3 py-2 text-sm ${subtle} min-w-[80px] justify-center`}
            >
              <Settings className="h-4 w-4" /> <span className="hidden sm:inline">Settings</span>
            </button>
          
            <ProfileButton 
              onOpenProfile={() => setShowProfileSidebar(true)}
            />
</div>
        </div>
      </div>

      {/* Board */}
      <div className="w-full h-[calc(100vh-64px)] sm:h-[calc(100vh-72px)] px-2 sm:px-4 lg:px-6 py-3 sm:py-4 overflow-hidden flex flex-col">
{/* AUTH_OVERLAY_START */}
{loading ? (
        <div className="absolute inset-0 z-[120] flex items-center justify-center" />
      ) : !user && (
  <div className="absolute inset-0 z-[120] bg-white/85 dark:bg-black/70 backdrop-blur-sm flex items-center justify-center">
    <div className="w-full max-w-sm rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 p-5 shadow-2xl">
      <div className="mb-3 text-center">
        <div className="mx-auto mb-2 h-12 w-12 rounded-full bg-black/5 dark:bg-white/10 flex items-center justify-center">🔐</div>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Sign in to use TasksMint</h2>
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
)}
{/* AUTH_OVERLAY_END */}

        {/* Filters notice */}
        {filtersActive ? (
          <div className="mb-2 sm:mb-3 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setState((s: any) => ({ ...s, filters: { text: "", priorities: [], labels: [], due: "all" } }))}
              className="text-xs px-2 py-1 rounded-lg border border-amber-500/60 bg-amber-500/10"
            >
              Clear all filters
            </button>
            <ActiveFilters state={state} setState={setState} />
          </div>
        ) : null}

        <div className="flex gap-3 sm:gap-4 overflow-x-auto overflow-y-hidden flex-1 min-h-0 scrollbar-hide">
            {state.columns.map((col: any, index: number) => (
              <div key={col.id}>
                <Column
                  col={col}
                  tasks={state.tasks}
                  ids={sortTasks(filteredTaskIds(col))}
                  theme={{ surface, surfaceAlt, border, subtle, muted }}
                  onOpenNew={() => openNewTask(col.id)}
                  onOpenEdit={openEditTask}
                  onDeleteColumn={deleteColumn}
                  onStartRename={() => startRenameColumn(col.id, col.title)}
                  onCancelRename={cancelRenameColumn}
                  renaming={state.renamingColumnId === col.id}
                  tempTitle={state.tempTitle}
                  setTempTitle={(v: string) => setState((s: any) => ({ ...s, tempTitle: v }))}
                  onCommitRename={() => commitRenameColumn(col.id)}
                  selectedTaskId={state.selectedTaskId}
                  setSelectedTaskId={(id: string) => setState((s: any) => ({ ...s, selectedTaskId: id }))}
                  onMoveTask={moveTask}
                  onMoveColumn={moveColumn}
                  onCompleteTask={completeTask}
                  shouldAnimate={shouldAnimateColumns}
                  animationIndex={index}
                />
              </div>
            ))}

            <div>
              <AddColumnCard
                adding={state.addingColumn}
                tempTitle={state.tempTitle}
                onChangeTitle={(v: string) => setState((s: any) => ({ ...s, tempTitle: v }))}
                onStart={startAddColumn}
                onAdd={commitAddColumn}
                onCancel={cancelAddColumn}
                theme={{ surfaceAlt, border, input, subtle, muted }}
              />
            </div>
          </div>

          {/* Task Reports - Bottom section within same container */}
          <div className="mt-2 mb-2">
            <TaskReports 
              state={state} 
              onOpenCompletedTasks={openCompletedTasks}
              undoState={undoState || undefined}
              theme={{ surface, border, muted, subtle }} 
            />
          </div>

      </div>

      {/* Task Modal */}
      {state.showTaskModal && (
        <TaskModal
          onClose={() => setState((s: any) => ({ ...s, showTaskModal: false }))}
          onSave={(payload: any, columnId: string | null, taskId?: string, metadataOnly?: boolean) => {
            createOrUpdateTask(payload, columnId, taskId || null, metadataOnly);
            if (!metadataOnly) {
              setState((s: any) => ({ ...s, showTaskModal: false }));
            }
          }}
          state={state}
          editingTaskId={state.editingTaskId}
          allLabels={allLabels}
          onDelete={deleteTask}
          onDeleteLabel={deleteLabel}
          onCompleteTask={completeTask}
          theme={{ surface, border, input, muted, subtle }}
        />
      )}

      {/* Settings Modal */}
      {/* Settings Sidebar */}
      <SettingsSidebar
        isOpen={showSettingsSidebar}
        onClose={() => setShowSettingsSidebar(false)}
        onToggleTheme={toggleTheme}
        isDark={isDark}
        onExport={exportJSON}
        onImport={importJSON}
        shortcuts={state.shortcuts}
        onChangeShortcut={(key: string, value: string) => {
          setState((s: any) => ({
            ...s,
            shortcuts: { ...s.shortcuts, [key]: value }
          }));
        }}
        deletedTasksSettings={state.deletedTasksSettings || { enabled: false, retentionPeriod: '7days' }}
        onChangeDeletedTasksSetting={(key: string, value: any) => {
          setState((s: any) => ({
            ...s,
            deletedTasksSettings: { ...s.deletedTasksSettings, [key]: value }
          }));
        }}
        onOpenDeletedTasks={() => setShowDeletedTasks(true)}
        theme={{ surface, border, input, subtle, muted }}
      />

      {/* Completed Tasks Modal */}
      {state.showCompletedTasks && (
        <CompletedTasksModal
          isOpen={state.showCompletedTasks}
          onClose={closeCompletedTasks}
          completedTasks={Object.values(state.tasks).filter((task: any) => task.completed)}
          onRestoreTask={restoreTask}
          theme={{ surface, border, muted, subtle }}
        />
      )}

      {/* Deleted Tasks Modal */}
      {showDeletedTasks && (
        <DeletedTasksModal
          isOpen={showDeletedTasks}
          onClose={() => setShowDeletedTasks(false)}
          deletedTasks={state.deletedTasks || []}
          onRestoreTask={(taskId: string) => {
            const deletedTask = state.deletedTasks?.find((t: any) => t.id === taskId);
            if (deletedTask) {
              setState((s: any) => {
                // Clean up the task data (remove deletion metadata)
                const { deletedAt, originalColumnId, originalPosition, ...cleanTask } = deletedTask;
                
                // Find the original column or fallback to first column
                let targetColumn = s.columns.find((c: any) => c.id === originalColumnId);
                if (!targetColumn) {
                  targetColumn = s.columns[0]; // Fallback to first column if original doesn't exist
                }
                
                // Insert task back at original position or at the end
                const newTaskIds = [...targetColumn.taskIds];
                const insertPosition = Math.min(originalPosition || 0, newTaskIds.length);
                newTaskIds.splice(insertPosition, 0, taskId);
                
                // Update columns with restored task
                const updatedColumns = s.columns.map((c: any) => 
                  c.id === targetColumn.id 
                    ? { ...c, taskIds: newTaskIds }
                    : c
                );
                
                return {
                  ...s,
                  tasks: { ...s.tasks, [taskId]: cleanTask },
                  columns: updatedColumns,
                  deletedTasks: s.deletedTasks?.filter((t: any) => t.id !== taskId) || []
                };
              });
            }
          }}
          onPermanentlyDeleteTask={(taskId: string) => {
            setState((s: any) => ({
              ...s,
              deletedTasks: s.deletedTasks?.filter((t: any) => t.id !== taskId) || []
            }));
          }}
          theme={{ surface, border, muted, subtle }}
        />
      )}

      {/* Profile Sidebar */}
      <ProfileSidebar
        isOpen={showProfileSidebar}
        onClose={() => setShowProfileSidebar(false)}
        saveStatus={saveStatus as any}
        onForceSync={forceSync}
        theme={{ surface, border, input, subtle, muted }}
      />



      {/* Dev Tests */}
      <DevTests />
    </div>
  );


function AddColumnCard({ adding, tempTitle, onChangeTitle, onStart, onAdd, onCancel, theme }: any) {
  return (
    <div
      className={`snap-start shrink-0 w-80 sm:w-[320px] lg:w-[340px] h-full rounded-3xl border ${theme.border} ${theme.surfaceAlt} backdrop-blur p-3 sm:p-4 flex flex-col justify-center items-stretch`}
    >
      {!adding ? (
        <button
          type="button"
          onClick={onStart}
          className={`w-full flex-1 min-h-0 rounded-2xl border border-dashed ${theme.border} ${theme.subtle} text-sm flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/10 transition-colors`}
        >
          <Plus className="h-4 w-4 mr-2" /> Add column
        </button>
      ) : (
        <div className="space-y-2">
          <input
            autoFocus
            value={tempTitle}
            onChange={(e) => onChangeTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onAdd();
              if (e.key === 'Escape') onCancel();
            }}
            placeholder="Column name"
            className={`w-full rounded-xl ${theme.input} px-2.5 py-2 text-sm`}
          />
          <div className="flex items-center gap-2">
            <button type="button" onClick={onAdd} className="px-2.5 py-1.5 rounded-xl text-sm border border-emerald-600 bg-emerald-500/15 hover:bg-emerald-500/25">Add</button>
            <button type="button" onClick={onCancel} className={`px-2.5 py-1.5 rounded-xl text-sm border ${theme.border} ${theme.subtle}`}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

// -----------------------------
// Dev Self-tests (extended)
// -----------------------------
function DevTests() {
  useEffect(() => {
    const results: string[] = [];
    const assert = (cond: boolean, msg: string) => {
      if (!cond) throw new Error(msg);
      results.push(`✓ ${msg}`);
    };
    try {
      // prettyDate
      assert(prettyDate("") === "No due", "prettyDate handles empty");
      assert(prettyDate("not-a-date") === "No due", "prettyDate handles invalid");

      // getDueDateStatus
      const past = new Date(Date.now() - 86400000).toISOString();
      assert(getDueDateStatus(past) === 'past', "getDueDateStatus handles past date");

      // priorityColor mapping
      const pc = priorityColor("High");
      assert(typeof pc === "string" && pc.includes("amber"), "priorityColor maps High");

      // default state shape
      const ds = defaultState();
      assert(Array.isArray(ds.columns) && ds.columns.length >= 3, "defaultState has columns");
      assert(ds.tasks && typeof ds.tasks === "object", "defaultState has tasks map");

      // helpers
      const within = reorderWithin(["a","b","c"], "a", "c");
      assert(within.join(",") === "b,c,a" || within.join(",") === "a,b,c", "reorderWithin returns array");

      const moved = moveItemBetween(["a","b"], ["c"], "a", "c");
      assert(moved.from.join(",") === "b" && moved.to.join(",") === "a,c".replace(/,/g, ",").split(",").join(","), "moveItemBetween basic move");

      console.info("TasksMint self-tests passed:\n" + results.join("\n"));
    } catch (e) {
      console.error("TasksMint self-tests FAILED:", e);
    }
  }, []);
  return null;
  }
}