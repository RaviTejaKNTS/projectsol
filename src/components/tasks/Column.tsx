import { motion, AnimatePresence } from 'framer-motion';
import { CustomDropdown } from '../common/CustomDropdown';
import TaskCard from './TaskCard';
import { useEffect, useRef, useState } from 'react';
import { draggable, dropTargetForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import { setCustomNativeDragPreview } from '@atlaskit/pragmatic-drag-and-drop/element/set-custom-native-drag-preview';
import { Check, MoreHorizontal, Plus, X } from 'lucide-react';

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
            preview.style.transform = 'rotate(5deg)';
            preview.style.opacity = '0.8';
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

  useEffect(() => {
    const element = taskListRef.current;
    if (!element) return;

    return dropTargetForElements({
      element,
      canDrop: (args) => args.source.data.type === 'task',
      onDrop: (args) => {
        if (args.source.data.type === 'task') {
          if (args.location.current.dropTargets.find(target => target.data.type === 'task-card')) {
            return;
          }

          const taskId = args.source.data.taskId as string;
          const fromColumnId = args.source.data.columnId as string;
          onMoveTask(taskId, fromColumnId, col.id, ids.length);
        }
      },
    });
  }, [col.id, onMoveTask, ids.length]);

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
        className={`snap-start shrink-0 w-80 sm:w-[320px] lg:w-[340px] h-full rounded-3xl border ${theme.border} ${theme.surfaceAlt} backdrop-blur p-2 flex flex-col relative overflow-hidden ${isColumnDraggedOver ? 'bg-emerald-500/20' : ''}`}
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
            {ids.map((taskId: string, index: number) => (
              <TaskCard
                key={taskId}
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
            ))}
          </AnimatePresence>
        </div>
        
        <div className="pb-2.5" />
      </div>
        </motion.div>
  );
}
