import { useMemo } from "react";
import { Column } from "../tasks/Column";
import { AddColumnCard } from "./AddColumnCard";
import { ActiveFilters } from "../filters/ActiveFilters";
import { TaskReports } from "../TaskReports";
import { getDueDateStatus } from "../../utils/helpers";

interface BoardContainerProps {
  state: any;
  setState: (updater: (state: any) => any) => void;
  theme: {
    surface: string;
    surfaceAlt: string;
    border: string;
    subtle: string;
    muted: string;
    input: string;
  };
  shouldAnimateColumns: boolean;
  onOpenNewTask: (columnId?: string) => void;
  onOpenEditTask: (taskId: string) => void;
  onOpenCompletedTasks: () => void;
  onDeleteColumn: (id: string) => void;
  onStartRenameColumn: (id: string, title: string) => void;
  onCancelRenameColumn: () => void;
  onCommitRenameColumn: (id: string) => void;
  onMoveTask: (taskId: string, fromColumnId: string, toColumnId: string, position?: number) => void;
  onMoveColumn: (fromId: string, toId: string) => void;
  onCompleteTask: (taskId: string) => void;

  onStartAddColumn: () => void;
  onCommitAddColumn: () => void;
  onCancelAddColumn: () => void;
  undoState: any;
}

export function BoardContainer({
  state,
  setState,
  theme,
  shouldAnimateColumns,
  onOpenNewTask,
  onOpenEditTask,
  onOpenCompletedTasks,
  onDeleteColumn,
  onStartRenameColumn,
  onCancelRenameColumn,
  onCommitRenameColumn,
  onMoveTask,
  onMoveColumn,
  onCompleteTask,

  onStartAddColumn,
  onCommitAddColumn,
  onCancelAddColumn,
  undoState
}: BoardContainerProps) {
  
  const filteredTaskIds = (col: any) => {
    const ids = col.taskIds;
    const { text, priorities, labels, due } = state.filters;
    const now = new Date();
    const weekAhead = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7);

    return ids.filter((id: string) => {
      const t = state.tasks[id];
      if (!t) return false;
      // Hide completed tasks if showCompleted is false
      if (!state.showCompleted && t.completed) return false;
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

  const filtersActive = useMemo(() =>
    state.filters.text || state.filters.priorities.length || state.filters.labels.length || state.filters.due !== "all",
    [state.filters]
  );

  return (
    <div className="w-full h-[calc(100vh-64px)] sm:h-[calc(100vh-72px)] px-2 sm:px-4 lg:px-6 py-3 sm:py-4 overflow-hidden flex flex-col">
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
              theme={theme}
              onOpenNew={() => onOpenNewTask(col.id)}
              onOpenEdit={onOpenEditTask}
              onDeleteColumn={onDeleteColumn}
              onStartRename={() => onStartRenameColumn(col.id, col.title)}
              onCancelRename={onCancelRenameColumn}
              renaming={state.renamingColumnId === col.id}
              tempTitle={state.tempTitle}
              setTempTitle={(v: string) => setState((s: any) => ({ ...s, tempTitle: v }))}
              onCommitRename={() => onCommitRenameColumn(col.id)}
              selectedTaskId={state.selectedTaskId}
              setSelectedTaskId={(id: string) => setState((s: any) => ({ ...s, selectedTaskId: id }))}
              onMoveTask={onMoveTask}
              onMoveColumn={onMoveColumn}
              onCompleteTask={onCompleteTask}

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
            onStart={onStartAddColumn}
            onAdd={onCommitAddColumn}
            onCancel={onCancelAddColumn}
            theme={theme}
          />
        </div>
      </div>

      {/* Task Reports - Bottom section within same container */}
      <div className="mt-2 mb-2">
        <TaskReports 
          state={state} 
          onOpenCompletedTasks={onOpenCompletedTasks}
          undoState={undoState || undefined}
          theme={theme} 
        />
      </div>
    </div>
  );
}
