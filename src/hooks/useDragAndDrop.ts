// Production-ready drag and drop system
import { useCallback, useState } from 'react';

export interface DragContext {
  type: 'task' | 'column';
  sourceId: string;
  sourceColumnId?: string;
  targetColumnId?: string;
  targetIndex?: number;
}

export interface DragState {
  isDragging: boolean;
  draggedItem: DragContext | null;
  draggedOverColumn: string | null;
  draggedOverTask: string | null;
  insertionIndex: number | null;
  previewPosition: { x: number; y: number } | null;
}

export interface DragCallbacks {
  onTaskMove: (taskId: string, fromColumnId: string, toColumnId: string, position: number) => void;
  onColumnMove: (fromColumnId: string, toColumnId: string) => void;
}

export function useDragAndDrop(callbacks: DragCallbacks) {
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    draggedItem: null,
    draggedOverColumn: null,
    draggedOverTask: null,
    insertionIndex: null,
    previewPosition: null,
  });

  const startDrag = useCallback((context: DragContext) => {
    setDragState(prev => ({
      ...prev,
      isDragging: true,
      draggedItem: context,
    }));
  }, []);

  const endDrag = useCallback(() => {
    setDragState({
      isDragging: false,
      draggedItem: null,
      draggedOverColumn: null,
      draggedOverTask: null,
      insertionIndex: null,
      previewPosition: null,
    });
  }, []);

  const updateDragOver = useCallback((updates: Partial<DragState>) => {
    setDragState(prev => ({
      ...prev,
      ...updates,
    }));
  }, []);

  const calculateTaskInsertionIndex = useCallback((
    event: MouseEvent | DragEvent,
    containerElement: HTMLElement,
    taskElements: HTMLElement[],
    columnId: string
  ): number => {
    const rect = containerElement.getBoundingClientRect();
    const mouseY = event.clientY - rect.top;
    
    // If no tasks, insert at beginning
    if (taskElements.length === 0) {
      return 0;
    }

    let insertIndex = 0;
    
    for (let i = 0; i < taskElements.length; i++) {
      const taskRect = taskElements[i].getBoundingClientRect();
      const taskY = taskRect.top - rect.top;
      const taskHeight = taskRect.height;
      const taskMiddle = taskY + taskHeight / 2;
      
      if (mouseY < taskMiddle) {
        insertIndex = i;
        break;
      } else {
        insertIndex = i + 1;
      }
    }

    // Handle same-column reordering
    if (dragState.draggedItem?.sourceColumnId === columnId && dragState.draggedItem.type === 'task') {
      const draggedTaskElement = taskElements.find(el => 
        el.getAttribute('data-task-id') === dragState.draggedItem?.sourceId
      );
      
      if (draggedTaskElement) {
        const draggedIndex = taskElements.indexOf(draggedTaskElement);
        if (draggedIndex < insertIndex) {
          insertIndex--;
        }
      }
    }

    return Math.max(0, insertIndex);
  }, [dragState.draggedItem]);

  const performDrop = useCallback(() => {
    if (!dragState.draggedItem) return;

    const { type, sourceId, sourceColumnId, targetColumnId } = dragState.draggedItem;
    const { insertionIndex } = dragState;

    if (type === 'task' && sourceColumnId && targetColumnId && insertionIndex !== null) {
      callbacks.onTaskMove(sourceId, sourceColumnId, targetColumnId, insertionIndex);
    } else if (type === 'column' && targetColumnId) {
      callbacks.onColumnMove(sourceId, targetColumnId);
    }

    endDrag();
  }, [dragState, callbacks, endDrag]);

  return {
    dragState,
    startDrag,
    endDrag,
    updateDragOver,
    calculateTaskInsertionIndex,
    performDrop,
  };
}
