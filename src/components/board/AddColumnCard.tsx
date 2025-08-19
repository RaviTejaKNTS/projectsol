import { Plus } from "lucide-react";

interface AddColumnCardProps {
  adding: boolean;
  tempTitle: string;
  onChangeTitle: (title: string) => void;
  onStart: () => void;
  onAdd: () => void;
  onCancel: () => void;
  theme: {
    border: string;
    surfaceAlt: string;
    subtle: string;
    input: string;
  };
}

export function AddColumnCard({ 
  adding, 
  tempTitle, 
  onChangeTitle, 
  onStart, 
  onAdd, 
  onCancel, 
  theme 
}: AddColumnCardProps) {
  return (
    <div
      className={`snap-start shrink-0 w-80 sm:w-[320px] lg:w-[340px] h-full rounded-3xl border ${theme.border} ${theme.surfaceAlt} backdrop-blur p-3 sm:p-4 flex flex-col justify-center items-stretch`}
    >
      {!adding ? (
        <button
          type="button"
          onClick={onStart}
          className={`w-full flex-1 min-h-0 rounded-2xl border border-dashed ${theme.border} ${theme.subtle} text-sm flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/10 transition-colors`}
        >
          <Plus className="h-4 w-4 mr-2" /> Add column
        </button>
      ) : (
        <div className="space-y-2">
          <input
            autoFocus
            value={tempTitle}
            onChange={(e) => onChangeTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onAdd();
              if (e.key === 'Escape') onCancel();
            }}
            placeholder="Column name"
            className={`w-full rounded-xl ${theme.input} px-2.5 py-2 text-sm`}
          />
          <div className="flex items-center gap-2">
            <button type="button" onClick={onAdd} className="px-2.5 py-1.5 rounded-xl text-sm border border-emerald-600 bg-emerald-500/15 hover:bg-emerald-500/25">Add</button>
            <button type="button" onClick={onCancel} className={`px-2.5 py-1.5 rounded-xl text-sm border ${theme.border} ${theme.subtle}`}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
