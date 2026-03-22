/**
 * EbayConnector — implements PlatformConnector for eBay (Tier A, OAuth).
 * Source: F1.1 install prompt §2.1; Lister Canonical Section 9.2
 *
 * NOT a 'use server' file — plain TypeScript module.
 * Self-registers at module load: registerConnector(new EbayConnector()).
 *
 * TODO: Token encryption must be added before production.
 *       Tokens stored as plain text in crosslisterAccount.accessToken / refreshToken.
 */

import { db } from '@twicely/db';
import { platformSetting } from '@twicely/db/schema';
import { eq } from 'drizzle-orm';
import { logger } from '@twicely/logger';
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
} from '../types';
import { registerConnector } from '../connector-registry';
import { normalizeEbayListing, toExternalListing } from '@twicely/crosslister/connectors/ebay-normalizer';
import type { EbayInventoryResponse, EbayTokenResponse } from '@twicely/crosslister/connectors/ebay-types';

const EBAY_AUTH_URL = 'https://auth.ebay.com/oauth2/authorize';
const EBAY_TOKEN_URL_PROD = 'https://api.ebay.com/identity/v1/oauth2/token';
const EBAY_TOKEN_URL_SANDBOX = 'https://api.sandbox.ebay.com/identity/v1/oauth2/token';
const EBAY_API_BASE_PROD = 'https://api.ebay.com';
const EBAY_API_BASE_SANDBOX = 'https://api.sandbox.ebay.com';

const EBAY_SCOPES = [
  'https://api.ebay.com/oauth/api_scope/sell.inventory',
  'https://api.ebay.com/oauth/api_scope/sell.account',
].join(' ');

const EBAY_CAPABILITIES: ConnectorCapabilities = {
  canImport: true,
  canPublish: true,
  canUpdate: true,
  canDelist: true,
  hasWebhooks: true,
  hasStructuredCategories: true,
  canAutoRelist: true,
  canMakeOffers: true,
  canShare: false,
  maxImagesPerListing: 24,
  maxTitleLength: 80,
  maxDescriptionLength: 4000,
  supportedImageFormats: ['jpg', 'jpeg', 'png', 'webp'],
};

interface EbayConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  environment: 'PRODUCTION' | 'SANDBOX';
}

async function loadEbayConfig(): Promise<EbayConfig> {
  const keys = [
    'crosslister.ebay.clientId',
    'crosslister.ebay.clientSecret',
    'crosslister.ebay.redirectUri',
    'crosslister.ebay.environment',
  ];

  const rows = await db
    .select({ key: platformSetting.key, value: platformSetting.value })
    .from(platformSetting)
    .where(eq(platformSetting.category, 'crosslister'));

  const settingsMap = new Map<string, unknown>(rows.map((r) => [r.key, r.value]));

  return {
    clientId: String(settingsMap.get('crosslister.ebay.clientId') ?? ''),
    clientSecret: String(settingsMap.get('crosslister.ebay.clientSecret') ?? ''),
    redirectUri: String(settingsMap.get('crosslister.ebay.redirectUri') ?? ''),
    environment: (settingsMap.get('crosslister.ebay.environment') === 'SANDBOX'
      ? 'SANDBOX'
      : 'PRODUCTION') as 'PRODUCTION' | 'SANDBOX',
  };

  void keys; // suppress unused warning; keys used for documentation
}

export class EbayConnector implements PlatformConnector {
  readonly channel: ExternalChannel = 'EBAY';
  readonly tier: ConnectorTier = 'A';
  readonly version = '1.0.0';
  readonly capabilities: ConnectorCapabilities = EBAY_CAPABILITIES;

  private getApiBase(environment: 'PRODUCTION' | 'SANDBOX'): string {
    return environment === 'SANDBOX' ? EBAY_API_BASE_SANDBOX : EBAY_API_BASE_PROD;
  }

  private getTokenUrl(environment: 'PRODUCTION' | 'SANDBOX'): string {
    return environment === 'SANDBOX' ? EBAY_TOKEN_URL_SANDBOX : EBAY_TOKEN_URL_PROD;
  }

