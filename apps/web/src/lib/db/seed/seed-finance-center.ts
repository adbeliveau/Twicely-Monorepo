import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { financeSubscription, expense, mileageEntry } from '@twicely/db/schema';
import { USER_IDS, SELLER_IDS } from './seed-users';

// Hardcoded IDs for idempotency
const FINANCE_SUB_IDS = {
  seller1: 'seed-finsub-001',
};

const EXPENSE_IDS = {
  exp1: 'seed-exp-001', exp2: 'seed-exp-002', exp3: 'seed-exp-003', exp4: 'seed-exp-004', exp5: 'seed-exp-005',
  exp6: 'seed-exp-006', exp7: 'seed-exp-007', exp8: 'seed-exp-008', exp9: 'seed-exp-009', exp10: 'seed-exp-010',
};

const MILEAGE_IDS = {
  m1: 'seed-mi-001', m2: 'seed-mi-002', m3: 'seed-mi-003', m4: 'seed-mi-004', m5: 'seed-mi-005',
};

export async function seedFinanceCenter(db: PostgresJsDatabase): Promise<void> {
  const now = new Date();
  const daysAgo = (days: number) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1); // First of current month
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0); // Last of current month

  // 1. Finance Subscription (seller1 = PRO tier, ACTIVE)
  await db.insert(financeSubscription).values([
    {
      id: FINANCE_SUB_IDS.seller1,
      sellerProfileId: SELLER_IDS.seller1,
      tier: 'PRO',
      status: 'ACTIVE',
      stripeSubscriptionId: 'sub_seed_finance_001',
      stripePriceId: 'price_finance_pro_monthly',
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: false,
    },
  ]).onConflictDoNothing();

  // 2. Expenses (10 for seller1 — mix of categories, 3 recurring)
  await db.insert(expense).values([
    // Shipping supplies (one-time)
    { id: EXPENSE_IDS.exp1, userId: USER_IDS.seller1, category: 'SHIPPING_SUPPLIES', amountCents: 4599, currency: 'USD', vendor: 'ULINE', description: 'Poly mailers (pack of 100)', expenseDate: daysAgo(25) },
    { id: EXPENSE_IDS.exp2, userId: USER_IDS.seller1, category: 'SHIPPING_SUPPLIES', amountCents: 2499, currency: 'USD', vendor: 'Amazon', description: 'Bubble wrap roll', expenseDate: daysAgo(18) },
    // Packaging (one-time)
    { id: EXPENSE_IDS.exp3, userId: USER_IDS.seller1, category: 'PACKAGING', amountCents: 3299, currency: 'USD', vendor: 'PackagingSupplies.com', description: 'Custom branded tissue paper', expenseDate: daysAgo(30) },
    { id: EXPENSE_IDS.exp4, userId: USER_IDS.seller1, category: 'PACKAGING', amountCents: 1899, currency: 'USD', vendor: 'Staples', description: 'Packing tape (6 rolls)', expenseDate: daysAgo(12) },
    // Inventory purchases (one-time)
    { id: EXPENSE_IDS.exp5, userId: USER_IDS.seller1, category: 'INVENTORY', amountCents: 45000, currency: 'USD', vendor: 'Estate Sale', description: 'Lot of 5 phones (estate purchase)', expenseDate: daysAgo(45) },
    { id: EXPENSE_IDS.exp6, userId: USER_IDS.seller1, category: 'INVENTORY', amountCents: 89900, currency: 'USD', vendor: 'Local seller', description: 'MacBook Pro M2', expenseDate: daysAgo(20) },
    // Software subscriptions (recurring monthly)
    { id: EXPENSE_IDS.exp7, userId: USER_IDS.seller1, category: 'SOFTWARE', amountCents: 999, currency: 'USD', vendor: 'Canva', description: 'Canva Pro (monthly)', expenseDate: daysAgo(5), isRecurring: true, recurringFrequency: 'MONTHLY' },
    { id: EXPENSE_IDS.exp8, userId: USER_IDS.seller1, category: 'SOFTWARE', amountCents: 1499, currency: 'USD', vendor: 'Adobe', description: 'Lightroom CC (monthly)', expenseDate: daysAgo(5), isRecurring: true, recurringFrequency: 'MONTHLY' },
    // Office supplies (one-time)
    { id: EXPENSE_IDS.exp9, userId: USER_IDS.seller1, category: 'OFFICE', amountCents: 2199, currency: 'USD', vendor: 'Office Depot', description: 'Printer ink cartridges', expenseDate: daysAgo(8) },
    // Storage (recurring monthly)
    { id: EXPENSE_IDS.exp10, userId: USER_IDS.seller1, category: 'STORAGE', amountCents: 15000, currency: 'USD', vendor: 'Public Storage', description: '10x10 storage unit (monthly)', expenseDate: daysAgo(1), isRecurring: true, recurringFrequency: 'MONTHLY' },
  ]).onConflictDoNothing();

  // 3. Mileage Entries (5 for seller1)
  // IRS rate for 2024: 67 cents per mile
  const irsRate = 0.67;
  await db.insert(mileageEntry).values([
    { id: MILEAGE_IDS.m1, userId: USER_IDS.seller1, description: 'Post office drop-off', miles: 8.2, ratePerMile: irsRate, deductionCents: Math.round(8.2 * irsRate * 100), tripDate: daysAgo(3) },
    { id: MILEAGE_IDS.m2, userId: USER_IDS.seller1, description: 'Estate sale pickup', miles: 24.5, ratePerMile: irsRate, deductionCents: Math.round(24.5 * irsRate * 100), tripDate: daysAgo(7) },
    { id: MILEAGE_IDS.m3, userId: USER_IDS.seller1, description: 'UPS store shipping', miles: 5.8, ratePerMile: irsRate, deductionCents: Math.round(5.8 * irsRate * 100), tripDate: daysAgo(10) },
    { id: MILEAGE_IDS.m4, userId: USER_IDS.seller1, description: 'Thrift store sourcing run', miles: 32.1, ratePerMile: irsRate, deductionCents: Math.round(32.1 * irsRate * 100), tripDate: daysAgo(14) },
    { id: MILEAGE_IDS.m5, userId: USER_IDS.seller1, description: 'Meet local buyer for pickup', miles: 12.4, ratePerMile: irsRate, deductionCents: Math.round(12.4 * irsRate * 100), tripDate: daysAgo(20) },
  ]).onConflictDoNothing();
}

// Export IDs for use in other seeders
export const FINANCE_CENTER_IDS = {
  subscriptions: FINANCE_SUB_IDS,
  expenses: EXPENSE_IDS,
  mileage: MILEAGE_IDS,
};
