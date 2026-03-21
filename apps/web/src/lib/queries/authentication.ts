import { db } from '@twicely/db';
import { authenticationRequest, listing, sellerProfile } from '@twicely/db/schema';
import { eq, desc, and, count, sql } from 'drizzle-orm';
import type {
  AuthenticationRequestResult,
  AuthenticatorPartnerSummary,
  CertificateVerification,
} from '@/lib/authentication/types';

// Re-export from extended file for convenience
export type { AuthenticationRequestResult, AuthenticatorPartnerSummary, CertificateVerification };

// ─── Query 1: getAuthenticationRequestById ───────────────────────────────────

export async function getAuthenticationRequestById(
  requestId: string
): Promise<AuthenticationRequestResult | null> {
  const [row] = await db
    .select({
      id: authenticationRequest.id,
      listingId: authenticationRequest.listingId,
      orderId: authenticationRequest.orderId,
      sellerId: authenticationRequest.sellerId,
      buyerId: authenticationRequest.buyerId,
      initiator: authenticationRequest.initiator,
      tier: authenticationRequest.tier,
      status: authenticationRequest.status,
      totalFeeCents: authenticationRequest.totalFeeCents,
      buyerFeeCents: authenticationRequest.buyerFeeCents,
      sellerFeeCents: authenticationRequest.sellerFeeCents,
      refundedBuyerCents: authenticationRequest.refundedBuyerCents,
      certificateNumber: authenticationRequest.certificateNumber,
      certificateUrl: authenticationRequest.certificateUrl,
      verifyUrl: authenticationRequest.verifyUrl,
      photosHash: authenticationRequest.photosHash,
      photoUrls: authenticationRequest.photoUrls,
      resultNotes: authenticationRequest.resultNotes,
      authenticatorId: authenticationRequest.authenticatorId,
      submittedAt: authenticationRequest.submittedAt,
      completedAt: authenticationRequest.completedAt,
      expiresAt: authenticationRequest.expiresAt,
      createdAt: authenticationRequest.createdAt,
    })
    .from(authenticationRequest)
    .where(eq(authenticationRequest.id, requestId))
    .limit(1);

  return row ?? null;
}

// ─── Query 2: getAuthenticationRequestsForListing ────────────────────────────

export async function getAuthenticationRequestsForListing(
  listingId: string
): Promise<AuthenticationRequestResult[]> {
  return db
    .select({
      id: authenticationRequest.id,
      listingId: authenticationRequest.listingId,
      orderId: authenticationRequest.orderId,
      sellerId: authenticationRequest.sellerId,
      buyerId: authenticationRequest.buyerId,
      initiator: authenticationRequest.initiator,
      tier: authenticationRequest.tier,
      status: authenticationRequest.status,
      totalFeeCents: authenticationRequest.totalFeeCents,
      buyerFeeCents: authenticationRequest.buyerFeeCents,
      sellerFeeCents: authenticationRequest.sellerFeeCents,
      refundedBuyerCents: authenticationRequest.refundedBuyerCents,
      certificateNumber: authenticationRequest.certificateNumber,
      certificateUrl: authenticationRequest.certificateUrl,
      verifyUrl: authenticationRequest.verifyUrl,
      photosHash: authenticationRequest.photosHash,
      photoUrls: authenticationRequest.photoUrls,
      resultNotes: authenticationRequest.resultNotes,
      authenticatorId: authenticationRequest.authenticatorId,
      submittedAt: authenticationRequest.submittedAt,
      completedAt: authenticationRequest.completedAt,
      expiresAt: authenticationRequest.expiresAt,
      createdAt: authenticationRequest.createdAt,
    })
    .from(authenticationRequest)
    .where(eq(authenticationRequest.listingId, listingId))
    .orderBy(desc(authenticationRequest.createdAt));
}

// ─── Query 3: getAuthenticationRequestsForSeller ─────────────────────────────

