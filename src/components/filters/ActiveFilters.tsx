import { X } from "lucide-react";

interface ActiveFiltersProps {
  state: any;
  setState: (updater: (state: any) => any) => void;
}

export const ActiveFilters = ({ state, setState }: ActiveFiltersProps) => {
  const { filters } = state;
  const { priorities, labels, due, text } = filters;

  const removePriority = (p: string) => {
    setState((s: any) => ({ ...s, filters: { ...s.filters, priorities: s.filters.priorities.filter((q: string) => q !== p) } }));
  };

  const removeLabel = (l: string) => {
    setState((s: any) => ({ ...s, filters: { ...s.filters, labels: s.filters.labels.filter((q: string) => q !== l) } }));
  };

  const removeDue = () => {
    setState((s: any) => ({ ...s, filters: { ...s.filters, due: "all" } }));
  };

  const removeText = () => {
    setState((s: any) => ({ ...s, filters: { ...s.filters, text: "" } }));
  };

  const FilterTag = ({ children, onRemove }: any) => (
    <div className={`group relative inline-flex items-center gap-1.5 rounded-lg pl-2.5 pr-2 py-1 text-xs border transition-colors bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30`}>
      {children}
      <button type="button" onClick={onRemove} className={`opacity-60 hover:opacity-100`}>
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );

  return (
    <div className="flex flex-wrap items-center gap-2">
      {text && <FilterTag onRemove={removeText}>Search: "{text}"</FilterTag>}
      {priorities.map((p: string) => <FilterTag key={p} onRemove={() => removePriority(p)}>{p} priority</FilterTag>)}
      {labels.map((l: string) => <FilterTag key={l} onRemove={() => removeLabel(l)}>#{l}</FilterTag>)}
      {due !== 'all' && <FilterTag onRemove={removeDue}>Due: {due}</FilterTag>}
    </div>
  );
};
