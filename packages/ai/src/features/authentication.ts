/**
 * AI Authentication Feature
 *
 * AI-powered item authentication for luxury goods.
 * Uses premium vision model for highest accuracy.
 * Supplementary to third-party Entrupy integration.
 */

import { z } from 'zod';
import { getPlatformSetting } from '@twicely/db/queries/platform-settings';
import { logger } from '@twicely/logger';
import type { AiFeature } from '../types';
import { AiDisabledError } from '../types';
import { resolveProvider } from '../providers/provider-resolver';
import { checkBudget } from '../budget';
import { logUsage } from '../usage-log';
import { AUTHENTICATION_SYSTEM_PROMPT } from '../prompts/authentication-system';

const FEATURE: AiFeature = 'authentication';

const DetailCheckSchema = z.object({
  check: z.string(),
  passed: z.boolean(),
  note: z.string(),
});

const AuthenticationResultSchema = z.object({
  verdict: z.enum(['AUTHENTICATED', 'COUNTERFEIT', 'INCONCLUSIVE']),
  confidencePercent: z.number().int().min(0).max(100),
  findings: z.array(z.string()),
  detailChecks: z.array(DetailCheckSchema),
  recommendExpertReview: z.boolean(),
});

export type AuthenticationVerdict = 'AUTHENTICATED' | 'COUNTERFEIT' | 'INCONCLUSIVE';

export interface AuthenticationRequest {
  listingId: string;
  imageUrls: string[];
  brand: string;
  categorySlug: string;
  claimedModel?: string;
  userId?: string;
}

export interface AuthenticationResult {
  verdict: AuthenticationVerdict;
  confidencePercent: number;
  findings: string[];
  detailChecks: Array<{ check: string; passed: boolean; note: string }>;
  recommendExpertReview: boolean;
}

export async function authenticateItem(req: AuthenticationRequest): Promise<AuthenticationResult> {
  // 1. Kill switch
  const enabled = await getPlatformSetting<boolean>('ai.authentication.enabled', true);
  if (!enabled) throw new AiDisabledError(FEATURE);

  // 2. Check supported categories
  const supportedCategories = await getPlatformSetting<string[]>(
    'trust.authentication.aiSupportedCategories',
    ['luxury-handbags', 'luxury-shoes', 'luxury-watches', 'designer-clothing'],
  );
  if (!supportedCategories.includes(req.categorySlug)) {
    return {
      verdict: 'INCONCLUSIVE',
      confidencePercent: 0,
      findings: [`Category "${req.categorySlug}" is not supported for AI authentication.`],
      detailChecks: [],
      recommendExpertReview: true,
    };
  }

  // 3. Minimum images check
  if (req.imageUrls.length < 3) {
    return {
      verdict: 'INCONCLUSIVE',
      confidencePercent: 0,
      findings: ['Insufficient images. At least 3 angles are required for authentication.'],
      detailChecks: [],
      recommendExpertReview: true,
    };
  }

  // 4. Budget (authentication is budget-exempt, but still log)
  await checkBudget(FEATURE);

  // 5. Build prompt
  const parts: string[] = [
    `Brand: ${req.brand}`,
    `Category: ${req.categorySlug}`,
  ];
  if (req.claimedModel) parts.push(`Claimed Model: ${req.claimedModel}`);
  parts.push(`Number of images provided: ${req.imageUrls.length}`);
  parts.push('Analyze all images for authenticity. Return your assessment as JSON.');

  const userPrompt = parts.join('\n');

  // 6. Call provider — uses premium vision model
  const provider = await resolveProvider();
  const visionPremium = await getPlatformSetting<string>('ai.model.visionPremium', 'gpt-4o');

  const res = await provider.vision({
    model: visionPremium,
    systemPrompt: AUTHENTICATION_SYSTEM_PROMPT,
    userPrompt,
    imageUrls: req.imageUrls.slice(0, 8),
    maxTokens: 2048,
    temperature: 0.1,
    jsonMode: true,
  });

  // 7. Parse and apply safety rules
  const parsed = AuthenticationResultSchema.parse(JSON.parse(res.text));

  // Safety: low confidence always triggers expert review
  if (parsed.confidencePercent < 70) {
    parsed.recommendExpertReview = true;
  }

  // Safety: counterfeit verdict always triggers expert review
  if (parsed.verdict === 'COUNTERFEIT') {
    parsed.recommendExpertReview = true;
  }

  // Safety: never claim AUTHENTICATED with low confidence
  const result: AuthenticationResult = {
    verdict: parsed.confidencePercent < 70 && parsed.verdict === 'AUTHENTICATED'
      ? 'INCONCLUSIVE'
      : parsed.verdict,
    confidencePercent: parsed.confidencePercent,
    findings: parsed.findings,
    detailChecks: parsed.detailChecks,
    recommendExpertReview: parsed.recommendExpertReview,
  };

  // 8. Log usage
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

  logger.info('[ai:authentication] Result', {
    listingId: req.listingId,
    brand: req.brand,
    verdict: result.verdict,
    confidence: result.confidencePercent,
    recommendExpertReview: result.recommendExpertReview,
  });

  return result;
}
