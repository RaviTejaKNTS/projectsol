import { motion, AnimatePresence } from 'framer-motion';
import { CustomDropdown } from '../common/CustomDropdown';
import TaskCard from './TaskCard';
import { useEffect, useRef, useState } from 'react';
import { draggable, dropTargetForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import { setCustomNativeDragPreview } from '@atlaskit/pragmatic-drag-and-drop/element/set-custom-native-drag-preview';
import { Check, MoreHorizontal, Plus, X } from 'lucide-react';
import { PreciseDropIndicator } from './DropIndicator';

export function Column({
  col,
  tasks,
  ids,
  theme,
  onOpenNew,
  onOpenEdit,
  onDeleteColumn,
  onStartRename,
  onCancelRename,
  renaming,
  tempTitle,
  setTempTitle,
  onCommitRename,
  onMoveTask,
  onMoveColumn,

  selectedTaskId,
  setSelectedTaskId,
  onCompleteTask,
  shouldAnimate = false,
  animationIndex = 0,
}: any) {
  const columnRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const taskListRef = useRef<HTMLDivElement>(null);
  const [isColumnDraggedOver, setIsColumnDraggedOver] = useState<boolean>(false);
  const [isTaskDraggedOver, setIsTaskDraggedOver] = useState<boolean>(false);
  const [dropIndicatorIndex, setDropIndicatorIndex] = useState<number | null>(null);

  // Column drag and drop
  useEffect(() => {
    const headerEl = headerRef.current;
    const columnEl = columnRef.current;
    if (!headerEl || !columnEl) return;

    const cleanupDraggable = draggable({
      element: headerEl,
      getInitialData: () => ({ type: 'column', columnId: col.id }),
      onGenerateDragPreview({ nativeSetDragImage }: any) {
        setCustomNativeDragPreview({
          nativeSetDragImage,
          getOffset: () => ({ x: 16, y: 16 }),
          render({ container }: any) {
            const preview = columnEl.cloneNode(true) as HTMLElement;
            preview.style.width = `${columnEl.offsetWidth}px`;
            preview.style.transform = 'rotate(3deg)';
            preview.style.opacity = '0.9';
            preview.style.border = '2px solid rgb(34 197 94)';
            preview.style.boxShadow = '0 25px 50px -12px rgba(0, 0, 0, 0.25)';
            container.appendChild(preview);
          },
        });
      },
    });

    const cleanupDropTarget = dropTargetForElements({
      element: columnEl,
      canDrop: (args: any) => args.source.data.type === 'column' && args.source.data.columnId !== col.id,
      onDragEnter: () => setIsColumnDraggedOver(true),
      onDragLeave: () => setIsColumnDraggedOver(false),
      onDrop: (args: any) => {
        const fromColumnId = args.source.data.columnId as string;
        const toColumnId = col.id;
        onMoveColumn(fromColumnId, toColumnId);
        setIsColumnDraggedOver(false);
      },
    });

    return () => {
      cleanupDraggable();
      cleanupDropTarget();
    };
  }, [col.id, onMoveColumn]);

  // Task drop zone with precise positioning and real-time updates
  useEffect(() => {
    const element = taskListRef.current;
    if (!element) return;

    const calculateDropPosition = (clientY: number, draggedTaskId?: string, draggedFromColumn?: string) => {
      const rect = element.getBoundingClientRect();
      const relativeY = clientY - rect.top;
      
      let insertPosition = 0;
      
      if (ids.length > 0) {
        const taskElements = Array.from(element.querySelectorAll('[data-task-id]')) as HTMLElement[];
        
        for (let i = 0; i < taskElements.length; i++) {
          const taskRect = taskElements[i].getBoundingClientRect();
          const taskY = taskRect.top - rect.top;
          const taskHeight = taskRect.height;
          
          if (relativeY < taskY + taskHeight / 2) {
            insertPosition = i;
            break;
          } else {
            insertPosition = i + 1;
          }
        }
        
        // Handle same-column reordering adjustment
        if (draggedTaskId && draggedFromColumn === col.id) {
          const draggedIndex = ids.indexOf(draggedTaskId);
          if (draggedIndex !== -1 && draggedIndex < insertPosition) {
            insertPosition--;
          }
        }
      }
      
      return insertPosition;
    };

    let dragMoveHandler: ((event: MouseEvent) => void) | null = null;

    return dropTargetForElements({
      element,
      canDrop: (args) => args.source.data.type === 'task',
      onDragEnter: (args) => {
        if (args.source.data.type === 'task') {
          setIsTaskDraggedOver(true);
          
          const draggedTaskId = args.source.data.taskId as string;
          const draggedFromColumn = args.source.data.columnId as string;
          
          // Calculate initial position
          const initialPosition = calculateDropPosition(
            args.location.current.input.clientY,
            draggedTaskId,
            draggedFromColumn
          );
          setDropIndicatorIndex(initialPosition);
          
          // Set up real-time position tracking
          dragMoveHandler = (event: MouseEvent) => {
            const newPosition = calculateDropPosition(
              event.clientY,
              draggedTaskId,
              draggedFromColumn
            );
            setDropIndicatorIndex(newPosition);
          };
          
          document.addEventListener('dragover', dragMoveHandler);
        }
      },
      onDragLeave: (args) => {
        // Only clear if we're actually leaving the column (not entering a child element)
        const rect = element.getBoundingClientRect();
        const x = args.location.current.input.clientX;
        const y = args.location.current.input.clientY;
        
        if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
          setIsTaskDraggedOver(false);
          setDropIndicatorIndex(null);
          
          if (dragMoveHandler) {
            document.removeEventListener('dragover', dragMoveHandler);
            dragMoveHandler = null;
          }
        }
      },
      onDrop: (args) => {
        if (args.source.data.type === 'task') {
          // Don't handle drop if it's on a task card (let the task handle it)
          if (args.location.current.dropTargets.find((target: any) => target.data.type === 'task-card')) {
            return;
          }

          const taskId = args.source.data.taskId as string;
          const fromColumnId = args.source.data.columnId as string;
          
          // Calculate precise drop position based on mouse location
          const rect = element.getBoundingClientRect();
          const dropY = args.location.current.input.clientY;
          const relativeY = dropY - rect.top;
          
          let insertPosition = 0;
          
          if (ids.length > 0) {
            // Get all task elements
            const taskElements = Array.from(element.querySelectorAll('[data-task-id]')) as HTMLElement[];
            
            for (let i = 0; i < taskElements.length; i++) {
              const taskRect = taskElements[i].getBoundingClientRect();
              const taskY = taskRect.top - rect.top;
              const taskHeight = taskRect.height;
              
              if (relativeY < taskY + taskHeight / 2) {
                insertPosition = i;
                break;
              } else {
                insertPosition = i + 1;
              }
            }
            
            // Handle same-column reordering adjustment
            const draggedTaskId = args.source.data.taskId as string;
            const draggedFromColumn = args.source.data.columnId as string;
            
            if (draggedFromColumn === col.id) {
              const draggedIndex = ids.indexOf(draggedTaskId);
              if (draggedIndex !== -1 && draggedIndex < insertPosition) {
                insertPosition--;
              }
            }
          } else {
            insertPosition = 0;
          }
          
          // Ensure valid bounds
          insertPosition = Math.max(0, Math.min(insertPosition, ids.length));
          
          onMoveTask(taskId, fromColumnId, col.id, insertPosition);
          
          // Clean up after drop
          setIsTaskDraggedOver(false);
          setDropIndicatorIndex(null);
          
          if (dragMoveHandler) {
            document.removeEventListener('dragover', dragMoveHandler);
            dragMoveHandler = null;
          }
        }
      },
    });
  }, [col.id, onMoveTask, ids]);


  return (
      <motion.div
        ref={columnRef}
        layout
        initial={shouldAnimate ? { opacity: 0, x: -100, scale: 0.95 } : { opacity: 0, y: 6 }}
        animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
        transition={shouldAnimate ? {
          type: "spring",
          stiffness: 300,
          damping: 30,
          delay: animationIndex * 0.05,
          duration: 0.2
        } : {
          type: "spring",
          stiffness: 200,
          damping: 25
        }}
        className={`snap-start shrink-0 w-80 sm:w-[320px] lg:w-[340px] h-full rounded-3xl border ${theme.border} ${theme.surfaceAlt} backdrop-blur p-2 flex flex-col relative overflow-hidden ${
        isColumnDraggedOver ? 'bg-emerald-500/20 ring-2 ring-emerald-500/50' : ''
      } ${isTaskDraggedOver ? 'bg-emerald-500/10' : ''}`}
    >
                  <div ref={headerRef} className="flex items-center gap-2 mb-3 shrink-0 cursor-grab">
        {renaming ? (
          <div className="flex items-center gap-2 w-full">
            <input
              autoFocus
              value={tempTitle}
              onChange={(e) => setTempTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onCommitRename();
                if (e.key === 'Escape') onCancelRename();
              }}
              className="flex-1 rounded-xl px-2.5 py-1 text-sm border border-emerald-500/50 bg-emerald-500/10"
            />
            <button type="button" onClick={onCommitRename} className={`p-1.5 rounded-lg ${theme.subtle}`} title="Save changes">
              <Check className="h-4 w-4" />
            </button>
            <button type="button" onClick={onCancelRename} className={`p-1.5 rounded-lg ${theme.subtle}`} title="Cancel">
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <>
            <h2 className="font-medium text-sm flex-1 truncate px-4" onDoubleClick={onStartRename}>
              {col.title}
            </h2>
            <span className={`text-xs px-2 py-1 rounded-full font-medium ${theme.muted} bg-black/5 dark:bg-white/10`}>
              {ids.length}
            </span>
            <button type="button" onClick={onOpenNew} className={`p-1.5 rounded-lg ${theme.subtle} hover:bg-black/10 dark:hover:bg-white/10 transition-colors`} title="New task">
              <Plus className="h-4 w-4" />
            </button>
            <CustomDropdown
              onChange={(key: string) => {
                if (key === "rename") onStartRename();
                if (key === "delete") onDeleteColumn(col.id);
              }}
              options={[
                { value: "rename", label: "Rename" },
                { value: "delete", label: "Delete" },
              ]}
              theme={theme}
              trigger={<MoreHorizontal className="h-4 w-4" />}
            />
          </>
        )}
      </div>

      <div 
        ref={taskListRef}
        className="flex-1 min-h-0 -mx-2 px-2 overflow-y-auto scrollbar-hide rounded-b-3xl border-t border-dashed border-zinc-200 dark:border-zinc-800"
      >
        <div className="pt-2.5" />
        
        
        <div className="space-y-2">
          <AnimatePresence initial={false}>
            {/* Drop indicator for empty columns - show only when column is empty */}
            {isTaskDraggedOver && ids.length === 0 && dropIndicatorIndex === 0 && (
              <PreciseDropIndicator 
                visible={true} 
                insertionIndex={0}
                className="my-4"
              />
            )}
            
            {ids.map((taskId: string, index: number) => (
              <div key={taskId}>
                {/* Drop indicator before this task */}
                {isTaskDraggedOver && dropIndicatorIndex === index && (
                  <PreciseDropIndicator 
                    visible={true} 
                    insertionIndex={index}
                  />
                )}
                
                <TaskCard
                  id={taskId}
                  task={tasks[taskId]}
                  onEdit={() => onOpenEdit(taskId)}
                  theme={theme}
                  selected={selectedTaskId === taskId}
                  onSelect={() => setSelectedTaskId(taskId)}
                  onMoveTask={onMoveTask}
                  columnId={col.id}
                  index={index}
                  taskIds={ids}
                  onCompleteTask={onCompleteTask}
                />
              </div>
            ))}
            
            {/* Drop indicator after all tasks - only show when there are tasks */}
            {isTaskDraggedOver && ids.length > 0 && dropIndicatorIndex === ids.length && (
              <PreciseDropIndicator 
                visible={true} 
                insertionIndex={ids.length}
              />
            )}
          </AnimatePresence>
        </div>
        
        <div className="pb-2.5" />
      </div>
        </motion.div>
  );
}
