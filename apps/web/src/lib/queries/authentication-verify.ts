import { db } from '@twicely/db';
import { authenticationRequest, authenticatorPartner, listing, listingImage } from '@twicely/db/schema';
import { eq, and } from 'drizzle-orm';
import type { AuthenticatorPartnerSummary, CertificateVerification } from '@/lib/authentication/types';

// ─── Query: verifyCertificate (public, no auth required) ─────────────────────

export async function verifyCertificate(
  certificateNumber: string
): Promise<CertificateVerification> {
  const [row] = await db
    .select({
      id: authenticationRequest.id,
      status: authenticationRequest.status,
      authenticationType: authenticationRequest.tier,
      authenticationDate: authenticationRequest.completedAt,
      photoUrls: authenticationRequest.photoUrls,
      authenticatorId: authenticationRequest.authenticatorId,
      listingId: authenticationRequest.listingId,
      certNum: authenticationRequest.certificateNumber,
    })
    .from(authenticationRequest)
    .where(eq(authenticationRequest.certificateNumber, certificateNumber))
    .limit(1);

  if (!row || !row.certNum) {
    return {
      certificateNumber,
      status: 'NOT_FOUND',
      authenticationType: null,
      authenticationDate: null,
      listingTitle: null,
      listingThumbnailUrl: null,
      authenticatorName: null,
      photoUrls: null,
      message: 'Certificate not found. Verify the certificate number and try again.',
    };
  }

  const s = row.status;

  if (s === 'CERTIFICATE_EXPIRED') {
    return {
      certificateNumber,
      status: 'TRANSFERRED',
      authenticationType: row.authenticationType,
      authenticationDate: row.authenticationDate,
      listingTitle: null,
      listingThumbnailUrl: null,
      authenticatorName: null,
      photoUrls: row.photoUrls,
      message: 'This certificate was issued for a previous listing.',
    };
  }

  if (s === 'CERTIFICATE_REVOKED') {
    return {
      certificateNumber,
      status: 'REVOKED',
      authenticationType: row.authenticationType,
      authenticationDate: row.authenticationDate,
      listingTitle: null,
      listingThumbnailUrl: null,
      authenticatorName: null,
      photoUrls: null,
      message: 'This certificate has been revoked.',
    };
  }

  if (s !== 'EXPERT_AUTHENTICATED' && s !== 'AI_AUTHENTICATED') {
    return {
      certificateNumber,
      status: 'NOT_FOUND',
      authenticationType: null,
      authenticationDate: null,
      listingTitle: null,
      listingThumbnailUrl: null,
      authenticatorName: null,
      photoUrls: null,
      message: 'Certificate not found. Verify the certificate number and try again.',
    };
  }

  const [listingRow] = await db
    .select({ title: listing.title })
    .from(listing)
    .where(eq(listing.id, row.listingId))
    .limit(1);

  const [imageRow] = await db
    .select({ url: listingImage.url })
    .from(listingImage)
    .where(and(eq(listingImage.listingId, row.listingId), eq(listingImage.isPrimary, true)))
    .limit(1);

  let authenticatorName: string | null = null;
  if (row.authenticatorId) {
    const [partner] = await db
      .select({ name: authenticatorPartner.name })
      .from(authenticatorPartner)
      .where(eq(authenticatorPartner.id, row.authenticatorId))
      .limit(1);
    authenticatorName = partner?.name ?? null;
  }

  return {
    certificateNumber,
    status: 'VALID',
    authenticationType: row.authenticationType,
    authenticationDate: row.authenticationDate,
    listingTitle: listingRow?.title ?? null,
    listingThumbnailUrl: imageRow?.url ?? null,
    authenticatorName,
    photoUrls: row.photoUrls,
    message: 'This item has been authenticated by Twicely.',
  };
}

// ─── Query: getAuthenticatorPartners (admin only) ────────────────────────────

export async function getAuthenticatorPartners(
  filters?: { isActive?: boolean; specialty?: string }
): Promise<AuthenticatorPartnerSummary[]> {
  const rows = await db
    .select({
      id: authenticatorPartner.id,
      name: authenticatorPartner.name,
      specialties: authenticatorPartner.specialties,
      isActive: authenticatorPartner.isActive,
      completedCount: authenticatorPartner.completedCount,
      accuracyRate: authenticatorPartner.accuracyRate,
      avgTurnaroundHours: authenticatorPartner.avgTurnaroundHours,
    })
    .from(authenticatorPartner);

  return rows.filter((r) => {
    if (filters?.isActive !== undefined && r.isActive !== filters.isActive) return false;
    if (filters?.specialty && !r.specialties.includes(filters.specialty)) return false;
    return true;
  });
}
