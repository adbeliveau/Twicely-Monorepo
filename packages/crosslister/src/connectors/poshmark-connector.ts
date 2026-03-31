/**
 * PoshmarkConnector — implements PlatformConnector for Poshmark (Tier C, session-based).
 * Source: F2 install prompt §2.1.3; Lister Canonical Section 9.4
 *
 * NOT a 'use server' file — plain TypeScript module.
 * Self-registers at module load: registerConnector(new PoshmarkConnector()).
 *
 * Auth helpers extracted to poshmark-auth.ts.
 * Normalizer functions in poshmark-normalizer.ts.
 */

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
import { tierCDelay } from '../services/platform-fees';
import { normalizePoshmarkListing, toExternalListing } from './poshmark-normalizer';
import type { PoshmarkListingsResponse } from './poshmark-types';
import {
  loadPoshmarkConfig,
  extractSessionData,
  poshmarkAuthenticate,
  poshmarkRefreshAuth,
  poshmarkRevokeAuth,
} from './poshmark-auth';

const POSHMARK_CAPABILITIES: ConnectorCapabilities = {
  canImport: true,
  canPublish: true,
  canUpdate: false,
  canDelist: true,
  hasWebhooks: false,
  hasStructuredCategories: false,
  canAutoRelist: false,
  canMakeOffers: false,
  canShare: true,
  maxImagesPerListing: 16,
  maxTitleLength: 80,
  maxDescriptionLength: 1500,
  supportedImageFormats: ['jpg', 'jpeg', 'png'],
};

export class PoshmarkConnector implements PlatformConnector {
  readonly channel: ExternalChannel = 'POSHMARK';
  readonly tier: ConnectorTier = 'C';
  readonly version = '1.0.0';
  readonly capabilities: ConnectorCapabilities = POSHMARK_CAPABILITIES;

  async authenticate(credentials: AuthInput): Promise<AuthResult> {
    return poshmarkAuthenticate(credentials, POSHMARK_CAPABILITIES);
  }

  async refreshAuth(account: CrosslisterAccount): Promise<AuthResult> {
    return poshmarkRefreshAuth(account, POSHMARK_CAPABILITIES);
  }

  async revokeAuth(account: CrosslisterAccount): Promise<void> {
    return poshmarkRevokeAuth(account);
  }

