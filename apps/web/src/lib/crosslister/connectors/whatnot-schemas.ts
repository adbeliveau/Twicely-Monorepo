/**
 * Zod runtime validation schemas for Whatnot API data.
 * Validates fields accessed by normalizeWhatnotListing() in whatnot-normalizer.ts.
 * Source: H2.1 install prompt §2.5
 *
 * Follow exact pattern from mercari-schemas.ts.
 */

import { z } from 'zod';

const WhatnotMoneySchema = z.object({
  amount: z.string(),
  currencyCode: z.string(),
});

const WhatnotMediaSchema = z.object({
  url: z.string(),
  type: z.string(),
});

const WhatnotVariantSchema = z.object({
  id: z.string(),
  title: z.string().optional(),
  price: WhatnotMoneySchema.optional(),
  inventoryQuantity: z.number().optional(),
});

const WhatnotProductSchema = z.object({
  id: z.string(),
  title: z.string().optional(),
  variants: z.array(WhatnotVariantSchema).optional(),
});

export const WhatnotListingSchema = z.object({
  id: z.string(),
  title: z.string().optional(),
  description: z.string().nullable().optional(),
  price: WhatnotMoneySchema.optional(),
  status: z.string().optional(),
  media: z.array(WhatnotMediaSchema).optional(),
  product: WhatnotProductSchema.nullable().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export const WhatnotTokenResponseSchema = z.object({
  access_token: z.string(),
  token_type: z.string().optional(),
  expires_in: z.number(),
  refresh_token: z.string(),
  scope: z.string().optional(),
  error: z.string().optional(),
  error_description: z.string().optional(),
});

export type { WhatnotListing } from './whatnot-types';

// Mutation response schemas

export const WhatnotUserErrorSchema = z.object({
  field: z.array(z.string()),
  message: z.string(),
});

const WhatnotMutationListingSchema = z.object({
  id: z.string(),
  title: z.string().optional(),
  status: z.string().optional(),
});

export const WhatnotListingCreateResponseSchema = z.object({
  listingCreate: z.object({
    listing: WhatnotMutationListingSchema.nullable(),
    userErrors: z.array(WhatnotUserErrorSchema),
  }),
});

export const WhatnotListingPublishResponseSchema = z.object({
  listingPublish: z.object({
    listing: z.object({ id: z.string(), status: z.string().optional() }).nullable(),
    userErrors: z.array(WhatnotUserErrorSchema),
  }),
});

export const WhatnotListingUpdateResponseSchema = z.object({
  listingUpdate: z.object({
    listing: WhatnotMutationListingSchema.nullable(),
    userErrors: z.array(WhatnotUserErrorSchema),
  }),
});

export const WhatnotListingUnpublishResponseSchema = z.object({
  listingUnpublish: z.object({
    listing: z.object({ id: z.string(), status: z.string().optional() }).nullable(),
    userErrors: z.array(WhatnotUserErrorSchema),
  }),
});

export const WhatnotListingDeleteResponseSchema = z.object({
  listingDelete: z.object({
    deletedListingId: z.string().nullable(),
    userErrors: z.array(WhatnotUserErrorSchema),
  }),
});

/** Zod schema for Whatnot webhook envelope validation. */
export const WhatnotWebhookEnvelopeSchema = z.object({
  eventId: z.string().min(1),
  eventType: z.string().min(1),
  createdAt: z.string().min(1),
  data: z.record(z.string(), z.unknown()),
}).strict();

/** Zod schema for the order.completed event data payload. */
export const WhatnotOrderCompletedDataSchema = z.object({
  orderId: z.string().min(1),
  listingId: z.string().min(1),
  price: z.object({
    amount: z.string().min(1),
    currencyCode: z.string().length(3),
  }).strict(),
  buyer: z.object({
    id: z.string().min(1),
    username: z.string().min(1),
  }).strict(),
  completedAt: z.string().min(1),
}).strict();
