/**
 * Depop OAuth callback route — F3
 * GET /api/crosslister/depop/callback
 *
 * Handles the OAuth authorization code exchange after the seller
 * approves access on Depop's authorization page.
 * Pattern: identical to src/app/api/crosslister/mercari/callback/route.ts
 */

import { type NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { db } from '@twicely/db';
import { crosslisterAccount } from '@twicely/db/schema';
import { eq, and } from 'drizzle-orm';
import '@/lib/crosslister/connectors'; // Ensure all connectors are registered
import { DepopConnector } from '@twicely/crosslister/connectors/depop-connector';
import { encryptToken } from '@twicely/crosslister/token-crypto';
import { logger } from '@twicely/logger';
import { authorize, sub } from '@twicely/casl';

const CONNECT_SUCCESS_URL = '/my/selling/crosslist/connect?connected=depop';
const CONNECT_FAILURE_URL = '/my/selling/crosslist/connect?error=auth_failed';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');

  if (!code) {
    logger.warn('[depop/callback] Missing authorization code');
    return NextResponse.redirect(new URL(CONNECT_FAILURE_URL, request.url));
  }

  // Validate OAuth state to prevent CSRF
  const cookieStore = await cookies();
  const stateCookie = cookieStore.get('crosslister_oauth_state')?.value;
  cookieStore.delete('crosslister_oauth_state');
  if (!stateCookie || !state) {
    logger.warn('[depop/callback] Missing OAuth state — possible CSRF', { state });
    return NextResponse.redirect(new URL(CONNECT_FAILURE_URL, request.url));
  }
  try {
    const stored = JSON.parse(stateCookie) as { state?: string };
    if (stored.state !== state) {
      logger.warn('[depop/callback] OAuth state mismatch — possible CSRF', { expected: stored.state, got: state });
      return NextResponse.redirect(new URL(CONNECT_FAILURE_URL, request.url));
    }
  } catch {
    logger.warn('[depop/callback] Invalid OAuth state cookie');
    return NextResponse.redirect(new URL(CONNECT_FAILURE_URL, request.url));
  }

  // Verify session — seller must be logged in
  const { session, ability } = await authorize();
  if (!session) {
    return NextResponse.redirect(new URL('/auth/login', request.url));
  }

  const sellerId = session.delegationId ? session.onBehalfOfSellerId! : session.userId;

  // CASL authorization check — user must have crosslister account creation rights
  if (!ability.can('create', sub('CrosslisterAccount', { sellerId }))) {
    return NextResponse.redirect(new URL(CONNECT_FAILURE_URL, request.url));
  }

  try {
    const connector = new DepopConnector();
    const authResult = await connector.authenticate({
      method: 'OAUTH',
      code,
      redirectUri: '', // loaded from platform_settings inside connector
    });

    if (!authResult.success || !authResult.accessToken) {
      logger.error('[depop/callback] Auth failed', { sellerId, error: authResult.error });
      return NextResponse.redirect(new URL(CONNECT_FAILURE_URL, request.url));
    }

    // Upsert crosslisterAccount row
    const [existing] = await db
      .select({ id: crosslisterAccount.id })
      .from(crosslisterAccount)
      .where(
        and(
          eq(crosslisterAccount.sellerId, sellerId),
          eq(crosslisterAccount.channel, 'DEPOP'),
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
          accessToken: encryptToken(authResult.accessToken),
          refreshToken: encryptToken(authResult.refreshToken),
          tokenExpiresAt: authResult.tokenExpiresAt,
          capabilities: authResult.capabilities,
          lastAuthAt: new Date(),
          firstImportCompletedAt: null,
          updatedAt: new Date(),
        })
        .where(eq(crosslisterAccount.id, existing.id));
    } else {
      await db.insert(crosslisterAccount).values({
        sellerId,
        channel: 'DEPOP',
        authMethod: 'OAUTH',
        status: 'ACTIVE',
        externalAccountId: authResult.externalAccountId,
        externalUsername: authResult.externalUsername,
        accessToken: encryptToken(authResult.accessToken),
        refreshToken: encryptToken(authResult.refreshToken),
        tokenExpiresAt: authResult.tokenExpiresAt,
        capabilities: authResult.capabilities,
        lastAuthAt: new Date(),
        firstImportCompletedAt: null,
      });
    }

    return NextResponse.redirect(new URL(CONNECT_SUCCESS_URL, request.url));
  } catch (err) {
    logger.error('[depop/callback] Unexpected error', { sellerId, error: String(err) });
    return NextResponse.redirect(new URL(CONNECT_FAILURE_URL, request.url));
  }
}