  async fetchListings(account: CrosslisterAccount, cursor?: string): Promise<PaginatedListings> {
    const sd = extractSessionData(account);
    if (!sd?.jwt) {
      return { listings: [], cursor: null, hasMore: false, totalEstimate: null };
    }

    const config = await loadPoshmarkConfig();
    const username = sd.username;
    const url = cursor
      ? `${config.apiBase}/posts?username=${encodeURIComponent(username)}&max_id=${encodeURIComponent(cursor)}&limit=48`
      : `${config.apiBase}/posts?username=${encodeURIComponent(username)}&limit=48`;

    try {
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${sd.jwt}`,
          'User-Agent': config.userAgent,
        },
      });

      if (response.status === 401) {
        logger.warn('[PoshmarkConnector.fetchListings] 401 — session expired', { accountId: account.id });
        return { listings: [], cursor: null, hasMore: false, totalEstimate: null };
      }

      if (!response.ok) {
        logger.error('[PoshmarkConnector.fetchListings] API error', { status: response.status, accountId: account.id });
        return { listings: [], cursor: null, hasMore: false, totalEstimate: null };
      }

      const data: PoshmarkListingsResponse = await response.json() as PoshmarkListingsResponse;
      const rawListings = data.data ?? [];

      const listings: ExternalListing[] = rawListings
        .map((item) => toExternalListing(normalizePoshmarkListing(item)))
        .filter((l) => l.status === 'ACTIVE');

      return {
        listings,
        cursor: data.more_available && data.next_max_id ? data.next_max_id : null,
        hasMore: data.more_available ?? false,
        totalEstimate: null,
      };
    } catch (err) {
      logger.error('[PoshmarkConnector.fetchListings] Network error', { error: String(err) });
      return { listings: [], cursor: null, hasMore: false, totalEstimate: null };
    }
  }

  async fetchSingleListing(account: CrosslisterAccount, externalId: string): Promise<ExternalListing> {
    const sd = extractSessionData(account);
    if (!sd?.jwt) throw new Error('No session data');

    const config = await loadPoshmarkConfig();
    const response = await fetch(`${config.apiBase}/posts/${encodeURIComponent(externalId)}`, {
      headers: {
        Authorization: `Bearer ${sd.jwt}`,
        'User-Agent': config.userAgent,
      },
    });

    if (!response.ok) throw new Error(`Poshmark API error: ${response.status}`);

    const item = await response.json() as import('./poshmark-types').PoshmarkListing;
    return toExternalListing(normalizePoshmarkListing(item));
  }

  /**
   * Create a listing on Poshmark via session API.
   * Adds a 2-8 second human-like delay before the API call.
   */
  async createListing(account: CrosslisterAccount, listing: TransformedListing): Promise<PublishResult> {
    const sd = extractSessionData(account);
    if (!sd?.jwt) return { success: false, externalId: null, externalUrl: null, error: 'No credentials', retryable: false };
    const config = await loadPoshmarkConfig();
    await tierCDelay();
    try {
      const body = {
        title: listing.title,
        description: listing.description,
        price_amount: { val: (listing.priceCents / 100).toFixed(2), currency_code: 'USD' },
        original_price_amount: { val: (listing.priceCents / 100).toFixed(2), currency_code: 'USD' },
        pictures: listing.images.map((img) => ({ url_fullsize: img.url })),
        condition: listing.condition ? (listing.condition.includes('NEW') ? 'nwt' : 'not_nwt') : 'not_nwt',
        brand: listing.brand ?? 'Other',
        size: listing.itemSpecifics['size'] ?? 'OS',
      };
      const resp = await fetch(`${config.apiBase}/posts`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${sd.jwt}`, 'Content-Type': 'application/json', 'User-Agent': config.userAgent },
        body: JSON.stringify(body),
      });
      if (!resp.ok) {
        const text = await resp.text().catch(() => '');
        logger.error('[PoshmarkConnector] createListing failed', { status: resp.status, body: text.slice(0, 500) });
        return { success: false, externalId: null, externalUrl: null, error: `Poshmark API error: ${resp.status}`, retryable: resp.status >= 500 || resp.status === 429 };
      }
      const data = await resp.json() as { data?: { id?: string } };
      const id = data.data?.id;
      if (!id) return { success: false, externalId: null, externalUrl: null, error: 'No listing ID returned', retryable: false };
      return { success: true, externalId: id, externalUrl: `https://poshmark.com/listing/${id}`, retryable: false };
    } catch (err) {
      logger.error('[PoshmarkConnector] createListing error', { error: String(err) });
      return { success: false, externalId: null, externalUrl: null, error: String(err), retryable: true };
    }
  }

  /** Poshmark Tier C does not support update — return not-retryable. */
  async updateListing(_account: CrosslisterAccount, _externalId: string, _changes: Partial<TransformedListing>): Promise<UpdateResult> {
    return { success: false, error: 'Poshmark does not support listing updates via API', retryable: false };
  }

  /** Delist a Poshmark listing via session API. */
  async delistListing(account: CrosslisterAccount, externalId: string): Promise<DelistResult> {
    const sd = extractSessionData(account);
    if (!sd?.jwt) return { success: false, error: 'No credentials', retryable: false };
    const config = await loadPoshmarkConfig();
    await tierCDelay();
    try {
      const resp = await fetch(`${config.apiBase}/posts/${encodeURIComponent(externalId)}/delete`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${sd.jwt}`, 'Content-Type': 'application/json', 'User-Agent': config.userAgent },
        body: '{}',
      });
      if (!resp.ok && resp.status !== 404) {
        return { success: false, error: `Poshmark API error: ${resp.status}`, retryable: resp.status >= 500 };
      }
      return { success: true, retryable: false };
    } catch (err) {
      return { success: false, error: String(err), retryable: true };
    }
  }

  async verifyListing(_account: CrosslisterAccount, _externalId: string): Promise<VerificationResult> {
    return { exists: false, status: 'UNKNOWN', priceCents: null, quantity: null, lastModifiedAt: null, diff: null };
  }

  async healthCheck(account: CrosslisterAccount): Promise<HealthResult> {
    const sd = extractSessionData(account);
    if (!sd?.jwt) return { healthy: false, latencyMs: 0, error: 'No session data' };

    const config = await loadPoshmarkConfig();
    const url = `${config.apiBase}/posts?username=${encodeURIComponent(sd.username)}&limit=1`;
    const start = Date.now();

    try {
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${sd.jwt}`,
          'User-Agent': config.userAgent,
        },
      });
      const latencyMs = Date.now() - start;
      if (response.ok) return { healthy: true, latencyMs };
      return { healthy: false, latencyMs, error: `Poshmark API returned ${response.status}` };
    } catch (err) {
      return { healthy: false, latencyMs: Date.now() - start, error: String(err) };
    }
  }
}

// Self-register when this module is loaded
registerConnector(new PoshmarkConnector());
