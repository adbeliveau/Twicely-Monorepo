/**
 * Facebook Marketplace OAuth callback route — F3
 * GET /api/crosslister/fb-marketplace/callback
 *
 * Handles the OAuth authorization code exchange after the seller
 * approves access on Facebook's authorization page.
 * Pattern: identical to src/app/api/crosslister/mercari/callback/route.ts
 */

import { type NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { auth } from '@twicely/auth/server';
import { db } from '@twicely/db';
import { crosslisterAccount } from '@twicely/db/schema';
import { eq, and } from 'drizzle-orm';
import '@/lib/crosslister/connectors'; // Ensure all connectors are registered
import { FbMarketplaceConnector } from '@twicely/crosslister/connectors/fb-marketplace-connector';
import { logger } from '@twicely/logger';
import { defineAbilitiesFor, sub } from '@twicely/casl';

const CONNECT_SUCCESS_URL = '/my/selling/crosslist/connect?connected=fb-marketplace';
const CONNECT_FAILURE_URL = '/my/selling/crosslist/connect?error=auth_failed';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  searchParams.get('state');

  if (!code) {
    logger.warn('[fb-marketplace/callback] Missing authorization code');
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
    const connector = new FbMarketplaceConnector();
    const authResult = await connector.authenticate({
      method: 'OAUTH',
      code,
      redirectUri: '', // loaded from platform_settings inside connector
    });

    if (!authResult.success || !authResult.accessToken) {
      logger.error('[fb-marketplace/callback] Auth failed', { sellerId, error: authResult.error });
      return NextResponse.redirect(new URL(CONNECT_FAILURE_URL, request.url));
    }

    // Upsert crosslisterAccount row
    const [existing] = await db
      .select({ id: crosslisterAccount.id })
      .from(crosslisterAccount)
      .where(
        and(
          eq(crosslisterAccount.sellerId, sellerId),
          eq(crosslisterAccount.channel, 'FB_MARKETPLACE'),
        ),
      )
      .limit(1);

    if (existing) {
      await db
        .update(crosslisterAccount)
        .set({
          status: 'ACTIVE',
          externalAccountId: authResult.externalAccountId,
          externalUsername: authResult.externalUsername,
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
      // TODO: Encrypt tokens before production (stored as plain text for F3)
      await db.insert(crosslisterAccount).values({
        sellerId,
        channel: 'FB_MARKETPLACE',
        authMethod: 'OAUTH',
        status: 'ACTIVE',
        externalAccountId: authResult.externalAccountId,
        externalUsername: authResult.externalUsername,
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
    logger.error('[fb-marketplace/callback] Unexpected error', { sellerId, error: String(err) });
    return NextResponse.redirect(new URL(CONNECT_FAILURE_URL, request.url));
  }
}
