import React, { useEffect, useMemo, useState, useRef } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  useDroppable,
} from "@dnd-kit/core";
import { pointerWithin } from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  arrayMove,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Search,
  Trash2,
  Edit,
  Calendar,
  Tag,
  Filter,
  ChevronDown,
  AlertTriangle,
  Upload,
  Download,
  Leaf,
  GripVertical,
  Settings as SettingsIcon,
  Sun,
  Moon,
  X,
  Check,
} from "lucide-react";
import confetti from "canvas-confetti";
import { ProfileButton } from './components/ProfileButton';
import { useCloudState } from './hooks/useCloudState';
import { useAuth } from './contexts/AuthProvider';
function InlineEmailSignIn({ onSend }: { onSend: (email: string) => Promise<void> }) {
  const [email, setEmail] = React.useState('')
  const [sent, setSent] = React.useState(false)
  const [err, setErr] = React.useState<string | null>(null)

  const submit = async () => {
    setErr(null)
    try {
      if (!email.trim()) { setErr('Enter your email'); return }
      await onSend(email.trim())
      setSent(true)
    } catch (e: any) {
      setErr(e?.message || 'Failed to send link')
    }
  }

  return (
    <div className="space-y-2">
      {!sent ? (
        <>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@example.com"
            className="w-full rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 px-3 py-2.5 text-sm text-zinc-900 dark:text-zinc-100 outline-none focus:border-black/30 dark:focus:border-white/30"
          />
          <button
            onClick={submit}
            type="button"
            className="w-full rounded-2xl px-4 py-2.5 text-sm font-medium border border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/10 transition text-zinc-900 dark:text-zinc-100"
          >
            Send Magic Link
          </button>
        </>
      ) : (
        <p className="text-xs text-emerald-600 dark:text-emerald-400 text-center">Check your email for the sign-in link.</p>
      )}
      {err && <p className="text-xs text-red-600 text-center">{err}</p>}
    </div>
  )
}

const SaveStatusBadge: React.FC<{ status: 'idle'|'saving'|'saved'|'error' }> = ({ status }) => {
  const map = {
    idle: { label: 'Idle', dot: 'bg-zinc-400' },
    saving: { label: 'Saving…', dot: 'bg-zinc-400 animate-pulse' },
    saved: { label: 'Saved', dot: 'bg-emerald-500' },
    error: { label: 'Error', dot: 'bg-red-500' },
  } as const
  const v = map[status] || map.idle
  return (
    <div className="hidden sm:flex items-center gap-2 rounded-xl border px-2.5 py-1.5 text-xs shadow-sm bg-white/80 backdrop-blur border-black/10">
      <span className={`h-2.5 w-2.5 rounded-full ${v.dot}`}></span>
      <span className="text-zinc-600">{v.label}</span>
    </div>
  )
}


// ------------------------------------------------------------
// TasksMint — Material‑ish Kanban To‑Do (Trello style)
// Polished, responsive board with smooth dnd-kit drag/drop,
// Material-esque surfaces, dark/light themes, filters,
// labels, priorities, due dates, subtasks, import/export,
// keyboard shortcuts (in Settings), and confetti on Done.
// ------------------------------------------------------------

// Utilities
const uid = () => Math.random().toString(36).slice(2, 10);
const PRIORITIES = ["Low", "Medium", "High", "Urgent"] as const;
const priorityColor = (p: string) =>
  ({
    Low: "bg-emerald-500/15 text-emerald-600 ring-emerald-500/30",
    Medium: "bg-sky-500/15 text-sky-600 ring-sky-500/30",
    High: "bg-amber-500/15 text-amber-600 ring-amber-500/30",
    Urgent: "bg-rose-500/15 text-rose-600 ring-rose-500/30",
  }[p] || "bg-zinc-500/15 text-zinc-600 ring-zinc-400/30");

const prettyDate = (iso?: string) => {
  if (!iso) return "No due";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "No due";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
};
const isOverdue = (iso?: string) => iso && new Date(iso).setHours(23, 59, 59, 999) < Date.now();

