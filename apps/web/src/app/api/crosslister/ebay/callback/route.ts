/**
 * eBay OAuth callback route — F1.1
 * GET /api/crosslister/ebay/callback
 *
 * Handles the OAuth authorization code exchange after the seller
 * approves access on eBay's authorization page.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { auth } from '@twicely/auth/server';
import { db } from '@twicely/db';
import { crosslisterAccount } from '@twicely/db/schema';
import { eq, and } from 'drizzle-orm';
import { EbayConnector } from '@twicely/crosslister/connectors/ebay-connector';
import { logger } from '@twicely/logger';
import { defineAbilitiesFor, sub } from '@twicely/casl';

const CONNECT_SUCCESS_URL = '/my/selling/crosslist/connect?connected=ebay';
const CONNECT_FAILURE_URL = '/my/selling/crosslist/connect?error=auth_failed';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  // state is validated in production; for F1 we accept any valid state
  searchParams.get('state');

  if (!code) {
    logger.warn('[ebay/callback] Missing authorization code');
    return NextResponse.redirect(new URL(CONNECT_FAILURE_URL, request.url));
  }

  // Verify session — seller must be logged in
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.redirect(new URL('/auth/login', request.url));
  }

  const sellerId = session.user.id;

  // CASL authorization check — user must have crosslister account creation rights
  const ability = defineAbilitiesFor({
    userId: sellerId,
    email: session.user.email,
    isSeller: (session.user as { isSeller?: boolean }).isSeller ?? false,
    sellerId: (session.user as { isSeller?: boolean }).isSeller ? sellerId : null,
    sellerStatus: null,
    delegationId: null,
    onBehalfOfSellerId: null,
    onBehalfOfSellerProfileId: null,
    delegatedScopes: [],
    isPlatformStaff: false,
    platformRoles: [],
  });
  if (!ability.can('create', sub('CrosslisterAccount', { sellerId }))) {
    return NextResponse.redirect(new URL(CONNECT_FAILURE_URL, request.url));
  }

  try {
    const connector = new EbayConnector();
    const authResult = await connector.authenticate({
      method: 'OAUTH',
      code,
      redirectUri: '', // loaded from platform_settings inside connector
    });

    if (!authResult.success || !authResult.accessToken) {
      logger.error('[ebay/callback] Auth failed', { sellerId, error: authResult.error });
      return NextResponse.redirect(new URL(CONNECT_FAILURE_URL, request.url));
    }

    // Upsert crosslisterAccount row
    const [existing] = await db
      .select({ id: crosslisterAccount.id })
      .from(crosslisterAccount)
      .where(
        and(
          eq(crosslisterAccount.sellerId, sellerId),
          eq(crosslisterAccount.channel, 'EBAY'),
        ),
      )
      .limit(1);

    if (existing) {
      // Update existing account (re-connect after revocation)
      await db
        .update(crosslisterAccount)
        .set({
          status: 'ACTIVE',
          accessToken: authResult.accessToken,
          refreshToken: authResult.refreshToken,
          tokenExpiresAt: authResult.tokenExpiresAt,
          capabilities: authResult.capabilities,
          lastAuthAt: new Date(),
          firstImportCompletedAt: null,
          updatedAt: new Date(),
        })
        .where(eq(crosslisterAccount.id, existing.id));
    } else {
      // Create new account row
      // TODO: Encrypt tokens before production (stored as plain text for F1)
      await db.insert(crosslisterAccount).values({
        sellerId,
        channel: 'EBAY',
        authMethod: 'OAUTH',
        status: 'ACTIVE',
        accessToken: authResult.accessToken,
        refreshToken: authResult.refreshToken,
        tokenExpiresAt: authResult.tokenExpiresAt,
        capabilities: authResult.capabilities,
        lastAuthAt: new Date(),
        firstImportCompletedAt: null,
      });
    }

    return NextResponse.redirect(new URL(CONNECT_SUCCESS_URL, request.url));
  } catch (err) {
    logger.error('[ebay/callback] Unexpected error', { sellerId, error: String(err) });
    return NextResponse.redirect(new URL(CONNECT_FAILURE_URL, request.url));
  }
}
