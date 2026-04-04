/**
 * Shared TypeScript types for the Crosslister Connector Framework.
 * Source: Lister Canonical Section 9.2
 */

// External channels (all channels except TWICELY)
export type ExternalChannel =
  | 'EBAY'
  | 'POSHMARK'
  | 'MERCARI'
  | 'DEPOP'
  | 'FB_MARKETPLACE'
  | 'ETSY'
  | 'GRAILED'
  | 'THEREALREAL'
  | 'WHATNOT'
  | 'SHOPIFY'
  | 'VESTIAIRE';

export type Channel = 'TWICELY' | ExternalChannel;

// Connector tier — A (full API), B (standard API), C (session-based)
// TypeScript-only type; NOT a Drizzle pgEnum
export type ConnectorTier = 'A' | 'B' | 'C';

// Connector capabilities — set by connector at auth time
// Source: Lister Canonical Section 9.2
export interface ConnectorCapabilities {
  canImport: boolean;
  canPublish: boolean;
  canUpdate: boolean;
  canDelist: boolean;
  hasWebhooks: boolean;
  hasStructuredCategories: boolean;
  canAutoRelist: boolean;
  canMakeOffers: boolean;
  canShare: boolean;
  maxImagesPerListing: number;
  maxTitleLength: number;
  maxDescriptionLength: number;
  supportedImageFormats: string[];
}

// Auth input variants
export interface OAuthAuthInput {
  method: 'OAUTH';
  code: string;
  redirectUri: string;
  state?: string;
  shopDomain?: string;
  codeVerifier?: string;
}

export interface ApiKeyAuthInput {
  method: 'API_KEY';
  apiKey: string;
  apiSecret?: string;
}

export interface SessionAuthInput {
  method: 'SESSION';
  username: string;
  password: string;
}

export type AuthInput = OAuthAuthInput | ApiKeyAuthInput | SessionAuthInput;

export interface AuthResult {
  success: boolean;
  externalAccountId: string | null;
  externalUsername: string | null;
  accessToken: string | null;
  refreshToken: string | null;
  sessionData: Record<string, unknown> | null;
  tokenExpiresAt: Date | null;
  capabilities: ConnectorCapabilities;
  error?: string;
}

// Normalized shape of a listing fetched from an external platform
export interface ExternalImage {
  url: string;
  isPrimary: boolean;
  sortOrder: number;
}

export interface ExternalListing {
  externalId: string;
  title: string;
  description: string;
  priceCents: number;
  currencyCode: string;
  quantity: number;
  condition: string | null;
  category: string | null;
  brand: string | null;
  images: ExternalImage[];
  itemSpecifics: Record<string, string>;
  shippingType: string | null;
  shippingPriceCents: number | null;
  weight: number | null;
  dimensions: { length: number; width: number; height: number } | null;
  url: string;
  status: 'ACTIVE' | 'SOLD' | 'ENDED' | 'DRAFT';
  listedAt: Date | null;
  soldAt: Date | null;
}

// Paginated response from connector.fetchListings()
export interface PaginatedListings {
  listings: ExternalListing[];
  cursor: string | null;
  hasMore: boolean;
  totalEstimate: number | null;
}

// Shape sent to connector.createListing() / updateListing()
export interface ExternalCategoryMapping {
  externalCategoryId: string;
  externalCategoryName: string;
  path: string[];
}

export interface TransformedImage {
  url: string;
  sortOrder: number;
  isPrimary: boolean;
}

export interface TransformedShipping {
  type: 'FREE' | 'FLAT' | 'CALCULATED';
  flatRateCents: number | null;
  weightOz: number | null;
  dimensions: { length: number; width: number; height: number } | null;
  handlingTimeDays: number;
}

export interface TransformedListing {
  title: string;
  description: string;
  descriptionHtml: string | null;
  priceCents: number;
  quantity: number;
  condition: string;
  category: ExternalCategoryMapping;
  brand: string | null;
  images: TransformedImage[];
  itemSpecifics: Record<string, string>;
  shipping: TransformedShipping;
}

// Result types — all include retryable boolean
export interface PublishResult {
  success: boolean;
  externalId: string | null;
  externalUrl: string | null;
  error?: string;
  retryable: boolean;
}

export interface UpdateResult {
  success: boolean;
  error?: string;
  retryable: boolean;
}

export interface DelistResult {
  success: boolean;
  error?: string;
  retryable: boolean;
}

export interface VerificationResult {
  exists: boolean;
  status: 'ACTIVE' | 'SOLD' | 'ENDED' | 'REMOVED' | 'UNKNOWN';
  priceCents: number | null;
  quantity: number | null;
  lastModifiedAt: Date | null;
  diff: Record<string, { expected: unknown; actual: unknown }> | null;
}

export interface HealthResult {
  healthy: boolean;
  latencyMs: number;
  error?: string;
  details?: Record<string, unknown>;
}

export interface WebhookRegistration {
  webhookId: string;
  events: string[];
  callbackUrl: string;
}

export interface WebhookEvent {
  type: 'SALE' | 'LISTING_ENDED' | 'LISTING_UPDATED' | 'OFFER_RECEIVED' | 'MESSAGE';
  externalId: string;
  channel: ExternalChannel;
  payload: Record<string, unknown>;
  timestamp: Date;
}
