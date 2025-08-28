import { useEffect } from "react";
import { serializeCombo } from "../utils/helpers";

interface KeyboardShortcutsProps {
  state: any;
  setState: (updater: (state: any) => any) => void;
  openNewTask: (columnId?: string) => void;
  startAddColumn: () => void;
  deleteTask: (taskId: string) => void;
  taskActions: any;
}

export function useKeyboardShortcuts({
  state,
  setState,
  openNewTask,
  startAddColumn,
  deleteTask,
  taskActions
}: KeyboardShortcutsProps) {
  useEffect(() => {
    const findTaskColumnIndex = (taskId: string) =>
      state.columns.findIndex((c: any) => c.taskIds.includes(taskId));

    const selectTask = (colIdx: number, taskIdx: number) => {
      const col = state.columns[colIdx];
      if (!col) return;
      const ids = col.taskIds; // Simplified for now
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
      const ids = col.taskIds;
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
      
      // Use taskActions to move task
      taskActions.moveTask(state.selectedTaskId, col.id, col.id, target);
    };

    const moveAcross = (key: string) => {
      if (!state.selectedTaskId) return;
      const fromIdx = findTaskColumnIndex(state.selectedTaskId);
      const toIdx = key === "ArrowLeft" ? fromIdx - 1 : fromIdx + 1;
      if (toIdx < 0 || toIdx >= state.columns.length) return;
      const fromCol = state.columns[fromIdx];
      const toCol = state.columns[toIdx];
      const samePosId = toCol.taskIds[fromCol.taskIds.indexOf(state.selectedTaskId)] || null;
      
      // Use taskActions to move task across columns
      const position = samePosId ? toCol.taskIds.indexOf(samePosId) : toCol.taskIds.length;
      taskActions.moveTask(state.selectedTaskId, fromCol.id, toCol.id, position);
    };

    const toggleComplete = () => {
      if (!state.selectedTaskId) return;
      taskActions.completeTask(state.selectedTaskId);
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
  }, [state, openNewTask, startAddColumn, deleteTask, taskActions]);

  // Scroll selected task into view
  useEffect(() => {
    if (state.selectedTaskId) {
      document
        .getElementById(`task-${state.selectedTaskId}`)
        ?.scrollIntoView({ block: "nearest", inline: "nearest" });
    }
  }, [state.selectedTaskId]);
}
