import { useEffect, useRef, useMemo, useState } from "react";
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
import { useOptimisticColumnActions } from "../hooks/useOptimisticColumnActions";
import { useKeyboardShortcuts } from "../hooks/useKeyboardShortcuts";
import { OptimisticTaskActions } from "../utils/optimisticTaskActions";
import { ProfileSidebar } from '../components/ProfileSidebar';
import { AccountLinkingModal } from '../components/auth/AccountLinkingModal';
import { defaultState } from '../utils/helpers';

// NEW (relational):
import { useRelationalState } from "../hooks/useRelationalState";
import { updateBoardSettings, retentionKeyToInterval, updateUserSettings } from "../data/settings";
import { updateBoard, createBoard, deleteBoard } from "../data/boards";
import { setCurrentBoardId, useCurrentBoard } from '../state/currentBoard';
import { supabase } from '../lib/supabaseClient';

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
    theme
  } = useAppState();

  const { user, loading, signInWithGoogle, signInWithEmail, showAccountLinkingModal, accountLinkingInfo, closeAccountLinkingModal } = useAuth();

  // Get current board ID from Zustand store
  const currentBoardId = useCurrentBoard(state => state.boardId);

  // Relational data loader
  const { board, state: loaded, refresh } = useRelationalState(user?.id || null);

  // Local save status (driven by DAL-backed actions)
  const [saveStatus, setSaveStatus] = useState<'idle'|'saving'|'saved'|'error'>('saved');
  const [userBoards, setUserBoards] = useState<Array<{ id: string; title: string }>>([]);
  const [isCreatingBoard, setIsCreatingBoard] = useState(false);

  const prevUserRef = useRef(user);

  // Debug board ID changes
  useEffect(() => {
    console.log('App: currentBoardId changed to:', currentBoardId);
  }, [currentBoardId]);

  // Ensure persisted board ID is respected on page load
  useEffect(() => {
    if (user?.id && currentBoardId) {
      console.log('Page loaded with persisted board ID:', currentBoardId);
      // The useRelationalState hook will handle loading this board
    }
  }, [user?.id, currentBoardId]);

  // Load user boards when user changes
  useEffect(() => {
    const loadUserBoards = async () => {
      if (!user?.id) {
        setUserBoards([]);
        return;
      }
      
      try {
        console.log('Loading user boards for user:', user.id);
        const { data: boards, error } = await supabase
          .from('boards')
          .select('id, title')
          .eq('user_id', user.id)
          .order('created_at', { ascending: true });
        
        if (error) throw error;
        console.log('Loaded boards:', boards);
        setUserBoards(boards || []);
      } catch (error) {
        console.error('Failed to load user boards:', error);
        setUserBoards([]);
      }
    };

    loadUserBoards();
  }, [user?.id]);

  // Real-time subscription to boards table for automatic updates
  useEffect(() => {
    if (!user?.id) return;

    console.log('Setting up real-time subscription for boards...');
    
    const subscription = supabase
      .channel('boards_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'boards',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          console.log('Boards table change detected:', payload);
          
          // Refresh the boards list when changes occur
          refreshUserBoards();
        }
      )
      .subscribe();

    return () => {
      console.log('Cleaning up boards subscription...');
      subscription.unsubscribe();
    };
  }, [user?.id]);

  // Function to manually refresh user boards
  const refreshUserBoards = async () => {
    if (!user?.id) return;
    
    try {
      console.log('Manually refreshing user boards...');
      const { data: boards, error } = await supabase
        .from('boards')
        .select('id, title')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      console.log('Refreshed boards:', boards);
      setUserBoards(boards || []);
    } catch (error) {
      console.error('Failed to refresh user boards:', error);
    }
  };

  // Hydrate legacy UI state once relational data arrives
  useEffect(() => {
    console.log('Legacy state hydration effect:', { loaded, hasLoaded: !!loaded, loadedColumns: loaded?.columns?.length, loadedTasks: loaded?.tasks ? Object.keys(loaded.tasks).length : 0 });
    if (loaded) {
      console.log('Setting state with loaded data');
      setState(loaded);
    }
  }, [loaded, setState]);

  // After loading board, set it in context:
  useEffect(() => {
    console.log('Board state changed:', { board, boardId: board?.id, hasBoard: !!board });
    if (board) {
      setCurrentBoardId(board.id);
      console.log('Current board ID set to:', board.id);
    } else {
      console.log('No board available, clearing current board ID');
      setCurrentBoardId(null);
    }
  }, [board]);

  // Pass board to all action hooks:
  const columnActions = useOptimisticColumnActions(state, setState, { 
    setSaveStatus 
  });
  const {
    deleteColumn,
    moveColumn,
    startAddColumn,
    cleanup: cleanupColumnActions
  } = columnActions;

  // Task actions now write to DB under the hood (no UI changes)
  const taskActions = new OptimisticTaskActions({ state, setState, setSaveStatus });

  // Cleanup optimistic actions on unmount
  useEffect(() => {
    return () => {
      taskActions.destroy();
      cleanupColumnActions();
    };
  }, [cleanupColumnActions]);

  const openNewTask = (columnId: string | null = null) => {
    setNewTaskColumnId(columnId);
    setEditingTask(null);
    setShowTaskModal(true);
  };

  useKeyboardShortcuts({
    state,
    setState,
    openNewTask,
    startAddColumn,
    deleteTask: (taskId: string) => board && taskActions.deleteTask(taskId),
    taskActions
  });

  const openEditTask = (taskId: string) => {
    const column = state.columns.find((col: any) => col.taskIds.includes(taskId));
    const fullTask = state.tasks[taskId];
    const taskWithColumn = { ...fullTask, columnId: column?.id };
    setEditingTask(taskWithColumn);
    setNewTaskColumnId(null);
    setShowTaskModal(true);
  };

  const moveTask = (taskId: string, fromColumnId: string, toColumnId: string, position?: number) => {
    console.log('moveTask called in App.tsx:', { taskId, fromColumnId, toColumnId, position, board, boardId: board?.id });
    if (!board) {
      console.error('Cannot move task: no board available');
      return;
    }
    if (!board.id) {
      console.error('Cannot move task: board has no ID');
      return;
    }
    console.log('Moving task with board ID:', board.id);
    taskActions.moveTask(taskId, fromColumnId, toColumnId, position || 0);
  };

  useEffect(() => {
    if (prevUserRef.current !== user) {
      if (user && !prevUserRef.current) {
        setShouldAnimateColumns(true);
      } else if (!user && prevUserRef.current) {
        setState(() => {
          return defaultState();
        });
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
  }, [user, setState, setShowTaskModal, setShowSettingsSidebar, setShowProfileSidebar, setShowCompletedTasks, setShowDeletedTasks, setEditingTask, setNewTaskColumnId, setShouldAnimateColumns]);

  useEffect(() => {
    if (shouldAnimateColumns) {
      const timer = setTimeout(() => {
        setShouldAnimateColumns(false);
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [shouldAnimateColumns, setShouldAnimateColumns]);

  const toggleTheme = async () => {
    const newTheme = state.theme === 'dark' ? 'light' : 'dark';
    setState((s: any) => ({
      ...s,
      theme: newTheme
    }));
    
    // Sync theme to database
    try {
      if (user?.id) {
        await updateUserSettings(user.id, { theme: newTheme });
      }
    } catch (error) {
      console.error('Failed to sync theme to database:', error);
    }
  };

  const handleRenameBoard = async (newTitle: string) => {
    if (!board) return;
    
    try {
      await updateBoard(board.id, { title: newTitle });
      // Refresh to get updated data
      refresh();
    } catch (error) {
      console.error('Failed to rename board:', error);
    }
  };

  const handleCreateBoard = async (boardName?: string) => {
    if (!user?.id) return;
    
    setIsCreatingBoard(true);
    try {
      console.log('Creating new board for user:', user.id);
      const boardTitle = boardName || `Board ${userBoards.length + 1}`;
      const newBoard = await createBoard(user.id, boardTitle);
      console.log('New board created:', newBoard);
      
      // Optimistically update the UI
      setUserBoards(prev => [...prev, { id: newBoard.id, title: newBoard.title }]);
      
      // Set as current board
      setCurrentBoardId(newBoard.id);
      
      // Save to database
      await updateUserSettings(user.id, { current_board_id: newBoard.id });
      console.log('Saved new board as current in database');
      
      // Refresh data
      await refresh();
      await refreshUserBoards();
      
      console.log('Board creation completed successfully');
    } catch (error) {
      console.error('Failed to create board:', error);
      // Revert optimistic update
      setUserBoards(prev => prev.filter(b => b.id !== 'temp'));
    } finally {
      setIsCreatingBoard(false);
    }
  };

  const handleSwitchBoard = async (boardId: string) => {
    console.log('Switching to board:', boardId);
    setCurrentBoardId(boardId);
    // Also save to database
    if (user?.id) {
      try {
        await updateUserSettings(user.id, { current_board_id: boardId });
        console.log('Saved current board ID to database:', boardId);
      } catch (error) {
        console.error('Failed to save current board ID to database:', error);
      }
    }
    await refresh();
  };

  const handleDeleteBoard = async (boardId: string) => {
    if (!user?.id || !board) return;
    
    try {
      console.log('Deleting board:', boardId);
      
      // Delete the board from database
      await deleteBoard(boardId);
      console.log('Board deleted from database');
      
      // Remove from user boards list
      setUserBoards(prev => prev.filter(b => b.id !== boardId));
      
      // If this was the current board, switch to another board or clear current
      if (currentBoardId === boardId) {
        const remainingBoards = userBoards.filter(b => b.id !== boardId);
        if (remainingBoards.length > 0) {
          // Switch to the first remaining board
          const nextBoard = remainingBoards[0];
          setCurrentBoardId(nextBoard.id);
          await updateUserSettings(user.id, { current_board_id: nextBoard.id });
          console.log('Switched to next board:', nextBoard.id);
        } else {
          // No boards left, clear current board
          setCurrentBoardId(null);
          await updateUserSettings(user.id, { current_board_id: null });
          console.log('No boards left, cleared current board');
        }
      }
      
      // Close settings sidebar
      setShowSettingsSidebar(false);
      
      // Refresh data
      await refresh();
      await refreshUserBoards();
      
      console.log('Board deletion completed successfully');
    } catch (error) {
      console.error('Failed to delete board:', error);
      throw error;
    }
  };

  const closeCompletedTasks = () => {
    setShowCompletedTasks(false);
  };

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
        board={board}
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
        onDeleteColumn={(id: string) => board && deleteColumn(id)}
        onStartRenameColumn={() => {}}
        onCancelRenameColumn={() => {}}
        onCommitRenameColumn={() => {}}
        onMoveTask={moveTask}
        onMoveColumn={(from: string, to: string) => board && moveColumn(from, to)}

        onCompleteTask={(taskId: string) => board && taskActions.completeTask(taskId)}
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
            if (!board) return;
            taskActions.createOrUpdateTask(payload, columnId, taskId || null, metadataOnly);
            if (!metadataOnly) {
              setShowTaskModal(false);
            }
          }}
          onUpdateTaskLabels={(taskId: string, labels: string[]) => board && taskActions.updateTaskLabels(taskId, labels)}
          state={state}
          editingTaskId={editingTask ? { taskId: editingTask.id, columnId: editingTask.columnId } : null}
          newTaskColumnId={editingTask ? null : newTaskColumnId}
          allLabels={allLabels}
          onDelete={(taskId: string) => board && taskActions.deleteTask(taskId)}
          onDeleteLabel={(name: string) => board && taskActions.deleteLabel(name)}
          onCompleteTask={(taskId: string) => board && taskActions.completeTask(taskId)}
          theme={theme}
        />
      )}

      {/* Settings Sidebar */}
      <SettingsSidebar
        isOpen={showSettingsSidebar}
        onClose={() => setShowSettingsSidebar(false)}
        board={board}
        onRenameBoard={handleRenameBoard}
        onDeleteBoard={handleDeleteBoard}
        showCompleted={state.showCompleted ?? false}
        onChangeShowCompleted={async (value: boolean) => {
          if (board) {
            await updateBoardSettings(board.id as any, { show_completed: value });
            setState((s: any) => ({ ...s, showCompleted: value }));
          }
        }}
        deletedTasksSettings={state.deletedTasksSettings || { enabled: false, retentionPeriod: '7days' }}
        onChangeDeletedTasksSetting={(key: string, value: any) => {
          // Persist per-board settings in DB; mirror into local state for instant UI
          if (board) {
            if (key === 'enabled') updateBoardSettings(board.id as any, { save_deleted: !!value });
            if (key === 'retentionPeriod') updateBoardSettings(board.id as any, { deleted_retention: retentionKeyToInterval(value) });
          }
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
          onRestoreTask={(taskId: string) => board && taskActions.restoreTask(taskId)}
          theme={theme}
        />
      )}

      {/* Deleted Tasks Modal */}
      {showDeletedTasks && (
        <DeletedTasksModal
          isOpen={showDeletedTasks}
          onClose={() => setShowDeletedTasks(false)}
          deletedTasks={state.deletedTasks || []}
          onRestoreTask={(taskId: string) => board && taskActions.restoreDeletedTask(taskId)}
          onPermanentlyDeleteTask={(taskId: string) => board && taskActions.permanentlyDeleteTask(taskId)}
          theme={theme}
        />
      )}

      {/* Profile Sidebar */}
      <ProfileSidebar
        isOpen={showProfileSidebar}
        onClose={() => setShowProfileSidebar(false)}
        saveStatus={saveStatus as any}
        onForceSync={refresh}
        onToggleTheme={toggleTheme}
        isDark={isDark}
        shortcuts={state.shortcuts}
        onChangeShortcut={(key: string, value: string) => {
          setState((s: any) => ({
            ...s,
            shortcuts: { ...s.shortcuts, [key]: value }
          }));
        }}
        onExport={exportJSON}
        onImport={importJSON}
        onCreateBoard={handleCreateBoard}
        onSwitchBoard={handleSwitchBoard}
        currentBoardId={currentBoardId}
        userBoards={userBoards}
        isCreatingBoard={isCreatingBoard}
        theme={theme}
      />

      {/* Account Linking Modal */}
      {showAccountLinkingModal && accountLinkingInfo && (
        <AccountLinkingModal
          isOpen={showAccountLinkingModal}
          onClose={closeAccountLinkingModal}
          existingEmail={accountLinkingInfo.email}
          newProvider={accountLinkingInfo.provider}
        />
      )}

      {/* Dev Tests */}
      <DevTests />
    </div>
  );
}

export default App;
