import { motion } from "framer-motion";
import { AlertTriangle, Calendar, Tag, Check } from 'lucide-react';
import { prettyDate, getDueDateStatus } from '../../utils/helpers';
import { useEffect, useRef, useState } from 'react';
import { draggable, dropTargetForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import { setCustomNativeDragPreview } from '@atlaskit/pragmatic-drag-and-drop/element/set-custom-native-drag-preview';
import { DropIndicator } from './DropIndicator';

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

export default function TaskCard({ id, task, onEdit, theme, selected, onSelect, columnId, onMoveTask, index, taskIds, onCompleteTask }: any) {
  const ref = useRef<HTMLDivElement>(null);
  
  const [isDraggedOver, setIsDraggedOver] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const cleanupDraggable = draggable({
      element,
      getInitialData: () => ({ type: 'task', taskId: id, columnId }),
      onGenerateDragPreview({ nativeSetDragImage }) {
        setCustomNativeDragPreview({
          nativeSetDragImage,
          getOffset: () => ({ x: 16, y: 16 }),
          render({ container }) {
            const preview = element.cloneNode(true) as HTMLElement;
            preview.style.width = `${element.offsetWidth}px`;
            preview.style.transform = 'rotate(5deg)';
            preview.style.opacity = '0.8';
            container.appendChild(preview);
          },
        });
      },
    });

    const cleanupDropTarget = dropTargetForElements({
      getData: () => ({ type: 'task-card', taskId: id }),
      element,
      canDrop: (args) => args.source.data.type === 'task' && args.source.data.taskId !== id,
      onDragEnter: () => setIsDraggedOver(true),
      onDragLeave: () => setIsDraggedOver(false),
      onDrop: (args) => {
        const fromTaskId = args.source.data.taskId as string;
        const fromColumnId = args.source.data.columnId as string;
        
        // If moving within the same column, adjust the index to account for the dragged task being removed
        let adjustedIndex = index;
        if (fromColumnId === columnId) {
          // Find the current position of the dragged task
          const draggedTaskIndex = taskIds.indexOf(fromTaskId);
          // If the dragged task is above the drop target, subtract 1 from the target index
          if (draggedTaskIndex !== -1 && draggedTaskIndex < index) {
            adjustedIndex = index - 1;
          }
        }
        
        onMoveTask(fromTaskId, fromColumnId, columnId, adjustedIndex);
        setIsDraggedOver(false);
      },
    });

    return () => {
      cleanupDraggable();
      cleanupDropTarget();
    };
  }, [id, columnId, onMoveTask, index]);

  const handleCardClick = () => {
    onEdit();
  };

  const handleCompleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onCompleteTask(id);
  };

  return (
    <>
      {isDraggedOver && <DropIndicator />}
      <motion.div
        ref={ref}
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
        }`}>
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
