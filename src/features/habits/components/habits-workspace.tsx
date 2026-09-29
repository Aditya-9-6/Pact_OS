'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { HabitsBootstrapData } from '../data-access';
import { DailyHabitItem, RoutineProgressSummary, HabitCategory } from '@/lib/habits/types';
import { StreakSummaryCard } from './streak-summary-card';
import { HabitCard } from './habit-card';
import { HabitFormModal } from './habit-form-modal';
import { RoutineCard } from './routine-card';
import { RoutineFormModal } from './routine-form-modal';
import { unarchiveHabitAction } from '../actions';
import {
  Plus,
  Sparkles,
  Repeat,
  CheckCircle2,
  ListOrdered,
  Archive,
  RotateCcw,
} from 'lucide-react';
import { useUrlState } from '@/hooks/use-url-state';
import {
  HabitsUrlState,
  DEFAULT_HABITS_URL_STATE,
  parseHabitsUrlState,
  serializeHabitsUrlState,
} from '@/lib/url-state';

interface HabitsWorkspaceProps {
  initialData: HabitsBootstrapData;
}

export function HabitsWorkspace({ initialData }: HabitsWorkspaceProps) {
  const router = useRouter();
  const [urlState, setUrlState] = useUrlState<HabitsUrlState>({
    parse: parseHabitsUrlState,
    serialize: serializeHabitsUrlState,
    defaultValue: DEFAULT_HABITS_URL_STATE,
    debounceMs: 250,
  });

  const activeTab = urlState.tab;
  const selectedCategory = urlState.category;

  // Modal states
  const [isHabitModalOpen, setIsHabitModalOpen] = useState(false);
  const [editingHabit, setEditingHabit] = useState<DailyHabitItem | null>(null);

  const [isRoutineModalOpen, setIsRoutineModalOpen] = useState(false);
  const [editingRoutine, setEditingRoutine] = useState<RoutineProgressSummary | null>(null);

  const handleRefresh = () => {
    router.refresh();
  };

  const handleOpenCreateHabit = () => {
    setEditingHabit(null);
    setIsHabitModalOpen(true);
  };

  const handleOpenEditHabit = (item: DailyHabitItem) => {
    setEditingHabit(item);
    setIsHabitModalOpen(true);
  };

  const handleOpenCreateRoutine = () => {
    setEditingRoutine(null);
    setIsRoutineModalOpen(true);
  };

  const handleOpenEditRoutine = (routine: RoutineProgressSummary) => {
    setEditingRoutine(routine);
    setIsRoutineModalOpen(true);
  };

  const handleUnarchive = async (templateId: string) => {
    await unarchiveHabitAction(templateId);
    handleRefresh();
  };

  // Derive categories
  const allCategories: HabitCategory[] = Array.from(
    new Set(
      initialData.habits
        .map((h) => h.template.category)
        .filter((c): c is HabitCategory => Boolean(c))
    )
  );

  // Filter habits
  const todayHabits = initialData.habits.filter((h) => {
    const isScheduled = Boolean(h.occurrence);
    const matchesCategory =
      selectedCategory === 'all' || h.template.category === selectedCategory;
    return isScheduled && matchesCategory;
  });

  const allActiveHabits = initialData.habits.filter((h) => {
    return selectedCategory === 'all' || h.template.category === selectedCategory;
  });

  const activeHabitTemplates = initialData.habits.map((h) => h.template);

  return (
    <div className="w-full max-w-6xl mx-auto space-y-8 py-6 px-4 sm:px-6">
      {/* 1. Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold tracking-wider uppercase bg-[#d4af37]/10 text-[#d4af37] border border-[#d4af37]/30">
              Behavioral Systems
            </span>
            <span className="font-mono text-xs text-zinc-500">
              {initialData.currentDateStr} ({initialData.userTimezone})
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-100">
            Habits & Daily Routines
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1">
            Deterministic daily commitments, ordered rituals, and streak continuity.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            aria-label="Create new routine"
            onClick={handleOpenCreateRoutine}
            className="px-3.5 py-2 rounded-xl text-xs font-medium bg-zinc-900 border border-white/[0.1] text-zinc-200 hover:bg-zinc-800 hover:text-white flex items-center gap-1.5 transition-all"
          >
            <Sparkles className="w-3.5 h-3.5 text-[#d4af37]" />
            New Routine
          </button>

          <button
            type="button"
            aria-label="Create new habit"
            onClick={handleOpenCreateHabit}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#d4af37] text-black hover:bg-[#e2c056] shadow-lg shadow-[#d4af37]/20 flex items-center gap-1.5 transition-all"
          >
            <Plus className="w-4 h-4" />
            Create Habit
          </button>
        </div>
      </div>

      {/* 2. Streak & Consistency Overview */}
      <StreakSummaryCard metrics={initialData.overallMetrics} />

      {/* 3. Navigation Tabs & Category Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/[0.08] pb-3">
        {/* Tab Buttons */}
        <div className="flex items-center gap-1.5 overflow-x-auto">
          <button
            type="button"
            aria-label="Switch to today's focus habits view"
            onClick={() => setUrlState((prev) => ({ ...prev, tab: 'today' }))}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'today'
                ? 'bg-[#d4af37]/20 text-[#f3e198] border border-[#d4af37]/50'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            Today&apos;s Focus ({todayHabits.length})
          </button>

          <button
            type="button"
            aria-label="Switch to all habits view"
            onClick={() => setUrlState((prev) => ({ ...prev, tab: 'all' }))}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'all'
                ? 'bg-[#d4af37]/20 text-[#f3e198] border border-[#d4af37]/50'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]'
            }`}
          >
            <Repeat className="w-3.5 h-3.5" />
            All Habits ({initialData.habits.length})
          </button>

          <button
            type="button"
            aria-label="Switch routine view mode"
            onClick={() => setUrlState((prev) => ({ ...prev, tab: 'routines' }))}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'routines'
                ? 'bg-[#d4af37]/20 text-[#f3e198] border border-[#d4af37]/50'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]'
            }`}
          >
            <ListOrdered className="w-3.5 h-3.5" />
            Routines ({initialData.routines.length})
          </button>

          {initialData.archivedHabits.length > 0 && (
            <button
              type="button"
              aria-label="Switch to archived habits view"
              onClick={() => setUrlState((prev) => ({ ...prev, tab: 'archived' }))}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === 'archived'
                  ? 'bg-[#d4af37]/20 text-[#f3e198] border border-[#d4af37]/50'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]'
              }`}
            >
              <Archive className="w-3.5 h-3.5" />
              Archived ({initialData.archivedHabits.length})
            </button>
          )}
        </div>

        {/* Category Pills (for habits tabs) */}
        {(activeTab === 'today' || activeTab === 'all') && allCategories.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto text-xs">
            <button
              type="button"
              aria-label="Show all categories"
              onClick={() => setUrlState((prev) => ({ ...prev, category: 'all' }))}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                selectedCategory === 'all'
                  ? 'bg-zinc-800 text-zinc-100 border border-zinc-700 font-medium'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              All
            </button>
            {allCategories.map((cat) => (
              <button
                key={cat}
                type="button"
                aria-label={`Filter habits by ${cat} category`}
                onClick={() => setUrlState((prev) => ({ ...prev, category: cat }))}
                className={`px-2.5 py-1 rounded-lg transition-all capitalize cursor-pointer ${
                  selectedCategory === cat
                    ? 'bg-zinc-800 text-zinc-100 border border-zinc-700 font-medium'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 4. Tab Contents */}

      {/* Tab: Today's Focus */}
      {activeTab === 'today' && (
        <div className="space-y-6">
          {/* Active Routines Summary in Today's View */}
          {initialData.routines.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-[#d4af37]" /> Active Daily Routines
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {initialData.routines.map((routineSummary) => (
                  <RoutineCard
                    key={routineSummary.routine.id}
                    routineSummary={routineSummary}
                    currentDateStr={initialData.currentDateStr}
                    onEdit={handleOpenEditRoutine}
                    onRefresh={handleRefresh}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Today's Habits List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
                <Repeat className="w-3.5 h-3.5 text-[#d4af37]" /> Today&apos;s Scheduled Habits
              </h2>
              <span className="text-xs text-zinc-500 font-mono">
                {todayHabits.filter((h) => h.occurrence?.status === 'completed').length}/
                {todayHabits.length} Complete
              </span>
            </div>

            {todayHabits.length === 0 ? (
              <div className="text-center py-12 px-4 rounded-3xl bg-[#121217]/50 border border-dashed border-zinc-800">
                <Repeat className="w-8 h-8 text-zinc-600 mx-auto mb-3" />
                <h3 className="text-sm font-semibold text-zinc-300">No habits scheduled for today</h3>
                <p className="text-xs text-zinc-500 mt-1 max-w-sm mx-auto">
                  Add a daily or weekday habit to start building deterministic streaks.
                </p>
                <button
                  type="button"
                  aria-label="Create new habit"
                  onClick={handleOpenCreateHabit}
                  className="mt-4 px-4 py-2 rounded-xl text-xs font-semibold bg-[#d4af37] text-black hover:bg-[#e2c056]"
                >
                  Create Habit
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {todayHabits.map((item) => (
                  <HabitCard
                    key={item.template.id}
                    item={item}
                    currentDateStr={initialData.currentDateStr}
                    onEdit={handleOpenEditHabit}
                    onRefresh={handleRefresh}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab: All Active Habits */}
      {activeTab === 'all' && (
        <div className="space-y-3">
          {allActiveHabits.length === 0 ? (
            <div className="text-center py-12 px-4 rounded-3xl bg-[#121217]/50 border border-dashed border-zinc-800">
              <Repeat className="w-8 h-8 text-zinc-600 mx-auto mb-3" />
              <h3 className="text-sm font-semibold text-zinc-300">No active habits found</h3>
              <p className="text-xs text-zinc-500 mt-1">
                Create a habit template to establish repeatable behavioral commitments.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {allActiveHabits.map((item) => (
                <HabitCard
                  key={item.template.id}
                  item={item}
                  currentDateStr={initialData.currentDateStr}
                  onEdit={handleOpenEditHabit}
                  onRefresh={handleRefresh}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab: Routines */}
      {activeTab === 'routines' && (
        <div className="space-y-4">
          {initialData.routines.length === 0 ? (
            <div className="text-center py-12 px-4 rounded-3xl bg-[#121217]/50 border border-dashed border-zinc-800">
              <Sparkles className="w-8 h-8 text-zinc-600 mx-auto mb-3" />
              <h3 className="text-sm font-semibold text-zinc-300">No routine templates</h3>
              <p className="text-xs text-zinc-500 mt-1 max-w-sm mx-auto">
                Group existing habits into ordered morning rituals, shutdown routines, or deep work
                sequences.
              </p>
              <button
                type="button"
                aria-label="Create new routine"
                onClick={handleOpenCreateRoutine}
                className="mt-4 px-4 py-2 rounded-xl text-xs font-semibold bg-[#d4af37] text-black hover:bg-[#e2c056]"
              >
                Create Routine
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {initialData.routines.map((routineSummary) => (
                <RoutineCard
                  key={routineSummary.routine.id}
                  routineSummary={routineSummary}
                  currentDateStr={initialData.currentDateStr}
                  onEdit={handleOpenEditRoutine}
                  onRefresh={handleRefresh}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab: Archived */}
      {activeTab === 'archived' && (
        <div className="space-y-3">
          {initialData.archivedHabits.map((template) => (
            <div
              key={template.id}
              className="flex items-center justify-between p-4 rounded-2xl bg-zinc-900/40 border border-zinc-800/80"
            >
              <div>
                <h3 className="text-sm font-semibold text-zinc-300">{template.name}</h3>
                <p className="text-xs text-zinc-500">
                  Archived • Frequency: {template.frequency_type}
                </p>
              </div>

              <button
                type="button"
                aria-label={`Restore habit ${template.name}`}
                onClick={() => handleUnarchive(template.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700"
              >
                <RotateCcw className="w-3.5 h-3.5 text-[#d4af37]" />
                Restore Habit
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Modals */}
      <HabitFormModal
        isOpen={isHabitModalOpen}
        onClose={() => setIsHabitModalOpen(false)}
        onSuccess={handleRefresh}
        initialHabit={editingHabit}
        availableTasks={initialData.availableTasks}
        currentDateStr={initialData.currentDateStr}
      />

      <RoutineFormModal
        isOpen={isRoutineModalOpen}
        onClose={() => setIsRoutineModalOpen(false)}
        onSuccess={handleRefresh}
        initialRoutine={editingRoutine}
        availableHabits={activeHabitTemplates}
      />
    </div>
  );
}
