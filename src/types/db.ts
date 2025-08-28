export type UUID = string;

export type Profile = {
  id: UUID;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
};

export type Board = {
  id: UUID;
  user_id: UUID;
  title: string;
  created_at: string;
  updated_at: string;
};

export type BoardSettings = {
  board_id: UUID;
  show_completed: boolean;
  save_deleted: boolean;
  deleted_retention: string; // e.g., '7 days'
  auto_cleanup: boolean;
  last_cleanup_at: string | null;
};

export type BoardColumn = {
  id: UUID;
  board_id: UUID;
  title: string;
  position: number;
  created_at: string;
  updated_at: string;
};

export type Task = {
  id: UUID;
  board_id: UUID;
  column_id: UUID;
  title: string;
  description: string | null;
  priority: 'Low' | 'Medium' | 'High' | 'Urgent';
  due_at: string | null; // ISO
  completed: boolean;
  completed_at: string | null; // ISO
  position: number;
  deleted_at: string | null; // ISO
  created_at: string;
  updated_at: string;
};

export type Subtask = {
  id: UUID;
  task_id: UUID;
  title: string;
  completed: boolean;
  position: number;
  created_at: string;
  updated_at: string;
};

export type Label = {
  id: UUID;
  board_id: UUID;
  name: string;
  color: string | null;
  created_at: string;
  updated_at: string;
};

export type TaskLabel = {
  task_id: UUID;
  label_id: UUID;
};

export type UserSettings = {
  user_id: UUID;
  theme: 'light' | 'dark';
  shortcuts: Record<string, string>;
  current_board_id: UUID | null;
  created_at: string;
  updated_at: string;
};

// Legacy state shape consumed by the current UI
export type LegacyTask = {
  id: string;
  title: string;
  description?: string;
  labels: string[]; // names
  priority: 'Low' | 'Medium' | 'High' | 'Urgent';
  dueDate?: string | null;
  createdAt?: number;
  updatedAt?: number;
  subtasks: { id: string; title: string; completed: boolean }[];
  completed?: boolean;
  completedAt?: number | null;
  // extra meta used by DeletedTasksModal (optional)
  deletedAt?: number | null;
  originalColumnId?: string | null;
  originalPosition?: number | null;
};

export type LegacyColumn = { id: string; title: string; taskIds: string[] };

export type LegacyState = {
  name: string; // board title
  columns: LegacyColumn[];
  tasks: Record<string, LegacyTask>;
  labels: string[]; // board-scoped label names
  // Deleted tasks UI expects this list
  deletedTasks?: LegacyTask[];
  // Deleted tasks settings panel expects this object
  deletedTasksSettings?: { enabled: boolean; retentionPeriod: '1hour'|'24hours'|'7days'|'30days'|'forever' };
  
  // Board settings
  showCompleted?: boolean;
  
  // UI state properties that the components expect
  filters: { text: string; priorities: string[]; labels: string[]; due: string };
  theme: string;
  sortMode: string;
  showFilters: boolean;
  shortcuts: Record<string, string>;
  activeId: string | null;
  selectedTaskId: string | null;
  showTaskModal: boolean;
  editingTaskId: any;
  addingColumn: boolean;
  renamingColumnId: string | null;
  tempTitle: string;
  showSettings: boolean;
  showCompletedTasks: boolean;
};
