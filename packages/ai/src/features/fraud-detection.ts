/**
 * Fraud Detection Feature
 *
 * AI-augmented fraud detection that supplements rule-based signals.
 * Produces signals that the risk engine evaluates (does not make risk decisions).
 * Budget-exempt — fraud detection is never throttled.
 */

import { z } from 'zod';
import { getPlatformSetting } from '@twicely/db/queries/platform-settings';
import { logger } from '@twicely/logger';
import type { AiFeature } from '../types';
import { AiDisabledError } from '../types';
import { resolveProvider } from '../providers/provider-resolver';
import { logUsage } from '../usage-log';
import { FRAUD_SYSTEM_PROMPT } from '../prompts/fraud-system';

const FEATURE: AiFeature = 'fraud';

const FraudSignalSchema = z.object({
  signal: z.string(),
  confidence: z.number().min(0).max(1),
  evidence: z.string(),
});

const FraudResultSchema = z.object({
  riskScore: z.number().min(0).max(1),
  signals: z.array(FraudSignalSchema),
  action: z.enum(['ALLOW', 'FLAG', 'BLOCK']),
});

export interface FraudAnalysisRequest {
  type: 'listing' | 'message' | 'review' | 'account';
  content: string;
  metadata: Record<string, unknown>;
  userId?: string;
}

export interface FraudSignal {
  signal: string;
  confidence: number;
  evidence: string;
}

export interface FraudAnalysisResult {
  riskScore: number;
  signals: FraudSignal[];
  action: 'ALLOW' | 'FLAG' | 'BLOCK';
}

export async function analyzeFraud(req: FraudAnalysisRequest): Promise<FraudAnalysisResult> {
  // 1. Kill switch
  const enabled = await getPlatformSetting<boolean>('ai.fraud.enabled', true);
  if (!enabled) throw new AiDisabledError(FEATURE);

  // 2. No rate limit — fraud is unlimited
  // 3. No budget check — fraud is budget-exempt

  // 4. Build prompt
  const metadataStr = Object.entries(req.metadata)
    .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
    .join('\n');

  const userPrompt = [
    `Content type: ${req.type}`,
    `\nContent:\n${req.content}`,
    `\nMetadata:\n${metadataStr}`,
  ].join('\n');

  // 5. Call provider — uses premium model for fraud analysis
  const provider = await resolveProvider();
  const model = await getPlatformSetting<string>('ai.model.completionPremium', 'gpt-4o');

  const res = await provider.complete({
    model,
    systemPrompt: FRAUD_SYSTEM_PROMPT,
    userPrompt,
    maxTokens: 1024,
    temperature: 0.1,
    jsonMode: true,
  });

  // 6. Parse
  const parsed = FraudResultSchema.parse(JSON.parse(res.text));

  // 7. Derive action from risk score if not consistent
  const flagThreshold = await getPlatformSetting<number>('ai.fraud.flagThreshold', 0.3);
  const blockThreshold = await getPlatformSetting<number>('ai.fraud.blockThreshold', 0.7);

  let action = parsed.action;
  if (parsed.riskScore < flagThreshold && action !== 'ALLOW') action = 'ALLOW';
  if (parsed.riskScore > blockThreshold && action !== 'BLOCK') action = 'BLOCK';
  if (parsed.riskScore >= flagThreshold && parsed.riskScore <= blockThreshold && action === 'ALLOW') action = 'FLAG';

  // 8. Log
  void logUsage({
    feature: FEATURE,
    userId: req.userId,
    provider: provider.name,
    model: res.model,
    inputTokens: res.inputTokens,
    outputTokens: res.outputTokens,
    latencyMs: res.latencyMs,
    cached: false,
  });

  logger.info('[ai:fraud] Analysis complete', {
    type: req.type,
    riskScore: parsed.riskScore,
    signalCount: parsed.signals.length,
    action,
  });

  return {
    riskScore: parsed.riskScore,
    signals: parsed.signals,
    action,
  };
}
