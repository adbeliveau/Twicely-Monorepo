/**
 * Poll Budget Tracker
 * Per-seller per-hour poll budget enforcement.
 * Spec: Lister Canonical §13.2
 */

import { getPlatformSetting } from '@/lib/queries/platform-settings';

// In-memory budget tracking
interface BudgetWindow {
  count: number;
  windowStart: number;
}

const budgets = new Map<string, BudgetWindow>();

// Cache tier budgets for 5 minutes
let budgetCache: Record<string, number> = {};
let budgetCacheExpiresAt = 0;

async function getTierBudget(listerTier: string): Promise<number> {
  const now = Date.now();
  if (now < budgetCacheExpiresAt && listerTier in budgetCache) {
    return budgetCache[listerTier] as number;
  }

  const key = `crosslister.polling.budget.${listerTier}`;
  const fallbacks: Record<string, number> = { NONE: 10, FREE: 20, LITE: 200, PRO: 1000 };
  const fallback = fallbacks[listerTier] ?? 10;
  const budget = await getPlatformSetting<number>(key, fallback);

  budgetCache[listerTier] = budget;
  budgetCacheExpiresAt = now + 300_000; // 5-minute cache
  return budgetCache[listerTier] as number;
}

const HOUR_MS = 3_600_000;

/**
 * Check if seller has remaining poll budget this hour.
 */
export async function canPoll(sellerId: string, listerTier: string): Promise<boolean> {
  const maxBudget = await getTierBudget(listerTier);
  if (maxBudget === 0) return false;

  const now = Date.now();
  const window = budgets.get(sellerId);

  if (!window || now - window.windowStart > HOUR_MS) {
    return true; // New window, hasn't hit budget
  }

  return window.count < maxBudget;
}

/**
 * Record a poll against the seller's hourly budget.
 */
export async function recordPoll(sellerId: string): Promise<void> {
  const now = Date.now();
  const window = budgets.get(sellerId);

  if (!window || now - window.windowStart > HOUR_MS) {
    budgets.set(sellerId, { count: 1, windowStart: now });
    return;
  }

  window.count += 1;
}

/**
 * Reset all poll budgets (testing only).
 */
export function resetAllPollBudgets(): void {
  budgets.clear();
  budgetCache = {};
  budgetCacheExpiresAt = 0;
}
