import assert from 'node:assert';
import {
  parseAmountToCents,
  formatCentsToCurrency,
  calculateFinanceSummary,
  calculateCategoryBreakdown,
  calculateMonthlyTrends,
  formatMonthLabel,
  calculatePercentageChange,
  FinanceTransaction,
  FinanceCategory,
} from '../src/lib/money';
import {
  createCategorySchema,
  updateCategorySchema,
  createTransactionSchema,
  updateTransactionSchema,
} from '../src/lib/validations/finance';

console.log('================================================================');
console.log('  PACT Phase 4I-2 — Finance Domain & Validation Test Suite');
console.log('================================================================\n');

// 1. Zero Transactions & Honest Empty States
console.log('1. Testing zero transactions & empty state calculations...');

const emptySummary = calculateFinanceSummary([]);
assert.strictEqual(emptySummary.balanceCents, 0, 'Balance must be 0 for zero transactions');
assert.strictEqual(emptySummary.totalIncomeCents, 0, 'Total income must be 0');
assert.strictEqual(emptySummary.totalExpensesCents, 0, 'Total expenses must be 0');
assert.strictEqual(emptySummary.netSavingsCents, 0, 'Net savings must be 0');
assert.strictEqual(emptySummary.savingsRatePercent, 0, 'Savings rate must be 0%');
assert.strictEqual(emptySummary.transactionCount, 0, 'Transaction count must be 0');

const emptyBreakdown = calculateCategoryBreakdown([], []);
assert.strictEqual(emptyBreakdown.length, 0, 'Category breakdown must be empty');

const emptyTrends = calculateMonthlyTrends([], 'UTC');
assert.strictEqual(emptyTrends.length, 0, 'Monthly trends must be empty');

console.log('✅ Zero transactions honest empty states verified.');

// 2. Integer Cents Precision & Money Calculations
console.log('2. Testing integer cents precision and calculations...');

const mockCategories: FinanceCategory[] = [
  {
    id: 'cat-housing',
    user_id: 'user-1',
    name: 'Housing & Rent',
    color_tag: 'gold',
    is_archived: false,
    created_at: '2026-09-01T00:00:00Z',
    updated_at: '2026-09-01T00:00:00Z',
  },
  {
    id: 'cat-food',
    user_id: 'user-1',
    name: 'Food & Dining',
    color_tag: 'amber',
    is_archived: false,
    created_at: '2026-09-01T00:00:00Z',
    updated_at: '2026-09-01T00:00:00Z',
  },
  {
    id: 'cat-transport',
    user_id: 'user-1',
    name: 'Transport',
    color_tag: 'blue',
    is_archived: false,
    created_at: '2026-09-01T00:00:00Z',
    updated_at: '2026-09-01T00:00:00Z',
  },
];

const mockTransactions: FinanceTransaction[] = [
  {
    id: 'tx-1',
    user_id: 'user-1',
    category_id: null,
    type: 'income',
    amount_cents: 8000000, // ₹80,000.00
    description: 'Monthly Salary',
    transaction_date: '2026-09-01',
    created_at: '2026-09-01T00:00:00Z',
    updated_at: '2026-09-01T00:00:00Z',
  },
  {
    id: 'tx-2',
    user_id: 'user-1',
    category_id: 'cat-housing',
    type: 'expense',
    amount_cents: 3000000, // ₹30,000.00
    description: 'Apartment Rent',
    transaction_date: '2026-09-02',
    created_at: '2026-09-02T00:00:00Z',
    updated_at: '2026-09-02T00:00:00Z',
  },
  {
    id: 'tx-3',
    user_id: 'user-1',
    category_id: 'cat-food',
    type: 'expense',
    amount_cents: 1200050, // ₹12,000.50
    description: 'Groceries & Dinners',
    transaction_date: '2026-09-05',
    created_at: '2026-09-05T00:00:00Z',
    updated_at: '2026-09-05T00:00:00Z',
  },
  {
    id: 'tx-4',
    user_id: 'user-1',
    category_id: 'cat-transport',
    type: 'expense',
    amount_cents: 624950, // ₹6,249.50
    description: 'Train & Metro Pass',
    transaction_date: '2026-09-10',
    created_at: '2026-09-10T00:00:00Z',
    updated_at: '2026-09-10T00:00:00Z',
  },
];

