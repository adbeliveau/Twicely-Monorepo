/**
 * Shopify OAuth callback route — H3.1
 * GET /api/crosslister/shopify/callback
 *
 * Handles the OAuth authorization code exchange after the seller
 * approves access on Shopify's OAuth install page.
 *
 * Key differences from other connector callbacks:
 * - Shopify includes `shop` and `hmac` params in the callback.
 * - HMAC-SHA256 verification prevents forged/tampered callbacks.
 * - The shop domain (externalAccountId) comes from the `shop` query param.
 * - Tokens are permanent — no tokenExpiresAt, no refreshToken.
 *
 * Source: H3.1 install prompt §7
 */

import { type NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { auth } from '@twicely/auth/server';
import { db } from '@twicely/db';
import { crosslisterAccount, platformSetting } from '@twicely/db/schema';
import { eq, and } from 'drizzle-orm';
import '@/lib/crosslister/connectors'; // Ensure all connectors are registered
import { ShopifyConnector } from '@twicely/crosslister/connectors/shopify-connector';
import { logger } from '@twicely/logger';
import { defineAbilitiesFor, sub } from '@twicely/casl';
import { createHmac } from 'crypto';

const CONNECT_SUCCESS_URL = '/my/selling/crosslist/connect?connected=shopify';
const CONNECT_FAILURE_URL = '/my/selling/crosslist/connect?error=auth_failed';

/**
 * Verify Shopify's HMAC signature on the callback query parameters.
 * Algorithm: HMAC-SHA256 over all query params except `hmac`, sorted alphabetically.
 * Source: Shopify Developer documentation — OAuth HMAC verification.
 *
 * NOT exported — must not become an unintended server action.
 */
function verifyShopifyHmac(query: URLSearchParams, secret: string): boolean {
  const providedHmac = query.get('hmac');
  if (!providedHmac) return false;

  // Build sorted param string excluding `hmac`
  const params: string[] = [];
  query.forEach((value, key) => {
    if (key !== 'hmac') {
      params.push(`${key}=${value}`);
    }
  });
  params.sort();
  const message = params.join('&');

  const computed = createHmac('sha256', secret).update(message).digest('hex');

  // Constant-time comparison to prevent timing attacks
  if (computed.length !== providedHmac.length) return false;
  let diff = 0;
  for (let i = 0; i < computed.length; i++) {
    diff |= computed.charCodeAt(i) ^ providedHmac.charCodeAt(i);
  }
  return diff === 0;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const shop = searchParams.get('shop');

  if (!code || !shop) {
    logger.warn('[shopify/callback] Missing code or shop param');
    return NextResponse.redirect(new URL(CONNECT_FAILURE_URL, request.url));
  }

  // Load client secret from platform_settings for HMAC verification
  let clientSecret = '';
  try {
    const [secretRow] = await db
      .select({ value: platformSetting.value })
      .from(platformSetting)
      .where(eq(platformSetting.key, 'crosslister.shopify.clientSecret'))
      .limit(1);
    clientSecret = typeof secretRow?.value === 'string' ? secretRow.value : '';
  } catch (err) {
    logger.error('[shopify/callback] Failed to load client secret', { error: String(err) });
    return NextResponse.redirect(new URL(CONNECT_FAILURE_URL, request.url));
  }

  // Verify HMAC signature — reject tampered callbacks
  if (!verifyShopifyHmac(searchParams, clientSecret)) {
    logger.warn('[shopify/callback] HMAC verification failed');
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
    const connector = new ShopifyConnector();
    // Pass shop domain via credentials.state for use in token exchange
    const authResult = await connector.authenticate({
      method: 'OAUTH',
      code,
      redirectUri: '', // loaded from platform_settings inside connector
      state: shop,
    });

    if (!authResult.success || !authResult.accessToken) {
      logger.error('[shopify/callback] Auth failed', { sellerId, error: authResult.error });
      return NextResponse.redirect(new URL(CONNECT_FAILURE_URL, request.url));
    }

    // Upsert crosslisterAccount row — explicit field mapping (no request body spreading)
    const [existing] = await db
      .select({ id: crosslisterAccount.id })
      .from(crosslisterAccount)
      .where(
        and(
          eq(crosslisterAccount.sellerId, sellerId),
          eq(crosslisterAccount.channel, 'SHOPIFY'),
        ),
      )
      .limit(1);

    if (existing) {
      // Update existing account (re-connect flow)
      await db
        .update(crosslisterAccount)
        .set({
          status: 'ACTIVE',
          externalAccountId: authResult.externalAccountId,
          externalUsername: authResult.externalUsername,
          accessToken: authResult.accessToken,
          refreshToken: null,        // Shopify tokens are permanent
          tokenExpiresAt: null,      // No expiry
          capabilities: authResult.capabilities,
          lastAuthAt: new Date(),
          firstImportCompletedAt: null,
          updatedAt: new Date(),
        })
        .where(eq(crosslisterAccount.id, existing.id));
    } else {
      // Create new account row
      await db.insert(crosslisterAccount).values({
        sellerId,
        channel: 'SHOPIFY',
        authMethod: 'OAUTH',
        status: 'ACTIVE',
        externalAccountId: authResult.externalAccountId,
        externalUsername: authResult.externalUsername,
        accessToken: authResult.accessToken,
        refreshToken: null,          // Shopify tokens are permanent
        tokenExpiresAt: null,        // No expiry
        capabilities: authResult.capabilities,
        lastAuthAt: new Date(),
        firstImportCompletedAt: null,
      });
    }

    // Best-effort webhook registration after successful OAuth (H3.4)
    // Load webhook topics from platform_settings, fall back to defaults
    let webhookTopics: string[] = [
      'products/create',
      'products/update',
      'products/delete',
      'orders/create',
      'orders/paid',
      'app/uninstalled',
    ];
    try {
      const [topicsRow] = await db
        .select({ value: platformSetting.value })
        .from(platformSetting)
        .where(eq(platformSetting.key, 'crosslister.shopify.webhookTopics'))
        .limit(1);
      if (typeof topicsRow?.value === 'string' && topicsRow.value) {
        webhookTopics = topicsRow.value.split(',').map((t) => t.trim()).filter(Boolean);
      }
    } catch {
      // Ignore — use defaults
    }

    // Fetch the upserted account to pass to registerWebhook
    try {
      const [accountRow] = await db
        .select({ id: crosslisterAccount.id })
        .from(crosslisterAccount)
        .where(
          and(
            eq(crosslisterAccount.sellerId, sellerId),
            eq(crosslisterAccount.channel, 'SHOPIFY'),
          ),
        )
        .limit(1);

      if (accountRow && authResult.accessToken && authResult.externalAccountId) {
        const freshConnector = new ShopifyConnector();
        await freshConnector.registerWebhook(
          {
            id: accountRow.id,
            sellerId,
            channel: 'SHOPIFY',
            authMethod: 'OAUTH',
            status: 'ACTIVE',
            externalAccountId: authResult.externalAccountId,
            externalUsername: authResult.externalUsername,
            accessToken: authResult.accessToken,
            refreshToken: null,
            sessionData: null,
            tokenExpiresAt: null,
            lastAuthAt: new Date(),
            lastSyncAt: null,
            lastErrorAt: null,
            lastError: null,
            consecutiveErrors: 0,
            capabilities: JSON.parse(JSON.stringify(authResult.capabilities)) as Record<string, unknown>,
            firstImportCompletedAt: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          webhookTopics,
        );
        logger.info('[shopify/callback] Webhook registration complete', { sellerId });
      }
    } catch (webhookErr) {
      // Best-effort — log but do not fail the OAuth flow
      logger.warn('[shopify/callback] Webhook registration failed (best-effort)', {
        sellerId,
        error: String(webhookErr),
      });
    }

    return NextResponse.redirect(new URL(CONNECT_SUCCESS_URL, request.url));
  } catch (err) {
    logger.error('[shopify/callback] Unexpected error', { sellerId, error: String(err) });
    return NextResponse.redirect(new URL(CONNECT_FAILURE_URL, request.url));
  }
}