export async function getAuthenticationRequestsForSeller(
  sellerId: string,
  filters?: { status?: string; limit?: number; offset?: number }
): Promise<{ requests: AuthenticationRequestResult[]; total: number }> {
  const limit = filters?.limit ?? 20;
  const offset = filters?.offset ?? 0;

  const whereClause = filters?.status
    ? and(
        eq(authenticationRequest.sellerId, sellerId),
        sql`${authenticationRequest.status} = ${filters.status}`
      )
    : eq(authenticationRequest.sellerId, sellerId);

  const [totalRow] = await db.select({ total: count() }).from(authenticationRequest).where(whereClause);

  const requests = await db
    .select({
      id: authenticationRequest.id,
      listingId: authenticationRequest.listingId,
      orderId: authenticationRequest.orderId,
      sellerId: authenticationRequest.sellerId,
      buyerId: authenticationRequest.buyerId,
      initiator: authenticationRequest.initiator,
      tier: authenticationRequest.tier,
      status: authenticationRequest.status,
      totalFeeCents: authenticationRequest.totalFeeCents,
      buyerFeeCents: authenticationRequest.buyerFeeCents,
      sellerFeeCents: authenticationRequest.sellerFeeCents,
      refundedBuyerCents: authenticationRequest.refundedBuyerCents,
      certificateNumber: authenticationRequest.certificateNumber,
      certificateUrl: authenticationRequest.certificateUrl,
      verifyUrl: authenticationRequest.verifyUrl,
      photosHash: authenticationRequest.photosHash,
      photoUrls: authenticationRequest.photoUrls,
      resultNotes: authenticationRequest.resultNotes,
      authenticatorId: authenticationRequest.authenticatorId,
      submittedAt: authenticationRequest.submittedAt,
      completedAt: authenticationRequest.completedAt,
      expiresAt: authenticationRequest.expiresAt,
      createdAt: authenticationRequest.createdAt,
    })
    .from(authenticationRequest)
    .where(whereClause)
    .orderBy(desc(authenticationRequest.createdAt))
    .limit(limit)
    .offset(offset);

  return { requests, total: totalRow?.total ?? 0 };
}

// ─── Query 4: getSellerVerificationStatus ────────────────────────────────────

export async function getSellerVerificationStatus(
  userId: string
): Promise<{ isVerified: boolean }> {
  const [row] = await db
    .select({ isAuthenticatedSeller: sellerProfile.isAuthenticatedSeller })
    .from(sellerProfile)
    .where(eq(sellerProfile.userId, userId))
    .limit(1);
  return { isVerified: row?.isAuthenticatedSeller ?? false };
}

// ─── Query 5: getAuthenticationBadgeForListing ───────────────────────────────

const BADGE_LABELS: Record<string, string | null> = {
  SELLER_VERIFIED: 'Verified Seller',
  EXPERT_AUTHENTICATED: 'Expert Authenticated',
  EXPERT_PENDING: 'Authentication Pending',
  AI_AUTHENTICATED: 'AI Authenticated',
};

export async function getAuthenticationBadgeForListing(
  listingId: string
): Promise<{ status: string; badgeLabel: string | null; certificateNumber: string | null } | null> {
  const [row] = await db
    .select({ authenticationStatus: listing.authenticationStatus, authenticationRequestId: listing.authenticationRequestId })
    .from(listing)
    .where(eq(listing.id, listingId))
    .limit(1);

  if (!row || row.authenticationStatus === 'NONE') return null;

  const badgeLabel = BADGE_LABELS[row.authenticationStatus] ?? null;
  if (!badgeLabel) return null;

  let certificateNumber: string | null = null;
  if (row.authenticationRequestId) {
    const [reqRow] = await db
      .select({ certificateNumber: authenticationRequest.certificateNumber })
      .from(authenticationRequest)
      .where(eq(authenticationRequest.id, row.authenticationRequestId))
      .limit(1);
    certificateNumber = reqRow?.certificateNumber ?? null;
  }

  return { status: row.authenticationStatus, badgeLabel, certificateNumber };
}

// ─── Exports from extended query file ────────────────────────────────────────

export { verifyCertificate, getAuthenticatorPartners } from './authentication-verify';
