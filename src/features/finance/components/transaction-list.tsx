'use client';

import React, { useState, useMemo } from 'react';
import {
  FinanceTransaction,
  FinanceCategory,
  TransactionType,
  formatCentsToCurrency,
  FinanceColorTag,
} from '@/lib/money';
import {
  bulkCategorizeTransactionsAction,
  bulkDeleteTransactionsAction,
} from '../actions';
import {
  Search,
  Filter,
  Plus,
  Pencil,
  Trash2,
  ArrowDownRight,
  ArrowUpRight,
  Check,
  Tag,
  X,
} from 'lucide-react';
import { Button, GlassCard, BulkActionToolbar, Alert } from '@/components/ui';
import { useUrlState } from '@/hooks/use-url-state';
import { useSelection } from '@/hooks/use-selection';
import {
  FinanceUrlState,
  DEFAULT_FINANCE_URL_STATE,
  parseFinanceUrlState,
  serializeFinanceUrlState,
} from '@/lib/url-state';

interface TransactionListProps {
  transactions: FinanceTransaction[];
  categories: FinanceCategory[];
  currency?: string;
  onAddTransaction: (type?: TransactionType) => void;
  onEditTransaction: (transaction: FinanceTransaction) => void;
  onDeleteTransaction: (id: string) => Promise<void>;
  onRefresh?: () => void;
  isDeletingId?: string | null;
}

const COLOR_MAP: Record<FinanceColorTag, { dot: string; bg: string; text: string }> = {
  gold: { dot: 'bg-amber-400', bg: 'bg-amber-400/15', text: 'text-amber-400' },
  blue: { dot: 'bg-blue-400', bg: 'bg-blue-400/15', text: 'text-blue-400' },
  purple: { dot: 'bg-purple-400', bg: 'bg-purple-400/15', text: 'text-purple-400' },
  emerald: { dot: 'bg-emerald-400', bg: 'bg-emerald-400/15', text: 'text-emerald-400' },
  amber: { dot: 'bg-amber-500', bg: 'bg-amber-500/15', text: 'text-amber-500' },
  rose: { dot: 'bg-rose-400', bg: 'bg-rose-400/15', text: 'text-rose-400' },
  cyan: { dot: 'bg-cyan-400', bg: 'bg-cyan-400/15', text: 'text-cyan-400' },
  slate: { dot: 'bg-zinc-400', bg: 'bg-zinc-400/15', text: 'text-zinc-400' },
};

