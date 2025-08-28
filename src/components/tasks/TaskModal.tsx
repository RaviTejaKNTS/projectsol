import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { X, Trash2, Check, Edit3 } from "lucide-react";
import { CustomDropdown } from "../common/CustomDropdown";
import { CustomDatePicker } from "../common/CustomDatePicker";
import { PRIORITIES, priorityColor } from "../../utils/helpers";

export function TaskModal({ onClose, onSave, state, editingTaskId, newTaskColumnId, onDelete, onDeleteLabel, onCompleteTask, theme, allLabels, onUpdateTaskLabels }: any) {
    const isEdit = Boolean(editingTaskId?.taskId);
    const task = isEdit ? state.tasks[editingTaskId.taskId] : null;
    const [title, setTitle] = useState(task?.title || "");
    const [description, setDescription] = useState(task?.description || "");
    const [priority, setPriority] = useState(task?.priority || "Medium");
    const [dueDate, setDueDate] = useState(task?.dueDate ? task.dueDate.slice(0, 10) : "");
    const [labels, setLabels] = useState<string[]>(task?.labels || []);
    const [subtasks, setSubtasks] = useState<any[]>(task?.subtasks || []);
    const [newSubtask, setNewSubtask] = useState<string>("");
    const [editingSubtask, setEditingSubtask] = useState<string | null>(null);
    const [editSubtaskText, setEditSubtaskText] = useState<string>("");
    const [draggedSubtask, setDraggedSubtask] = useState<number | null>(null);
    const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
    const [newLabel, setNewLabel] = useState("");
    const [columnId, setColumnId] = useState(editingTaskId?.columnId || newTaskColumnId || state.columns[0]?.id);
  
    useEffect(() => {
      if (editingTaskId?.taskId) {
        const task = state.tasks[editingTaskId.taskId];
        if (task) {
          setTitle(task.title || "");
          setDescription(task.description || "");
          setPriority(task.priority || "Medium");
          setDueDate(task.dueDate ? task.dueDate.slice(0, 10) : "");
          setLabels(task.labels || []);
          setSubtasks(task.subtasks || []);
        }
      } else {
        setTitle("");
        setDescription("");
        setPriority("Medium");
        setDueDate("");
        setLabels([]);
        setSubtasks([]);
      }
    }, [editingTaskId, newTaskColumnId, state.tasks, state.columns]);

    const handleSave = () => {
      console.log('TaskModal handleSave called with labels:', labels);
      console.log('Full payload:', { title, description, priority, dueDate, labels, subtasks });
      
      onSave(
        { title, description, priority, dueDate, labels, subtasks },
        columnId,
        editingTaskId?.taskId
      );
      onClose();
    };
  
    const toggleLabel = (label: string) => {
      console.log('toggleLabel called for:', label);
      console.log('Current labels before toggle:', labels);
      
      setLabels(currentLabels => {
        const newLabels = currentLabels.includes(label) 
          ? currentLabels.filter(l => l !== label) 
          : [...currentLabels, label];
        console.log('New labels after toggle:', newLabels);
        
        // Immediately save the label change for existing tasks to prevent real-time override
        if (editingTaskId?.taskId && onUpdateTaskLabels) {
          console.log('Immediately updating task labels:', editingTaskId.taskId, newLabels);
          onUpdateTaskLabels(editingTaskId.taskId, newLabels);
        }
        
        return newLabels;
      });
    };

    const addLabel = () => {
      console.log('addLabel called with newLabel:', newLabel);
      console.log('Current labels before add:', labels);
      console.log('Available board labels:', allLabels);
      
      const trimmedLabel = newLabel.trim().slice(0, 20);
      if (trimmedLabel && !allLabels.includes(trimmedLabel)) {
        console.log('Adding new label to board:', trimmedLabel);
        
        // First, add the new label to the current task's labels immediately
        const newLabelsForTask = [...labels, trimmedLabel];
        console.log('Adding new label to task immediately:', newLabelsForTask);
        console.log('Previous labels:', labels);
        console.log('New labels array:', newLabelsForTask);
        setLabels(newLabelsForTask);
        
        // Then add new label to board's global label collection
        onSave({ labels: [...allLabels, trimmedLabel] }, null, null, true);
        
        // For existing tasks, immediately save the task labels to prevent real-time override
        if (editingTaskId?.taskId && onUpdateTaskLabels) {
          console.log('Immediately saving new label to task in database:', editingTaskId.taskId, newLabelsForTask);
          onUpdateTaskLabels(editingTaskId.taskId, newLabelsForTask);
        }
        
        setNewLabel("");
      } else if (trimmedLabel && allLabels.includes(trimmedLabel)) {
        console.log('Label already exists in board, adding to task:', trimmedLabel);
        // Label exists in board, just add it to current task
        const newLabelsForTask = [...labels, trimmedLabel];
        setLabels(newLabelsForTask);
        
        // For existing tasks, immediately save the task labels
        if (editingTaskId?.taskId && onUpdateTaskLabels) {
          console.log('Immediately saving existing label to task in database:', editingTaskId.taskId, newLabelsForTask);
          onUpdateTaskLabels(editingTaskId.taskId, newLabelsForTask);
        }
        
        setNewLabel("");
      } else {
        console.log('Label not added - empty or invalid');
      }
    };

    const handleDelete = () => {
      onDelete(editingTaskId.taskId);
      onClose();
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

    const startEditSubtask = (id: string, currentText: string) => {
      setEditingSubtask(id);
      setEditSubtaskText(currentText);
    };

    const saveSubtaskEdit = () => {
      if (editingSubtask && editSubtaskText.trim()) {
        setSubtasks(subtasks.map(st => 
          st.id === editingSubtask ? { ...st, title: editSubtaskText.trim() } : st
        ));
        setEditingSubtask(null);
        setEditSubtaskText("");
      }
    };

    const cancelSubtaskEdit = () => {
      setEditingSubtask(null);
      setEditSubtaskText("");
    };

    const moveSubtask = (fromIndex: number, toIndex: number) => {
      const newSubtasks = [...subtasks];
      const [movedItem] = newSubtasks.splice(fromIndex, 1);
      newSubtasks.splice(toIndex, 0, movedItem);
      setSubtasks(newSubtasks);
    };

    const handleDragStart = (e: React.DragEvent, index: number) => {
      setDraggedSubtask(index);
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/html', '');
    };

    const handleDragOver = (e: React.DragEvent, index: number) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      setDragOverIndex(index);
    };

    const handleDragLeave = () => {
      setDragOverIndex(null);
    };

    const handleDrop = (e: React.DragEvent, dropIndex: number) => {
      e.preventDefault();
      if (draggedSubtask !== null && draggedSubtask !== dropIndex) {
        moveSubtask(draggedSubtask, dropIndex);
      }
      setDraggedSubtask(null);
      setDragOverIndex(null);
    };

    const handleDragEnd = () => {
      setDraggedSubtask(null);
      setDragOverIndex(null);
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
          <div className="p-6 grid grid-cols-3 gap-x-8 max-h-[calc(100vh-160px)] overflow-y-auto scrollbar-hide">
            {/* Left Column */}
            <div className="col-span-2 space-y-6">
              <div>
                <label className={`text-xs uppercase ${theme.muted}`}>Task title</label>
                <input
                  type="text"
                  placeholder="Enter task title..."
                  value={title}
                  onChange={(e) => setTitle(e.target.value.slice(0, 60))}
                  onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                  maxLength={60}
                  className={`w-full text-base bg-transparent focus:outline-none px-3 py-2 rounded-2xl border ${theme.border} focus:ring-2 focus:ring-emerald-500/40`}
                  autoFocus
                />
                <div className={`text-xs ${theme.muted} mt-1`}>
                  {title.length}/60 characters
                </div>
              </div>
              <div>
                <label className={`text-xs uppercase ${theme.muted}`}>Description</label>
                <textarea
                  placeholder="Describe your task..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className={`w-full text-sm bg-transparent focus:outline-none resize-none h-24 px-3 py-2 rounded-2xl border ${theme.border} focus:ring-2 focus:ring-emerald-500/40`}
                />
              </div>
              <div>
                <label className={`text-xs uppercase ${theme.muted}`}>Subtasks</label>
                <div className="space-y-1 mt-1">
                  {subtasks.map((st, index) => (
                    <div key={st.id}>
                      {/* Drop indicator above */}
                      {dragOverIndex === index && draggedSubtask !== index && (
                        <div className="h-0.5 bg-emerald-500 rounded-full mx-2 mb-1" />
                      )}
                      
                      <div 
                        className={`flex items-center gap-2 p-2 rounded-lg cursor-grab transition-all ${
                          draggedSubtask === index 
                            ? 'opacity-50 scale-95' 
                            : theme.subtle
                        } ${editingSubtask !== st.id ? 'hover:bg-zinc-100 dark:hover:bg-zinc-800' : ''}`}
                        draggable={editingSubtask !== st.id}
                        onDragStart={(e) => handleDragStart(e, index)}
                        onDragOver={(e) => handleDragOver(e, index)}
                        onDragLeave={handleDragLeave}
                        onDrop={(e) => handleDrop(e, index)}
                        onDragEnd={handleDragEnd}
                      >
                        <button
                          type="button"
                          onClick={() => toggleSubtask(st.id)}
                          className={`w-5 h-5 rounded border ${theme.border} flex items-center justify-center shrink-0 ${st.completed ? 'bg-emerald-500 border-emerald-500' : ''}`}>
                          {st.completed && <Check className="w-4 h-4 text-white" />}
                        </button>
                        
                        {editingSubtask === st.id ? (
                          <div className="flex-1 flex items-center gap-2">
                            <input
                              type="text"
                              value={editSubtaskText}
                              onChange={(e) => setEditSubtaskText(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') saveSubtaskEdit();
                                if (e.key === 'Escape') cancelSubtaskEdit();
                              }}
                              className={`flex-1 bg-transparent focus:outline-none p-1 -mx-1 rounded border-2 border-emerald-500`}
                              autoFocus
                            />
                            <button onClick={saveSubtaskEdit} className={`p-1 rounded ${theme.subtle}`}>
                              <Check className="h-4 w-4" />
                            </button>
                            <button onClick={cancelSubtaskEdit} className={`p-1 rounded ${theme.subtle}`}>
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ) : (
                          <>
                            <span className={`flex-1 ${st.completed ? 'line-through ' + theme.muted : ''}`}>{st.title}</span>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => startEditSubtask(st.id, st.title)}
                                className={`p-1 rounded ${theme.subtle}`}
                                title="Edit subtask"
                              >
                                <Edit3 className="h-4 w-4" />
                              </button>
                              <button onClick={() => deleteSubtask(st.id)} className={`p-1 rounded ${theme.subtle}`}>
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                      
                      {/* Drop indicator below last item */}
                      {index === subtasks.length - 1 && dragOverIndex === subtasks.length && (
                        <div className="h-0.5 bg-emerald-500 rounded-full mx-2 mt-1" />
                      )}
                    </div>
                  ))}
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Add subtask and press Enter"
                      value={newSubtask}
                      onChange={(e) => setNewSubtask(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && addSubtask()}
                      className={`grow bg-transparent focus:outline-none px-3 py-2 rounded-2xl border ${theme.border} focus:ring-2 focus:ring-emerald-500/40`}
                    />
                    <button onClick={addSubtask} className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ring-1 ring-inset ${priorityColor('Low')}`}>Add</button>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column */}
            <div className="col-span-1 space-y-6">
              <div>
                <label className={`text-xs uppercase ${theme.muted}`}>Due Date</label>
                <CustomDatePicker value={dueDate} onChange={setDueDate} theme={theme} />
              </div>
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
                  {allLabels.map((l: string) => (
                    <div key={l} className="relative group">
                      <button 
                        onClick={() => toggleLabel(l)}
                        className={`text-xs pl-2.5 pr-3 py-1 rounded-lg font-medium transition-colors ring-1 ring-inset ${labels.includes(l) ? 'bg-emerald-500/20 text-emerald-500 dark:text-emerald-400 ring-emerald-500/40' : `${theme.subtle} ring-transparent hover:bg-black/10 dark:hover:bg-white/10`}`}>
                        {l}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteLabel(l);
                        }}
                        className="absolute -top-1.5 -right-1.5 p-0.5 bg-zinc-300 dark:bg-zinc-700 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                        title={`Delete "${l}" label`}
                      >
                        <X className="h-3 w-3 text-zinc-600 dark:text-zinc-200" />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-2 mt-3">
                  <input
                    type="text"
                    placeholder="Add new label..."
                    value={newLabel}
                    onChange={(e) => setNewLabel(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addLabel()}
                    className={`grow bg-transparent focus:outline-none px-3 py-2 rounded-2xl border ${theme.border} focus:ring-2 focus:ring-emerald-500/40`}
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
              {isEdit && (
                <button
                  type="button"
                  onClick={() => {
                    onCompleteTask(editingTaskId.taskId);
                    onClose();
                  }}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ring-1 ring-inset ${priorityColor('Low')}`}
                >
                  Mark task as completed
                </button>
              )}
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
