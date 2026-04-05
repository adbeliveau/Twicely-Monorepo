/**
 * Xero OAuth authorization start — G10.3
 * GET /api/accounting/xero/authorize
 */

import { type NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { authorize, sub } from '@twicely/casl';
import { logger } from '@twicely/logger';
import { randomBytes } from 'crypto';
import { XeroAdapter } from '@/lib/accounting/xero-adapter';
import { getFinanceTier } from '@/lib/queries/finance-center';
import { getPlatformSetting } from '@/lib/queries/platform-settings';

const CONNECT_FAILURE_URL = '/my/selling/finances/integrations?error=auth_failed';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { session, ability } = await authorize();

  if (!session) {
    return NextResponse.redirect(new URL('/auth/login', request.url));
  }

  const userId = session.delegationId ? session.onBehalfOfSellerId! : session.userId;

  if (!ability.can('create', sub('AccountingIntegration', { userId }))) {
    return NextResponse.redirect(new URL(CONNECT_FAILURE_URL, request.url));
  }

  const financeTier = await getFinanceTier(userId);
  if (financeTier !== 'PRO') {
    return NextResponse.redirect(
      new URL('/my/selling/finances/integrations?error=pro_required', request.url),
    );
  }

  const enabled = await getPlatformSetting<boolean>('accounting.xero.enabled', false);
  if (!enabled) {
    logger.warn('[xero/authorize] Xero integration not enabled');
    return NextResponse.redirect(new URL(CONNECT_FAILURE_URL, request.url));
  }

  try {
    const state = randomBytes(16).toString('hex');
    const redirectUri = new URL('/api/accounting/xero/callback', request.url).toString();

    const adapter = new XeroAdapter();
    const authUrl = await adapter.getAuthorizationUrl(state, redirectUri);

    const cookieStore = await cookies();
    cookieStore.set('accounting_oauth_state', JSON.stringify({ state, userId }), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600,
      path: '/',
    });

    return NextResponse.redirect(authUrl);
  } catch (err) {
    logger.error('[xero/authorize] Failed to build auth URL', { userId, error: String(err) });
    return NextResponse.redirect(new URL(CONNECT_FAILURE_URL, request.url));
  }
}