export function TransactionList({
  transactions,
  categories,
  currency = 'INR',
  onAddTransaction,
  onEditTransaction,
  onDeleteTransaction,
  onRefresh,
  isDeletingId,
}: TransactionListProps) {
  // URL State Synchronization
  const [urlState, setUrlState] = useUrlState<FinanceUrlState>({
    parse: parseFinanceUrlState,
    serialize: serializeFinanceUrlState,
    defaultValue: DEFAULT_FINANCE_URL_STATE,
    debounceMs: 250,
  });

  const typeFilter = urlState.tab;
  const selectedCategory = urlState.category;
  const searchQuery = urlState.q;

  // Multi-Select Hook
  const {
    selectedList,
    count: selectedCount,
    isSelected,
    toggle: toggleSelect,
    toggleAll,
    clear: clearSelection,
    isAllSelected,
    isIndeterminate,
  } = useSelection();

  // Bulk operation processing state
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);
  const [bulkProcessingLabel, setBulkProcessingLabel] = useState('');
  const [bulkFeedback, setBulkFeedback] = useState<{
    type: 'success' | 'warning' | 'danger';
    message: string;
  } | null>(null);

  // Bulk Categorize Modal
  const [isCategorizeModalOpen, setIsCategorizeModalOpen] = useState(false);
  const [targetCategoryId, setTargetCategoryId] = useState<string>('none');

  // Bulk Delete Modal
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);

  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      // Type filter
      if (typeFilter !== 'all' && tx.type !== typeFilter) {
        return false;
      }
      // Category filter
      if (selectedCategory !== 'all') {
        if (selectedCategory === 'uncategorized' && tx.category_id) {
          return false;
        }
        if (selectedCategory !== 'uncategorized' && tx.category_id !== selectedCategory) {
          return false;
        }
      }
      // Search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const descMatch = tx.description.toLowerCase().includes(query);
        const catName = tx.categories?.name?.toLowerCase() || '';
        const catMatch = catName.includes(query);
        if (!descMatch && !catMatch) {
          return false;
        }
      }
      return true;
    });
  }, [transactions, typeFilter, selectedCategory, searchQuery]);

  const visibleTransactionIds = useMemo(
    () => filteredTransactions.map((tx) => tx.id),
    [filteredTransactions]
  );

  // ==========================================================================
  // Bulk Action Handlers
  // ==========================================================================
  const handleBulkCategorize = async () => {
    if (selectedList.length === 0) return;
    setIsBulkProcessing(true);
    setBulkProcessingLabel(`Categorizing ${selectedList.length} transactions...`);
    setBulkFeedback(null);

    const categoryIdVal = targetCategoryId === 'none' ? null : targetCategoryId;

    try {
      const res = await bulkCategorizeTransactionsAction({
        transactionIds: selectedList,
        categoryId: categoryIdVal,
      });

      setIsBulkProcessing(false);
      setIsCategorizeModalOpen(false);

      if (res.success) {
        setBulkFeedback({
          type: 'success',
          message: `Categorized ${res.succeeded.length} ${res.succeeded.length === 1 ? 'transaction' : 'transactions'}.`,
        });
        clearSelection();
        onRefresh?.();
      } else {
        setBulkFeedback({
          type: 'danger',
          message: res.error || 'Failed to categorize selected transactions.',
        });
      }
    } catch {
      setIsBulkProcessing(false);
      setIsCategorizeModalOpen(false);
      setBulkFeedback({
        type: 'danger',
        message: 'An unexpected error occurred during bulk categorization.',
      });
    }
  };

  const handleBulkDelete = async () => {
    if (selectedList.length === 0) return;
    setIsBulkProcessing(true);
    setBulkProcessingLabel(`Deleting ${selectedList.length} transactions...`);
    setBulkFeedback(null);

    try {
      const res = await bulkDeleteTransactionsAction({
        transactionIds: selectedList,
      });

      setIsBulkProcessing(false);
      setIsBulkDeleteModalOpen(false);

      if (res.success) {
        setBulkFeedback({
          type: 'success',
          message: `Deleted ${res.succeeded.length} ${res.succeeded.length === 1 ? 'transaction' : 'transactions'}.`,
        });
        clearSelection();
        onRefresh?.();
      } else {
        setBulkFeedback({
          type: 'danger',
          message: res.error || 'Failed to delete selected transactions.',
        });
      }
    } catch {
      setIsBulkProcessing(false);
      setIsBulkDeleteModalOpen(false);
      setBulkFeedback({
        type: 'danger',
        message: 'An unexpected error occurred during bulk deletion.',
      });
    }
  };

  return (
    <div className="p-6 rounded-2xl bg-zinc-950/40 border border-white/[0.08] backdrop-blur-md space-y-6">
      {/* Top Header and Filters */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-white">Transaction History</h2>
          <p
            className="text-xs text-zinc-400 mt-0.5"
            role="status"
            aria-live="polite"
          >
            {filteredTransactions.length} {filteredTransactions.length === 1 ? 'transaction' : 'transactions'} in selected period
          </p>
        </div>

        {/* Filter Toolbar */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Search Box */}
          <div className="relative min-w-[180px] flex-1 sm:flex-none">
            <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search transactions..."
              value={searchQuery}
              onChange={(e) => setUrlState((prev) => ({ ...prev, q: e.target.value }))}
              className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-zinc-900/80 border border-white/[0.08] text-xs text-zinc-200 placeholder-zinc-400 focus:outline-none focus:border-amber-400/50 transition-colors"
            />
          </div>

          {/* Type Segment Filter */}
          <div className="flex rounded-xl bg-zinc-900/80 p-1 border border-white/[0.08]" role="tablist" aria-label="Transaction Type Filter">
            <button
              type="button"
              role="tab"
              aria-selected={typeFilter === 'all'}
              onClick={() => setUrlState((prev) => ({ ...prev, tab: 'all' }))}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                typeFilter === 'all'
                  ? 'bg-zinc-800 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              All
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={typeFilter === 'expense'}
              onClick={() => setUrlState((prev) => ({ ...prev, tab: 'expense' }))}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                typeFilter === 'expense'
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Expenses
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={typeFilter === 'income'}
              onClick={() => setUrlState((prev) => ({ ...prev, tab: 'income' }))}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                typeFilter === 'income'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Income
            </button>
          </div>

          {/* Category Dropdown Filter */}
          <div className="relative">
            <select
              value={selectedCategory}
              onChange={(e) => setUrlState((prev) => ({ ...prev, category: e.target.value }))}
              aria-label="Filter by Category"
              className="pl-3 pr-8 py-1.5 rounded-xl bg-zinc-900/80 border border-white/[0.08] text-xs text-zinc-300 focus:outline-none focus:border-amber-400/50 appearance-none transition-colors cursor-pointer"
            >
              <option value="all">All Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
              <option value="uncategorized">Uncategorized</option>
            </select>
            <Filter className="w-3 h-3 text-zinc-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Select All Checkbox Button */}
          {visibleTransactionIds.length > 0 && (
            <button
              type="button"
              onClick={() => toggleAll(visibleTransactionIds)}
              title={isAllSelected(visibleTransactionIds) ? 'Deselect all visible' : 'Select all visible'}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-medium transition-colors cursor-pointer ${
                isAllSelected(visibleTransactionIds)
                  ? 'bg-amber-400/15 border-amber-400/40 text-amber-300'
                  : isIndeterminate(visibleTransactionIds)
                  ? 'bg-amber-400/10 border-amber-400/30 text-amber-300'
                  : 'bg-zinc-900/80 border-white/[0.08] text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <div
                className={`w-3.5 h-3.5 rounded border flex items-center justify-center ${
                  isAllSelected(visibleTransactionIds)
                    ? 'bg-amber-400 border-amber-400 text-zinc-950'
                    : isIndeterminate(visibleTransactionIds)
                    ? 'bg-amber-400/50 border-amber-400 text-zinc-950'
                    : 'border-white/30 bg-zinc-800'
                }`}
              >
                {isAllSelected(visibleTransactionIds) && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                {isIndeterminate(visibleTransactionIds) && <span className="w-1.5 h-1.5 bg-zinc-950 rounded-sm" />}
              </div>
              <span className="hidden sm:inline">Select All</span>
            </button>
          )}
        </div>
      </div>

      {bulkFeedback && (
        <Alert
          variant={bulkFeedback.type}
          title={bulkFeedback.type === 'success' ? 'Batch Succeeded' : 'Batch Notice'}
          onDismiss={() => setBulkFeedback(null)}
        >
          {bulkFeedback.message}
        </Alert>
      )}

      {/* Transaction Table / List */}
      {filteredTransactions.length === 0 ? (
        <div className="py-16 flex flex-col items-center justify-center text-center border border-dashed border-white/[0.06] rounded-2xl">
          <div className="w-12 h-12 rounded-full bg-zinc-900 border border-white/[0.08] flex items-center justify-center text-zinc-400 mb-3">
            <Filter className="w-6 h-6" aria-hidden="true" />
          </div>
          <p className="text-sm font-medium text-zinc-300">No transactions match your criteria</p>
          <p className="text-xs text-zinc-400 mt-1 max-w-sm">
            {transactions.length === 0
              ? 'No financial entries logged yet for this month. Start by adding your first transaction.'
              : 'Try clearing your search query or selecting a different filter.'}
          </p>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => onAddTransaction('expense')}
              className="px-3.5 py-1.5 rounded-xl bg-amber-400 text-zinc-950 text-xs font-bold hover:bg-amber-300 transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Expense
            </button>
            <button
              type="button"
              onClick={() => onAddTransaction('income')}
              className="px-3.5 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-medium hover:bg-emerald-500/20 transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Income
            </button>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse" aria-label="Transactions table">
            <thead>
              <tr className="border-b border-white/[0.06] text-[11px] font-mono uppercase tracking-wider text-zinc-400">
                <th scope="col" className="pb-3 pl-2 w-8">
                  <span className="sr-only">Select</span>
                </th>
                <th scope="col" className="pb-3 pl-2">Date</th>
                <th scope="col" className="pb-3">Description</th>
                <th scope="col" className="pb-3">Category</th>
                <th scope="col" className="pb-3 text-right">Amount</th>
                <th scope="col" className="pb-3 pr-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {filteredTransactions.map((tx) => {
                const isExpense = tx.type === 'expense';
                const catColor = (tx.categories?.color_tag as FinanceColorTag) || 'slate';
                const colorConfig = COLOR_MAP[catColor] || COLOR_MAP.slate;
                const selected = isSelected(tx.id);

                return (
                  <tr
                    key={tx.id}
                    className={`group transition-colors text-sm ${
                      selected ? 'bg-amber-500/[0.08] hover:bg-amber-500/[0.12]' : 'hover:bg-white/[0.02]'
                    }`}
                  >
                    {/* Row Select Checkbox */}
                    <td className="py-3.5 pl-2">
                      <button
                        type="button"
                        onClick={() => toggleSelect(tx.id)}
                        aria-label={selected ? `Deselect transaction ${tx.description}` : `Select transaction ${tx.description}`}
                        className={`w-4 h-4 rounded border flex items-center justify-center transition-all cursor-pointer ${
                          selected
                            ? 'bg-amber-400 border-amber-400 text-zinc-950'
                            : 'border-white/20 bg-zinc-900/80 hover:border-amber-400/60 opacity-60 group-hover:opacity-100'
                        }`}
                      >
                        {selected && <Check className="w-3 h-3 stroke-[3]" />}
                      </button>
                    </td>

                    {/* Date */}
                    <td className="py-3.5 pl-2 font-mono text-xs text-zinc-400 whitespace-nowrap">
                      {tx.transaction_date}
                    </td>

                    {/* Description & Type Icon */}
                    <td className="py-3.5 font-medium text-zinc-200">
                      <div className="flex items-center gap-2">
                        <div
                          className={`p-1 rounded-md ${
                            isExpense
                              ? 'bg-rose-500/10 text-rose-400'
                              : 'bg-emerald-500/10 text-emerald-400'
                          }`}
                        >
                          {isExpense ? (
                            <ArrowDownRight className="w-3.5 h-3.5" aria-hidden="true" />
                          ) : (
                            <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
                          )}
                        </div>
                        <span className="truncate max-w-xs">{tx.description}</span>
                      </div>
                    </td>

                    {/* Category */}
                    <td className="py-3.5 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${colorConfig.bg} ${colorConfig.text} border border-current/20`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${colorConfig.dot}`} aria-hidden="true" />
                        {tx.categories?.name || 'Uncategorized'}
                      </span>
                    </td>

                    {/* Amount */}
                    <td className="py-3.5 text-right font-mono font-semibold whitespace-nowrap">
                      <span className={isExpense ? 'text-zinc-200' : 'text-emerald-400'}>
                        {isExpense ? '-' : '+'}
                        {formatCentsToCurrency(tx.amount_cents, currency)}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 pr-2 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={() => onEditTransaction(tx)}
                          className="p-1.5 rounded-lg hover:bg-white/[0.06] text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
                          aria-label={`Edit transaction ${tx.description}`}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteTransaction(tx.id)}
                          disabled={isDeletingId === tx.id}
                          className="p-1.5 rounded-lg hover:bg-rose-500/10 text-zinc-400 hover:text-rose-400 transition-colors disabled:opacity-50 cursor-pointer"
                          aria-label={`Delete transaction ${tx.description}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Floating Bulk Action Toolbar */}
      <BulkActionToolbar
        selectedCount={selectedCount}
        onClear={clearSelection}
        isProcessing={isBulkProcessing}
        processingLabel={bulkProcessingLabel}
      >
        <Button
          variant="primary"
          size="sm"
          icon={<Tag className="w-3.5 h-3.5 text-zinc-950" />}
          onClick={() => setIsCategorizeModalOpen(true)}
        >
          Categorize
        </Button>

        <Button
          variant="destructive"
          size="sm"
          icon={<Trash2 className="w-3.5 h-3.5" />}
          onClick={() => setIsBulkDeleteModalOpen(true)}
        >
          Delete
        </Button>
      </BulkActionToolbar>

      {/* Bulk Categorize Modal */}
      {isCategorizeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <GlassCard variant="default" padding="md" className="w-full max-w-sm space-y-4 text-white">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold">Categorize {selectedCount} Transactions</h3>
              <button
                type="button"
                onClick={() => setIsCategorizeModalOpen(false)}
                className="p-1 text-zinc-400 hover:text-white rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-zinc-400">
              Assign a category to all {selectedCount} selected transactions.
            </p>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Select Category</label>
              <select
                value={targetCategoryId}
                onChange={(e) => setTargetCategoryId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-white/10 text-xs text-white focus:outline-none focus:border-amber-400"
              >
                <option value="none">Uncategorized (Clear Category)</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setIsCategorizeModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleBulkCategorize}
                disabled={isBulkProcessing}
              >
                Apply Category
              </Button>
            </div>
          </GlassCard>
        </div>
      )}

      {/* Bulk Delete Modal */}
      {isBulkDeleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <GlassCard variant="default" padding="md" className="w-full max-w-sm space-y-4 text-white">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-rose-400">Delete {selectedCount} Transactions</h3>
              <button
                type="button"
                onClick={() => setIsBulkDeleteModalOpen(false)}
                className="p-1 text-zinc-400 hover:text-white rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-zinc-300">
              Are you sure you want to delete {selectedCount} selected transactions? This action is permanent and cannot be undone.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setIsBulkDeleteModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleBulkDelete}
                disabled={isBulkProcessing}
              >
                Delete Selected
              </Button>
            </div>
          </GlassCard>
        </div>
      )}
    </div>
  );
}
