/**
 * ShopifyConnector — implements PlatformConnector for Shopify (Tier A, per-store OAuth).
 * Source: H3.1 install prompt §2
 *
 * NOT a 'use server' file — plain TypeScript module.
 * Self-registers at module load: registerConnector(new ShopifyConnector()).
 *
 * Key differences from other connectors:
 * - Per-store OAuth: each seller connects their own {shop}.myshopify.com.
 * - Permanent access tokens (no expiry, no refresh token).
 * - The shop domain is stored as externalAccountId.
 *
 * Auth methods extracted to shopify-auth.ts.
 * Import methods extracted to shopify-import.ts.
 * Crosslist methods extracted to shopify-crosslist.ts.
 */

import { db } from '@twicely/db';
import { platformSetting } from '@twicely/db/schema';
import { eq } from 'drizzle-orm';
import type { PlatformConnector } from '../connector-interface';
import type { CrosslisterAccount } from '../db-types';
import type {
  ExternalChannel,
  ConnectorTier,
  ConnectorCapabilities,
  AuthInput,
  AuthResult,
  PaginatedListings,
  ExternalListing,
  TransformedListing,
  PublishResult,
  UpdateResult,
  DelistResult,
  VerificationResult,
  HealthResult,
  WebhookRegistration,
} from '../types';
import { registerConnector } from '../connector-registry';
import { withDecryptedTokens } from '../token-crypto';
import {
  buildShopifyAuthUrl,
  authenticateShopify,
  refreshShopifyAuth,
  revokeShopifyAuth,
} from './shopify-auth';
import { fetchShopifyProducts, fetchSingleShopifyProduct } from './shopify-import';
import {
  toShopifyProductInput,
  toShopifyPartialInput,
  createShopifyProduct,
  updateShopifyProduct,
  deleteShopifyProduct,
  fetchShopifyProductForVerify,
} from './shopify-crosslist';

const SHOPIFY_CAPABILITIES: ConnectorCapabilities = {
  canImport: true,
  canPublish: true,
  canUpdate: true,
  canDelist: true,
  hasWebhooks: true,
  hasStructuredCategories: true,
  canAutoRelist: false,
  canMakeOffers: false,
  canShare: false,
  maxImagesPerListing: 250,
  maxTitleLength: 255,
  maxDescriptionLength: 65535,
  supportedImageFormats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
};

interface ShopifyConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string;
  apiVersion: string;
}

async function loadShopifyConfig(): Promise<ShopifyConfig> {
  const rows = await db
    .select({ key: platformSetting.key, value: platformSetting.value })
    .from(platformSetting)
    .where(eq(platformSetting.category, 'crosslister'));

  const settingsMap = new Map<string, unknown>(rows.map((r) => [r.key, r.value]));

  return {
    clientId: String(settingsMap.get('crosslister.shopify.clientId') ?? ''),
    clientSecret: String(settingsMap.get('crosslister.shopify.clientSecret') ?? ''),
    redirectUri: String(
      settingsMap.get('crosslister.shopify.redirectUri') ??
        'https://twicely.co/api/crosslister/shopify/callback',
    ),
    scopes: String(
      settingsMap.get('crosslister.shopify.scopes') ??
        'read_products,write_products,read_inventory,write_inventory,read_orders',
    ),
    apiVersion: String(settingsMap.get('crosslister.shopify.apiVersion') ?? '2024-01'),
  };
}

export class ShopifyConnector implements PlatformConnector {
  readonly channel: ExternalChannel = 'SHOPIFY';
  readonly tier: ConnectorTier = 'A';
  readonly version = '1.0.0';
  readonly capabilities: ConnectorCapabilities = SHOPIFY_CAPABILITIES;

  async buildAuthUrl(state: string, shopDomain?: string): Promise<string> {
    if (!shopDomain) {
      throw new Error('ShopifyConnector.buildAuthUrl requires shopDomain');
    }
    const config = await loadShopifyConfig();
    return buildShopifyAuthUrl(config, state, shopDomain);
  }

  async authenticate(credentials: AuthInput): Promise<AuthResult> {
    const config = await loadShopifyConfig();
    return authenticateShopify(config, credentials, SHOPIFY_CAPABILITIES);
  }

  async refreshAuth(account: CrosslisterAccount): Promise<AuthResult> {
    account = withDecryptedTokens(account);
    return refreshShopifyAuth(account, SHOPIFY_CAPABILITIES);
  }

  async revokeAuth(account: CrosslisterAccount): Promise<void> {
    return revokeShopifyAuth(account);
  }

  async fetchListings(account: CrosslisterAccount, cursor?: string): Promise<PaginatedListings> {
    account = withDecryptedTokens(account);
    if (!account.accessToken || !account.externalAccountId) {
      return { listings: [], cursor: null, hasMore: false, totalEstimate: null };
    }
    const config = await loadShopifyConfig();
    return fetchShopifyProducts(
      { apiVersion: config.apiVersion },
      account.externalAccountId,
      account.accessToken,
      cursor,
    );
  }

  async fetchSingleListing(account: CrosslisterAccount, externalId: string): Promise<ExternalListing> {
    account = withDecryptedTokens(account);
    if (!account.accessToken || !account.externalAccountId) {
      throw new Error('No access token or shop domain');
    }
    const config = await loadShopifyConfig();
    return fetchSingleShopifyProduct(
      { apiVersion: config.apiVersion },
      account.externalAccountId,
      account.accessToken,
      externalId,
    );
  }

