/**
 * Transform functions: TransformedListing -> WhatnotListingInput.
 * Handles cents -> decimal string conversion at the API boundary.
 * Source: H2.2 install prompt §2.13
 *
 * NOT a 'use server' file — plain TypeScript module.
 */

import type { TransformedListing } from '../types';
import type { WhatnotListingInput } from './whatnot-types';

/**
 * Convert a full TransformedListing to WhatnotListingInput for create mutations.
 * - Title truncated to 200 chars (maxTitleLength)
 * - Description truncated to 5000 chars (maxDescriptionLength)
 * - Price: integer cents -> decimal string ("49.99")
 * - Images: sorted by sortOrder, max 10 (maxImagesPerListing)
 */
export function toWhatnotInput(listing: TransformedListing): WhatnotListingInput {
  return {
    title: listing.title.slice(0, 200),
    description: listing.description.slice(0, 5000),
    price: {
      amount: (listing.priceCents / 100).toFixed(2),
      currencyCode: 'USD',
    },
    media: listing.images
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .slice(0, 10)
      .map((img) => ({ url: img.url })),
    quantity: listing.quantity,
    productTaxonomyNodeId: listing.category?.externalCategoryId || undefined,
    condition: listing.condition || undefined,
  };
}

/**
 * Convert only the changed fields from a Partial<TransformedListing> to
 * Partial<WhatnotListingInput> for update mutations.
 * Only includes fields that are present in the changes object.
 */
export function toWhatnotPartialInput(
  changes: Partial<TransformedListing>,
): Partial<WhatnotListingInput> {
  const input: Partial<WhatnotListingInput> = {};

  if (changes.title !== undefined) {
    input.title = changes.title.slice(0, 200);
  }
  if (changes.description !== undefined) {
    input.description = changes.description.slice(0, 5000);
  }
  if (changes.priceCents !== undefined) {
    input.price = {
      amount: (changes.priceCents / 100).toFixed(2),
      currencyCode: 'USD',
    };
  }
  if (changes.images !== undefined) {
    input.media = changes.images
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .slice(0, 10)
      .map((img) => ({ url: img.url }));
  }
  if (changes.quantity !== undefined) {
    input.quantity = changes.quantity;
  }
  if (changes.category !== undefined) {
    input.productTaxonomyNodeId = changes.category?.externalCategoryId || undefined;
  }

  return input;
}
