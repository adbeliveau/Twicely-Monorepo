/**
 * Content Moderation Feature
 *
 * AI-powered content moderation for listings, messages, reviews, profile content.
 * Budget-exempt — content moderation is never throttled.
 * Action thresholds configurable via platform_settings.
 */

import { z } from 'zod';
import { getPlatformSetting } from '@twicely/db/queries/platform-settings';
import { logger } from '@twicely/logger';
import type { AiFeature } from '../types';
import { AiDisabledError } from '../types';
import { resolveProvider } from '../providers/provider-resolver';
import { logUsage } from '../usage-log';
import { MODERATION_SYSTEM_PROMPT } from '../prompts/moderation-system';

const FEATURE: AiFeature = 'moderation';

const ViolationSchema = z.object({
  category: z.enum([
    'hate_speech', 'violence', 'sexual', 'prohibited_item',
    'counterfeit_claim', 'phishing', 'spam', 'personal_info',
  ]),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH']),
  evidence: z.string(),
  confidence: z.number().min(0).max(1),
});

const ModerationResultSchema = z.object({
  safe: z.boolean(),
  violations: z.array(ViolationSchema),
  action: z.enum(['ALLOW', 'FLAG_FOR_REVIEW', 'AUTO_REMOVE']),
});

export type ViolationCategory =
  | 'hate_speech' | 'violence' | 'sexual' | 'prohibited_item'
  | 'counterfeit_claim' | 'phishing' | 'spam' | 'personal_info';

export interface ModerationRequest {
  type: 'listing_text' | 'listing_image' | 'message' | 'review' | 'profile';
  text?: string;
  imageUrls?: string[];
  userId?: string;
}

export interface ModerationViolation {
  category: ViolationCategory;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  evidence: string;
  confidence: number;
}

export interface ModerationResult {
  safe: boolean;
  violations: ModerationViolation[];
  action: 'ALLOW' | 'FLAG_FOR_REVIEW' | 'AUTO_REMOVE';
}

export async function moderateContent(req: ModerationRequest): Promise<ModerationResult> {
  // 1. Kill switch
  const enabled = await getPlatformSetting<boolean>('ai.moderation.enabled', true);
  if (!enabled) throw new AiDisabledError(FEATURE);

  // 2. No rate limit — moderation is unlimited
  // 3. No budget check — moderation is budget-exempt

  // 4. Get action thresholds
  const autoRemoveThreshold = await getPlatformSetting<number>('ai.moderation.autoRemoveThreshold', 0.95);
  const flagThreshold = await getPlatformSetting<number>('ai.moderation.flagThreshold', 0.7);

  // 5. Build prompt
  const parts = [`Content type: ${req.type}`];
  if (req.text) parts.push(`Text content:\n${req.text}`);
  if (req.imageUrls?.length) parts.push(`${req.imageUrls.length} images provided for analysis.`);

  const userPrompt = parts.join('\n');

  // 6. Call provider
  const provider = await resolveProvider();
  const model = await getPlatformSetting<string>('ai.model.completionDefault', 'gpt-4o-mini');

  let rawText: string;
  let inputTokens: number;
  let outputTokens: number;
  let latencyMs: number;
  let modelUsed: string;

  if (req.imageUrls?.length) {
    const visionModel = await getPlatformSetting<string>('ai.model.vision', 'gpt-4o-mini');
    const res = await provider.vision({
      model: visionModel,
      systemPrompt: MODERATION_SYSTEM_PROMPT,
      userPrompt,
      imageUrls: req.imageUrls.slice(0, 8),
      maxTokens: 1024,
      temperature: 0,
      jsonMode: true,
    });
    rawText = res.text;
    inputTokens = res.inputTokens;
    outputTokens = res.outputTokens;
    latencyMs = res.latencyMs;
    modelUsed = res.model;
  } else {
    const res = await provider.complete({
      model,
      systemPrompt: MODERATION_SYSTEM_PROMPT,
      userPrompt,
      maxTokens: 1024,
      temperature: 0,
      jsonMode: true,
    });
    rawText = res.text;
    inputTokens = res.inputTokens;
    outputTokens = res.outputTokens;
    latencyMs = res.latencyMs;
    modelUsed = res.model;
  }

  // 7. Parse
  const parsed = ModerationResultSchema.parse(JSON.parse(rawText));

  // 8. Apply threshold-based action override
  let action = parsed.action;
  if (!parsed.safe && parsed.violations.length > 0) {
    const maxConfidence = Math.max(...parsed.violations.map((v) => v.confidence));
    const hasHighSeverity = parsed.violations.some((v) => v.severity === 'HIGH');

    if (hasHighSeverity && maxConfidence >= autoRemoveThreshold) {
      action = 'AUTO_REMOVE';
    } else if (maxConfidence >= flagThreshold) {
      action = 'FLAG_FOR_REVIEW';
    } else {
      action = 'ALLOW';
    }
  }

  // 9. Log
  void logUsage({
    feature: FEATURE,
    userId: req.userId,
    provider: provider.name,
    model: modelUsed,
    inputTokens,
    outputTokens,
    latencyMs,
    cached: false,
  });

  logger.info('[ai:moderation] Result', {
    type: req.type,
    safe: parsed.safe,
    violationCount: parsed.violations.length,
    action,
  });

  return {
    safe: parsed.safe,
    violations: parsed.violations,
    action,
  };
}
