import { arrayMove } from "@dnd-kit/sortable";

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
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "No due";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
};
export const isOverdue = (iso?: string) => iso && new Date(iso).setHours(23, 59, 59, 999) < Date.now();

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
  return arrayMove(from, oldIndex, newIndex);
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

export const STORAGE_KEY = "tasksmint_kanban_state_v1";
