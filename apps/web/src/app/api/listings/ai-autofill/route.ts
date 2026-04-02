/**
 * POST /api/listings/ai-autofill
 *
 * Analyzes uploaded listing photos with Claude Vision and returns field suggestions.
 * Rate-limited per user per calendar month, based on StoreTier.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authorize } from '@twicely/casl/authorize';
import { getPlatformSetting } from '@/lib/queries/platform-settings';
import {
  analyzeListingImages,
  getMonthlyUsage,
  incrementUsage,
} from '@/lib/services/ai-autofill-service';
import { logger } from '@twicely/logger';

const aiAutofillRequestSchema = z
  .object({
    imageUrls: z.array(z.string().url()).min(1).max(12),
  })
  .strict();

export async function POST(request: NextRequest) {
  const { session, ability } = await authorize();

  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  if (!ability.can('create', 'Listing')) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  const userId = session.userId;

  // Check master toggle
  const enabled = await getPlatformSetting<boolean>('ai.autofill.enabled', true);
  if (!enabled) {
    return NextResponse.json(
      { success: false, error: 'AI auto-fill is temporarily unavailable' },
      { status: 503 }
    );
  }

  // Parse and validate input
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid request body' },
      { status: 400 }
    );
  }

  const parseResult = aiAutofillRequestSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      { success: false, error: 'Invalid input', details: parseResult.error.flatten() },
      { status: 400 }
    );
  }

  const { imageUrls } = parseResult.data;

  // Rate limit check — getMonthlyUsage already fetches limit internally
  const { count, limit } = await getMonthlyUsage(userId);

  if (limit !== -1 && count >= limit) {
    return NextResponse.json(
      {
        success: false,
        error: 'Monthly auto-fill limit reached. Upgrade your Store tier for more.',
        remainingUses: 0,
      },
      { status: 429 }
    );
  }

  // Call Claude Vision
  try {
    const suggestions = await analyzeListingImages(imageUrls);

    // Increment usage only after successful Claude call
    await incrementUsage(userId);

    const newCount = count + 1;
    const remainingUses = limit === -1 ? -1 : Math.max(0, limit - newCount);

    return NextResponse.json({
      success: true,
      suggestions,
      remainingUses,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown';

    if (message === 'NO_IMAGES') {
      logger.error('[AI AutoFill] All image fetches failed', { userId });
      return NextResponse.json(
        { success: false, error: 'Could not load images. Please try again.' },
        { status: 400 }
      );
    }

    logger.error('[AI AutoFill] Claude API error', {
      userId,
      error: message,
    });

    return NextResponse.json(
      { success: false, error: 'Auto-fill unavailable, please fill in manually' },
      { status: 502 }
    );
  }
}
