'use server';

import { db } from '@twicely/db';
import { affiliate } from '@twicely/db/schema';
import { eq } from 'drizzle-orm';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { runFraudScanSchema } from '@/lib/validations/affiliate-fraud';
import { runAllFraudChecks } from '@/lib/affiliate/fraud-detection';
import type { FraudScanResult } from '@/lib/affiliate/fraud-detection';

export interface FraudScanActionResult {
  success: boolean;
  data?: FraudScanResult;
  error?: string;
}

/**
 * Staff action: manually trigger a fraud scan for an affiliate.
 * Requires CASL manage Affiliate ability.
 * Returns scan results — does NOT auto-escalate (admin reviews and decides).
 */
export async function runAffiliateFraudScan(
  input: unknown,
): Promise<FraudScanActionResult> {
  const { ability } = await staffAuthorize();

  if (!ability.can('manage', 'Affiliate')) {
    return { success: false, error: 'Forbidden' };
  }

  const parsed = runFraudScanSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const { affiliateId } = parsed.data;

  const [record] = await db
    .select({ id: affiliate.id })
    .from(affiliate)
    .where(eq(affiliate.id, affiliateId))
    .limit(1);

  if (!record) {
    return { success: false, error: 'Affiliate not found' };
  }

  const result = await runAllFraudChecks(affiliateId);

  return { success: true, data: result };
}
