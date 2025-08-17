// Utilities

// Utilities
export const uid = () => Math.random().toString(36).slice(2, 10);
export const PRIORITIES = ["Low", "Medium", "High", "Urgent"] as const;
export const priorityColor = (p: string) =>
  ({
    Low: "bg-emerald-500/15 text-emerald-600 ring-emerald-500/30",
    Medium: "bg-sky-500/15 text-sky-600 ring-sky-500/30",
    High: "bg-amber-500/15 text-amber-600 ring-amber-500/30",
    Urgent: "bg-rose-500/15 text-rose-600 ring-rose-500/30",
  }[p] || "bg-zinc-500/15 text-zinc-600 ring-zinc-400/30");

export const prettyDate = (iso?: string) => {
  if (!iso) return "No due";
  const dueDate = new Date(iso);
  if (Number.isNaN(dueDate.getTime())) return "No due";

  const today = new Date();
  const isDifferentYear = dueDate.getFullYear() !== today.getFullYear();

  const options: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
  };

  if (isDifferentYear) {
    options.year = "numeric";
  }

  const absoluteDate = dueDate.toLocaleDateString(undefined, options);

  // Create copies for comparison to avoid mutating the original dueDate
  const dueDateForComparison = new Date(iso);
  const todayForComparison = new Date();

  // Reset time part for accurate day comparison
  dueDateForComparison.setHours(0, 0, 0, 0);
  todayForComparison.setHours(0, 0, 0, 0);

  const diffTime = dueDateForComparison.getTime() - todayForComparison.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

  let relativeTime;
  if (diffDays === 0) {
    relativeTime = "Today";
  } else if (diffDays < 0) {
    const daysAgo = -diffDays;
    relativeTime = `${daysAgo} day${daysAgo > 1 ? 's' : ''} ago`;
  } else {
    relativeTime = `${diffDays} day${diffDays > 1 ? 's' : ''} to go`;
  }

  return `${absoluteDate} • ${relativeTime}`;
};

export const getDueDateStatus = (iso?: string): 'past' | 'today' | 'future' | null => {
  if (!iso) return null;
  const date = new Date(iso);
  const today = new Date();

  date.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);

  if (date.getTime() < today.getTime()) {
    return 'past';
  }
  if (date.getTime() === today.getTime()) {
    return 'today';
  }
  return 'future';
};

export const DEFAULT_SHORTCUTS = {
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

export function serializeCombo(e: { key: string; altKey: boolean; shiftKey: boolean; ctrlKey: boolean; metaKey: boolean }) {
  const parts: string[] = [];
  if (e.altKey) parts.push("alt");
  if (e.shiftKey) parts.push("shift");
  if (e.ctrlKey || e.metaKey) parts.push("ctrl");
  parts.push(e.key.toLowerCase());
  return parts.join("+");
}

// Pure helpers (also used in tests)
export function reorderWithin(ids: string[], activeId: string, overId: string | null) {
  const from = [...ids];
  const oldIndex = from.indexOf(activeId);
  if (oldIndex === -1) return ids;
  const newIndex = overId ? from.indexOf(overId) : from.length - 1;
  if (newIndex === -1) return ids;
  
  // Simple array move implementation
  const item = from.splice(oldIndex, 1)[0];
  from.splice(newIndex, 0, item);
  return from;
}
export function moveItemBetween(
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

export const defaultState = () => {
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
        completed: false,
        completedAt: null,
        lastColumnId: null,
        subtasks: [
          { id: uid(), title: "Sketch data model", completed: true },
          { id: uid(), title: "Pick libraries", completed: false },
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
        completed: false,
        completedAt: null,
        lastColumnId: null,
        subtasks: [
          { id: uid(), title: "Render columns", completed: true },
          { id: uid(), title: "Enable dnd", completed: false },
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
        completed: true,
        completedAt: Date.now() - 86400000 * 0.5,
        lastColumnId: "done",
        subtasks: [
          { id: uid(), title: "Core features", completed: true },
          { id: uid(), title: "Nice-to-haves", completed: true },
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
    showCompletedTasks: false,
    shortcuts: { ...DEFAULT_SHORTCUTS },
  } as any;
};

export const STORAGE_KEY = "project-sol_kanban_state_v1";
