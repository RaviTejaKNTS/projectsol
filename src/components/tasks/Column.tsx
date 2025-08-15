import { motion, AnimatePresence } from 'framer-motion';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Plus, Check, X, MoreHorizontal } from 'lucide-react';
import { CustomDropdown } from '../common/CustomDropdown';
import { TaskCard } from './TaskCard';

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
  selectedTaskId,
  setSelectedTaskId,
}: any) {
  const { setNodeRef } = useDroppable({ id: col.id });

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 120, damping: 18 }}
      className={`snap-start shrink-0 min-w-0 h-full rounded-3xl border ${theme.border} ${theme.surfaceAlt} backdrop-blur p-3 sm:p-4 flex flex-col relative overflow-hidden`}
    >
      <div className="flex items-center gap-2 mb-3 shrink-0">
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
            <h2 className="font-medium text-sm flex-1 truncate" onDoubleClick={onStartRename}>
              {col.title}
            </h2>
            <span className={`text-xs px-2 py-1 rounded-full font-medium ${theme.muted} bg-black/5 dark:bg-white/10`}>
              {ids.length}
            </span>
            <button type="button" onClick={onOpenNew} className={`p-1.5 rounded-lg ${theme.subtle}`} title="New task">
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

      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <div ref={setNodeRef} className={`flex-1 min-h-0 -mx-3 sm:-mx-4 px-3 sm:px-4 space-y-2.5 overflow-y-auto rounded-b-3xl border-t ${theme.border} border-dashed`}>
          <div className="pt-2.5" />
          <AnimatePresence initial={false}>
            {ids.map((taskId: string) => (
              <TaskCard
                key={taskId}
                id={taskId}
                task={tasks[taskId]}
                onEdit={() => onOpenEdit(taskId)}
                theme={theme}
                selected={selectedTaskId === taskId}
                onSelect={() => setSelectedTaskId(taskId)}
              />
            ))}
          </AnimatePresence>
          <div className="pb-2.5" />
        </div>
      </SortableContext>
    </motion.div>
  );
}