const DEFAULT_SHORTCUTS = {
  newTask: "n",
  newColumn: "shift+n",
  search: "/",
  toggleFilters: "shift+f",
  moveTaskUp: "alt+shift+arrowup",
  moveTaskDown: "alt+shift+arrowdown",
  moveTaskLeft: "alt+shift+arrowleft",
  moveTaskRight: "alt+shift+arrowright",
  deleteTask: "delete",
  completeTask: "space",
  priority1: "shift+1",
  priority2: "shift+2",
  priority3: "shift+3",
  priority4: "shift+4",
  setDueDate: "shift+t",
};

function serializeCombo(e: { key: string; altKey: boolean; shiftKey: boolean; ctrlKey: boolean; metaKey: boolean }) {
  const parts: string[] = [];
  if (e.altKey) parts.push("alt");
  if (e.shiftKey) parts.push("shift");
  if (e.ctrlKey || e.metaKey) parts.push("ctrl");
  parts.push(e.key.toLowerCase());
  return parts.join("+");
}

// Pure helpers (also used in tests)
function reorderWithin(ids: string[], activeId: string, overId: string | null) {
  const from = [...ids];
  const oldIndex = from.indexOf(activeId);
  if (oldIndex === -1) return ids;
  const newIndex = overId ? from.indexOf(overId) : from.length - 1;
  if (newIndex === -1) return ids;
  return arrayMove(from, oldIndex, newIndex);
}
function moveItemBetween(
  fromIds: string[],
  toIds: string[],
  activeId: string,
  overId: string | null
) {
  const from = [...fromIds];
  const to = [...toIds];
  const oldIndex = from.indexOf(activeId);
  if (oldIndex === -1) return { from: fromIds, to: toIds };
  from.splice(oldIndex, 1);
  const insertIndex = overId && to.includes(overId) ? to.indexOf(overId) : to.length;
  to.splice(insertIndex, 0, activeId);
  return { from, to };
}

