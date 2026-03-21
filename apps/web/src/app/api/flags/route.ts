/**
 * GET /api/flags
 *
 * Evaluates feature flags for the current user (authenticated or guest).
 * Returns only resolved boolean values — raw flag metadata is never exposed.
 *
 * Query params:
 *   keys (optional): comma-separated list of flag keys to evaluate.
 *   If omitted, ALL active flags are evaluated.
 *
 * Auth: optional — authenticated userId is used for PERCENTAGE/TARGETED evaluation.
 * No CASL gate — guests may fetch evaluated flag booleans (public, resolved-only).
 *
 * Response:
 *   { flags: Record<string, boolean> }
 *   Cache-Control: private, max-age=30
 */

import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { auth } from '@twicely/auth/server';
import { isFeatureEnabled } from '@/lib/services/feature-flags';
import { logger } from '@twicely/logger';

const CACHE_HEADER = 'private, max-age=30';

export async function GET(request: Request): Promise<NextResponse> {
  // Optional auth — only needed for PERCENTAGE/TARGETED evaluation
  let userId: string | undefined;
  try {
    const betterAuthSession = await auth.api.getSession({
      headers: await headers(),
    });
    userId = betterAuthSession?.user?.id ?? undefined;
  } catch (err) {
    logger.warn('[flags] Session read failed, continuing as guest', {
      message: err instanceof Error ? err.message : String(err),
    });
  }

  // Parse optional keys param
  const { searchParams } = new URL(request.url);
  const keysParam = searchParams.get('keys');

  let flagKeys: string[];

  if (keysParam) {
    // Split on comma, strip whitespace, drop empty strings
    flagKeys = keysParam
      .split(',')
      .map((k) => k.trim())
      .filter((k) => k.length > 0);
  } else {
    // M4 Security: Require explicit keys param — don't expose all flag names to unauthenticated users
    return NextResponse.json(
      { error: 'keys parameter is required' },
      { status: 400, headers: { 'Cache-Control': CACHE_HEADER } }
    );
  }

  if (flagKeys.length === 0) {
    return NextResponse.json(
      { flags: {} },
      { headers: { 'Cache-Control': CACHE_HEADER } }
    );
  }

  // Evaluate all flags in parallel — cache hits make this fast
  const evaluations = await Promise.all(
    flagKeys.map(async (key) => {
      try {
        const enabled = await isFeatureEnabled(key, { userId });
        return { key, enabled };
      } catch {
        // Default to false on evaluation error — never expose error details
        return { key, enabled: false };
      }
    })
  );

  const flags: Record<string, boolean> = {};
  for (const { key, enabled } of evaluations) {
    flags[key] = enabled;
  }

  return NextResponse.json(
    { flags },
    { headers: { 'Cache-Control': CACHE_HEADER } }
  );
}
