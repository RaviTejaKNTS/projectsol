import { uid } from "../utils/helpers";

export function useColumnActions(state: any, setState: (updater: (state: any) => any) => void) {
  const startAddColumn = () => setState((s: any) => ({ ...s, addingColumn: true, tempTitle: "" }));
  
  const commitAddColumn = () => {
    const title = (state.tempTitle || "").trim();
    if (!title) return;
    const id = uid();
    setState((s: any) => ({
      ...s,
      columns: [...s.columns, { id, title, taskIds: [] }],
      addingColumn: false,
      tempTitle: "",
    }));
  };
  
  const cancelAddColumn = () => setState((s: any) => ({ ...s, addingColumn: false, tempTitle: "" }));

  const startRenameColumn = (id: string, current: string) =>
    setState((s: any) => ({ ...s, renamingColumnId: id, tempTitle: current }));

  const cancelRenameColumn = () => setState((s: any) => ({ ...s, renamingColumnId: null, tempTitle: "" }));

  const commitRenameColumn = (id: string) => {
    const next = (state.tempTitle || "").trim();
    if (!next) return;
    setState((s: any) => ({
      ...s,
      columns: s.columns.map((c: any) => (c.id === id ? { ...c, title: next } : c)),
      renamingColumnId: null,
      tempTitle: "",
    }));
  };

  const deleteColumn = (id: string) => {
    if (!confirm("Delete this column and its tasks?")) return;
    setState((s: any) => {
      const col = s.columns.find((c: any) => c.id === id);
      if (!col) return s;
      const tasks = { ...s.tasks } as any;
      col.taskIds.forEach((tid: string) => delete tasks[tid]);
      return { ...s, columns: s.columns.filter((c: any) => c.id !== id), tasks };
    });
  };

  const moveColumn = (fromId: string, toId: string) => {
    setState((s: any) => {
      const fromIndex = s.columns.findIndex((c: any) => c.id === fromId);
      const toIndex = s.columns.findIndex((c: any) => c.id === toId);

      if (fromIndex === -1 || toIndex === -1) return s;

      const newColumns = [...s.columns];
      const [movedItem] = newColumns.splice(fromIndex, 1);
      newColumns.splice(toIndex, 0, movedItem);

      return { ...s, columns: newColumns };
    });
  };

  return {
    startAddColumn,
    commitAddColumn,
    cancelAddColumn,
    startRenameColumn,
    cancelRenameColumn,
    commitRenameColumn,
    deleteColumn,
    moveColumn
  };
}
