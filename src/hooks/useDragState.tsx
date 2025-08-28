import React, { createContext, useContext, useState, ReactNode } from 'react';

interface DragState {
  isDragging: boolean;
  draggedTaskId: string | null;
  draggedFromColumn: string | null;
  dragType: 'task' | 'column' | null;
}

interface DragContextType {
  dragState: DragState;
  setDragState: (state: Partial<DragState>) => void;
  startTaskDrag: (taskId: string, columnId: string) => void;
  startColumnDrag: (columnId: string) => void;
  endDrag: () => void;
}

const DragContext = createContext<DragContextType | null>(null);

export const DragProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [dragState, setDragStateInternal] = useState<DragState>({
    isDragging: false,
    draggedTaskId: null,
    draggedFromColumn: null,
    dragType: null,
  });

  const setDragState = (updates: Partial<DragState>) => {
    setDragStateInternal(prev => ({ ...prev, ...updates }));
  };

  const startTaskDrag = (taskId: string, columnId: string) => {
    setDragStateInternal({
      isDragging: true,
      draggedTaskId: taskId,
      draggedFromColumn: columnId,
      dragType: 'task',
    });
  };

  const startColumnDrag = (columnId: string) => {
    setDragStateInternal({
      isDragging: true,
      draggedTaskId: null,
      draggedFromColumn: columnId,
      dragType: 'column',
    });
  };

  const endDrag = () => {
    setDragStateInternal({
      isDragging: false,
      draggedTaskId: null,
      draggedFromColumn: null,
      dragType: null,
    });
  };

  return (
    <DragContext.Provider value={{
      dragState,
      setDragState,
      startTaskDrag,
      startColumnDrag,
      endDrag,
    }}>
      {children}
    </DragContext.Provider>
  );
};

export function useDragState() {
  const context = useContext(DragContext);
  if (!context) {
    // Return a fallback implementation when provider is not available
    return {
      dragState: {
        isDragging: false,
        draggedTaskId: null,
        draggedFromColumn: null,
        dragType: null,
      },
      setDragState: () => {},
      startTaskDrag: () => {},
      startColumnDrag: () => {},
      endDrag: () => {},
    };
  }
  return context;
}