const summary = calculateFinanceSummary(mockTransactions);
assert.strictEqual(summary.totalIncomeCents, 8000000, 'Income should be exactly 8,000,000 cents');
assert.strictEqual(summary.totalExpensesCents, 4825000, 'Expenses should be exactly 4,825,000 cents (30000 + 12000.50 + 6249.50 = 48250.00)');
assert.strictEqual(summary.netSavingsCents, 3175000, 'Net savings should be exactly 3,175,000 cents (₹31,750.00)');
assert.strictEqual(summary.savingsRatePercent, 40, 'Savings rate should be (31750 / 80000) * 100 = 39.68% -> 40%');
assert.strictEqual(summary.transactionCount, 4, 'Transaction count must be 4');

console.log('✅ Integer cents calculations and exact savings rate verified.');

// 3. Category Breakdown Calculations
console.log('3. Testing category breakdown and percentage distribution...');

const breakdown = calculateCategoryBreakdown(mockTransactions, mockCategories);
assert.strictEqual(breakdown.length, 3, 'Should have 3 expense categories');
assert.strictEqual(breakdown[0].categoryName, 'Housing & Rent', 'Highest expense should be first');
assert.strictEqual(breakdown[0].totalCents, 3000000);
assert.strictEqual(breakdown[0].percentage, 62, 'Housing percentage = 30000 / 48250 * 100 = 62.17% -> 62%');
assert.strictEqual(breakdown[1].categoryName, 'Food & Dining');
assert.strictEqual(breakdown[1].percentage, 25, 'Food percentage = 12000.50 / 48250 * 100 = 24.87% -> 25%');
assert.strictEqual(breakdown[2].categoryName, 'Transport');
assert.strictEqual(breakdown[2].percentage, 13, 'Transport percentage = 6249.50 / 48250 * 100 = 12.95% -> 13%');

console.log('✅ Category breakdown percentages and descending sort verified.');

// 4. Amount Parsing & Validation
console.log('4. Testing safe amount parsing and threshold bounds...');

assert.strictEqual(parseAmountToCents('45').cents, 4500);
assert.strictEqual(parseAmountToCents('45.50').cents, 4550);
assert.strictEqual(parseAmountToCents('1,250.00').cents, 125000);
assert.strictEqual(parseAmountToCents('₹80,000').cents, 8000000);
assert.strictEqual(parseAmountToCents('$99.99').cents, 9999);

// Edge cases & invalid amounts
assert.strictEqual(parseAmountToCents('-50').cents, null);
assert.strictEqual(parseAmountToCents('0').cents, null);
assert.strictEqual(parseAmountToCents('abc').cents, null);
assert.strictEqual(parseAmountToCents('').cents, null);
assert.strictEqual(parseAmountToCents('999999999999').cents, null, 'Overflow amount must be rejected');

console.log('✅ Safe amount parsing verified.');

// 5. Currency Formatting & Localization
console.log('5. Testing currency formatting...');

const inrFormatted = formatCentsToCurrency(4825050, 'INR');
assert.ok(inrFormatted.includes('48,250.50') || inrFormatted.includes('48250.50'), 'Formatted INR contains valid digits');

const usdFormatted = formatCentsToCurrency(125000, 'USD');
assert.ok(usdFormatted.includes('1,250.00'), 'Formatted USD contains $1,250.00');

assert.strictEqual(formatMonthLabel('2026-09'), 'September 2026');
assert.strictEqual(formatMonthLabel('2026-01'), 'January 2026');

console.log('✅ Currency formatting and month labels verified.');

// 6. Monthly Trends Grouping
console.log('6. Testing monthly trends grouping across historical dates...');

const historicalTransactions: FinanceTransaction[] = [
  {
    id: 'h-1',
    user_id: 'user-1',
    category_id: null,
    type: 'income',
    amount_cents: 5000000,
    description: 'July Salary',
    transaction_date: '2026-07-01',
    created_at: '2026-07-01T00:00:00Z',
    updated_at: '2026-07-01T00:00:00Z',
  },
  {
    id: 'h-2',
    user_id: 'user-1',
    category_id: null,
    type: 'expense',
    amount_cents: 3000000,
    description: 'July Expenses',
    transaction_date: '2026-07-15',
    created_at: '2026-07-15T00:00:00Z',
    updated_at: '2026-07-15T00:00:00Z',
  },
  {
    id: 'h-3',
    user_id: 'user-1',
    category_id: null,
    type: 'income',
    amount_cents: 6000000,
    description: 'Aug Salary',
    transaction_date: '2026-08-01',
    created_at: '2026-08-01T00:00:00Z',
    updated_at: '2026-08-01T00:00:00Z',
  },
  {
    id: 'h-4',
    user_id: 'user-1',
    category_id: null,
    type: 'expense',
    amount_cents: 2500000,
    description: 'Aug Expenses',
    transaction_date: '2026-08-20',
    created_at: '2026-08-20T00:00:00Z',
    updated_at: '2026-08-20T00:00:00Z',
  },
];

