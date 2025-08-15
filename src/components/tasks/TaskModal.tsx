import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { X, Trash2, Check } from "lucide-react";
import { CustomDropdown } from "../common/CustomDropdown";
import { CustomDatePicker } from "../common/CustomDatePicker";
import { PRIORITIES, priorityColor } from "../../utils/helpers";

export function TaskModal({ onClose, onSave, state, editingTaskId, onDelete, theme }: any) {
    const isEdit = Boolean(editingTaskId?.taskId);
    const task = isEdit ? state.tasks[editingTaskId.taskId] : null;
    const [title, setTitle] = useState(task?.title || "");
    const [description, setDescription] = useState(task?.description || "");
    const [priority, setPriority] = useState(task?.priority || "Medium");
    const [dueDate, setDueDate] = useState(task?.dueDate ? task.dueDate.slice(0, 10) : "");
    const [labels, setLabels] = useState<string[]>(task?.labels || []);
    const [subtasks, setSubtasks] = useState<any[]>(task?.subtasks || []);
    const [newSubtask, setNewSubtask] = useState<string>("");
    const [newLabel, setNewLabel] = useState("");
    const [columnId, setColumnId] = useState(editingTaskId?.columnId || state.columns[0]?.id);
  
    const handleSave = () => {
      onSave(
        { title, description, priority, dueDate, labels, subtasks },
        columnId,
        editingTaskId?.taskId
      );
      onClose();
    };
  
    const toggleLabel = (label: string) => {
      setLabels(currentLabels => 
        currentLabels.includes(label) 
          ? currentLabels.filter(l => l !== label) 
          : [...currentLabels, label]
      );
    };

    const addLabel = () => {
      const trimmedLabel = newLabel.trim();
      if (trimmedLabel && !labels.includes(trimmedLabel)) {
        if (!state.labels.includes(trimmedLabel)) {
          // This will be saved with the task, and the parent state logic should handle adding it to the global list.
        }
        setLabels([...labels, trimmedLabel]);
        setNewLabel("");
      }
    };

    const handleDelete = () => {
      if (window.confirm("Are you sure you want to delete this task?")) {
        onDelete(editingTaskId.taskId);
        onClose();
      }
    };
  
    const addSubtask = () => {
      if (newSubtask.trim()) {
        setSubtasks([...subtasks, { id: `subtask-${Date.now()}`, title: newSubtask, completed: false }]);
        setNewSubtask("");
      }
    };
  
    const toggleSubtask = (id: string) => {
      setSubtasks(subtasks.map(st => st.id === id ? { ...st, completed: !st.completed } : st));
    };
  
    const deleteSubtask = (id: string) => {
      setSubtasks(subtasks.filter(st => st.id !== id));
    };
  
    useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') onClose();
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSave();
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleSave]);
  
    return (
      <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 20, opacity: 0 }}
          transition={{ duration: 0.2 }}
          className={`w-full max-w-4xl rounded-2xl ${theme.surface} border ${theme.border} shadow-xl overflow-hidden`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Modal Header */}
          <div className={`flex items-center justify-between p-4 border-b ${theme.border}`}>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold">{isEdit ? 'Edit task' : 'Add new task'}</h2>
              {isEdit && task.updatedAt && (
                <span className={`text-xs ${theme.muted}`}>
                  Updated {new Date(task.updatedAt).toLocaleString()}
                </span>
              )}
            </div>
            <button type="button" onClick={onClose} className={`p-2 rounded-lg ${theme.subtle}`}>
              <X className="h-5 w-5" />
            </button>
          </div>
  
          {/* Modal Content */}
          <div className="p-6 grid grid-cols-3 gap-x-8 max-h-[70vh] overflow-y-auto">
            {/* Left Column */}
            <div className="col-span-2 space-y-6">
              <div>
                <label className={`text-xs uppercase ${theme.muted}`}>Task title</label>
                <input
                  type="text"
                  placeholder="Enter task title..."
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className={`w-full text-base bg-transparent focus:outline-none p-2 -mx-2 rounded-lg border-2 border-transparent focus:border-emerald-500`}
                />
              </div>
              <div>
                <label className={`text-xs uppercase ${theme.muted}`}>Description</label>
                <textarea
                  placeholder="Describe your task..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className={`w-full text-sm bg-transparent focus:outline-none resize-none h-24 p-2 -mx-2 rounded-lg border-2 border-transparent focus:border-emerald-500`}
                />
              </div>
              <div>
                <label className={`text-xs uppercase ${theme.muted}`}>Subtasks</label>
                <div className="space-y-2 mt-1">
                  {subtasks.map(st => (
                    <div key={st.id} className={`flex items-center gap-2 p-2 rounded-lg ${theme.subtle}`}>
                      <button
                        type="button"
                        onClick={() => toggleSubtask(st.id)}
                        className={`w-5 h-5 rounded border ${theme.border} flex items-center justify-center shrink-0 ${st.completed ? 'bg-emerald-500 border-emerald-500' : ''}`}>
                        {st.completed && <Check className="w-4 h-4 text-white" />}
                      </button>
                      <span className={`flex-1 ${st.completed ? 'line-through ' + theme.muted : ''}`}>{st.title}</span>
                      <button onClick={() => deleteSubtask(st.id)}>
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Add subtask and press Enter"
                      value={newSubtask}
                      onChange={(e) => setNewSubtask(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && addSubtask()}
                      className={`grow bg-transparent focus:outline-none p-2 -mx-2 rounded-lg border-2 border-transparent focus:border-emerald-500`}
                    />
                    <button onClick={addSubtask} className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ring-1 ring-inset ${priorityColor('Low')}`}>Add</button>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column */}
            <div className="col-span-1 space-y-6">
              <div>
                <label className={`text-xs uppercase ${theme.muted}`}>Priority</label>
                <CustomDropdown
                  value={priority}
                  onChange={setPriority}
                  options={PRIORITIES.map(p => ({ value: p, label: p }))}
                  theme={theme}
                />
              </div>
              <div>
                <label className={`text-xs uppercase ${theme.muted}`}>Due Date</label>
                <CustomDatePicker value={dueDate} onChange={setDueDate} theme={theme} />
              </div>
              <div>
                <label className={`text-xs uppercase ${theme.muted}`}>Column</label>
                <CustomDropdown
                  value={columnId}
                  onChange={setColumnId}
                  options={state.columns.map((c: any) => ({ value: c.id, label: c.title }))}
                  theme={theme}
                />
              </div>
              <div>
                <label className={`text-xs uppercase ${theme.muted}`}>Labels</label>
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  {state.labels.map((l: string) => (
                    <button 
                      key={l} 
                      onClick={() => toggleLabel(l)}
                      className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-colors ring-1 ring-inset ${labels.includes(l) ? 'bg-emerald-500/20 text-emerald-500 dark:text-emerald-400 ring-emerald-500/40' : `${theme.subtle} ring-transparent`}`}>
                      {l}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2 mt-3">
                  <input
                    type="text"
                    placeholder="Add new label..."
                    value={newLabel}
                    onChange={(e) => setNewLabel(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addLabel()}
                    className={`grow bg-transparent focus:outline-none p-1 -mx-1 rounded-md border-2 border-transparent focus:border-emerald-500`}
                  />
                  <button onClick={addLabel} className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ring-1 ring-inset ${priorityColor('Low')}`}>Add</button>
                </div>
              </div>
            </div>
          </div>
  
          {/* Modal Footer */}
          <div className={`flex items-center justify-between p-4 border-t ${theme.border}`}>
            <div>
              {isEdit && (
                <button
                  type="button"
                  onClick={handleDelete}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ring-1 ring-inset ${priorityColor('Urgent')}`}
                >
                  Delete
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ring-1 ring-inset ${priorityColor('none')}`}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ring-1 ring-inset ${priorityColor('Low')}`}
              >
                {isEdit ? 'Save' : 'Create'}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }
