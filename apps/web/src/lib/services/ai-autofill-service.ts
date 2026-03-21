/**
 * AI Auto-Fill Service (G1.1)
 *
 * Calls Claude Vision API to analyze listing photos and return field suggestions.
 * All rate limits and model config are read from platform_settings.
 */

import Anthropic from '@anthropic-ai/sdk';
import type { ImageBlockParam, TextBlockParam } from '@anthropic-ai/sdk/resources/messages/messages';
import { z } from 'zod';
import { sql } from 'drizzle-orm';
import { db } from '@twicely/db';
import { aiAutofillUsage } from '@twicely/db/schema';
import { getPlatformSetting } from '@/lib/queries/platform-settings';
import { getUserStoreTier, getAutofillUsage } from '@/lib/queries/ai-autofill';
import { logger } from '@twicely/logger';
import type { AiAutofillSuggestions } from '@/types/ai-autofill';

const AI_SYSTEM_PROMPT = `You are a product listing assistant for Twicely, a secondhand resale marketplace. Analyze the provided product photos and suggest listing details.

Return a JSON object with exactly these fields:
{
  "title": "Concise product title, max 80 characters",
  "description": "Detailed description of the item, mentioning condition, notable features, measurements if visible. Max 2000 characters.",
  "category": "Best matching category name (e.g., 'Men's Shoes', 'Women's Dresses', 'Electronics')",
  "brand": "Brand name if identifiable, or empty string",
  "condition": "One of: NEW_WITH_TAGS, NEW_WITHOUT_TAGS, NEW_WITH_DEFECTS, LIKE_NEW, VERY_GOOD, GOOD, ACCEPTABLE",
  "color": "Primary color of the item",
  "tags": ["up to 5 relevant search tags"],
  "suggestedPriceMinCents": 0,
  "suggestedPriceMaxCents": 0,
  "confidence": "HIGH, MEDIUM, or LOW"
}

Rules:
- Title should be descriptive but concise (include brand, key feature, size if visible)
- Description should focus on what a buyer needs to know
- For condition, look for wear signs, tags, packaging
- Price suggestions should be in cents (e.g., 2500 = $25.00) and reflect typical resale value
- If you cannot determine a field, use empty string or null
- Return ONLY the JSON object, no markdown formatting, no explanation`;

const AI_USER_PROMPT =
  'Analyze these product photos and suggest listing details for a secondhand marketplace listing.';

const aiResponseSchema = z.object({
  title: z.string().max(80).default(''),
  description: z.string().max(5000).default(''),
  category: z.string().default(''),
  brand: z.string().default(''),
  condition: z
    .enum([
      'NEW_WITH_TAGS',
      'NEW_WITHOUT_TAGS',
      'NEW_WITH_DEFECTS',
      'LIKE_NEW',
      'VERY_GOOD',
      'GOOD',
      'ACCEPTABLE',
    ])
    .nullable()
    .default(null),
  color: z.string().default(''),
  tags: z.array(z.string()).max(5).default([]),
  suggestedPriceMinCents: z.number().int().nonnegative().default(0),
  suggestedPriceMaxCents: z.number().int().nonnegative().default(0),
  confidence: z.enum(['HIGH', 'MEDIUM', 'LOW']).default('LOW'),
});

type SupportedMediaType = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif';

export function getCurrentMonthKey(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
}

function getMediaTypeFromContentType(contentType: string): SupportedMediaType {
  if (contentType.includes('png')) return 'image/png';
  if (contentType.includes('webp')) return 'image/webp';
  if (contentType.includes('gif')) return 'image/gif';
  return 'image/jpeg';
}

function isAllowedImageUrl(url: string): boolean {
  if (url.startsWith('/')) return true;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return false;
    const allowed = [
      process.env.NEXT_PUBLIC_APP_URL ? new URL(process.env.NEXT_PUBLIC_APP_URL).hostname : null,
      process.env.R2_PUBLIC_URL ? new URL(process.env.R2_PUBLIC_URL).hostname : null,
      'cdn.twicely.com',
    ].filter((h): h is string => h !== null);
    return allowed.some((host) => parsed.hostname === host || parsed.hostname.endsWith(`.${host}`));
  } catch {
    return false;
  }
}