  async createListing(account: CrosslisterAccount, listing: TransformedListing): Promise<PublishResult> {
    account = withDecryptedTokens(account);
    if (!account.accessToken || !account.externalAccountId) {
      return { success: false, externalId: null, externalUrl: null, error: 'No credentials', retryable: false };
    }
    const config = await loadShopifyConfig();
    const shopDomain = account.externalAccountId;
    const input = toShopifyProductInput(listing);
    const result = await createShopifyProduct(config, shopDomain, account.accessToken, input);
    if (result.success && result.productId) {
      const handle = result.handle;
      const externalUrl = handle
        ? `https://${shopDomain}/products/${handle}`
        : `https://${shopDomain}/admin/products/${result.productId}`;
      return { success: true, externalId: result.productId, externalUrl, retryable: false };
    }
    return { success: false, externalId: null, externalUrl: null, error: result.error, retryable: result.retryable };
  }

  async updateListing(
    account: CrosslisterAccount,
    externalId: string,
    changes: Partial<TransformedListing>,
  ): Promise<UpdateResult> {
    account = withDecryptedTokens(account);
    if (!account.accessToken || !account.externalAccountId) {
      return { success: false, error: 'No credentials', retryable: false };
    }
    const config = await loadShopifyConfig();
    const shopDomain = account.externalAccountId;
    const partialInput = toShopifyPartialInput(changes);
    const result = await updateShopifyProduct(config, shopDomain, account.accessToken, externalId, partialInput);
    return { success: result.success, error: result.error, retryable: result.retryable };
  }

  async delistListing(account: CrosslisterAccount, externalId: string): Promise<DelistResult> {
    account = withDecryptedTokens(account);
    if (!account.accessToken || !account.externalAccountId) {
      return { success: false, error: 'No credentials', retryable: false };
    }
    const config = await loadShopifyConfig();
    const shopDomain = account.externalAccountId;
    const result = await deleteShopifyProduct(config, shopDomain, account.accessToken, externalId);
    return { success: result.success, error: result.error, retryable: result.retryable };
  }

  async verifyListing(account: CrosslisterAccount, externalId: string): Promise<VerificationResult> {
    account = withDecryptedTokens(account);
    if (!account.accessToken || !account.externalAccountId) {
      return { exists: false, status: 'UNKNOWN', priceCents: null, quantity: null, lastModifiedAt: null, diff: null };
    }
    const config = await loadShopifyConfig();
    const shopDomain = account.externalAccountId;
    const result = await fetchShopifyProductForVerify(config, shopDomain, account.accessToken, externalId);
    return {
      exists: result.exists,
      status: result.status,
      priceCents: result.priceCents,
      quantity: result.quantity,
      lastModifiedAt: result.lastModifiedAt,
      diff: null,
    };
  }

  /**
   * Register Shopify webhooks for the given events.
   * Called after successful OAuth to enable real-time sync.
   * Best-effort: failures are logged but do not block the OAuth flow.
   */
  async registerWebhook(
    account: CrosslisterAccount,
    events: string[],
  ): Promise<WebhookRegistration> {
    account = withDecryptedTokens(account);
    if (!account.accessToken || !account.externalAccountId) {
      throw new Error('ShopifyConnector.registerWebhook: no access token or shop domain');
    }

    const config = await loadShopifyConfig();
    const shopDomain = account.externalAccountId;

    // Load webhook callback URL from platform_settings
    const [webhookUrlRow] = await db
      .select({ value: platformSetting.value })
      .from(platformSetting)
      .where(eq(platformSetting.key, 'crosslister.shopify.webhookUrl'))
      .limit(1);

    const callbackUrl =
      typeof webhookUrlRow?.value === 'string'
        ? webhookUrlRow.value
        : 'https://twicely.co/api/crosslister/shopify/webhook';

    const registeredIds: string[] = [];

    for (const event of events) {
      const url = `https://${shopDomain}/admin/api/${config.apiVersion}/webhooks.json`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': account.accessToken,
        },
        body: JSON.stringify({
          webhook: {
            topic: event,
            address: callbackUrl,
            format: 'json',
          },
        }),
      });

      if (response.ok) {
        const data = await response.json() as { webhook?: { id?: number } };
        if (data.webhook?.id) {
          registeredIds.push(String(data.webhook.id));
        }
      } else {
        const errorText = await response.text();
        throw new Error(
          `Shopify webhook registration failed for ${event}: ${response.status} ${errorText}`,
        );
      }
    }

    return {
      webhookId: registeredIds.join(','),
      events,
      callbackUrl,
    };
  }

  async healthCheck(account: CrosslisterAccount): Promise<HealthResult> {
    account = withDecryptedTokens(account);
    if (!account.accessToken) {
      return { healthy: false, latencyMs: 0, error: 'No access token' };
    }
    if (!account.externalAccountId) {
      return { healthy: false, latencyMs: 0, error: 'No shop domain' };
    }

    const config = await loadShopifyConfig();
    const shopDomain = account.externalAccountId;
    const shopUrl = `https://${shopDomain}/admin/api/${config.apiVersion}/shop.json`;

    const start = Date.now();
    try {
      const response = await fetch(shopUrl, {
        headers: { 'X-Shopify-Access-Token': account.accessToken },
      });
      const latencyMs = Date.now() - start;
      if (response.ok) {
        return { healthy: true, latencyMs };
      }
      return { healthy: false, latencyMs, error: `Shopify API returned ${response.status}` };
    } catch (err) {
      return { healthy: false, latencyMs: Date.now() - start, error: String(err) };
    }
  }
}

// Self-register when this module is loaded
registerConnector(new ShopifyConnector());