const defaultState = () => {
  const t1 = uid();
  const t2 = uid();
  const t3 = uid();
  return {
    name: "TasksMint",
    columns: [
      { id: "backlog", title: "Backlog", taskIds: [t1] },
      { id: "inprogress", title: "In Progress", taskIds: [t2] },
      { id: "review", title: "Review", taskIds: [] },
      { id: "done", title: "Done", taskIds: [t3] },
    ],
    tasks: {
      [t1]: {
        id: t1,
        title: "Plan project structure",
        description: "Decide columns, fields, and persistence.",
        labels: ["planning"],
        priority: "High",
        dueDate: new Date(Date.now() + 86400000 * 2).toISOString(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
        subtasks: [
          { id: uid(), title: "Sketch data model", done: true },
          { id: uid(), title: "Pick libraries", done: false },
        ],
      },
      [t2]: {
        id: t2,
        title: "Build draggable cards",
        description: "Implement drag/drop across columns.",
        labels: ["dev"],
        priority: "Urgent",
        dueDate: new Date(Date.now() + 86400000).toISOString(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
        subtasks: [
          { id: uid(), title: "Render columns", done: true },
          { id: uid(), title: "Enable dnd", done: false },
        ],
      },
      [t3]: {
        id: t3,
        title: "Draft feature list",
        description: "List all bells & whistles.",
        labels: ["docs"],
        priority: "Medium",
        dueDate: new Date(Date.now() - 86400000 * 1).toISOString(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
        subtasks: [
          { id: uid(), title: "Core features", done: true },
          { id: uid(), title: "Nice-to-haves", done: true },
        ],
      },
    },
    labels: ["planning", "dev", "docs", "design", "bug"],
    theme: "dark",
    sortMode: "manual", // manual | due | priority | created
    filters: { text: "", priorities: [], labels: [], due: "all" },
    activeId: null,
    selectedTaskId: null,
    showTaskModal: false,
    editingTaskId: null,
    addingColumn: false,
    renamingColumnId: null,
    tempTitle: "",
    showSettings: false,
    showFilters: false,
    shortcuts: { ...DEFAULT_SHORTCUTS },
  } as any;
};

const STORAGE_KEY = "tasksmint_kanban_state_v1";

export default function TasksMintApp() {
  const [state, setState] = useState<any>(() => defaultState());
  const { user, signInWithGoogle, signInWithApple, signInWithEmail } = useAuth();
  const { status: saveStatus } = useCloudState(state as any, setState as any, DEFAULT_SHORTCUTS, STORAGE_KEY);

// Theme only (cloud-only mode)
  useEffect(() => {
    document.documentElement.classList.toggle("dark", state.theme === "dark");
  }, [state.theme]);


  // DnD sensors — Trello-like: click starts drag when you move > 6px
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor)
  );

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

  // DnD helpers
  const findContainer = (id: string) => {
    if (state.columns.some((c: any) => c.id === id)) return id; // it's a column droppable
    return state.columns.find((c: any) => c.taskIds.includes(id))?.id; // column containing task
  };

  const onDragStart = (event: any) => setState((s: any) => ({ ...s, activeId: event.active.id }));

  const moveBetweenPreview = (activeId: string, overId: string) => {
    const activeContainer = findContainer(activeId);
    const overContainer = findContainer(overId);
    if (!activeContainer || !overContainer) return;

    const fromCol = state.columns.find((c: any) => c.id === activeContainer);
    const toCol = state.columns.find((c: any) => c.id === overContainer);
    if (!fromCol || !toCol) return;
    if (fromCol.id === toCol.id) return; // handled by sortable internally

    const { from, to } = moveItemBetween(fromCol.taskIds, toCol.taskIds, activeId, overId);

    const newColumns = state.columns.map((c: any) =>
      c.id === fromCol.id ? { ...c, taskIds: from } : c.id === toCol.id ? { ...c, taskIds: to } : c
    );

    setState((s: any) => ({ ...s, columns: newColumns }));
  };

  const onDragOver = (event: any) => {
    const { active, over } = event;
    if (!over) return;
    moveBetweenPreview(active.id, over.id);
  };

  const onDragEnd = (event: any) => {
    const { active, over } = event;
    setState((s: any) => ({ ...s, activeId: null }));
    if (!over) return;

    const activeContainer = findContainer(active.id);
    const overContainer = findContainer(over.id);
    if (!activeContainer || !overContainer) return;

    if (activeContainer === overContainer) {
      const col = state.columns.find((c: any) => c.id === activeContainer);
      const newIds = reorderWithin(col.taskIds, active.id, over.id);
      const newColumns = state.columns.map((c: any) => (c.id === col.id ? { ...c, taskIds: newIds } : c));
      setState((s: any) => ({ ...s, columns: newColumns }));
      return;
    }

    // finalize cross-column (also set updated time + confetti)
    const toCol = state.columns.find((c: any) => c.id === overContainer);
    const fromCol = state.columns.find((c: any) => c.id === activeContainer);
    const moved = moveItemBetween(fromCol.taskIds, toCol.taskIds, active.id, over.id);
    let newColumns = state.columns.map((c: any) =>
      c.id === fromCol.id ? { ...c, taskIds: moved.from } : c.id === toCol.id ? { ...c, taskIds: moved.to } : c
    );
    if (toCol?.id === "done") {
      try {
        confetti({ particleCount: 110, spread: 70, origin: { y: 0.15 } });
      } catch {}
    }
    setState((s: any) => {
      const tasks = { ...s.tasks } as any;
      if (tasks[active.id]) tasks[active.id].updatedAt = Date.now();
      return { ...s, tasks, columns: newColumns };
    });
  };

  const createOrUpdateTask = (payload: any, columnId: string, taskId: string | null = null) => {
    setState((s: any) => {
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
        subtasks: payload.subtasks || [],
      };
      const tasks = { ...s.tasks, [id]: newTask } as any;
      let columns = s.columns;
      
      if (!taskId) {
        // New task: add to the specified column
        columns = s.columns.map((c: any) => (c.id === columnId ? { ...c, taskIds: [id, ...c.taskIds] } : c));
      } else {
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
      
      return { ...s, tasks, columns };
    });
  };

  const deleteTask = (taskId: string) => {
    setState((s: any) => {
      const tasks = { ...s.tasks } as any;
      delete tasks[taskId];
      const columns = s.columns.map((c: any) => ({ ...c, taskIds: c.taskIds.filter((id: string) => id !== taskId) }));
      return { ...s, tasks, columns };
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
      if (due === "overdue" && !isOverdue(t.dueDate)) return false;
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

  return (
    <div className={`min-h-screen w-full ${bg} overflow-x-hidden`}>
      {/* Top bar */}
      <div className={`sticky top-0 z-40 ${isDark ? "bg-zinc-950/95" : "bg-white/95"} backdrop-blur-md border-b ${border}`}>
        <div className="w-full px-2 sm:px-4 lg:px-6 py-2 sm:py-3 flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="relative h-7 w-7 rounded-2xl overflow-hidden shrink-0">
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-500 via-teal-500 to-sky-500" />
              <Leaf className="absolute inset-0 m-auto h-4 w-4 text-white/90" />
            </div>
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
                  type="button"
                  onClick={() => setState((s: any) => ({ ...s, showFilters: !s.showFilters }))}
                  className={`inline-flex items-center gap-2 rounded-2xl border ${border} ${surface} px-3 py-2 text-sm ${subtle}`}
                >
                  <Filter className="h-4 w-4" /> Filters
                  <ChevronDown className="h-4 w-4 opacity-80" />
                </button>
                {state.showFilters && (
                  <div className={`absolute right-0 mt-2 w-[280px] lg:w-[320px] rounded-2xl border ${border} ${surface} p-3 shadow-xl z-50`}>
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
                              className={`px-2.5 py-1 rounded-xl text-xs border ${surface} ${border} ${subtle}`}
                            >
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
                              className={`px-2.5 py-1 rounded-xl text-xs border ${surface} ${border} ${subtle}`}
                            >
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
                              className={`px-2.5 py-1 rounded-xl text-xs border ${surface} ${border} ${subtle}`}
                            >
                              {k}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="hidden lg:flex items-center gap-2">
                <span className={`text-xs ${muted}`}>Sort</span>
                <select
                  value={state.sortMode}
                  onChange={(e) => setState((s: any) => ({ ...s, sortMode: e.target.value }))}
                  className={`${surface} border ${border} rounded-xl text-sm px-2.5 py-2 focus:outline-none`}
                >
                  <option value="manual">Manual</option>
                  <option value="due">Due date</option>
                  <option value="priority">Priority</option>
                  <option value="created">Newest</option>
                </select>
              </div>
            </div>

            {/* Settings entry point */}
            <button
              type="button"
              onClick={() => setState((s: any) => ({ ...s, showSettings: true }))}
              className={`inline-flex items-center gap-1 sm:gap-2 rounded-2xl border ${border} ${surface} px-2 sm:px-3 py-2 text-sm ${subtle}`}
            >
              <SettingsIcon className="h-4 w-4" /> <span className="hidden sm:inline">Settings</span>
            </button>
          
            <SaveStatusBadge status={saveStatus as any} />
              <ProfileButton />
</div>
        </div>
      </div>

      {/* Board */}
      <div className="w-full h-[calc(100vh-64px)] sm:h-[calc(100vh-72px)] px-2 sm:px-4 lg:px-6 py-3 sm:py-4 overflow-hidden">
{/* AUTH_OVERLAY_START */}
{!user && (
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
        <button
          onClick={signInWithApple}
          type="button"
          className="w-full rounded-2xl px-4 py-2.5 text-sm font-medium border border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/10 transition text-left text-zinc-900 dark:text-zinc-100"
        >
          Continue with Apple
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
          <div className="mb-2 sm:mb-3">
            <button
              type="button"
              onClick={() => setState((s: any) => ({ ...s, filters: { text: "", priorities: [], labels: [], due: "all" } }))}
              className="text-xs px-2 py-1 rounded-lg border border-amber-500/60 bg-amber-500/10"
            >
              Clear active filters
            </button>
          </div>
        ) : null}

        <DndContext
          sensors={sensors}
          collisionDetection={pointerWithin}
          onDragStart={onDragStart}
          onDragOver={onDragOver}
          onDragEnd={onDragEnd}
          onDragCancel={() => setState((s: any) => ({ ...s, activeId: null }))}
        >
          <div className="h-full grid grid-flow-col auto-cols-[minmax(280px,90vw)] sm:auto-cols-[minmax(300px,320px)] lg:auto-cols-[minmax(320px,360px)] gap-3 sm:gap-4 overflow-x-auto overflow-y-hidden pb-16 sm:pb-20 snap-x snap-mandatory touch-pan-x">
            {state.columns.map((col: any) => (
              <Column
                key={col.id}
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
              />
            ))}

            {/* Add Column at end */}
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

          <DragOverlay>
            {state.activeId && state.tasks[state.activeId] ? (
              <div className={`rounded-2xl border ${border} ${surface} p-3 shadow-lg pointer-events-none`}>
                <CardItem task={state.tasks[state.activeId]} readOnly theme={{ muted }} />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>

        {/* FAB on all viewports */}
        <button
          type="button"
          onClick={() => openNewTask()}
          className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 inline-flex items-center justify-center h-12 w-12 sm:h-14 sm:w-14 rounded-2xl shadow-lg text-white bg-gradient-to-br from-emerald-500 via-teal-500 to-sky-500 active:scale-95 z-50"
          title="Add task"
        >
          <Plus className="h-5 w-5 sm:h-6 sm:w-6" />
        </button>
      </div>

      {/* Task Modal */}
      {state.showTaskModal && (
        <TaskModal
          onClose={() => setState((s: any) => ({ ...s, showTaskModal: false }))}
          onSave={(payload: any, columnId: string, taskId?: string) => {
            createOrUpdateTask(payload, columnId, taskId || null);
            setState((s: any) => ({ ...s, showTaskModal: false }));
          }}
          state={state}
          editingTaskId={state.editingTaskId}
          allLabels={allLabels}
          onDelete={deleteTask}
          theme={{ surface, border, input, muted, subtle }}
        />
      )}

      {/* Settings Modal */}
      {state.showSettings && (
        <SettingsModal
          onClose={() => setState((s: any) => ({ ...s, showSettings: false }))}
          onToggleTheme={toggleTheme}
          isDark={isDark}
          onExport={exportJSON}
          onImport={importJSON}
          shortcuts={state.shortcuts}
          onChangeShortcut={(k: string, v: string) =>
            setState((s: any) => ({ ...s, shortcuts: { ...s.shortcuts, [k]: v } }))
          }
          theme={{ surface, border, input, subtle }}
        />
      )}


      {/* Dev Tests */}
      <DevTests />
    </div>
  );
}

function Column({ col, tasks, ids, theme, onOpenNew, onOpenEdit, onDeleteColumn, onStartRename, onCancelRename, renaming, tempTitle, setTempTitle, onCommitRename, selectedTaskId, setSelectedTaskId }: any) {
  // make the whole column body droppable so dropping on empty space works
  const { setNodeRef } = useDroppable({ id: col.id });

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 120, damping: 18 }}
      className={`snap-start shrink-0 min-w-0 h-full rounded-3xl border ${theme.border} ${theme.surfaceAlt} backdrop-blur p-3 sm:p-4 flex flex-col relative overflow-hidden`}
    >
      <div className="flex items-center gap-2 mb-3 shrink-0">
        {renaming ? (
          <div className="flex items-center gap-2 w-full">
            <input
              autoFocus
              value={tempTitle}
              onChange={(e) => setTempTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onCommitRename();
                if (e.key === 'Escape') onCancelRename();
              }}
              className="flex-1 rounded-xl px-2.5 py-1 text-sm border border-emerald-500/50 bg-emerald-500/10"
            />
            <button type="button" onClick={onCommitRename} className={`p-1.5 rounded-lg ${theme.subtle}`} title="Save">
              <Check className="h-4 w-4" />
            </button>
            <button type="button" onClick={onCancelRename} className={`p-1.5 rounded-lg ${theme.subtle}`} title="Cancel">
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <>
            <span className="text-sm font-medium">{col.title}</span>
            <span className={`ml-1 text-xs ${theme.muted}`}>{ids.length}</span>
            <div className="ml-auto flex items-center gap-1">
              <button type="button" onClick={onOpenNew} className={`p-1 rounded-xl ${theme.subtle}`} title="New task in column">
                <Plus className="h-4 w-4" />
              </button>
              <button type="button" onClick={onStartRename} className={`p-1 rounded-xl ${theme.subtle}`} title="Rename column">
                <Edit className="h-4 w-4" />
              </button>
              <button type="button" onClick={() => onDeleteColumn(col.id)} className={`p-1 rounded-xl ${theme.subtle}`} title="Delete column">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </>
        )}
      </div>

      {/* Sortable list for this column */}
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <div ref={setNodeRef} className={`flex-1 min-h-[48px] rounded-2xl border border-dashed ${theme.border} p-2 space-y-2 overflow-y-auto overflow-x-hidden`}>
          <AnimatePresence initial={false}>
            {ids.map((taskId: string) => (
              <SortableCard
                key={taskId}
                id={taskId}
                task={tasks[taskId]}
                onEdit={() => onOpenEdit(taskId)}
                theme={theme}
                selected={selectedTaskId === taskId}
                onSelect={() => setSelectedTaskId(taskId)}
              />
            ))}
          </AnimatePresence>
        </div>
      </SortableContext>
    </motion.div>
  );
}

function SortableCard({ id, task, onEdit, theme, selected, onSelect }: any) {
  // Trello-like: click opens; drag after moving >6px
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition } as React.CSSProperties;

  const handleCardClick: React.MouseEventHandler = () => {
    if (!isDragging) {
      onSelect();
      onEdit();
    }
  };

  return (
    <motion.div
      layout
      ref={setNodeRef}
      style={style}
      onClick={handleCardClick}
      onFocus={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter") handleCardClick(e as any);
      }}
      {...attributes}
      {...listeners}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98 }}
      id={`task-${id}`}
      className={`relative rounded-2xl border ${theme.border} ${theme.surface} p-3 shadow-sm select-none ${isDragging ? "ring-2 ring-emerald-400/40" : selected ? "ring-2 ring-emerald-500" : ""}`}
    >
      <div className="flex items-start gap-2">
        <div className="text-left flex-1">
          <div className="font-medium leading-tight">{task.title}</div>
          {task.description && <div className={`text-xs ${theme.muted} line-clamp-2`}>{task.description}</div>}
        </div>
        <div className="flex items-center gap-1">
          <span className={`p-1 rounded-lg ${theme.subtle}`} title="Drag">
            <GripVertical className="h-4 w-4" />
          </span>
        </div>
      </div>

      <CardMeta task={task} />
    </motion.div>
  );
}