const trends = calculateMonthlyTrends(historicalTransactions, 'UTC', 6);
assert.strictEqual(trends.length, 2, 'Should have 2 historical months (July, August)');
assert.strictEqual(trends[0].monthKey, '2026-07');
assert.strictEqual(trends[0].incomeCents, 5000000);
assert.strictEqual(trends[0].expenseCents, 3000000);
assert.strictEqual(trends[1].monthKey, '2026-08');
assert.strictEqual(trends[1].incomeCents, 6000000);
assert.strictEqual(trends[1].expenseCents, 2500000);

console.log('✅ Monthly trends grouping verified.');

// 7. Schema Validations
console.log('7. Testing Zod schemas for transactions and categories...');

// Transaction creation schema
const validTx = createTransactionSchema.safeParse({
  type: 'expense',
  amount_cents: 15000,
  description: 'Team Lunch',
  category_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  transaction_date: '2026-09-10',
});
assert.ok(validTx.success, 'Valid transaction must pass validation');
if (validTx.success) {
  assert.strictEqual(validTx.data.amount_cents, 15000);
}

const invalidTxType = createTransactionSchema.safeParse({
  type: 'transfer', // invalid type
  amount_cents: 10000,
  description: 'Invalid',
});
assert.strictEqual(invalidTxType.success, false, 'Invalid type must be rejected');

const invalidTxAmount = createTransactionSchema.safeParse({
  type: 'expense',
  amount_cents: -5000,
  description: 'Invalid negative amount',
});
assert.strictEqual(invalidTxAmount.success, false, 'Negative amount must be rejected');

// Category creation schema
const validCat = createCategorySchema.safeParse({
  name: 'Health & Wellness',
  color_tag: 'emerald',
});
assert.ok(validCat.success, 'Valid category must pass validation');

const invalidCatName = createCategorySchema.safeParse({
  name: '', // empty name
  color_tag: 'emerald',
});
assert.strictEqual(invalidCatName.success, false, 'Empty category name must be rejected');

const invalidCatColor = createCategorySchema.safeParse({
  name: 'Books',
  color_tag: 'neon_pink', // invalid color
});
assert.strictEqual(invalidCatColor.success, false, 'Invalid color tag must be rejected');

console.log('✅ Zod domain schemas verified.');

// 8. Percentage Change Calculations
console.log('8. Testing calculatePercentageChange helper...');

// Positive growth tests
assert.strictEqual(calculatePercentageChange(10000, 15000), 50, '10000 to 15000 must be 50% growth');
assert.strictEqual(calculatePercentageChange(3000, 4000), 33.33, '3000 to 4000 must round to 33.33%');

// Percentage decrease tests
assert.strictEqual(calculatePercentageChange(10000, 8000), -20, '10000 to 8000 must be -20% change');
assert.strictEqual(calculatePercentageChange(3000, 2000), -33.33, '3000 to 2000 must round to -33.33%');

// Zero division and edge cases
assert.strictEqual(calculatePercentageChange(0, 5000), 0, 'oldValueCents = 0 must return 0 safely');
assert.strictEqual(calculatePercentageChange(0, 0), 0, 'oldValueCents = 0 and newValueCents = 0 must return 0 safely');
assert.strictEqual(calculatePercentageChange(0, -5000), 0, 'oldValueCents = 0 and negative newValueCents must return 0 safely');
assert.strictEqual(calculatePercentageChange(5000, 5000), 0, 'Identical values must yield 0% change');

console.log('✅ calculatePercentageChange helper verified.');

console.log('\n================================================================');
console.log('🎉 ALL PHASE 4I-2 FINANCE DOMAIN & VALIDATION TESTS PASSED');
console.log('================================================================');
