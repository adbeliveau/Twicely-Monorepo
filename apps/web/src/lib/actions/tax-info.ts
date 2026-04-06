'use server';

/**
 * Tax info server actions
 * G5.1 — Tax info collection + encryption service
 * G5.5 — Wire affiliate taxInfoProvided on save
 *
 * SECURITY:
 *  - taxIdEncrypted is NEVER returned to the client
 *  - Only taxIdLastFour + taxIdType are exposed
 *  - Full SSN/EIN is encrypted before storage
 */

import { db } from '@twicely/db';
import { taxInfo, affiliate } from '@twicely/db/schema';
import { eq } from 'drizzle-orm';
import { authorize, sub } from '@twicely/casl';
import { encrypt } from '@twicely/db/encryption';
import { taxInfoSchema, sanitizeTaxIdInput } from '@/lib/validations/tax';
import { getTaxInfoByUserId } from '@/lib/queries/tax-info';
import { logger } from '@twicely/logger';
import { revalidatePath } from 'next/cache';
import type { TaxInfoPublic } from '@/lib/queries/tax-info';

interface SaveTaxInfoResult {
  success: boolean;
  error?: string;
  data?: TaxInfoPublic;
}

interface GetTaxInfoResult {
  success: boolean;
  error?: string;
  data?: TaxInfoPublic;
}

/**
 * Save (upsert) tax info for the current user.
 * Encrypts tax ID before storage. Stores last 4 digits only in taxIdLastFour.
 * Also updates affiliate.taxInfoProvided if the user is an affiliate.
 */
export async function saveTaxInfoAction(
  input: unknown
): Promise<SaveTaxInfoResult> {
  const { session, ability } = await authorize();

  if (!session) {
    return { success: false, error: 'Please sign in to continue' };
  }

  if (!ability.can('update', sub('TaxInfo', { userId: session.userId }))) {
    return { success: false, error: 'Not authorized' };
  }

  const parsed = taxInfoSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Invalid input',
    };
  }

  const {
    taxIdType, taxId, legalName, businessName,
    address1, city, state, zip, country,
  } = parsed.data;

  // Sanitize raw tax ID (strip dashes/spaces) then encrypt
  const cleanTaxId = sanitizeTaxIdInput(taxId);
  const taxIdEncrypted = encrypt(cleanTaxId);
  const taxIdLastFour = cleanTaxId.slice(-4);

  const now = new Date();

  try {
    await db
      .insert(taxInfo)
      .values({
        userId: session.userId,
        taxIdType,
        taxIdEncrypted,
        taxIdLastFour,
        legalName,
        businessName: businessName ?? null,
        address1,
        city,
        state: state.toUpperCase(),
        zip,
        country: country ?? 'US',
        w9ReceivedAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: taxInfo.userId,
        set: {
          taxIdType,
          taxIdEncrypted,
          taxIdLastFour,
          legalName,
          businessName: businessName ?? null,
          address1,
          city,
          state: state.toUpperCase(),
          zip,
          country: country ?? 'US',
          w9ReceivedAt: now,
          updatedAt: now,
        },
      });

    // G5.5: If user is an affiliate, set taxInfoProvided = true
    await db
      .update(affiliate)
      .set({ taxInfoProvided: true, updatedAt: now })
      .where(eq(affiliate.userId, session.userId));

    logger.info('[saveTaxInfoAction] Tax info saved', { userId: session.userId });

    revalidatePath('/my/selling/tax');

    const saved = await getTaxInfoByUserId(session.userId);
    return { success: true, data: saved ?? undefined };
  } catch (error) {
    logger.error('[saveTaxInfoAction] Failed to save tax info', { error });
    return {
      success: false,
      error: 'Failed to save tax information',
    };
  }
}

/**
 * Get tax info for the current user.
 * Returns masked data only — taxIdEncrypted is NEVER returned.
 */
export async function getTaxInfoAction(): Promise<GetTaxInfoResult> {
  const { session, ability } = await authorize();

  if (!session) {
    return { success: false, error: 'Please sign in to continue' };
  }

  if (!ability.can('read', sub('TaxInfo', { userId: session.userId }))) {
    return { success: false, error: 'Not authorized' };
  }

  const data = await getTaxInfoByUserId(session.userId);
  return { success: true, data: data ?? undefined };
}