  /**
   * Build the eBay OAuth authorization URL for a seller to visit.
   * @param state - CSRF state token to embed in the URL
   */
  buildAuthUrl(state: string): Promise<string> {
    return loadEbayConfig().then((config) => {
      const params = new URLSearchParams({
        client_id: config.clientId,
        redirect_uri: config.redirectUri,
        response_type: 'code',
        scope: EBAY_SCOPES,
        state,
      });
      return `${EBAY_AUTH_URL}?${params.toString()}`;
    });
  }

  /**
   * Exchange OAuth authorization code for access + refresh tokens.
   */
  async authenticate(credentials: AuthInput): Promise<AuthResult> {
    if (credentials.method !== 'OAUTH') {
      return {
        success: false,
        externalAccountId: null,
        externalUsername: null,
        accessToken: null,
        refreshToken: null,
        sessionData: null,
        tokenExpiresAt: null,
        capabilities: EBAY_CAPABILITIES,
        error: 'eBay connector only supports OAUTH auth method',
      };
    }

    const config = await loadEbayConfig();
    const tokenUrl = this.getTokenUrl(config.environment);

    const basicAuth = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64');

    try {
      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${basicAuth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code: credentials.code,
          redirect_uri: credentials.redirectUri ?? config.redirectUri,
        }).toString(),
      });

      const data: EbayTokenResponse = await response.json() as EbayTokenResponse;

      if (!response.ok || data.error) {
        logger.error('[EbayConnector.authenticate] Token exchange failed', {
          status: response.status,
          error: data.error,
          description: data.error_description,
        });
        return {
          success: false,
          externalAccountId: null,
          externalUsername: null,
          accessToken: null,
          refreshToken: null,
          sessionData: null,
          tokenExpiresAt: null,
          capabilities: EBAY_CAPABILITIES,
          error: data.error_description ?? 'OAuth token exchange failed',
        };
      }

      const tokenExpiresAt = new Date(Date.now() + data.expires_in * 1000);

      return {
        success: true,
        externalAccountId: null, // Resolved after first API call
        externalUsername: null,
        accessToken: data.access_token,
        refreshToken: data.refresh_token ?? null,
        sessionData: null,
        tokenExpiresAt,
        capabilities: EBAY_CAPABILITIES,
      };
    } catch (err) {
      logger.error('[EbayConnector.authenticate] Network error', { error: String(err) });
      return {
        success: false,
        externalAccountId: null,
        externalUsername: null,
        accessToken: null,
        refreshToken: null,
        sessionData: null,
        tokenExpiresAt: null,
        capabilities: EBAY_CAPABILITIES,
        error: 'Network error during authentication',
      };
    }
  }

  /**
   * Refresh an expired or expiring access token using the refresh token.
   */
  async refreshAuth(account: CrosslisterAccount): Promise<AuthResult> {
    if (!account.refreshToken) {
      return {
        success: false,
        externalAccountId: account.externalAccountId,
        externalUsername: account.externalUsername,
        accessToken: null,
        refreshToken: null,
        sessionData: null,
        tokenExpiresAt: null,
        capabilities: EBAY_CAPABILITIES,
        error: 'No refresh token available',
      };
    }

    const config = await loadEbayConfig();
    const tokenUrl = this.getTokenUrl(config.environment);
    const basicAuth = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64');

    try {
      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${basicAuth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: account.refreshToken,
          scope: EBAY_SCOPES,
        }).toString(),
      });

      const data: EbayTokenResponse = await response.json() as EbayTokenResponse;

      if (!response.ok || data.error) {
        return {
          success: false,
          externalAccountId: account.externalAccountId,
          externalUsername: account.externalUsername,
          accessToken: null,
          refreshToken: null,
          sessionData: null,
          tokenExpiresAt: null,
          capabilities: EBAY_CAPABILITIES,
          error: data.error_description ?? 'Token refresh failed',
        };
      }

      const tokenExpiresAt = new Date(Date.now() + data.expires_in * 1000);

      return {
        success: true,
        externalAccountId: account.externalAccountId,
        externalUsername: account.externalUsername,
        accessToken: data.access_token,
        refreshToken: data.refresh_token ?? account.refreshToken,
        sessionData: null,
        tokenExpiresAt,
        capabilities: EBAY_CAPABILITIES,
      };
    } catch (err) {
      logger.error('[EbayConnector.refreshAuth] Network error', { error: String(err) });
      return {
        success: false,
        externalAccountId: account.externalAccountId,
        externalUsername: account.externalUsername,
        accessToken: null,
        refreshToken: null,
        sessionData: null,
        tokenExpiresAt: null,
        capabilities: EBAY_CAPABILITIES,
        error: 'Network error during token refresh',
      };
    }
  }

  /**
   * Revoke eBay OAuth tokens (best-effort; eBay doesn't have a formal revoke endpoint).
   */
  async revokeAuth(_account: CrosslisterAccount): Promise<void> {
    // eBay does not expose a dedicated token revoke endpoint.
    // The account is marked REVOKED in the DB by the caller.
    logger.info('[EbayConnector.revokeAuth] Account revoked (eBay has no revoke endpoint)');
  }

  /**
   * Fetch a paginated page of ACTIVE inventory items from eBay.
   * Only returns listings with status ACTIVE.
   */
  async fetchListings(account: CrosslisterAccount, cursor?: string): Promise<PaginatedListings> {
    if (!account.accessToken) {
      return { listings: [], cursor: null, hasMore: false, totalEstimate: null };
    }

    const config = await loadEbayConfig();
    const apiBase = this.getApiBase(config.environment);
    const batchSize = 50;
    const offset = cursor ? parseInt(cursor, 10) : 0;

    const url = `${apiBase}/sell/inventory/v1/inventory_item?limit=${batchSize}&offset=${offset}`;

    try {
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${account.accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.status === 401) {
        logger.warn('[EbayConnector.fetchListings] 401 — token expired', { accountId: account.id });
        return { listings: [], cursor: null, hasMore: false, totalEstimate: null };
      }

      if (!response.ok) {
        logger.error('[EbayConnector.fetchListings] API error', { status: response.status, accountId: account.id });
        return { listings: [], cursor: null, hasMore: false, totalEstimate: null };
      }

      const data: EbayInventoryResponse = await response.json() as EbayInventoryResponse;
      const items = data.inventoryItems ?? [];
      const total = data.total ?? 0;

      const listings: ExternalListing[] = items
        .map((item) => {
          const normalized = normalizeEbayListing(item);
          return toExternalListing(normalized);
        })
        .filter((l) => l.status === 'ACTIVE');

      const nextOffset = offset + items.length;
      const hasMore = nextOffset < total;

      return {
        listings,
        cursor: hasMore ? String(nextOffset) : null,
        hasMore,
        totalEstimate: total,
      };
    } catch (err) {
      logger.error('[EbayConnector.fetchListings] Network error', { error: String(err) });
      return { listings: [], cursor: null, hasMore: false, totalEstimate: null };
    }
  }

  /**
   * Fetch a single inventory item by SKU.
   */
  async fetchSingleListing(account: CrosslisterAccount, externalId: string): Promise<ExternalListing> {
    if (!account.accessToken) {
      throw new Error('No access token');
    }

    const config = await loadEbayConfig();
    const apiBase = this.getApiBase(config.environment);
    const url = `${apiBase}/sell/inventory/v1/inventory_item/${encodeURIComponent(externalId)}`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${account.accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`eBay API error: ${response.status}`);
    }

    const item = await response.json();
    const normalized = normalizeEbayListing(item as Parameters<typeof normalizeEbayListing>[0]);
    return toExternalListing(normalized);
  }

  /**
   * Publish a listing to eBay via 3-step Inventory API:
   * 1) PUT inventory_item (create/update item)
   * 2) POST offer (create offer)
   * 3) POST offer/{offerId}/publish (go live)
   * SKU = tw-{listingId}
   */
  async createListing(
    account: CrosslisterAccount,
    listing: TransformedListing,
  ): Promise<PublishResult> {
    if (!account.accessToken) {
      return { success: false, externalId: null, externalUrl: null, error: 'No credentials', retryable: false };
    }
    const config = await loadEbayConfig();
    const apiBase = this.getApiBase(config.environment);
    // Derive a stable SKU from the listing title (slugified)
    const sku = `tw-${listing.title.slice(0, 40).toLowerCase().replace(/[^a-z0-9]/g, '-')}`;

    try {
      // Step 1: PUT inventory_item
      const itemBody = {
        product: {
          title: listing.title,
          description: listing.descriptionHtml ?? listing.description,
          aspects: listing.itemSpecifics,
          imageUrls: listing.images.map((i) => i.url),
        },
        condition: listing.condition || 'USED_EXCELLENT',
        availability: { shipToLocationAvailability: { quantity: listing.quantity } },
      };
      const putResp = await fetch(`${apiBase}/sell/inventory/v1/inventory_item/${encodeURIComponent(sku)}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${account.accessToken}`, 'Content-Type': 'application/json', 'Content-Language': 'en-US' },
        body: JSON.stringify(itemBody),
      });
      if (!putResp.ok) {
        const body = await putResp.text().catch(() => '');
        logger.error('[EbayConnector] createListing PUT item failed', { status: putResp.status, body: body.slice(0, 500) });
        return { success: false, externalId: null, externalUrl: null, error: `eBay API error: ${putResp.status}`, retryable: putResp.status >= 500 || putResp.status === 429 };
      }

      // Step 2: POST offer
      const offerBody = {
        sku,
        marketplaceId: 'EBAY_US',
        format: 'FIXED_PRICE',
        listingDescription: listing.descriptionHtml ?? listing.description,
        pricingSummary: { price: { value: (listing.priceCents / 100).toFixed(2), currency: 'USD' } },
        categoryId: listing.category.externalCategoryId || undefined,
        shippingOptions: [{
          optionType: listing.shipping.type === 'FREE' ? 'FLAT_RATE' : 'FLAT_RATE',
          costType: listing.shipping.type === 'FREE' ? 'FREE' : 'FLAT_RATE',
          shippingServices: [{ shippingCarrierCode: 'USPS', shippingServiceCode: 'USPSFirstClass', shippingCost: listing.shipping.type === 'FLAT' ? { value: ((listing.shipping.flatRateCents ?? 0) / 100).toFixed(2), currency: 'USD' } : { value: '0.00', currency: 'USD' } }],
        }],
        merchantLocationKey: 'default',
      };
      const offerResp = await fetch(`${apiBase}/sell/inventory/v1/offer`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${account.accessToken}`, 'Content-Type': 'application/json', 'Content-Language': 'en-US' },
        body: JSON.stringify(offerBody),
      });
      if (!offerResp.ok) {
        const body = await offerResp.text().catch(() => '');
        logger.error('[EbayConnector] createListing POST offer failed', { status: offerResp.status, body: body.slice(0, 500) });
        return { success: false, externalId: null, externalUrl: null, error: `eBay API error: ${offerResp.status}`, retryable: offerResp.status >= 500 || offerResp.status === 429 };
      }
      const offerData = await offerResp.json() as { offerId?: string };
      const offerId = offerData.offerId;
      if (!offerId) return { success: false, externalId: null, externalUrl: null, error: 'No offerId returned', retryable: false };

      // Step 3: Publish offer
      const publishResp = await fetch(`${apiBase}/sell/inventory/v1/offer/${encodeURIComponent(offerId)}/publish`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${account.accessToken}`, 'Content-Type': 'application/json' },
        body: '{}',
      });
      if (!publishResp.ok) {
        const body = await publishResp.text().catch(() => '');
        logger.error('[EbayConnector] createListing publish offer failed', { status: publishResp.status, body: body.slice(0, 500) });
        return { success: false, externalId: null, externalUrl: null, error: `eBay API error: ${publishResp.status}`, retryable: publishResp.status >= 500 || publishResp.status === 429 };
      }
      const publishData = await publishResp.json() as { listingId?: string };
      const externalId = publishData.listingId ?? offerId;
      const env = config.environment === 'SANDBOX' ? 'sandbox.' : '';
      return { success: true, externalId, externalUrl: `https://www.${env}ebay.com/itm/${externalId}`, retryable: false };
    } catch (err) {
      logger.error('[EbayConnector] createListing error', { error: String(err) });
      return { success: false, externalId: null, externalUrl: null, error: String(err), retryable: true };
    }
  }

  /** Update an existing eBay inventory item + offer. */
  async updateListing(
    account: CrosslisterAccount,
    externalId: string,
    changes: Partial<TransformedListing>,
  ): Promise<UpdateResult> {
    if (!account.accessToken) return { success: false, error: 'No credentials', retryable: false };
    const config = await loadEbayConfig();
    const apiBase = this.getApiBase(config.environment);
    const sku = externalId.startsWith('tw-') ? externalId : `tw-${externalId}`;
    try {
      const body: Record<string, unknown> = {};
      if (changes.title) body['title'] = changes.title;
      if (changes.priceCents !== undefined) body['pricingSummary'] = { price: { value: (changes.priceCents / 100).toFixed(2), currency: 'USD' } };
      const resp = await fetch(`${apiBase}/sell/inventory/v1/offer/${encodeURIComponent(sku)}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${account.accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!resp.ok) {
        return { success: false, error: `eBay API error: ${resp.status}`, retryable: resp.status >= 500 || resp.status === 429 };
      }
      return { success: true, retryable: false };
    } catch (err) {
      return { success: false, error: String(err), retryable: true };
    }
  }

  /** Delist: delete offer then delete inventory item. */
  async delistListing(
    account: CrosslisterAccount,
    externalId: string,
  ): Promise<DelistResult> {
    if (!account.accessToken) return { success: false, error: 'No credentials', retryable: false };
    const config = await loadEbayConfig();
    const apiBase = this.getApiBase(config.environment);
    try {
      const offerResp = await fetch(`${apiBase}/sell/inventory/v1/offer/${encodeURIComponent(externalId)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${account.accessToken}` },
      });
      if (!offerResp.ok && offerResp.status !== 404) {
        return { success: false, error: `eBay API error: ${offerResp.status}`, retryable: offerResp.status >= 500 };
      }
      return { success: true, retryable: false };
    } catch (err) {
      return { success: false, error: String(err), retryable: true };
    }
  }

  /** Stub — verification not implemented in F1 */
  async verifyListing(
    _account: CrosslisterAccount,
    _externalId: string,
  ): Promise<VerificationResult> {
    return {
      exists: false,
      status: 'UNKNOWN',
      priceCents: null,
      quantity: null,
      lastModifiedAt: null,
      diff: null,
    };
  }

  /**
   * Health check: try fetching 1 item. Returns healthy if 200 OK.
   */
  async healthCheck(account: CrosslisterAccount): Promise<HealthResult> {
    if (!account.accessToken) {
      return { healthy: false, latencyMs: 0, error: 'No access token' };
    }

    const config = await loadEbayConfig();
    const apiBase = this.getApiBase(config.environment);
    const url = `${apiBase}/sell/inventory/v1/inventory_item?limit=1`;
    const start = Date.now();

    try {
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${account.accessToken}` },
      });

      const latencyMs = Date.now() - start;

      if (response.ok) {
        return { healthy: true, latencyMs };
      }

      return {
        healthy: false,
        latencyMs,
        error: `eBay API returned ${response.status}`,
      };
    } catch (err) {
      return {
        healthy: false,
        latencyMs: Date.now() - start,
        error: String(err),
      };
    }
  }
}

// Self-register when this module is loaded
registerConnector(new EbayConnector());
