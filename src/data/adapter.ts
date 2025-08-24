import type { Board, BoardColumn, Task, Subtask, Label, TaskLabel, LegacyState } from '../types/db';
import { intervalToRetentionKey } from './settings';

export function toLegacyState(
  board: Board,
  columns: BoardColumn[],
  tasksOpen: Task[],
  subtasks: Subtask[],
  labels: Label[],
  taskLabels: TaskLabel[],
  tasksDeleted: Task[],
  boardSettings: { show_completed: boolean; save_deleted: boolean; deleted_retention: string }
): LegacyState {
  const labelNameById = new Map(labels.map((l) => [l.id, l.name] as const));
  const labelIdsByTask = new Map<string, string[]>();
  for (const tl of taskLabels) {
    const arr = labelIdsByTask.get(tl.task_id) ?? [];
    arr.push(tl.label_id);
    labelIdsByTask.set(tl.task_id, arr);
  }

  const subtasksByTask = new Map<string, Subtask[]>();
  for (const st of subtasks) {
    const arr = subtasksByTask.get(st.task_id) ?? [];
    arr.push(st);
    subtasksByTask.set(st.task_id, arr);
  }

  const tasksMap: Record<string, any> = {};
  for (const t of tasksOpen) {
    const st = (subtasksByTask.get(t.id) ?? []).sort((a, b) => a.position - b.position);
    const labelNames = (labelIdsByTask.get(t.id) ?? [])
      .map((lid) => labelNameById.get(lid)!)
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));
    tasksMap[t.id] = {
      id: t.id,
      title: t.title,
      description: t.description ?? undefined,
      labels: labelNames,
      priority: t.priority,
      dueDate: t.due_at,
      createdAt: Date.parse(t.created_at) / 1000,
      updatedAt: Date.parse(t.updated_at) / 1000,
      subtasks: st.map((s) => ({ id: s.id, title: s.title, completed: s.completed })),
      completed: t.completed,
      completedAt: t.completed_at ? Date.parse(t.completed_at) / 1000 : null,
    };
  }

  const columnsLegacy = columns
    .sort((a, b) => a.position - b.position)
    .map((c) => ({
      id: c.id,
      title: c.title,
      taskIds: tasksOpen
        .filter((t) => t.column_id === c.id && !t.deleted_at)
        .sort((a, b) => a.position - b.position)
        .map((t) => t.id),
    }));

  const deletedTasks = tasksDeleted.map((t) => ({
    id: t.id,
    title: t.title,
    description: t.description ?? undefined,
    labels: [],
    priority: t.priority,
    dueDate: t.due_at,
    createdAt: Date.parse(t.created_at) / 1000,
    updatedAt: Date.parse(t.updated_at) / 1000,
    subtasks: [],
    completed: t.completed,
    completedAt: t.completed_at ? Date.parse(t.completed_at) / 1000 : null,
    deletedAt: t.deleted_at ? Date.parse(t.deleted_at) / 1000 : null,
  }));

  const retentionKey = intervalToRetentionKey(boardSettings.deleted_retention);

  return {
    name: board.title,
    columns: columnsLegacy,
    tasks: tasksMap,
    labels: labels.map((l) => l.name).sort((a, b) => a.localeCompare(b)),
    deletedTasks,
    deletedTasksSettings: {
      enabled: boardSettings.save_deleted,
      retentionPeriod: retentionKey,
    },
    // Add missing properties that the UI expects
    filters: { text: "", priorities: [], labels: [], due: "all" },
    theme: "light", // Will be overridden by user settings
    sortMode: "manual",
    showFilters: false,
    shortcuts: { newTask: "n", newColumn: "shift+n", search: "/", completeTask: "space" },
    activeId: null,
    selectedTaskId: null,
    showTaskModal: false,
    editingTaskId: null,
    addingColumn: false,
    renamingColumnId: null,
    tempTitle: "",
    showSettings: false,
    showCompletedTasks: false,
  };
}
