/**
 * Risk Gate (Canonical 26 §6.4)
 *
 * The enforcement point for risk-gated actions. Every call to assertRiskAllowed()
 * creates a riskAction audit row, regardless of outcome.
 *
 * FAIL-OPEN: If the risk engine errors, the action is allowed but logged.
 * This prevents system failures from blocking legitimate users.
 */

import { db } from '@twicely/db';
import { riskAction } from '@twicely/db/schema';
import { logger } from '@twicely/logger';
import type {
  AssertRiskAllowedArgs,
  RiskScoreResult,
  RiskActionOutcome,
} from './types';
import { computeRiskScore } from './scoring';

// ─── Error classes ──────────────────────────────────────────────────────────

/**
 * Thrown when an action is blocked by the risk engine (score >= blockAt).
 */
export class RiskBlockedError extends Error {
  readonly score: number;
  readonly action: string;

  constructor(score: number, action: string) {
    super(`Action '${action}' blocked by risk engine (score: ${score})`);
    this.name = 'RiskBlockedError';
    this.score = score;
    this.action = action;
  }
}

/**
 * Thrown when step-up verification is required (score >= stepUpAt and < blockAt).
 */
export class StepUpRequiredError extends Error {
  readonly score: number;
  readonly action: string;

  constructor(score: number, action: string) {
    super(`Action '${action}' requires step-up verification (score: ${score})`);
    this.name = 'StepUpRequiredError';
    this.score = score;
    this.action = action;
  }
}

// ─── Risk gate ──────────────────────────────────────────────────────────────

/**
 * Assert that a user is allowed to perform a risk-gated action.
 *
 * - Computes risk score for the user+action
 * - Creates a riskAction audit row with the outcome
 * - Throws RiskBlockedError if recommendation is 'block'
 * - Throws StepUpRequiredError if recommendation is 'step_up' (unless bypassStepUp)
 * - Returns the score otherwise
 *
 * FAIL-OPEN: On any error from the risk engine, logs the error and returns
 * a zero-score result. This prevents system failures from blocking users.
 */
export async function assertRiskAllowed(args: AssertRiskAllowedArgs): Promise<RiskScoreResult> {
  const { userId, action, bypassStepUp = false, meta = {} } = args;

  let result: RiskScoreResult;

  try {
    result = await computeRiskScore({ userId, action });
  } catch (err) {
    // FAIL-OPEN: risk service error does not block the user
    logger.error('Risk engine error — failing OPEN', {
      userId,
      action,
      error: err instanceof Error ? err.message : String(err),
    });

    // Record the fail-open audit row
    try {
      await db.insert(riskAction).values({
        userId,
        action,
        recommendation: 'allow',
        scoreAtTime: 0,
        outcome: 'allowed' satisfies RiskActionOutcome,
        metaJson: { ...meta, failOpen: true, error: err instanceof Error ? err.message : String(err) },
      });
    } catch {
      // If even the audit write fails, just log it
      logger.error('Risk action audit write failed during fail-open', { userId, action });
    }

    return {
      userId,
      compositeScore: 0,
      buyerScore: 0,
      sellerScore: 0,
      severity: 'LOW',
      signalCount: 0,
      recommendation: 'allow',
      signals: [],
    };
  }

  // Determine outcome
  let outcome: RiskActionOutcome;

  if (result.recommendation === 'block') {
    outcome = 'blocked';
  } else if (result.recommendation === 'step_up' && !bypassStepUp) {
    outcome = 'step_up_failed';
  } else if (result.recommendation === 'step_up' && bypassStepUp) {
    outcome = 'step_up_passed';
  } else {
    outcome = 'allowed';
  }

  // Always create audit row
  try {
    await db.insert(riskAction).values({
      userId,
      action,
      recommendation: result.recommendation,
      scoreAtTime: result.compositeScore,
      outcome,
      metaJson: meta,
    });
  } catch (err) {
    logger.error('Risk action audit write failed', {
      userId,
      action,
      outcome,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  // Throw on block
  if (outcome === 'blocked') {
    throw new RiskBlockedError(result.compositeScore, action);
  }

  // Throw on step_up (unless bypassed)
  if (outcome === 'step_up_failed') {
    throw new StepUpRequiredError(result.compositeScore, action);
  }

  return result;
}
