/**
 * getEvaluatedFlags — Server-side batch flag evaluator (G10.5)
 *
 * Used by server components that want to pre-populate the FeatureFlagProvider
 * with evaluated flag state, avoiding the client-side fetch waterfall.
 *
 * This is NOT a server action (no 'use server' directive).
 * It is a plain async utility that runs on the server only,
 * because it imports from feature-flags.ts which uses Node.js DB/cache APIs.
 *
 * Usage in a server component:
 *   const flags = await getEvaluatedFlags(['kill.checkout', 'gate.marketplace'], userId);
 *   return <FeatureFlagProvider initialFlags={flags}>{children}</FeatureFlagProvider>;
 */

import { isFeatureEnabled } from '@/lib/services/feature-flags';

/**
 * Evaluate multiple feature flags in parallel for an optional userId.
 *
 * @param keys - Array of flag keys to evaluate.
 * @param userId - Optional user ID for PERCENTAGE/TARGETED evaluation.
 * @returns A Record mapping each key to its resolved boolean value.
 */
export async function getEvaluatedFlags(
  keys: string[],
  userId?: string
): Promise<Record<string, boolean>> {
  if (keys.length === 0) return {};

  const results = await Promise.all(
    keys.map(async (key) => {
      try {
        const enabled = await isFeatureEnabled(key, { userId });
        return { key, enabled };
      } catch {
        return { key, enabled: false };
      }
    })
  );

  const flags: Record<string, boolean> = {};
  for (const { key, enabled } of results) {
    flags[key] = enabled;
  }
  return flags;
}
