import { motion } from "framer-motion";
import { AlertTriangle, Calendar, Tag, Check } from 'lucide-react';
import { prettyDate, getDueDateStatus } from '../../utils/helpers';
import { useEffect, useRef, useState } from 'react';
import { draggable, dropTargetForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import { setCustomNativeDragPreview } from '@atlaskit/pragmatic-drag-and-drop/element/set-custom-native-drag-preview';

function CardMeta({ task }: any) {
  const subtaskProgress = task.subtasks?.length ? `${task.subtasks.filter((st: any) => st.completed).length}/${task.subtasks.length}` : null;

  if (!task.priority && !subtaskProgress) return null;

  const colorClasses = {
    Low: 'text-emerald-600 dark:text-emerald-400',
    Medium: 'text-sky-600 dark:text-sky-400',
    High: 'text-amber-600 dark:text-amber-500',
    Urgent: 'text-rose-600 dark:text-rose-500',
  };

  const priorityClass = task.priority ? colorClasses[task.priority as keyof typeof colorClasses] : 'text-gray-500 dark:text-gray-400';

  const metaItems = [];
  if (task.priority) metaItems.push(task.priority);
  if (subtaskProgress) metaItems.push(`${subtaskProgress} done`);

  return (
    <div className={`inline-flex items-center gap-1.5 text-[10px] font-medium ${priorityClass}`}>
      {task.priority && <AlertTriangle className="h-2.5 w-2.5" />}
      {metaItems.join(' \u00B7 ')}
    </div>
  );
}


function DueDate({ task }: any) {
  const status = getDueDateStatus(task.dueDate);

  const colorRingClasses = {
    past: 'bg-rose-500/15 text-rose-600 dark:text-rose-400 ring-rose-500/30',
    today: 'bg-sky-500/15 text-sky-600 dark:text-sky-400 ring-sky-500/30',
    future: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 ring-emerald-500/30',
  };

  const baseClasses = 'inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-xs font-medium';

  if (!task.dueDate) {
    const noDueDateClasses = 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 ring-zinc-500/30';
    return (
      <div className={`${baseClasses} ring-1 ring-inset ${noDueDateClasses}`}>
        <Calendar className="h-3 w-3" />
        No due
      </div>
    );
  }

  const statusClass = status ? colorRingClasses[status] : 'bg-zinc-500/15 text-zinc-600 dark:text-zinc-400 ring-zinc-400/30';

  return (
    <div className={`${baseClasses} ring-1 ring-inset ${statusClass}`}>
      <Calendar className="h-3 w-3" />
      {prettyDate(task.dueDate)}
    </div>
  );
}

function CardItem({ task, theme }: any) {
  const visibleLabels = task.labels?.slice(0, 3) || [];
  const hiddenLabelsCount = task.labels?.length > 3 ? task.labels.length - 3 : 0;
  const isCompleted = task.completed;

  return (
    <>
      <div className="flex flex-col items-start gap-1">
        <CardMeta task={task} />
        <div className="text-left w-full">
          <div className={`font-medium leading-tight ${isCompleted ? 'line-through opacity-60' : ''}`}>
            {task.title}
          </div>
          {task.description && (
            <div className={`text-xs ${theme.muted} line-clamp-2 mt-1 ${isCompleted ? 'line-through opacity-60' : ''}`}>
              {task.description}
            </div>
          )}
        </div>
      </div>
      <div className={`mt-3 flex items-center flex-wrap gap-2 ${isCompleted ? 'opacity-60' : ''}`}>
        <DueDate task={task} />
        {visibleLabels.map((label: string) => (
          <div key={label} className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 ring-1 ring-inset ring-zinc-500/30">
            <Tag className="h-3 w-3" />
            {label}
          </div>
        ))}
        {hiddenLabelsCount > 0 && (
          <span className="text-xs font-medium text-zinc-500">
            +{hiddenLabelsCount}
          </span>
        )}
      </div>
    </>
  );
}

<<<<<<< HEAD
export default function TaskCard({ 
  id, 
  task, 
  onEdit, 
  theme, 
  selected, 
  onSelect, 
  columnId, 
  onMoveTask, 
  index, 
  taskIds, 
  onCompleteTask 
}: any) {
  const ref = useRef<HTMLDivElement>(null);
  
  const [isDraggedOver, setIsDraggedOver] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
=======
export default function TaskCard({ id, task, onEdit, theme, selected, onSelect, columnId, onMoveTask, index, taskIds, onCompleteTask }: any) {
  const ref = useRef<HTMLDivElement>(null);
  
  const [isDraggedOver, setIsDraggedOver] = useState(false);
>>>>>>> 2283453e807f43fae148164a14de839081d94cce

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

<<<<<<< HEAD
    // Enhanced draggable with better preview and feedback
    const cleanupDraggable = draggable({
      element,
      getInitialData: () => ({ 
        type: 'task', 
        taskId: id, 
        columnId,
        sourceIndex: index
      }),
      onDragStart: () => {
        setIsDragging(true);
        element.style.opacity = '0.5';
      },
      onDrop: () => {
        setIsDragging(false);
        element.style.opacity = '';
      },
=======
    const cleanupDraggable = draggable({
      element,
      getInitialData: () => ({ type: 'task', taskId: id, columnId }),
>>>>>>> 2283453e807f43fae148164a14de839081d94cce
      onGenerateDragPreview({ nativeSetDragImage }) {
        setCustomNativeDragPreview({
          nativeSetDragImage,
          getOffset: () => ({ x: 16, y: 16 }),
          render({ container }) {
            const preview = element.cloneNode(true) as HTMLElement;
            preview.style.width = `${element.offsetWidth}px`;
<<<<<<< HEAD
            preview.style.transform = 'rotate(3deg)';
            preview.style.opacity = '0.9';
            preview.style.border = '2px solid rgb(34 197 94)';
            preview.style.boxShadow = '0 25px 50px -12px rgba(0, 0, 0, 0.25)';
=======
            preview.style.transform = 'rotate(5deg)';
            preview.style.opacity = '0.8';
>>>>>>> 2283453e807f43fae148164a14de839081d94cce
            container.appendChild(preview);
          },
        });
      },
    });

<<<<<<< HEAD
    // Enhanced drop target with precise positioning
    const cleanupDropTarget = dropTargetForElements({
      getData: () => ({ type: 'task-card', taskId: id, columnId, index }),
      element,
      canDrop: (args) => {
        const sourceData = args.source.data;
        return sourceData.type === 'task' && sourceData.taskId !== id;
      },
      onDragEnter: (args) => {
        const sourceData = args.source.data;
        if (sourceData.type === 'task' && sourceData.taskId !== id) {
          setIsDraggedOver(true);
        }
      },
      onDragLeave: () => {
        setIsDraggedOver(false);
      },
      onDrop: (args) => {
        const sourceData = args.source.data;
        const fromTaskId = sourceData.taskId as string;
        const fromColumnId = sourceData.columnId as string;
        
        setIsDraggedOver(false);
        
        if (fromTaskId === id) return; // Can't drop on self
        
        // Calculate precise insertion position
        let targetIndex = index;
        
        if (fromColumnId === columnId) {
          // Same column reordering
          const currentTaskIndex = taskIds.indexOf(fromTaskId);
          const targetTaskIndex = taskIds.indexOf(id);
          
          // Determine if we're dropping above or below
          const rect = element.getBoundingClientRect();
          const dropY = args.location.current.input.clientY;
          const elementMiddle = rect.top + rect.height / 2;
          
          if (dropY < elementMiddle) {
            // Dropping above this task
            targetIndex = targetTaskIndex;
          } else {
            // Dropping below this task
            targetIndex = targetTaskIndex + 1;
          }
          
          // Adjust for same column moves
          if (currentTaskIndex < targetIndex && currentTaskIndex !== -1) {
            targetIndex--;
          }
        } else {
          // Cross-column move
          const rect = element.getBoundingClientRect();
          const dropY = args.location.current.input.clientY;
          const elementMiddle = rect.top + rect.height / 2;
          
          targetIndex = dropY < elementMiddle ? index : index + 1;
        }
        
        // Ensure valid index bounds
        targetIndex = Math.max(0, Math.min(targetIndex, taskIds.length));
        
        onMoveTask(fromTaskId, fromColumnId, columnId, targetIndex);
=======
    const cleanupDropTarget = dropTargetForElements({
      getData: () => ({ type: 'task-card', taskId: id }),
      element,
      canDrop: (args) => args.source.data.type === 'task' && args.source.data.taskId !== id,
      onDragEnter: () => setIsDraggedOver(true),
      onDragLeave: () => setIsDraggedOver(false),
      onDrop: (args) => {
        const fromTaskId = args.source.data.taskId as string;
        const fromColumnId = args.source.data.columnId as string;
        
        let adjustedIndex = index;
        if (fromColumnId === columnId) {
          const currentIndex = taskIds.indexOf(fromTaskId);
          const targetIndex = taskIds.indexOf(id);
          
          if (fromTaskId === id) {
            adjustedIndex = targetIndex;
          } else if (fromTaskId !== id) {
            adjustedIndex = targetIndex > currentIndex ? targetIndex - 1 : targetIndex;
          }
        }
        
        onMoveTask(fromTaskId, fromColumnId, columnId, adjustedIndex);
        setIsDraggedOver(false);
>>>>>>> 2283453e807f43fae148164a14de839081d94cce
      },
    });

    return () => {
      cleanupDraggable();
      cleanupDropTarget();
    };
<<<<<<< HEAD
  }, [id, columnId, onMoveTask, index, taskIds]);
=======
  }, [id, columnId, onMoveTask, index]);
>>>>>>> 2283453e807f43fae148164a14de839081d94cce

  const handleCardClick = () => {
    onEdit();
  };

  const handleCompleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onCompleteTask(id);
  };

  return (
    <>
<<<<<<< HEAD
      <motion.div
        ref={ref}
        data-task-id={id}
=======
      {isDraggedOver && <DropIndicator />}
      <motion.div
        ref={ref}
>>>>>>> 2283453e807f43fae148164a14de839081d94cce
        tabIndex={0}
        onClick={handleCardClick}
        onFocus={onSelect}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleCardClick();
        }}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.98 }}
        id={`task-${id}`}
        className={`relative rounded-2xl border ${theme.border} ${theme.surface} p-4 shadow-sm select-none transition-all duration-150 cursor-grab active:cursor-grabbing ${
          selected ? "ring-2 ring-emerald-500" : "hover:shadow-md"
<<<<<<< HEAD
        } ${isDragging ? 'opacity-50' : ''} ${isDraggedOver ? 'transform scale-105' : ''}`}
        style={{
          transformOrigin: 'center',
        }}>
=======
        }`}>
>>>>>>> 2283453e807f43fae148164a14de839081d94cce
        {/* Circular checkbox in top-right corner */}
        <button
          onClick={handleCompleteClick}
          className={`absolute top-3 right-3 w-5 h-5 rounded-full border-2 transition-colors flex items-center justify-center group ${
            task.completed 
              ? 'border-emerald-500 bg-emerald-500 text-white' 
              : 'border-zinc-400 dark:border-zinc-500 bg-white dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800'
          }`}
          title={task.completed ? "Completed" : "Mark as completed"}
        >
          <Check className={`w-3 h-3 transition-opacity ${
            task.completed 
              ? 'opacity-100' 
              : 'text-zinc-400 dark:text-zinc-500 opacity-0 group-hover:opacity-100'
          }`} />
        </button>
        <CardItem task={task} theme={theme} />
      </motion.div>
    </>
  );
}
