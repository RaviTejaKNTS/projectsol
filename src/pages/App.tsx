import { useEffect, useRef, useMemo } from "react";
import { useCloudState } from '../hooks/useCloudState';
import { useAuth } from '../contexts/AuthProvider';
import { TaskModal } from "../components/tasks/TaskModal";
import { SettingsSidebar } from "../components/settings/SettingsSidebar";
import { CompletedTasksModal } from "../components/CompletedTasksModal";
import { DeletedTasksModal } from "../components/DeletedTasksModal";
import { AppHeader } from "../components/header/AppHeader";
import { AuthOverlay } from "../components/auth/AuthOverlay";
import { BoardContainer } from "../components/board/BoardContainer";
import { DevTests } from "../components/dev/DevTests";
import { useAppState } from "../hooks/useAppState";
import { useColumnActions } from "../hooks/useColumnActions";
import { useKeyboardShortcuts } from "../hooks/useKeyboardShortcuts";
import { TaskActions } from "../utils/taskActions";
import { ProfileSidebar } from '../components/ProfileSidebar';
import { defaultState } from '../utils/helpers';

// ------------------------------------------------------------
// Project Sol — Material‑ish Kanban To‑Do (Trello style)
// Polished, responsive board with smooth dnd-kit drag/drop,
// Material-esque surfaces, dark/light themes, filters,
// labels, priorities, due dates, subtasks, import/export,
// keyboard shortcuts (in Settings), and confetti on Done.
// ------------------------------------------------------------

