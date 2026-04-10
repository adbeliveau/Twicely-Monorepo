/**
 * AI Token Budget Enforcement
 *
 * Checks monthly token usage against platform_settings caps.
 * Budget-exempt features (fraud, moderation, authentication) are always allowed.
 * When hardCapEnabled is true, non-exempt features are blocked at 100%.
 */

import { getPlatformSetting } from '@twicely/db/queries/platform-settings';
import { logger } from '@twicely/logger';
import type { AiFeature } from './types';
import { BUDGET_EXEMPT_FEATURES, AiBudgetExceededError } from './types';
import { getMonthlyUsage } from './usage-log';

export interface BudgetStatus {
  inputTokensUsed: number;
  inputTokensBudget: number;
  outputTokensUsed: number;
  outputTokensBudget: number;
  inputPct: number;
  outputPct: number;
  exceeded: boolean;
}

/**
 * Get current budget utilization status.
 */
export async function getBudgetStatus(): Promise<BudgetStatus> {
  const [usage, inputBudget, outputBudget] = await Promise.all([
    getMonthlyUsage(),
    getPlatformSetting<number>('ai.budget.monthlyInputTokens', 50_000_000),
    getPlatformSetting<number>('ai.budget.monthlyOutputTokens', 10_000_000),
  ]);

  const inputPct = inputBudget > 0 ? Math.round((usage.inputTokens / inputBudget) * 100) : 0;
  const outputPct = outputBudget > 0 ? Math.round((usage.outputTokens / outputBudget) * 100) : 0;

  return {
    inputTokensUsed: usage.inputTokens,
    inputTokensBudget: inputBudget,
    outputTokensUsed: usage.outputTokens,
    outputTokensBudget: outputBudget,
    inputPct,
    outputPct,
    exceeded: inputPct >= 100 || outputPct >= 100,
  };
}

/**
 * Check if a feature is allowed to make an AI call given current budget.
 * Budget-exempt features are always allowed.
 * Throws AiBudgetExceededError if budget is exceeded and hardCap is enabled.
 */
export async function checkBudget(feature: AiFeature): Promise<void> {
  // Budget-exempt features always pass
  if (BUDGET_EXEMPT_FEATURES.has(feature)) {
    return;
  }

  const hardCapEnabled = await getPlatformSetting<boolean>('ai.budget.hardCapEnabled', true);
  if (!hardCapEnabled) {
    return;
  }

  const status = await getBudgetStatus();

  // Alert at threshold
  const alertThreshold = await getPlatformSetting<number>('ai.budget.alertThresholdPct', 80);
  if (status.inputPct >= alertThreshold || status.outputPct >= alertThreshold) {
    logger.warn('[ai:budget] Approaching budget limit', {
      feature,
      inputPct: status.inputPct,
      outputPct: status.outputPct,
      alertThreshold,
    });
  }

  if (status.exceeded) {
    logger.warn('[ai:budget] Budget exceeded, blocking non-exempt feature', {
      feature,
      inputPct: status.inputPct,
      outputPct: status.outputPct,
    });
    throw new AiBudgetExceededError(feature);
  }
}