async function fetchImageAsBase64(
  url: string
): Promise<{ base64: string; mediaType: SupportedMediaType } | null> {
  if (!isAllowedImageUrl(url)) return null;

  try {
    let resolvedUrl = url;
    if (url.startsWith('/')) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
      resolvedUrl = `${appUrl}${url}`;
    }

    const response = await fetch(resolvedUrl);
    if (!response.ok) return null;

    const contentType = response.headers.get('content-type') ?? 'image/jpeg';
    const mediaType = getMediaTypeFromContentType(contentType);
    const arrayBuffer = await response.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');

    return { base64, mediaType };
  } catch {
    return null;
  }
}

let anthropicClient: Anthropic | null = null;

function getAnthropicClient(): Anthropic {
  if (!anthropicClient) {
    anthropicClient = new Anthropic();
  }
  return anthropicClient;
}

/**
 * Analyze listing images using Claude Vision API.
 * Throws on network failure or unparseable response.
 */
export async function analyzeListingImages(
  imageUrls: string[]
): Promise<AiAutofillSuggestions> {
  const model = await getPlatformSetting<string>(
    'ai.autofill.model',
    'claude-sonnet-4-5-20250514'
  );
  const maxTokens = await getPlatformSetting<number>('ai.autofill.maxTokens', 2048);

  // Use up to first 4 images only
  const urlsToProcess = imageUrls.slice(0, 4);

  // Fetch and base64-encode images concurrently
  const imageResults = await Promise.all(
    urlsToProcess.map((url) => fetchImageAsBase64(url))
  );
  const validImages = imageResults.filter(
    (img): img is { base64: string; mediaType: SupportedMediaType } => img !== null
  );

  if (validImages.length === 0) {
    throw new Error('NO_IMAGES');
  }

  const imageContent: ImageBlockParam[] = validImages.map((img) => ({
    type: 'image' as const,
    source: {
      type: 'base64' as const,
      media_type: img.mediaType,
      data: img.base64,
    },
  }));

  const textBlock: TextBlockParam = {
    type: 'text',
    text: AI_USER_PROMPT,
  };

  const client = getAnthropicClient();

  const response = await client.messages.create({
    model,
    max_tokens: maxTokens,
    system: AI_SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: [...imageContent, textBlock],
      },
    ],
  });

  const firstBlock = response.content[0];
  if (!firstBlock || firstBlock.type !== 'text') {
    throw new Error('PARSE_FAILED');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(firstBlock.text);
  } catch {
    throw new Error('PARSE_FAILED');
  }

  const validated = aiResponseSchema.parse(parsed);
  return validated;
}

/**
 * Get the monthly auto-fill limit for a given user based on their StoreTier.
 */
export async function getUserMonthlyLimit(userId: string): Promise<number> {
  const tier = await getUserStoreTier(userId);
  switch (tier) {
    case 'STARTER':
      return getPlatformSetting<number>('ai.autofill.limitStarter', 50);
    case 'PRO':
      return getPlatformSetting<number>('ai.autofill.limitPro', 200);
    case 'POWER':
    case 'ENTERPRISE':
      return getPlatformSetting<number>('ai.autofill.limitPower', -1);
    default:
      return getPlatformSetting<number>('ai.autofill.limitDefault', 10);
  }
}

/**
 * Get current monthly usage and limit for a user.
 */
export async function getMonthlyUsage(
  userId: string
): Promise<{ count: number; limit: number; remaining: number }> {
  const monthKey = getCurrentMonthKey();

  const [usageRow, limit] = await Promise.all([
    getAutofillUsage(userId, monthKey),
    getUserMonthlyLimit(userId),
  ]);

  const count = usageRow?.count ?? 0;
  const remaining = limit === -1 ? -1 : Math.max(0, limit - count);
  return { count, limit, remaining };
}

/**
 * Atomically increment the auto-fill usage count for a user in the current month.
 */
export async function incrementUsage(userId: string): Promise<void> {
  const monthKey = getCurrentMonthKey();

  await db
    .insert(aiAutofillUsage)
    .values({
      userId,
      monthKey,
      count: 1,
    })
    .onConflictDoUpdate({
      target: [aiAutofillUsage.userId, aiAutofillUsage.monthKey],
      set: {
        count: sql`${aiAutofillUsage.count} + 1`,
        updatedAt: new Date(),
      },
    });

  logger.info('[AI AutoFill] Usage incremented', { userId, monthKey });
}
