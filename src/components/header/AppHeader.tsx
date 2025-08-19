import { useRef } from "react";
import { Search, Filter, ChevronDown, Settings } from "lucide-react";
import { ProfileButton } from '../ProfileButton';
import { useBoardsManager } from '../../hooks/useBoardsManager';
import { CustomDropdown } from "../common/CustomDropdown";
import { PRIORITIES } from "../../utils/helpers";

interface AppHeaderProps {
  state: any;
  setState: (updater: (state: any) => any) => void;
  allLabels: string[];
  isDark: boolean;
  border: string;
  surface: string;
  subtle: string;
  muted: string;
  onOpenProfile: () => void;
  onOpenSettings: () => void;
}

export function AppHeader({
  state,
  setState,
  allLabels,
  isDark,
  border,
  surface,
  subtle,
  muted,
  onOpenProfile,
  onOpenSettings
}: AppHeaderProps) {
  const filterButtonRef = useRef<HTMLButtonElement>(null);
  const filterDropdownRef = useRef<HTMLDivElement>(null);
  const { currentBoard } = useBoardsManager();

  return (
    <div className={`sticky top-0 z-40 ${isDark ? "bg-zinc-950/95" : "bg-white/95"} backdrop-blur-md border-b ${border}`}>
      <div className="w-full px-2 sm:px-4 lg:px-6 py-2 sm:py-3 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <img 
            src="/project-sol-logo.png" 
            alt="Project Sol Logo" 
            className="h-7 w-7 shrink-0"
          />
          <div className="flex flex-col min-w-0">
            <h1 className="text-lg sm:text-xl font-semibold tracking-tight truncate">Project Sol</h1>
            {currentBoard && (
              <p className={`text-xs ${muted} truncate`}>
                {currentBoard.name}
              </p>
            )}
          </div>
        </div>

        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          <label className="relative hidden md:block">
            <Search className={`absolute left-2 top-2.5 h-4 w-4 ${muted}`} />
            <input
              id="searchInput"
              placeholder="Search…"
              value={state.filters.text}
              onChange={(e) => setState((s: any) => ({ ...s, filters: { ...s.filters, text: e.target.value } }))}
              className={`pl-8 pr-3 py-2 rounded-2xl ${surface} border ${border} text-sm w-48 lg:w-56 focus:outline-none focus:ring-2 focus:ring-emerald-500/40`}
            />
          </label>

          {/* Filters & Sort remain in header */}
          <div className="hidden lg:flex items-center gap-2">
            <div className="relative">
              <button
                ref={filterButtonRef}
                type="button"
                onClick={() => setState((s: any) => ({ ...s, showFilters: !s.showFilters }))}
                className={`inline-flex items-center gap-2 rounded-2xl border ${border} ${surface} px-3 py-2 text-sm ${subtle} min-w-[80px] justify-center`}
              >
                <Filter className="h-4 w-4" /> Filters
                <ChevronDown className="h-4 w-4 opacity-80" />
              </button>
              {state.showFilters && (
                <div ref={filterDropdownRef} className={`absolute right-0 mt-2 w-[280px] lg:w-[320px] rounded-2xl border ${border} ${surface} p-3 shadow-xl z-50`}>
                  <div className="space-y-3">
                    <div>
                      <div className={`text-xs uppercase ${muted} mb-1`}>Priorities</div>
                      <div className="flex flex-wrap gap-2">
                        {PRIORITIES.map((p) => (
                          <button
                            type="button"
                            key={p}
                            onClick={() =>
                              setState((s: any) => {
                                const has = s.filters.priorities.includes(p);
                                const next = has ? s.filters.priorities.filter((q: any) => q !== p) : [...s.filters.priorities, p];
                                return { ...s, filters: { ...s.filters, priorities: next } };
                              })
                            }
                            className={`px-2.5 py-1 rounded-xl text-xs border transition-colors ${state.filters.priorities.includes(p) ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30' : `${surface} ${border} ${subtle}`}`}>
                            {p}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <div className={`text-xs uppercase ${muted} mb-1`}>Labels</div>
                      <div className="flex flex-wrap gap-2">
                        {allLabels.map((l: string) => (
                          <button
                            type="button"
                            key={l}
                            onClick={() =>
                              setState((s: any) => {
                                const has = s.filters.labels.includes(l);
                                const next = has ? s.filters.labels.filter((q: any) => q !== l) : [...s.filters.labels, l];
                                return { ...s, filters: { ...s.filters, labels: next } };
                              })
                            }
                            className={`px-2.5 py-1 rounded-xl text-xs border transition-colors ${state.filters.labels.includes(l) ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30' : `${surface} ${border} ${subtle}`}`}>
                            #{l}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <div className={`text-xs uppercase ${muted} mb-1`}>Due</div>
                      <div className="flex items-center gap-2">
                        {["all", "overdue", "week"].map((k) => (
                          <button
                            type="button"
                            key={k}
                            onClick={() => setState((s: any) => ({ ...s, filters: { ...s.filters, due: k } }))}
                            className={`px-2.5 py-1 rounded-xl text-xs border transition-colors ${state.filters.due === k ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30' : `${surface} ${border} ${subtle}`}`}>
                            {k}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="hidden lg:flex items-center">
              <CustomDropdown
                value={state.sortMode}
                onChange={(value) => setState((s: any) => ({ ...s, sortMode: value }))}
                prefix="Sort by: "
                options={[
                  { value: "manual", label: "Manual" },
                  { value: "due", label: "Due date" },
                  { value: "priority", label: "Priority" },
                  { value: "created", label: "Newest" }
                ]}
                className="w-40"
                theme={{ surface, border, muted }}
              />
            </div>
          </div>

          {/* Settings entry point */}
          <button
            type="button"
            onClick={onOpenSettings}
            className={`inline-flex items-center gap-1 sm:gap-2 rounded-2xl border ${border} ${surface} px-2 sm:px-3 py-2 text-sm ${subtle} min-w-[80px] justify-center`}
          >
            <Settings className="h-4 w-4" /> <span className="hidden sm:inline">Settings</span>
          </button>
        
          <ProfileButton 
            onOpenProfile={onOpenProfile}
          />
        </div>
      </div>
    </div>
  );
}
