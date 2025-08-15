import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { motion } from "framer-motion";
import { GripVertical, AlertTriangle, Calendar, CheckSquare, Tag } from 'lucide-react';
import { priorityColor, prettyDate, isOverdue } from '../../utils/helpers';

function CardMeta({ task, theme }: any) {
  if (!task.priority && !task.dueDate && !task.labels?.length && !task.subtasks?.length) return null;
  const subtaskProgress = task.subtasks?.length ? `${task.subtasks.filter((st: any) => st.completed).length}/${task.subtasks.length} done` : null;

  return (
    <div className="mt-3 flex items-center flex-wrap gap-x-3 gap-y-1.5 text-xs">
      {task.priority && (
        <div className={`inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-xs font-medium ring-1 ring-inset ${priorityColor(task.priority)}`}>
          <AlertTriangle className="h-3 w-3" />
          {task.priority}
        </div>
      )}
      {subtaskProgress && (
        <div className={`flex items-center gap-1.5 ${theme.muted}`}>
          <CheckSquare className="h-3.5 w-3.5" />
          {subtaskProgress}
        </div>
      )}
      {task.labels?.map((l: string) => (
        <div key={l} className={`flex items-center gap-1.5 ${theme.muted}`}>
          <Tag className="h-3.5 w-3.5" />
          {l}
        </div>
      ))}
      {task.dueDate && (
        <div className={`flex items-center gap-1.5 ml-auto ${isOverdue(task.dueDate) ? 'text-red-500' : theme.muted}`}>
          <Calendar className="h-3.5 w-3.5" />
          {prettyDate(task.dueDate)}
        </div>
      )}
    </div>
  );
}

function CardItem({ task, theme }: any) {
  return (
    <>
      <div className="flex items-start gap-2">
        <div className="text-left flex-1">
          <div className="font-medium leading-tight">{task.title}</div>
          {task.description && <div className={`text-xs ${theme.muted} line-clamp-2`}>{task.description}</div>}
        </div>
        <div className="flex items-center gap-1">
          <span className={`p-1 rounded-lg ${theme.subtle}`} title="Drag">
            <GripVertical className="h-4 w-4" />
          </span>
        </div>
      </div>
      <CardMeta task={task} theme={theme} />
    </>
  );
}

export function TaskCard({ id, task, onEdit, theme, selected, onSelect }: any) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition } as React.CSSProperties;

  const handleCardClick: React.MouseEventHandler = () => {
    if (!isDragging) {
      onSelect();
      onEdit();
    }
  };

  return (
    <motion.div
      layout
      ref={setNodeRef}
      style={style}
      onClick={handleCardClick}
      onFocus={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter") handleCardClick(e as any);
      }}
      {...attributes}
      {...listeners}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98 }}
      id={`task-${id}`}
      className={`relative rounded-2xl border ${theme.border} ${theme.surface} p-3 shadow-sm select-none ${isDragging ? "ring-2 ring-emerald-400/40" : selected ? "ring-2 ring-emerald-500" : ""}`}>
      <CardItem task={task} theme={theme} />
    </motion.div>
  );
}
