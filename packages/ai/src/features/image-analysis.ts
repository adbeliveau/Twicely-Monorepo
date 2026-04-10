/**
 * Image Analysis Feature
 *
 * Multi-purpose image analysis: quality check, duplicate detection,
 * policy violation scan, watermark detection, condition assessment.
 */

import { z } from 'zod';
import { getPlatformSetting } from '@twicely/db/queries/platform-settings';
import { logger } from '@twicely/logger';
import type { AiFeature } from '../types';
import { AiDisabledError } from '../types';
import { resolveProvider } from '../providers/provider-resolver';
import { checkBudget } from '../budget';
import { logUsage } from '../usage-log';

const FEATURE: AiFeature = 'image-analysis';

const ImageAnalysisSchema = z.object({
  quality: z.object({
    score: z.number().min(0).max(1),
    issues: z.array(z.string()),
  }).nullable(),
  duplicateOf: z.string().nullable(),
  policyViolations: z.array(z.string()).nullable(),
  hasWatermark: z.boolean().nullable(),
  conditionAssessment: z.object({
    suggestedCondition: z.string(),
    defectsDetected: z.array(z.string()),
    confidence: z.number().min(0).max(1),
  }).nullable(),
});

export type ImageAnalysisCheck = 'quality' | 'duplicate' | 'policy' | 'watermark' | 'condition';

export interface ImageAnalysisRequest {
  imageUrls: string[];
  checks: ImageAnalysisCheck[];
  userId?: string;
}

export interface ImageAnalysisResult {
  quality: { score: number; issues: string[] } | null;
  duplicateOf: string | null;
  policyViolations: string[] | null;
  hasWatermark: boolean | null;
  conditionAssessment: {
    suggestedCondition: string;
    defectsDetected: string[];
    confidence: number;
  } | null;
}

export async function analyzeImages(req: ImageAnalysisRequest): Promise<ImageAnalysisResult> {
  // 1. Kill switch
  const enabled = await getPlatformSetting<boolean>('ai.imageAnalysis.enabled', true);
  if (!enabled) throw new AiDisabledError(FEATURE);

  // 2. Budget
  await checkBudget(FEATURE);

  // 3. Build prompt based on requested checks
  const checkDescriptions: string[] = [];
  if (req.checks.includes('quality')) {
    checkDescriptions.push('- Assess image quality (score 0-1) and list issues: blurry, dark, low_resolution, stock_photo');
  }
  if (req.checks.includes('duplicate')) {
    checkDescriptions.push('- Check for duplicate/stolen images. Return listing ID if match found, null otherwise.');
  }
  if (req.checks.includes('policy')) {
    checkDescriptions.push('- Check for policy violations: prohibited_item, offensive_content, weapons, drugs');
  }
  if (req.checks.includes('watermark')) {
    checkDescriptions.push('- Detect watermarks on images');
  }
  if (req.checks.includes('condition')) {
    checkDescriptions.push('- Assess item condition from images. Detect defects: stain, tear, pilling, scuff, scratch');
  }

  const systemPrompt = `You are an image analysis engine for a resale marketplace. Analyze the provided images and perform the requested checks. Return JSON with null for checks not requested.`;
  const userPrompt = `Perform these checks:\n${checkDescriptions.join('\n')}\n\nReturn JSON with: quality (null if not checked), duplicateOf (null), policyViolations (null if not checked), hasWatermark (null if not checked), conditionAssessment (null if not checked).`;

  // 4. Call provider
  const provider = await resolveProvider();
  const visionModel = await getPlatformSetting<string>('ai.model.vision', 'gpt-4o-mini');

  const res = await provider.vision({
    model: visionModel,
    systemPrompt,
    userPrompt,
    imageUrls: req.imageUrls.slice(0, 8),
    maxTokens: 1024,
    temperature: 0.1,
    jsonMode: true,
  });

  // 5. Parse
  const parsed = ImageAnalysisSchema.parse(JSON.parse(res.text));

  // 6. Log
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

  logger.debug('[ai:image-analysis] Complete', {
    checks: req.checks,
    imageCount: req.imageUrls.length,
  });

  return parsed;
}
