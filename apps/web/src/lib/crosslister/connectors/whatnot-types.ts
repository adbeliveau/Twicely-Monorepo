/**
 * TypeScript interfaces for Whatnot API responses.
 * Source: H2.1 install prompt §2.3
 *
 * Whatnot uses OAuth 2.0 + GraphQL (not REST).
 * Price is a Money type { amount: "12.99", currencyCode: "USD" } — parse to integer cents.
 */

/** Whatnot OAuth token response */
export interface WhatnotTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
  scope: string;
  error?: string;
  error_description?: string;
}

/** Whatnot user profile from GraphQL me query */
export interface WhatnotUserProfile {
  id: string;
  username: string;
}

/** Whatnot GraphQL response wrapper */
export interface WhatnotGraphQLResponse<T> {
  data: T | null;
  errors?: Array<{ message: string; path?: string[] }>;
}

/** Whatnot listing from GraphQL listings query (H2.2 will flesh out) */
export interface WhatnotListing {
  id: string;
  title: string;
  description: string | null;
  /** Money type: { amount: string, currencyCode: string } */
  price: { amount: string; currencyCode: string };
  status: string;
  media: Array<{ url: string; type: string }>;
  product: {
    id: string;
    title: string;
    variants: Array<{
      id: string;
      title: string;
      price: { amount: string; currencyCode: string };
      inventoryQuantity: number;
    }>;
  } | null;
  createdAt: string;
  updatedAt: string;
}

/** Whatnot paginated listings response */
export interface WhatnotListingsResponse {
  listings: {
    nodes: WhatnotListing[];
    pageInfo: {
      hasNextPage: boolean;
      endCursor: string | null;
    };
  };
}

/** Whatnot listing input for create/update mutations */
export interface WhatnotListingInput {
  title: string;
  description?: string;
  price: { amount: string; currencyCode: string };
  media?: Array<{ url: string }>;
  productTaxonomyNodeId?: string;
  quantity?: number;
  condition?: string;
}

/** listingCreate response shape */
export interface WhatnotListingCreateResponse {
  listingCreate: {
    listing: { id: string; title: string; status: string } | null;
    userErrors: Array<{ field: string[]; message: string }>;
  };
}

/** listingPublish response shape */
export interface WhatnotListingPublishResponse {
  listingPublish: {
    listing: { id: string; status: string } | null;
    userErrors: Array<{ field: string[]; message: string }>;
  };
}

/** listingUpdate response shape */
export interface WhatnotListingUpdateResponse {
  listingUpdate: {
    listing: { id: string; title: string; status: string } | null;
    userErrors: Array<{ field: string[]; message: string }>;
  };
}

/** listingUnpublish response shape */
export interface WhatnotListingUnpublishResponse {
  listingUnpublish: {
    listing: { id: string; status: string } | null;
    userErrors: Array<{ field: string[]; message: string }>;
  };
}

/** listingDelete response shape */
export interface WhatnotListingDeleteResponse {
  listingDelete: {
    deletedListingId: string | null;
    userErrors: Array<{ field: string[]; message: string }>;
  };
}

/** Single listing query response */
export interface WhatnotSingleListingResponse {
  listing: WhatnotListing | null;
}

/** Whatnot webhook envelope. All events share this structure. */
export interface WhatnotWebhookEnvelope {
  /** Unique event identifier (for idempotency/deduplication) */
  eventId: string;
  /** Event type, e.g. "order.completed" */
  eventType: string;
  /** ISO 8601 timestamp of when event was created on Whatnot */
  createdAt: string;
  /** Event-specific payload */
  data: Record<string, unknown>;
}

/** Whatnot order.completed webhook data payload */
export interface WhatnotOrderCompletedData {
  /** Whatnot order ID */
  orderId: string;
  /** The Whatnot listing ID that sold */
  listingId: string;
  /** Sale price as Money type */
  price: { amount: string; currencyCode: string };
  /** Buyer information */
  buyer: { id: string; username: string };
  /** ISO 8601 timestamp of when the sale completed */
  completedAt: string;
}
