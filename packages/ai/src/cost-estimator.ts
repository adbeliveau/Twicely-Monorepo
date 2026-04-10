/**
 * AI Cost Estimator
 *
 * Calculates cost in microdollars ($0.000001 units) based on model and token count.
 * All pricing per 1M tokens. Uses integer arithmetic to avoid floating point drift.
 */

import { MODEL_PRICING } from './types';

/**
 * Estimate the cost of an AI call in microdollars.
 *
 * @param model - The model identifier (e.g., 'gpt-4o-mini')
 * @param inputTokens - Number of input tokens consumed
 * @param outputTokens - Number of output tokens generated
 * @returns Cost in microdollars (integer). Returns 0 for unknown models.
 */
export function estimateCostMicros(
  model: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const pricing = MODEL_PRICING[model];
  if (!pricing) return 0;

  // pricing.input/output are per 1M tokens in microdollars
  // costMicros = (tokens * pricePerMillionTokens) / 1_000_000
  const inputCost = Math.ceil((inputTokens * pricing.input) / 1_000_000);
  const outputCost = Math.ceil((outputTokens * pricing.output) / 1_000_000);

  return inputCost + outputCost;
}

/**
 * Get known pricing for a model, or null if not in registry.
 */
export function getModelPricing(model: string) {
  return MODEL_PRICING[model] ?? null;
}
