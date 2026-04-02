/**
 * WhatnotConnector — implements PlatformConnector for Whatnot (Tier B, OAuth + GraphQL).
 * Source: H2.1 install prompt §2.2
 *
 * NOT a 'use server' file — plain TypeScript module.
 * Self-registers at module load: registerConnector(new WhatnotConnector()).
 *
 * Key differences from other Tier B connectors:
 * - GraphQL API (not REST) for all data operations.
 * - Environment-aware URLs (production vs staging).
 * - Refresh tokens are invalidated on use — new token from every refresh response MUST be stored.
 *
 * H2.1 scope: OAuth connection only. Listing import/export methods are stubs for H2.2.
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
import { withDecryptedTokens } from '../token-crypto';
import { executeGraphQL } from './whatnot-graphql';
import { toWhatnotInput, toWhatnotPartialInput } from './whatnot-transform';
import { WhatnotListingSchema } from './whatnot-schemas';
import { normalizeWhatnotListing, toExternalListing, parseMoneyToCents } from './whatnot-normalizer';
import type {
  WhatnotTokenResponse,
  WhatnotUserProfile,
  WhatnotGraphQLResponse,
  WhatnotListingsResponse,
  WhatnotListingCreateResponse,
  WhatnotListingPublishResponse,
  WhatnotListingUpdateResponse,
  WhatnotListingUnpublishResponse,
  WhatnotSingleListingResponse,
} from './whatnot-types';

const WHATNOT_CAPABILITIES: ConnectorCapabilities = {
  canImport: true,
  canPublish: true,        // BIN listings only (H2.2)
  canUpdate: true,
  canDelist: true,
  hasWebhooks: true,       // H2.3: sale webhook handler
  hasStructuredCategories: true,  // productTaxonomyNode
  canAutoRelist: false,
  canMakeOffers: false,
  canShare: false,
  maxImagesPerListing: 10,
  maxTitleLength: 200,     // Whatnot product title limit
  maxDescriptionLength: 5000,
  supportedImageFormats: ['jpg', 'jpeg', 'png', 'webp'],
};

interface WhatnotConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  environment: string; // 'PRODUCTION' or 'STAGING'
}

async function loadWhatnotConfig(): Promise<WhatnotConfig> {
  const rows = await db
    .select({ key: platformSetting.key, value: platformSetting.value })
    .from(platformSetting)
    .where(eq(platformSetting.category, 'crosslister'));

  const settingsMap = new Map<string, unknown>(rows.map((r) => [r.key, r.value]));

  return {
    clientId: String(settingsMap.get('crosslister.whatnot.clientId') ?? ''),
    clientSecret: String(settingsMap.get('crosslister.whatnot.clientSecret') ?? ''),
    redirectUri: String(
      settingsMap.get('crosslister.whatnot.redirectUri') ??
        'https://twicely.co/api/crosslister/whatnot/callback',
    ),
    environment: String(settingsMap.get('crosslister.whatnot.environment') ?? 'PRODUCTION'),
  };
}

function getBaseUrl(environment: string): string {
  return environment === 'STAGING'
    ? 'https://api.stage.whatnot.com/seller-api'
    : 'https://api.whatnot.com/seller-api';
}

export class WhatnotConnector implements PlatformConnector {
  readonly channel: ExternalChannel = 'WHATNOT';
  readonly tier: ConnectorTier = 'B';
  readonly version = '1.0.0';
  readonly capabilities: ConnectorCapabilities = WHATNOT_CAPABILITIES;

  /**
   * Build the Whatnot OAuth authorization URL for a seller to visit.
   */
  async buildAuthUrl(state: string): Promise<string> {
    const config = await loadWhatnotConfig();
    const baseUrl = getBaseUrl(config.environment);
    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      response_type: 'code',
      scope: 'read:inventory write:inventory read:orders',
      state,
    });
    return `${baseUrl}/rest/oauth/authorize?${params.toString()}`;
  }

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
        capabilities: WHATNOT_CAPABILITIES,
        error: 'Whatnot connector only supports OAUTH auth method',
      };
    }

    const config = await loadWhatnotConfig();
    const baseUrl = getBaseUrl(config.environment);
    const tokenUrl = `${baseUrl}/rest/oauth/token`;

    try {
      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          client_id: config.clientId,
          client_secret: config.clientSecret,
          code: credentials.code,
          redirect_uri: credentials.redirectUri ?? config.redirectUri,
        }).toString(),
      });

      const data = await response.json() as WhatnotTokenResponse;

      if (!response.ok || data.error) {
        logger.error('[WhatnotConnector.authenticate] Token exchange failed', {
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
          capabilities: WHATNOT_CAPABILITIES,
          error: data.error_description ?? 'OAuth token exchange failed',
        };
      }

      const tokenExpiresAt = new Date(Date.now() + data.expires_in * 1000);

      // Fetch user profile via GraphQL me query
      let externalAccountId: string | null = null;
      let externalUsername: string | null = null;
      try {
        const graphqlUrl = `${baseUrl}/graphql`;
        const profileResponse = await fetch(graphqlUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${data.access_token}`,
          },
          body: JSON.stringify({ query: 'query { me { id username } }' }),
        });
        if (profileResponse.ok) {
          const profileData = await profileResponse.json() as WhatnotGraphQLResponse<{ me: WhatnotUserProfile }>;
          if (profileData.data?.me) {
            externalAccountId = profileData.data.me.id;
            externalUsername = profileData.data.me.username;
          }
        }
      } catch (profileErr) {
        logger.warn('[WhatnotConnector.authenticate] Failed to fetch profile', { error: String(profileErr) });
      }

      return {
        success: true,
        externalAccountId,
        externalUsername,
        accessToken: data.access_token,
        refreshToken: data.refresh_token ?? null,
        sessionData: null,
        tokenExpiresAt,
        capabilities: WHATNOT_CAPABILITIES,
      };
    } catch (err) {
      logger.error('[WhatnotConnector.authenticate] Network error', { error: String(err) });
      return {
        success: false,
        externalAccountId: null,
        externalUsername: null,
        accessToken: null,
        refreshToken: null,
        sessionData: null,
        tokenExpiresAt: null,
        capabilities: WHATNOT_CAPABILITIES,
        error: 'Network error during authentication',
      };
    }
  }

  async refreshAuth(account: CrosslisterAccount): Promise<AuthResult> {
    account = withDecryptedTokens(account);
    if (!account.refreshToken) {
      return {
        success: false,
        externalAccountId: account.externalAccountId,
        externalUsername: account.externalUsername,
        accessToken: null,
        refreshToken: null,
        sessionData: null,
        tokenExpiresAt: null,
        capabilities: WHATNOT_CAPABILITIES,
        error: 'No refresh token available',
      };
    }

    const config = await loadWhatnotConfig();
    const baseUrl = getBaseUrl(config.environment);
    const tokenUrl = `${baseUrl}/rest/oauth/token`;

    try {
      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          client_id: config.clientId,
          client_secret: config.clientSecret,
          refresh_token: account.refreshToken,
        }).toString(),
      });

      const data = await response.json() as WhatnotTokenResponse;

      if (!response.ok || data.error) {
        return {
          success: false,
          externalAccountId: account.externalAccountId,
          externalUsername: account.externalUsername,
          accessToken: null,
          refreshToken: null,
          sessionData: null,
          tokenExpiresAt: null,
          capabilities: WHATNOT_CAPABILITIES,
          error: data.error_description ?? 'Token refresh failed',
        };
      }

      const tokenExpiresAt = new Date(Date.now() + data.expires_in * 1000);

      // Whatnot invalidates used refresh tokens — MUST store the new one from the response.
      return {
        success: true,
        externalAccountId: account.externalAccountId,
        externalUsername: account.externalUsername,
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        sessionData: null,
        tokenExpiresAt,
        capabilities: WHATNOT_CAPABILITIES,
      };
    } catch (err) {
      logger.error('[WhatnotConnector.refreshAuth] Network error', { error: String(err) });
      return {
        success: false,
        externalAccountId: account.externalAccountId,
        externalUsername: account.externalUsername,
        accessToken: null,
        refreshToken: null,
        sessionData: null,
        tokenExpiresAt: null,
        capabilities: WHATNOT_CAPABILITIES,
        error: 'Network error during token refresh',
      };
    }
  }

  async revokeAuth(_account: CrosslisterAccount): Promise<void> {
    logger.info('[WhatnotConnector.revokeAuth] Account revoked (no revoke endpoint available)');
  }

  async fetchListings(account: CrosslisterAccount, cursor?: string): Promise<PaginatedListings> {
    account = withDecryptedTokens(account);
    if (!account.accessToken) {
      return { listings: [], cursor: null, hasMore: false, totalEstimate: null };
    }

    const config = await loadWhatnotConfig();

    const query = `
      query FetchListings($first: Int, $after: String) {
        listings(first: $first, after: $after) {
          nodes {
            id title description
            price { amount currencyCode }
            status
            media { url type }
            product {
              id title
              variants { id title price { amount currencyCode } inventoryQuantity }
            }
            createdAt updatedAt
          }
          pageInfo { hasNextPage endCursor }
        }
      }
    `;

    try {
      const result = await executeGraphQL<WhatnotListingsResponse>({
        accessToken: account.accessToken,
        environment: config.environment,
        query,
        variables: { first: 50, after: cursor ?? null },
      });

      if (result.status === 401) {
        logger.warn('[WhatnotConnector.fetchListings] 401 — token expired, caller must refresh');
        return { listings: [], cursor: null, hasMore: false, totalEstimate: null };
      }

      if (result.errors?.length || !result.data) {
        logger.error('[WhatnotConnector.fetchListings] GraphQL errors', { errors: result.errors });
        return { listings: [], cursor: null, hasMore: false, totalEstimate: null };
      }

      const nodes = result.data.listings.nodes;
      const pageInfo = result.data.listings.pageInfo;

      const listings: ExternalListing[] = [];
      for (const node of nodes) {
        const parsed = WhatnotListingSchema.safeParse(node);
        if (!parsed.success) {
          logger.warn('[WhatnotConnector.fetchListings] Invalid listing, skipping', {
            id: String(node.id),
            error: parsed.error.message,
          });
          continue;
        }
        const normalized = normalizeWhatnotListing(node);
        if (normalized.status !== 'ACTIVE') continue;
        listings.push(toExternalListing(normalized));
      }

      return {
        listings,
        cursor: pageInfo.endCursor ?? null,
        hasMore: pageInfo.hasNextPage,
        totalEstimate: null,
      };
    } catch (err) {
      logger.error('[WhatnotConnector.fetchListings] Unexpected error', { error: String(err) });
      return { listings: [], cursor: null, hasMore: false, totalEstimate: null };
    }
  }

  async fetchSingleListing(account: CrosslisterAccount, externalId: string): Promise<ExternalListing> {
    account = withDecryptedTokens(account);
    if (!account.accessToken) {
      throw new Error('No access token');
    }

    const config = await loadWhatnotConfig();

    const query = `
      query FetchListing($id: ID!) {
        listing(id: $id) {
          id title description
          price { amount currencyCode }
          status
          media { url type }
          product {
            id title
            variants { id title price { amount currencyCode } inventoryQuantity }
          }
          createdAt updatedAt
        }
      }
    `;

    const result = await executeGraphQL<WhatnotSingleListingResponse>({
      accessToken: account.accessToken,
      environment: config.environment,
      query,
      variables: { id: externalId },
    });

    if (result.errors?.length || !result.data?.listing) {
      throw new Error('Whatnot listing not found');
    }

    const parsed = WhatnotListingSchema.safeParse(result.data.listing);
    if (!parsed.success) {
      throw new Error(`Invalid listing data: ${parsed.error.message}`);
    }

    return toExternalListing(normalizeWhatnotListing(result.data.listing));
  }

  async createListing(account: CrosslisterAccount, listing: TransformedListing): Promise<PublishResult> {
    account = withDecryptedTokens(account);
    if (!account.accessToken) {
      return { success: false, externalId: null, externalUrl: null, error: 'No credentials', retryable: false };
    }

    const config = await loadWhatnotConfig();
    const input = toWhatnotInput(listing);

    const createMutation = `
      mutation CreateListing($input: ListingInput!) {
        listingCreate(input: $input) {
          listing { id title status }
          userErrors { field message }
        }
      }
    `;

    try {
      const createResult = await executeGraphQL<WhatnotListingCreateResponse>({
        accessToken: account.accessToken,
        environment: config.environment,
        query: createMutation,
        variables: { input },
      });

      if (createResult.status === 429 || createResult.status >= 500) {
        return { success: false, externalId: null, externalUrl: null, error: `HTTP ${createResult.status}`, retryable: true };
      }
      if (createResult.status >= 400 && createResult.status !== 429) {
        return { success: false, externalId: null, externalUrl: null, error: `HTTP ${createResult.status}`, retryable: false };
      }

      const createData = createResult.data?.listingCreate;
      if (!createData) {
        return { success: false, externalId: null, externalUrl: null, error: 'No response data', retryable: true };
      }

      if (createData.userErrors.length > 0) {
        return {
          success: false,
          externalId: null,
          externalUrl: null,
          error: createData.userErrors[0]?.message ?? 'Create failed',
          retryable: false,
        };
      }

      const listingId = createData.listing?.id;
      if (!listingId) {
        return { success: false, externalId: null, externalUrl: null, error: 'No listing ID returned', retryable: true };
      }

      // Step 2: publish the draft
      const publishMutation = `
        mutation PublishListing($id: ID!) {
          listingPublish(id: $id) {
            listing { id status }
            userErrors { field message }
          }
        }
      `;

      const publishResult = await executeGraphQL<WhatnotListingPublishResponse>({
        accessToken: account.accessToken,
        environment: config.environment,
        query: publishMutation,
        variables: { id: listingId },
      });

      const publishData = publishResult.data?.listingPublish;
      if (publishData?.userErrors.length) {
        return {
          success: false,
          externalId: listingId,
          externalUrl: null,
          error: `Created but publish failed: ${publishData.userErrors[0]?.message ?? 'unknown'}`,
          retryable: true,
        };
      }

      return {
        success: true,
        externalId: listingId,
        externalUrl: `https://www.whatnot.com/listings/${listingId}`,
        retryable: false,
      };
    } catch (err) {
      return { success: false, externalId: null, externalUrl: null, error: String(err), retryable: true };
    }
  }

  async updateListing(
    account: CrosslisterAccount,
    externalId: string,
    changes: Partial<TransformedListing>,
  ): Promise<UpdateResult> {
    account = withDecryptedTokens(account);
    if (!account.accessToken) {
      return { success: false, error: 'No credentials', retryable: false };
    }

    const config = await loadWhatnotConfig();
    const input = toWhatnotPartialInput(changes);

    const mutation = `
      mutation UpdateListing($id: ID!, $input: ListingInput!) {
        listingUpdate(id: $id, input: $input) {
          listing { id title status }
          userErrors { field message }
        }
      }
    `;

    try {
      const result = await executeGraphQL<WhatnotListingUpdateResponse>({
        accessToken: account.accessToken,
        environment: config.environment,
        query: mutation,
        variables: { id: externalId, input },
      });

      if (result.status === 0 || result.status === 429 || result.status >= 500) {
        return { success: false, error: `HTTP ${result.status}`, retryable: true };
      }

      const updateData = result.data?.listingUpdate;
      if (updateData?.userErrors.length) {
        return { success: false, error: updateData.userErrors[0]?.message ?? 'Update failed', retryable: false };
      }

      return { success: true, retryable: false };
    } catch (err) {
      return { success: false, error: String(err), retryable: true };
    }
  }

  async delistListing(account: CrosslisterAccount, externalId: string): Promise<DelistResult> {
    account = withDecryptedTokens(account);
    if (!account.accessToken) {
      return { success: false, error: 'No credentials', retryable: false };
    }

    const config = await loadWhatnotConfig();

    const mutation = `
      mutation UnpublishListing($id: ID!) {
        listingUnpublish(id: $id) {
          listing { id status }
          userErrors { field message }
        }
      }
    `;

    try {
      const result = await executeGraphQL<WhatnotListingUnpublishResponse>({
        accessToken: account.accessToken,
        environment: config.environment,
        query: mutation,
        variables: { id: externalId },
      });

      if (result.status === 404) return { success: true, retryable: false };

      const unpublishData = result.data?.listingUnpublish;
      if (unpublishData?.userErrors.length) {
        const msg = unpublishData.userErrors[0]?.message ?? '';
        // Treat already-unpublished/deleted as success (idempotent)
        if (
          msg.toLowerCase().includes('already') ||
          msg.toLowerCase().includes('not found')
        ) {
          return { success: true, retryable: false };
        }
        return { success: false, error: msg, retryable: result.status === 0 || result.status >= 500 || result.status === 429 };
      }

      const hasGraphQLNotFound = result.errors?.some((e) => e.message.toLowerCase().includes('not found'));
      if (hasGraphQLNotFound) return { success: true, retryable: false };

      if (result.errors?.length) {
        return {
          success: false,
          error: result.errors[0]?.message ?? 'Unpublish failed',
          retryable: result.status === 0 || result.status >= 500 || result.status === 429,
        };
      }

      return { success: true, retryable: false };
    } catch (err) {
      return { success: false, error: String(err), retryable: true };
    }
  }

  async verifyListing(account: CrosslisterAccount, externalId: string): Promise<VerificationResult> {
    account = withDecryptedTokens(account);
    if (!account.accessToken) {
      return { exists: false, status: 'UNKNOWN', priceCents: null, quantity: null, lastModifiedAt: null, diff: null };
    }

    const config = await loadWhatnotConfig();

    const query = `
      query FetchListing($id: ID!) {
        listing(id: $id) {
          id title description
          price { amount currencyCode }
          status
          media { url type }
          product {
            id title
            variants { id title price { amount currencyCode } inventoryQuantity }
          }
          createdAt updatedAt
        }
      }
    `;

    const result = await executeGraphQL<WhatnotSingleListingResponse>({
      accessToken: account.accessToken,
      environment: config.environment,
      query,
      variables: { id: externalId },
    });

    if (result.errors?.length || !result.data?.listing) {
      return { exists: false, status: 'REMOVED', priceCents: null, quantity: null, lastModifiedAt: null, diff: null };
    }

    const raw = result.data.listing;

    // Status mapping: PUBLISHED->ACTIVE, UNPUBLISHED->ENDED, SOLD->SOLD
    let verifyStatus: VerificationResult['status'] = 'ENDED';
    if (raw.status === 'PUBLISHED') verifyStatus = 'ACTIVE';
    else if (raw.status === 'SOLD') verifyStatus = 'SOLD';

    const priceCents = raw.price ? parseMoneyToCents(raw.price.amount) : null;

    // Quantity from first variant if available
    const firstVariant = raw.product?.variants?.[0];
    const quantity = firstVariant?.inventoryQuantity ?? 1;

    let lastModifiedAt: Date | null = null;
    if (raw.updatedAt) {
      const parsed = new Date(raw.updatedAt);
      if (!isNaN(parsed.getTime())) lastModifiedAt = parsed;
    }

    return { exists: true, status: verifyStatus, priceCents, quantity, lastModifiedAt, diff: null };
  }

  async healthCheck(account: CrosslisterAccount): Promise<HealthResult> {
    account = withDecryptedTokens(account);
    if (!account.accessToken) return { healthy: false, latencyMs: 0, error: 'No access token' };

    const config = await loadWhatnotConfig();
    const baseUrl = getBaseUrl(config.environment);
    const graphqlUrl = `${baseUrl}/graphql`;

    const start = Date.now();
    try {
      const response = await fetch(graphqlUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${account.accessToken}`,
        },
        body: JSON.stringify({ query: 'query { me { id username } }' }),
      });
      const latencyMs = Date.now() - start;
      if (response.ok) {
        const data = await response.json() as WhatnotGraphQLResponse<{ me: WhatnotUserProfile }>;
        if (data.errors?.length) {
          return { healthy: false, latencyMs, error: data.errors[0]?.message ?? 'GraphQL error' };
        }
        return { healthy: true, latencyMs };
      }
      return { healthy: false, latencyMs, error: `Whatnot API returned ${response.status}` };
    } catch (err) {
      return { healthy: false, latencyMs: Date.now() - start, error: String(err) };
    }
  }
}

// Self-register when this module is loaded
registerConnector(new WhatnotConnector());