function App() {
  const {
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
  } = useAppState();

  const { user, loading, signInWithGoogle, signInWithEmail } = useAuth();
  const { status: saveStatus, forceSync } = useCloudState(state, setState, {}, 'projectsol-state');
  const prevUserRef = useRef(user);

  // Function declarations
  const openNewTask = (columnId: string | null = null) => {
    setNewTaskColumnId(columnId);
    setEditingTask(null);
    setShowTaskModal(true);
  };

  // Column actions
  const columnActions = useColumnActions(state, setState);
  const {
    deleteColumn,
    moveColumn,
    startAddColumn
  } = columnActions;

  // Task actions
  const taskActions = new TaskActions({ state, setState, undoTimeoutRef, setUndoState });

  // Keyboard shortcuts
  useKeyboardShortcuts({
    state,
    setState,
    openNewTask,
    startAddColumn,
    deleteTask: taskActions.deleteTask,
    taskActions
  });

  const openEditTask = (taskId: string) => {
    // Find which column this task belongs to
    const column = state.columns.find((col: any) => col.taskIds.includes(taskId));
    // Get the full task data from state.tasks to ensure we have all properties
    const fullTask = state.tasks[taskId];
    const taskWithColumn = { ...fullTask, columnId: column?.id };
    setEditingTask(taskWithColumn);
    setNewTaskColumnId(null);
    setShowTaskModal(true);
  };

  const moveTask = (taskId: string, fromColumnId: string, toColumnId: string, position?: number) => {
    taskActions.moveTask(taskId, fromColumnId, toColumnId, position || 0);
  };

  // Handle user state changes (login/logout)
  useEffect(() => {
    if (prevUserRef.current !== user) {
      if (user && !prevUserRef.current) {
        // User just logged in
        setShouldAnimateColumns(true);
      } else if (!user && prevUserRef.current) {
        // User just logged out - clear application state
        setState(() => {
          // Reset to default state
          return defaultState();
        });
        // Close all modals and sidebars
        setShowTaskModal(false);
        setShowSettingsSidebar(false);
        setShowProfileSidebar(false);
        setShowCompletedTasks(false);
        setShowDeletedTasks(false);
        setEditingTask(null);
        setNewTaskColumnId(null);
      }
      prevUserRef.current = user;
    }
  }, [user, setState, setShowTaskModal, setShowSettingsSidebar, setShowProfileSidebar, setShowCompletedTasks, setShowDeletedTasks, setEditingTask, setNewTaskColumnId]);

  // Reset animation flag after columns have animated
  useEffect(() => {
    if (shouldAnimateColumns) {
      const timer = setTimeout(() => {
        setShouldAnimateColumns(false);
      }, 800); // Allow time for all columns to animate
      return () => clearTimeout(timer);
    }
  }, [shouldAnimateColumns]);

  // Handle filter dropdown clicks outside
  useEffect(() => {
    const handleClickOutside = () => {
      // This will be handled by AppHeader component
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [state.showFilters, setState]);


  // Toggle theme function
  const toggleTheme = () => {
    setState((s: any) => ({
      ...s,
      theme: s.theme === 'dark' ? 'light' : 'dark'
    }));
  };

  // Close completed tasks function
  const closeCompletedTasks = () => {
    setShowCompletedTasks(false);
  };

  // UI helpers
  const isDark = state.theme === "dark";

  const allLabels = useMemo(() => {
    const fromTasks = new Set(Object.values(state.tasks).flatMap((t: any) => t.labels || []));
    const base = new Set([...(state.labels || []), ...fromTasks]);
    return Array.from(base);
  }, [state.tasks, state.labels]);

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

  return (
    <div className={`min-h-screen w-full ${theme.bg} overflow-x-hidden`}>
      {/* App Header */}
      <AppHeader 
        state={state}
        setState={setState}
        allLabels={allLabels}
        isDark={isDark}
        border={theme.border}
        surface={theme.surface}
        subtle={theme.subtle}
        muted={theme.muted}
        onOpenSettings={() => setShowSettingsSidebar(true)}
        onOpenProfile={() => setShowProfileSidebar(true)}
      />

      {/* Auth Overlay */}
      <AuthOverlay 
        loading={loading}
        user={user}
        signInWithGoogle={signInWithGoogle}
        signInWithEmail={signInWithEmail}
      />

      {/* Board Container */}
      <BoardContainer
        state={state}
        setState={setState}
        theme={{
          surface: theme.surface,
          surfaceAlt: theme.surface,
          border: theme.border,
          subtle: theme.subtle,
          muted: theme.muted,
          input: theme.input
        }}
        shouldAnimateColumns={shouldAnimateColumns}
        onOpenNewTask={openNewTask}
        onOpenEditTask={openEditTask}
        onOpenCompletedTasks={() => setShowCompletedTasks(true)}
        onDeleteColumn={deleteColumn}
        onStartRenameColumn={() => {}}
        onCancelRenameColumn={() => {}}
        onCommitRenameColumn={() => {}}
        onMoveTask={moveTask}
        onMoveColumn={moveColumn}
        onCompleteTask={(taskId: string) => taskActions.completeTask(taskId)}
        onStartAddColumn={startAddColumn}
        onCommitAddColumn={() => {}}
        onCancelAddColumn={() => {}}
        undoState={undoState}
      />

      {/* Task Modal */}
      {showTaskModal && (
        <TaskModal
          onClose={() => setShowTaskModal(false)}
          onSave={(payload: any, columnId: string | null, taskId?: string, metadataOnly?: boolean) => {
            taskActions.createOrUpdateTask(payload, columnId, taskId || null, metadataOnly);
            if (!metadataOnly) {
              setShowTaskModal(false);
            }
          }}
          state={state}
          editingTaskId={editingTask ? { taskId: editingTask.id, columnId: editingTask.columnId } : null}
          newTaskColumnId={editingTask ? null : newTaskColumnId}
          allLabels={allLabels}
          onDelete={taskActions.deleteTask}
          onDeleteLabel={taskActions.deleteLabel}
          onCompleteTask={taskActions.completeTask}
          theme={theme}
        />
      )}

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
        theme={theme}
      />

      {/* Completed Tasks Modal */}
      {showCompletedTasks && (
        <CompletedTasksModal
          isOpen={showCompletedTasks}
          onClose={closeCompletedTasks}
          completedTasks={Object.values(state.tasks).filter((task: any) => task.completed)}
          onRestoreTask={taskActions.restoreTask}
          theme={theme}
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
          theme={theme}
        />
      )}

      {/* Profile Sidebar */}
      <ProfileSidebar
        isOpen={showProfileSidebar}
        onClose={() => setShowProfileSidebar(false)}
        saveStatus={saveStatus as any}
        onForceSync={forceSync}
        theme={theme}
      />

      {/* Dev Tests */}
      <DevTests />
    </div>
  );
}

export default App;