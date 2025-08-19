import { uid } from "./helpers";
import confetti from 'canvas-confetti';

export interface TaskActionsProps {
  state: any;
  setState: (updater: (state: any) => any) => void;
  undoTimeoutRef: React.MutableRefObject<NodeJS.Timeout | null>;
  setUndoState: (undoState: any) => void;
}

export class TaskActions {
  private state: any;
  private setState: (updater: (state: any) => any) => void;
  private undoTimeoutRef: React.MutableRefObject<NodeJS.Timeout | null>;
  private setUndoState: (undoState: any) => void;

  constructor({ state, setState, undoTimeoutRef, setUndoState }: TaskActionsProps) {
    this.state = state;
    this.setState = setState;
    this.undoTimeoutRef = undoTimeoutRef;
    this.setUndoState = setUndoState;
  }

  createOrUpdateTask = (payload: any, columnId: string | null, taskId: string | null = null, metadataOnly = false) => {
    this.setState((s: any) => {
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

  deleteTask = (taskId: string) => {
    const task = this.state.tasks[taskId];
    if (!task) return;

    const deletedTasksSettings = this.state.deletedTasksSettings || { enabled: false, retentionPeriod: '7days' };
    
    if (deletedTasksSettings.enabled) {
      // Find which column contains this task
      const sourceColumn = this.state.columns.find((c: any) => c.taskIds.includes(taskId));
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
      this.setState((s: any) => {
        const tasks = { ...s.tasks };
        delete tasks[taskId];
        const columns = s.columns.map((c: any) => ({ ...c, taskIds: c.taskIds.filter((id: string) => id !== taskId) }));
        const deletedTasks = [...(s.deletedTasks || []), taskToDelete];
        
        return { ...s, tasks, columns, deletedTasks };
      });
      
      // Clear any existing undo timeout
      if (this.undoTimeoutRef.current) {
        clearTimeout(this.undoTimeoutRef.current);
      }

      // Show undo message in task stats
      this.setUndoState({
        isVisible: true,
        message: `Task "${task.title}" deleted`,
        type: 'delete',
        onUndo: () => {
          // Clear timeout when undo is clicked
          if (this.undoTimeoutRef.current) {
            clearTimeout(this.undoTimeoutRef.current);
            this.undoTimeoutRef.current = null;
          }
          
          // Undo the deletion
          this.setState((s: any) => {
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
          
          this.setUndoState(null);
        }
      });

      // Auto-hide after 10 seconds with protected timeout
      this.undoTimeoutRef.current = setTimeout(() => {
        this.setUndoState(null);
        this.undoTimeoutRef.current = null;
      }, 10000);
    } else {
      // Permanently delete (original behavior)
      this.setState((s: any) => {
        const tasks = { ...s.tasks };
        delete tasks[taskId];
        const columns = s.columns.map((c: any) => ({ ...c, taskIds: c.taskIds.filter((id: string) => id !== taskId) }));
        return { ...s, tasks, columns };
      });
    }
  };

  completeTask = (taskId: string) => {
    const task = this.state.tasks[taskId];
    if (!task) return;
    
    // Find current column containing the task
    const currentColumn = this.state.columns.find((c: any) => c.taskIds.includes(taskId));
    if (!currentColumn) return;
    
    // Store task data for potential undo
    const taskForUndo = {
      ...task,
      originalColumnId: currentColumn.id,
      originalPosition: currentColumn.taskIds.indexOf(taskId)
    };
    
    this.setState((s: any) => {
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
    if (this.undoTimeoutRef.current) {
      clearTimeout(this.undoTimeoutRef.current);
    }

    // Show completion message with undo option
    this.setUndoState({
      isVisible: true,
      message: `Great job! Task "${task.title}" completed! 🎉`,
      type: 'complete',
      onUndo: () => {
        // Clear timeout when undo is clicked
        if (this.undoTimeoutRef.current) {
          clearTimeout(this.undoTimeoutRef.current);
          this.undoTimeoutRef.current = null;
        }
        
        // Undo the completion - restore to original column and position
        this.setState((s: any) => {
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
        
        this.setUndoState(null);
      }
    });

    // Auto-hide after 10 seconds with protected timeout
    this.undoTimeoutRef.current = setTimeout(() => {
      this.setUndoState(null);
      this.undoTimeoutRef.current = null;
    }, 10000);
    
    // Trigger confetti animation for positive feedback
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#10b981', '#059669', '#047857']
    });
  };

  restoreTask = (taskId: string) => {
    this.setState((s: any) => {
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

  moveTask = (taskId: string, fromColumnId: string, toColumnId: string, position?: number) => {
    this.setState((s: any) => {
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

  deleteLabel = (labelToDelete: string) => {
    if (!confirm(`Delete "${labelToDelete}" label everywhere?`)) return;
    this.setState((s: any) => {
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
}
