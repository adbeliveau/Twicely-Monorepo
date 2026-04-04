/**
 * Standard interface that every platform connector must implement.
 * Source: Lister Canonical Section 9.2
 *
 * Connectors are registered at runtime via connector-registry.ts.
 * This file only defines the contract — no concrete implementations here.
 */

import type { CrosslisterAccount } from '@twicely/crosslister/db-types';
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
  WebhookEvent,
} from '@twicely/crosslister/types';

export interface PlatformConnector {
  readonly channel: ExternalChannel;
  readonly tier: ConnectorTier;
  readonly version: string;
  readonly capabilities: ConnectorCapabilities;

  // Auth lifecycle
  authenticate(credentials: AuthInput): Promise<AuthResult>;
  refreshAuth(account: CrosslisterAccount): Promise<AuthResult>;
  revokeAuth(account: CrosslisterAccount): Promise<void>;

  // Import (inbound)
  fetchListings(account: CrosslisterAccount, cursor?: string): Promise<PaginatedListings>;
  fetchSingleListing(account: CrosslisterAccount, externalId: string): Promise<ExternalListing>;

  // Publish (outbound)
  createListing(account: CrosslisterAccount, listing: TransformedListing): Promise<PublishResult>;
  updateListing(
    account: CrosslisterAccount,
    externalId: string,
    changes: Partial<TransformedListing>,
  ): Promise<UpdateResult>;
  delistListing(account: CrosslisterAccount, externalId: string): Promise<DelistResult>;

  // Verification
  verifyListing(account: CrosslisterAccount, externalId: string): Promise<VerificationResult>;

  // OAuth (Tier A/B only — optional)
  // Returns URL string, or { url, codeVerifier } when PKCE is used.
  buildAuthUrl?(state: string, shopDomain?: string): Promise<string | { url: string; codeVerifier: string }>;

  // Webhooks (Tier A only — optional)
  registerWebhook?(account: CrosslisterAccount, events: string[]): Promise<WebhookRegistration>;
  handleWebhook?(payload: unknown): Promise<WebhookEvent>;

  // Automation methods (optional — check ConnectorCapabilities before calling)
  // V1: all connectors return { success: false, error: 'Not implemented', retryable: false }
  relistListing?(account: CrosslisterAccount, externalId: string): Promise<PublishResult>;
  sendOfferToLikers?(account: CrosslisterAccount, externalId: string, offerPriceCents: number): Promise<UpdateResult>;
  shareListing?(account: CrosslisterAccount, externalId: string): Promise<UpdateResult>;
  followUser?(account: CrosslisterAccount, targetUserId: string): Promise<UpdateResult>;

  // Health check
  healthCheck(account: CrosslisterAccount): Promise<HealthResult>;
}
