/**
 * Receipt OCR Feature
 *
 * AI-backed receipt data extraction for seller expense tracking.
 * Uses vision model to extract structured data from receipt images.
 */

import { z } from 'zod';
import { getPlatformSetting } from '@twicely/db/queries/platform-settings';
import { logger } from '@twicely/logger';
import type { AiFeature } from '../types';
import { AiDisabledError } from '../types';
import { resolveProvider } from '../providers/provider-resolver';
import { checkRateLimit } from '../rate-limiter';
import { checkBudget } from '../budget';
import { logUsage } from '../usage-log';
import { RECEIPT_OCR_PROMPT } from '../prompts/receipt-ocr-system';

const FEATURE: AiFeature = 'receipt-ocr';

const LineItemSchema = z.object({
  description: z.string(),
  amountCents: z.number().int(),
});

const ReceiptResultSchema = z.object({
  vendor: z.string().nullable(),
  amountCents: z.number().int().nullable(),
  date: z.string().nullable(),
  suggestedCategory: z.string().nullable(),
  lineItems: z.array(LineItemSchema),
  confidence: z.number().min(0).max(1),
  rawText: z.string().nullable(),
});

export interface ReceiptOcrRequest {
  imageUrl: string;
  expenseCategories: string[];
  userId: string;
}

export interface ReceiptLineItem {
  description: string;
  amountCents: number;
}

export interface ReceiptOcrResult {
  vendor: string | null;
  amountCents: number | null;
  date: string | null;
  suggestedCategory: string | null;
  lineItems: ReceiptLineItem[];
  confidence: number;
  rawText: string | null;
}

export async function extractReceiptData(req: ReceiptOcrRequest): Promise<ReceiptOcrResult> {
  // 1. Kill switch
  const enabled = await getPlatformSetting<boolean>('ai.receiptOcr.enabled', true);
  if (!enabled) throw new AiDisabledError(FEATURE);

  // 2. Validate image URL
  if (!req.imageUrl || !req.imageUrl.startsWith('http')) {
    throw new Error('Invalid image URL for receipt OCR');
  }

  // 3. Rate limit
  const { allowed } = await checkRateLimit(FEATURE, req.userId);
  if (!allowed) throw new Error('Daily receipt OCR limit reached');

  // 4. Budget
  await checkBudget(FEATURE);

  // 5. Build prompt
  const categoriesStr = req.expenseCategories.join(', ');
  const userPrompt = `Extract receipt data from the image. Available expense categories: ${categoriesStr}`;

  // 6. Call provider
  const provider = await resolveProvider();
  const visionModel = await getPlatformSetting<string>('ai.model.vision', 'gpt-4o-mini');

  const res = await provider.vision({
    model: visionModel,
    systemPrompt: RECEIPT_OCR_PROMPT,
    userPrompt,
    imageUrls: [req.imageUrl],
    maxTokens: 1024,
    temperature: 0,
    jsonMode: true,
  });

  // 7. Parse
  const parsed = ReceiptResultSchema.parse(JSON.parse(res.text));

  // 8. Ensure integer cents for all money values
  const result: ReceiptOcrResult = {
    vendor: parsed.vendor,
    amountCents: parsed.amountCents !== null ? Math.round(parsed.amountCents) : null,
    date: parsed.date,
    suggestedCategory: parsed.suggestedCategory,
    lineItems: parsed.lineItems.map((li) => ({
      description: li.description,
      amountCents: Math.round(li.amountCents),
    })),
    confidence: parsed.confidence,
    rawText: parsed.rawText,
  };

  // 9. Log
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

  logger.debug('[ai:receipt-ocr] Extracted', {
    vendor: result.vendor,
    amountCents: result.amountCents,
    confidence: result.confidence,
    lineItemCount: result.lineItems.length,
  });

  return result;
}
