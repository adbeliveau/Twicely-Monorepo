/**
 * QuickBooks OAuth callback — G10.3
 * GET /api/accounting/quickbooks/callback
 */

import { type NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { db } from '@twicely/db';
import { accountingIntegration } from '@twicely/db/schema';
import { eq, and } from 'drizzle-orm';
import { authorize, sub } from '@twicely/casl';
import { encrypt } from '@twicely/db/encryption';
import { logger } from '@twicely/logger';
import { QuickBooksAdapter } from '@/lib/accounting/quickbooks-adapter';

const CONNECT_SUCCESS_URL = '/my/selling/finances/integrations?connected=quickbooks';
const CONNECT_FAILURE_URL = '/my/selling/finances/integrations?error=auth_failed';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const realmId = searchParams.get('realmId');

  if (!code) {
    logger.warn('[quickbooks/callback] Missing authorization code');
    return NextResponse.redirect(new URL(CONNECT_FAILURE_URL, request.url));
  }

  // Validate OAuth state — CSRF protection
  const cookieStore = await cookies();
  const stateCookie = cookieStore.get('qb_oauth_state')?.value;
  cookieStore.delete('qb_oauth_state');

  if (!stateCookie || !state) {
    logger.warn('[quickbooks/callback] Missing OAuth state — possible CSRF', { state });
    return NextResponse.redirect(new URL(CONNECT_FAILURE_URL, request.url));
  }

  try {
    const stored = JSON.parse(stateCookie) as { state?: string; userId?: string };
    if (stored.state !== state) {
      logger.warn('[quickbooks/callback] OAuth state mismatch — possible CSRF', {
        expected: stored.state,
        got: state,
      });
      return NextResponse.redirect(new URL(CONNECT_FAILURE_URL, request.url));
    }

    // SEC-010: Verify the session user matches who initiated the OAuth flow
    const { session: earlySession } = await authorize();
    if (!earlySession) {
      return NextResponse.redirect(new URL('/auth/login', request.url));
    }
    const earlyUserId = earlySession.delegationId ? earlySession.onBehalfOfSellerId! : earlySession.userId;
    if (stored.userId && stored.userId !== earlyUserId) {
      logger.warn('[quickbooks/callback] OAuth userId mismatch — possible session swap', {
        cookieUserId: stored.userId,
        sessionUserId: earlyUserId,
      });
      return NextResponse.redirect(new URL(CONNECT_FAILURE_URL, request.url));
    }
  } catch {
    logger.warn('[quickbooks/callback] Invalid OAuth state cookie');
    return NextResponse.redirect(new URL(CONNECT_FAILURE_URL, request.url));
  }

  const { session, ability } = await authorize();
  if (!session) {
    return NextResponse.redirect(new URL('/auth/login', request.url));
  }

  const userId = session.delegationId ? session.onBehalfOfSellerId! : session.userId;

  if (!ability.can('create', sub('AccountingIntegration', { userId }))) {
    return NextResponse.redirect(new URL(CONNECT_FAILURE_URL, request.url));
  }

  try {
    const redirectUri = new URL('/api/accounting/quickbooks/callback', request.url).toString();
    const adapter = new QuickBooksAdapter();
    const tokens = await adapter.exchangeCode(code, redirectUri);

    const effectiveRealmId = tokens.realmId ?? realmId ?? '';

    let companyName: string | null = null;
    if (effectiveRealmId) {
      try {
        const info = await adapter.getCompanyInfo(tokens.accessToken, effectiveRealmId);
        companyName = info.name;
      } catch {
        // Non-fatal — proceed without company name
      }
    }

    const encryptedAccess = encrypt(tokens.accessToken);
    const encryptedRefresh = encrypt(tokens.refreshToken);

    const [existing] = await db
      .select({ id: accountingIntegration.id })
      .from(accountingIntegration)
      .where(
        and(
          eq(accountingIntegration.userId, userId),
          eq(accountingIntegration.provider, 'QUICKBOOKS'),
        ),
      )
      .limit(1);

    if (existing) {
      await db
        .update(accountingIntegration)
        .set({
          accessToken: encryptedAccess,
          refreshToken: encryptedRefresh,
          externalAccountId: effectiveRealmId,
          status: 'CONNECTED',
          companyName,
          syncErrorCount: 0,
          updatedAt: new Date(),
        })
        .where(eq(accountingIntegration.id, existing.id));
    } else {
      await db.insert(accountingIntegration).values({
        userId,
        provider: 'QUICKBOOKS',
        accessToken: encryptedAccess,
        refreshToken: encryptedRefresh,
        externalAccountId: effectiveRealmId,
        status: 'CONNECTED',
        companyName,
        syncErrorCount: 0,
      });
    }

    return NextResponse.redirect(new URL(CONNECT_SUCCESS_URL, request.url));
  } catch (err) {
    logger.error('[quickbooks/callback] Unexpected error', { userId, error: String(err) });
    return NextResponse.redirect(new URL(CONNECT_FAILURE_URL, request.url));
  }
}
