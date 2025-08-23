import { motion, AnimatePresence } from 'framer-motion';
import { X, Calendar, Tag, Clock, CheckCircle2 } from 'lucide-react';
import { prettyDate, priorityColor } from '../utils/helpers';

interface CompletedTasksModalProps {
  isOpen: boolean;
  onClose: () => void;
  completedTasks: any[];
  onRestoreTask: (taskId: string) => void;
  theme: {
    surface: string;
    border: string;
    muted: string;
    subtle: string;
  };
}

export function CompletedTasksModal({ isOpen, onClose, completedTasks, onRestoreTask, theme }: CompletedTasksModalProps) {
  if (!isOpen) return null;

  const sortedCompletedTasks = [...completedTasks].sort((a, b) => {
    const aTime = a.completedAt || a.updatedAt || a.createdAt;
    const bTime = b.completedAt || b.updatedAt || b.createdAt;
    return bTime - aTime;
  });

  const formatCompletionDate = (task: any) => {
    const date = new Date(task.completedAt || task.updatedAt || task.createdAt);
    return date.toLocaleDateString(undefined, { 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleRestoreTask = (taskId: string) => {
    onRestoreTask(taskId);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          onClick={onClose}
        />
        
        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className={`relative w-full max-w-4xl max-h-[80vh] rounded-3xl ${theme.surface} border ${theme.border} shadow-2xl flex flex-col`}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-zinc-200 dark:border-zinc-700">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-6 w-6 text-emerald-500" />
              <h2 className="text-xl font-semibold">Completed Tasks</h2>
              <span className={`px-2 py-1 rounded-full text-sm ${theme.muted} bg-emerald-500/10 text-emerald-600 dark:text-emerald-400`}>
                {completedTasks.length} tasks
              </span>
            </div>
            <button
              onClick={onClose}
              className={`p-2 rounded-xl ${theme.subtle} hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors`}
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto scrollbar-hide p-6">
            {completedTasks.length === 0 ? (
              <div className="text-center py-12">
                <CheckCircle2 className={`h-16 w-16 mx-auto mb-4 ${theme.muted}`} />
                <h3 className="text-lg font-medium mb-2">No completed tasks yet</h3>
                <p className={theme.muted}>Complete some tasks to see them here!</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {sortedCompletedTasks.map((task, index) => (
                  <motion.div
                    key={task.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className={`p-4 rounded-2xl border ${theme.border} ${theme.surface} hover:shadow-md transition-all duration-200 group`}
                  >
                    {/* Task Header */}
                    <div className="flex items-start justify-between mb-3">
                      <h3 className="font-medium text-sm leading-tight flex-1 pr-2">
                        {task.title}
                      </h3>
                      <div className="flex items-center gap-2">
                        <div className={`px-2 py-1 rounded-lg text-xs font-medium ring-1 ${priorityColor(task.priority)}`}>
                          {task.priority}
                        </div>
                        {/* Restore button */}
                        <button
                          onClick={() => handleRestoreTask(task.id)}
                          className="w-5 h-5 rounded-full bg-emerald-500 border-2 border-emerald-500 text-white hover:bg-emerald-600 hover:border-emerald-600 transition-colors flex items-center justify-center"
                          title="Restore task"
                        >
                          <CheckCircle2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    {/* Description */}
                    {task.description && (
                      <p className={`text-xs ${theme.muted} mb-3 line-clamp-2`}>
                        {task.description}
                      </p>
                    )}

                    {/* Labels */}
                    {task.labels && task.labels.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-3">
                        {task.labels.slice(0, 3).map((label: string) => (
                          <span
                            key={label}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
                          >
                            <Tag className="h-3 w-3" />
                            {label}
                          </span>
                        ))}
                        {task.labels.length > 3 && (
                          <span className={`text-xs ${theme.muted}`}>
                            +{task.labels.length - 3} more
                          </span>
                        )}
                      </div>
                    )}

                    {/* Subtasks Progress */}
                    {task.subtasks && task.subtasks.length > 0 && (
                      <div className="mb-3">
                        <div className="flex items-center gap-2 text-xs">
                          <div className="flex-1 bg-zinc-200 dark:bg-zinc-700 rounded-full h-1.5">
                            <div 
                              className="bg-emerald-500 h-1.5 rounded-full transition-all duration-300"
                              style={{ 
                                width: `${(task.subtasks.filter((st: any) => st.completed).length / task.subtasks.length) * 100}%` 
                              }}
                            />
                          </div>
                          <span className={theme.muted}>
                            {task.subtasks.filter((st: any) => st.completed).length}/{task.subtasks.length}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Footer */}
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <Clock className={`h-3 w-3 ${theme.muted}`} />
                        <span className={theme.muted}>
                          Completed {formatCompletionDate(task)}
                        </span>
                      </div>
                      {task.dueDate && (
                        <div className="flex items-center gap-1">
                          <Calendar className={`h-3 w-3 ${theme.muted}`} />
                          <span className={`text-xs ${theme.muted}`}>
                            {prettyDate(task.dueDate).split(' • ')[0]}
                          </span>
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
