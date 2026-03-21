/**
 * Tax info queries
 * G5.1 — Tax info collection
 *
 * SECURITY: taxIdEncrypted is NEVER returned from these functions.
 * Only taxIdLastFour and taxIdType are exposed.
 */

import { db } from '@twicely/db';
import { taxInfo } from '@/lib/db/schema/tax';
import { maskTaxId } from '@twicely/db/encryption';
import { eq } from 'drizzle-orm';

export interface TaxInfoPublic {
  id: string;
  userId: string;
  taxIdType: string | null;
  taxIdLastFour: string | null;
  legalName: string | null;
  businessName: string | null;
  address1: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  country: string;
  form1099Threshold: boolean;
  w9ReceivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface TaxInfoAdmin extends TaxInfoPublic {
  maskedTaxId: string | null;
}

/**
 * Get tax info for a user. Excludes taxIdEncrypted.
 * Used by seller actions to show their own tax info (masked last 4).
 */
export async function getTaxInfoByUserId(
  userId: string
): Promise<TaxInfoPublic | null> {
  const [row] = await db
    .select({
      id: taxInfo.id,
      userId: taxInfo.userId,
      taxIdType: taxInfo.taxIdType,
      taxIdLastFour: taxInfo.taxIdLastFour,
      legalName: taxInfo.legalName,
      businessName: taxInfo.businessName,
      address1: taxInfo.address1,
      city: taxInfo.city,
      state: taxInfo.state,
      zip: taxInfo.zip,
      country: taxInfo.country,
      form1099Threshold: taxInfo.form1099Threshold,
      w9ReceivedAt: taxInfo.w9ReceivedAt,
      createdAt: taxInfo.createdAt,
      updatedAt: taxInfo.updatedAt,
    })
    .from(taxInfo)
    .where(eq(taxInfo.userId, userId))
    .limit(1);

  return row ?? null;
}

/**
 * Get tax info with masked TIN for admin viewing.
 * Excludes taxIdEncrypted. Shows last 4 in masked format.
 * Used by admin tax compliance page — ADMIN and FINANCE roles only.
 */
export async function getTaxInfoForAdmin(
  userId: string
): Promise<TaxInfoAdmin | null> {
  const row = await getTaxInfoByUserId(userId);
  if (!row) return null;

  const maskedTaxId =
    row.taxIdLastFour && row.taxIdType
      ? maskTaxId(row.taxIdLastFour, row.taxIdType)
      : null;

  return { ...row, maskedTaxId };
}