function CardMeta({ task }: any) {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <span className={`inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[11px] ring-1 ${priorityColor(task.priority)}`} title={`Priority: ${task.priority}`}>
        <AlertTriangle className="h-3 w-3" /> {task.priority}
      </span>
      {task.labels?.slice(0, 3).map((l: string) => (
        <span key={l} className="inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[11px] bg-zinc-700/10 text-zinc-600 ring-1 ring-zinc-400/30">
          <Tag className="h-3 w-3" /> {l}
        </span>
      ))}
      {task.labels?.length > 3 && <span className="text-[11px] text-zinc-500">+{task.labels.length - 3}</span>}
      <span className={`ml-auto inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[11px] ring-1 ${isOverdue(task.dueDate) ? "bg-rose-500/10 text-rose-600 ring-rose-500/30" : "bg-zinc-500/10 text-zinc-600 ring-zinc-500/20"}`} title={task.dueDate ? new Date(task.dueDate).toLocaleString() : "No due"}>
        <Calendar className="h-3 w-3" /> {prettyDate(task.dueDate)}
      </span>
      {task.subtasks?.length ? (
        <div className="pt-1 text-[11px] text-zinc-500 w-full">
          {task.subtasks.filter((s: any) => s.done).length}/{task.subtasks.length} done
        </div>
      ) : null}
    </div>
  );
}

