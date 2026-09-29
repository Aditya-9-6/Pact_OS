'use client';

import { useState, useMemo, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Goal, GoalStatus } from '@/types/domain';
import { GoalCard } from './goal-card';
import { GoalFormModal } from './goal-form-modal';
import { DeleteGoalModal } from './delete-goal-modal';
import { archiveGoalAction, updateGoalAction } from '@/features/goals/actions';
import { Plus, Target, Search, Compass } from 'lucide-react';
import { useUrlState } from '@/hooks/use-url-state';
import {
  GoalsUrlState,
  DEFAULT_GOALS_URL_STATE,
  parseGoalsUrlState,
  serializeGoalsUrlState,
} from '@/lib/url-state';

interface GoalsViewProps {
  initialGoals: Goal[];
  error?: string | null;
}

type GoalFilter = GoalStatus | 'all';

const FILTER_TABS: { value: GoalFilter; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'completed', label: 'Completed' },
  { value: 'archived', label: 'Archived' },
  { value: 'all', label: 'All' },
];

export function GoalsView({ initialGoals, error }: GoalsViewProps) {
  const router = useRouter();
  const [urlState, setUrlState] = useUrlState<GoalsUrlState>({
    parse: parseGoalsUrlState,
    serialize: serializeGoalsUrlState,
    defaultValue: DEFAULT_GOALS_URL_STATE,
    debounceMs: 250,
  });

  const activeFilter = urlState.status;
  const searchQuery = urlState.q;

  // Modal states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [goalToEdit, setGoalToEdit] = useState<Goal | null>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [goalToDelete, setGoalToDelete] = useState<Goal | null>(null);

  const [, startTransition] = useTransition();

  // Derived counts
  const countByStatus = useMemo(() => {
    const counts: Record<string, number> = { active: 0, completed: 0, archived: 0, all: 0 };
    for (const g of initialGoals) {
      counts[g.status] = (counts[g.status] ?? 0) + 1;
      counts.all += 1;
    }
    return counts;
  }, [initialGoals]);

  const filteredGoals = useMemo(() => {
    return initialGoals.filter((goal) => {
      const matchesFilter = activeFilter === 'all' || goal.status === activeFilter;
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !q ||
        goal.title.toLowerCase().includes(q) ||
        (goal.description && goal.description.toLowerCase().includes(q));
      return matchesFilter && matchesSearch;
    });
  }, [initialGoals, activeFilter, searchQuery]);

  const handleOpenCreate = () => {
    setGoalToEdit(null);
    setIsFormOpen(true);
  };

  const handleOpenEdit = (goal: Goal) => {
    setGoalToEdit(goal);
    setIsFormOpen(true);
  };

  const handleOpenDelete = (goal: Goal) => {
    setGoalToDelete(goal);
    setIsDeleteOpen(true);
  };

  const handleArchive = (goal: Goal) => {
    startTransition(async () => {
      await archiveGoalAction(goal.id);
      router.refresh();
    });
  };

  const handleRestore = (goal: Goal) => {
    startTransition(async () => {
      await updateGoalAction(goal.id, { status: 'active' });
      router.refresh();
    });
  };

  const handleFormClose = () => {
    setIsFormOpen(false);
    setGoalToEdit(null);
    router.refresh();
  };

  const handleDeleteClose = () => {
    setIsDeleteOpen(false);
    setGoalToDelete(null);
    router.refresh();
  };

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-6 border-b border-zinc-800/80">
        <div className="min-w-0">
          {/* Eyebrow label */}
          <div className="inline-flex items-center gap-2 text-[11px] font-semibold text-[#d4af37] bg-[#d4af37]/8 border border-[#d4af37]/25 px-3 py-1 rounded-full mb-3 tracking-wide uppercase">
            <Target className="w-3 h-3" aria-hidden="true" />
            <span>Long-Term Commitments</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-100">Goals</h1>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1.5 max-w-md leading-relaxed">
            Define your highest-level objectives. Goals ground your projects and tasks, turning
            intent into discipline.
          </p>
        </div>

        <button
          onClick={handleOpenCreate}
          className="inline-flex items-center justify-center gap-2 bg-[#d4af37] hover:bg-[#e5c158] active:bg-[#c9a832] text-zinc-950 font-semibold px-4 py-2.5 rounded-xl text-xs transition-colors shadow-lg cursor-pointer shrink-0 focus-visible:ring-2 focus-visible:ring-[#d4af37] focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
          aria-label="Create new goal"
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
          <span>New Goal</span>
        </button>
      </div>

      {/* Error Banner */}
      {error && (
        <div
          role="alert"
          className="p-4 rounded-xl bg-rose-950/60 border border-rose-800/60 text-xs text-rose-300 flex items-center gap-2"
        >
          <span className="font-medium">Error:</span> {error}
        </div>
      )}

      {/* Toolbar: Filter Pills + Search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        {/* Status filter pills */}
        <div
          className="flex items-center gap-1 bg-zinc-900/90 border border-zinc-800 p-1 rounded-xl text-xs overflow-x-auto"
          role="tablist"
          aria-label="Filter goals by status"
        >
          {FILTER_TABS.map(({ value, label }) => {
            const isActive = activeFilter === value;
            return (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setUrlState((prev) => ({ ...prev, status: value }))}
                className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400 ${
                  isActive
                    ? 'bg-zinc-800 text-zinc-100 border border-zinc-700/80 shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
                }`}
              >
                {label}
                <span
                  className={`ml-1.5 tabular-nums ${isActive ? 'text-zinc-300' : 'text-zinc-600'}`}
                >
                  ({countByStatus[value] ?? 0})
                </span>
              </button>
            );
          })}
        </div>

        {/* Search */}
        <div className="relative sm:w-64">
          <Search
            className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
            aria-hidden="true"
          />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setUrlState((prev) => ({ ...prev, q: e.target.value }))}
            placeholder="Search goals..."
            aria-label="Search goals"
            className="w-full bg-zinc-950/80 border border-zinc-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-zinc-100 placeholder-zinc-500 focus:border-[#d4af37] focus:outline-none transition-colors"
          />
        </div>
      </div>

      {/* Goals Grid / Empty State */}
      {filteredGoals.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
          {filteredGoals.map((goal) => (
            <GoalCard
              key={goal.id}
              goal={goal}
              onEdit={handleOpenEdit}
              onDelete={handleOpenDelete}
              onArchive={handleArchive}
              onRestore={handleRestore}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          hasSearch={!!searchQuery.trim()}
          hasFilter={activeFilter !== 'all'}
          filterLabel={activeFilter}
          searchQuery={searchQuery.trim()}
          onCreateGoal={handleOpenCreate}
          onClearSearch={() => setUrlState((prev) => ({ ...prev, q: '' }))}
          onClearFilter={() => setUrlState((prev) => ({ ...prev, status: 'all' }))}
        />
      )}

      {/* Modals */}
      <GoalFormModal
        isOpen={isFormOpen}
        onClose={handleFormClose}
        goalToEdit={goalToEdit}
      />

      <DeleteGoalModal
        isOpen={isDeleteOpen}
        onClose={handleDeleteClose}
        goal={goalToDelete}
      />
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Empty State
// ──────────────────────────────────────────────────────────────────────────────

interface EmptyStateProps {
  hasSearch: boolean;
  hasFilter: boolean;
  filterLabel: string;
  searchQuery: string;
  onCreateGoal: () => void;
  onClearSearch: () => void;
  onClearFilter: () => void;
}

function EmptyState({
  hasSearch,
  hasFilter,
  searchQuery,
  onCreateGoal,
  onClearSearch,
  onClearFilter,
}: EmptyStateProps) {
  const isFiltered = hasSearch || hasFilter;

  return (
    <div className="glass-card p-12 rounded-3xl border border-zinc-800/60 text-center flex flex-col items-center justify-center space-y-5 max-w-md mx-auto my-8">
      <div
        className={`w-14 h-14 rounded-2xl flex items-center justify-center ${
          isFiltered
            ? 'bg-zinc-900 border border-zinc-800 text-zinc-500'
            : 'bg-[#d4af37]/8 border border-[#d4af37]/25 text-[#d4af37]'
        }`}
        aria-hidden="true"
      >
        <Compass className="w-6 h-6" />
      </div>

      <div>
        <h3 className="text-base font-semibold text-zinc-200">
          {isFiltered ? 'No goals match your filters.' : 'Start with what matters most.'}
        </h3>
        <p className="text-xs text-zinc-400 mt-1.5 leading-relaxed max-w-xs mx-auto">
          {hasSearch
            ? `No goals matched "${searchQuery}".`
            : isFiltered
              ? 'Try adjusting your filters to see more goals.'
              : 'Establish your first core goal to anchor your projects, habits, and daily focus sessions.'}
        </p>
      </div>

      {isFiltered ? (
        <div className="flex items-center gap-2">
          {hasSearch && (
            <button
              type="button"
              onClick={onClearSearch}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 border border-zinc-700/60 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400"
            >
              Clear search
            </button>
          )}
          {hasFilter && (
            <button
              type="button"
              onClick={onClearFilter}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 border border-zinc-700/60 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400"
            >
              Show all
            </button>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={onCreateGoal}
          className="inline-flex items-center gap-2 bg-[#d4af37] hover:bg-[#e5c158] text-zinc-950 font-semibold px-4 py-2 rounded-xl text-xs transition-colors shadow-md cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d4af37] focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
          <span>Create Your First Goal</span>
        </button>
      )}
    </div>
  );
}