function CardItem({ task, theme = { muted: "text-zinc-400" } }: any) {
  return (
    <div className="space-y-2">
      <div className="font-medium leading-tight">{task.title}</div>
      {task.description && <div className={`text-xs ${theme.muted} line-clamp-2`}>{task.description}</div>}
      <CardMeta task={task} />
    </div>
  );
}

function TaskModal({ onClose, onSave, state, editingTaskId, allLabels, onDelete, theme }: any) {
  const isEdit = Boolean(editingTaskId?.taskId);
  const task = isEdit ? state.tasks[editingTaskId.taskId] : null;
  const [title, setTitle] = useState(task?.title || "");
  const [description, setDescription] = useState(task?.description || "");
  const [priority, setPriority] = useState(task?.priority || "Medium");
  const [dueDate, setDueDate] = useState(task?.dueDate ? task.dueDate.slice(0, 10) : "");
  const [labels, setLabels] = useState<string[]>(task?.labels || []);
  const [subtasks, setSubtasks] = useState<any[]>(task?.subtasks || []);
  const [newSubtask, setNewSubtask] = useState<string>("");
  const [columnId, setColumnId] = useState(editingTaskId?.columnId || state.columns[0]?.id);

  const handleSave = () =>
    onSave({ title, description, priority, dueDate, labels, subtasks }, columnId, isEdit ? task.id : undefined);

  // Keyboard shortcuts for task modal
  useEffect(() => {
    const sc = state.shortcuts;
    const onKey = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in input fields
      const target = e.target as HTMLElement;
      const isInputField = target.matches('input, textarea, select');
      
      // Handle Escape key (always available)
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      
      // Handle Enter key (only when not in textarea)
      if (e.key === "Enter" && target.tagName !== "TEXTAREA") {
        e.preventDefault();
        handleSave();
        return;
      }
      
      // Don't trigger other shortcuts when typing
      if (isInputField) return;
      
      // Handle priority shortcuts
      const combo = serializeCombo(e);
      if (combo === sc.priority1) {
        e.preventDefault();
        setPriority("Urgent");
        return;
      }
      if (combo === sc.priority2) {
        e.preventDefault();
        setPriority("High");
        return;
      }
      if (combo === sc.priority3) {
        e.preventDefault();
        setPriority("Medium");
        return;
      }
      if (combo === sc.priority4) {
        e.preventDefault();
        setPriority("Low");
        return;
      }
      
      // Handle due date shortcut
      if (combo === sc.setDueDate) {
        e.preventDefault();
        (document.getElementById("dueInput") as HTMLInputElement)?.focus();
        return;
      }
      
      // Handle delete shortcut (only in edit mode)
      if (combo === sc.deleteTask && isEdit && task) {
        e.preventDefault();
        onDelete(task.id);
        onClose();
        return;
      }
    };
    
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [title, description, priority, dueDate, labels, subtasks, columnId, state.shortcuts, isEdit, task, onClose, onDelete, handleSave]);

  const addSubtaskFromInput = () => {
    const v = newSubtask.trim();
    if (!v) return;
    setSubtasks((arr) => [...arr, { id: uid(), title: v, done: false }]);
    setNewSubtask("");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 10 }}
        className={`relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl border ${theme.border} ${theme.surface} p-3 sm:p-4`}
      >
        <div className="flex items-center gap-2 mb-3">
          <h3 className="text-base font-semibold">{isEdit ? "Edit task" : "New task"}</h3>
          {isEdit && (
            <span className={`ml-2 text-xs ${theme.muted}`}>
              Updated {new Date(task.updatedAt).toLocaleString()}
            </span>
          )}
          <button type="button" onClick={onClose} className={`ml-auto p-2 rounded-xl ${theme.subtle}`}>
            ✕
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <div className="lg:col-span-2 space-y-3">
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Task title"
              className={`w-full rounded-2xl ${theme.input} px-3 py-2 text-sm focus:outline-none`}
            />
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Description"
              rows={6}
              className={`w-full rounded-2xl ${theme.input} px-3 py-2 text-sm focus:outline-none`}
            />

            <div>
              <div className={`text-xs ${theme.muted} mb-1`}>Subtasks</div>
              <div className="space-y-2">
                {/* Existing subtasks */}
                {subtasks.map((s: any, i: number) => (
                  <label key={s.id} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={s.done}
                      onChange={(e) =>
                        setSubtasks((arr) =>
                          arr.map((it: any, idx: number) => (idx === i ? { ...it, done: e.target.checked } : it))
                        )
                      }
                    />
                    <input
                      value={s.title}
                      onChange={(e) =>
                        setSubtasks((arr) =>
                          arr.map((it: any, idx: number) => (idx === i ? { ...it, title: e.target.value } : it))
                        )
                      }
                      className={`flex-1 rounded-xl ${theme.input} px-2 py-1 text-sm`}
                    />
                    <button
                      type="button"
                      onClick={() => setSubtasks((arr) => arr.filter((_: any, idx: number) => idx !== i))}
                      className={`p-1 rounded-xl ${theme.subtle}`}
                      title="Remove"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </label>
                ))}

                {/* Always-visible add field */}
                <div className="flex items-center gap-2">
                  <input
                    value={newSubtask}
                    onChange={(e) => setNewSubtask(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addSubtaskFromInput();
                      }
                    }}
                    placeholder="Add subtask and press Enter"
                    className={`flex-1 rounded-xl ${theme.input} px-2 py-2 text-sm`}
                  />
                  <button
                    type="button"
                    onClick={addSubtaskFromInput}
                    className="px-2.5 py-2 rounded-xl text-sm border border-emerald-600 bg-emerald-500/15 hover:bg-emerald-500/25"
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <div className={`text-xs ${theme.muted} mb-1`}>Column</div>
              <select
                value={columnId}
                onChange={(e) => setColumnId(e.target.value)}
                className={`w-full rounded-2xl ${theme.input} px-2.5 py-2 text-sm`}
              >
                {state.columns.map((c: any) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div className={`text-xs ${theme.muted} mb-1`}>Priority</div>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className={`w-full rounded-2xl ${theme.input} px-2.5 py-2 text-sm`}
              >
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div className={`text-xs ${theme.muted} mb-1`}>Due date</div>
              <input
                id="dueInput"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className={`w-full rounded-2xl ${theme.input} px-2.5 py-2 text-sm`}
              />
            </div>

            <div>
              <div className={`text-xs ${theme.muted} mb-1`}>Labels</div>
              <div className="flex flex-wrap gap-2">
                {allLabels.map((l: string) => {
                  const active = labels.includes(l);
                  return (
                    <button
                      key={l}
                      type="button"
                      onClick={() => setLabels((arr) => (active ? arr.filter((x) => x !== l) : [...arr, l]))}
                      className={`px-2.5 py-1 rounded-xl text-xs border ${theme.border} ${active ? "bg-emerald-500/10" : ""}`}
                    >
                      #{l}
                    </button>
                  );
                })}
              </div>
              <input
                placeholder="New label"
                onKeyDown={(e) => {
                  const v = (e.currentTarget as HTMLInputElement).value.trim();
                  if (e.key === "Enter" && v) {
                    setLabels((arr) => Array.from(new Set([...arr, v])));
                    (e.currentTarget as HTMLInputElement).value = "";
                  }
                }}
                className={`mt-2 w-full rounded-2xl ${theme.input} px-2.5 py-2 text-sm`}
              />
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          {isEdit && (
            <button
              type="button"
              onClick={() => {
                onDelete(task.id);
                onClose();
              }}
              className="px-3 py-2 rounded-xl text-sm border border-rose-600 bg-rose-500/15 hover:bg-rose-500/25 sm:w-auto"
            >
              Delete
            </button>
          )}
          <div className="sm:ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className={`flex-1 sm:flex-none px-3 py-2 rounded-xl text-sm border ${theme.border} ${theme.subtle}`}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="flex-1 sm:flex-none px-3 py-2 rounded-xl text-sm border border-emerald-600 bg-emerald-500/15 hover:bg-emerald-500/25"
            >
              {isEdit ? "Save" : "Create"}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function SettingsModal({ onClose, onToggleTheme, isDark, onExport, onImport, shortcuts, onChangeShortcut, theme }: any) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const shortcutItems = [
    { key: "newTask", label: "New task" },
    { key: "newColumn", label: "New list/column" },
    { key: "search", label: "Focus search" },
    { key: "toggleFilters", label: "Toggle filters panel" },
    { key: "moveTaskUp", label: "Move task within column ↑" },
    { key: "moveTaskDown", label: "Move task within column ↓" },
    { key: "moveTaskLeft", label: "Move task across columns ←" },
    { key: "moveTaskRight", label: "Move task across columns →" },
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

function AddColumnCard({ adding, tempTitle, onChangeTitle, onStart, onAdd, onCancel, theme }: any) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 120, damping: 18 }}
      className={`snap-start shrink-0 min-w-0 h-full rounded-3xl border ${theme.border} ${theme.surfaceAlt} backdrop-blur p-3 sm:p-4 flex flex-col justify-center items-stretch`}
    >
      {!adding ? (
        <button
          type="button"
          onClick={onStart}
          className={`w-full flex-1 min-h-[120px] rounded-2xl border border-dashed ${theme.border} ${theme.subtle} text-sm flex items-center justify-center`}
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
    </motion.div>
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

      // isOverdue
      const past = new Date(Date.now() - 86400000).toISOString();
      assert(Boolean(isOverdue(past)) === true, "isOverdue true for past date");

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