/**
 * Typesense collection schema for listings.
 * Defines all fields, facets, and search configuration.
 */

import type { CollectionCreateSchema } from 'typesense/lib/Typesense/Collections';

export const LISTINGS_COLLECTION = 'listings';

export const listingsSchema: CollectionCreateSchema = {
  name: LISTINGS_COLLECTION,
  default_sorting_field: 'activatedAt',
  fields: [
    // ── Searchable text fields ──────────────────────────────────────────
    { name: 'title', type: 'string', index: true },
    { name: 'description', type: 'string', index: true, optional: true },
    { name: 'brand', type: 'string', facet: true, index: true, optional: true },
    { name: 'tags', type: 'string[]', index: true, optional: true },
    { name: 'categoryName', type: 'string', index: true, optional: true },

    // ── Facet / filter fields ───────────────────────────────────────────
    { name: 'categoryId', type: 'string', facet: true, index: true, optional: true },
    { name: 'categorySlug', type: 'string', index: false, optional: true },
    { name: 'condition', type: 'string', facet: true, index: true, optional: true },
    { name: 'fulfillmentType', type: 'string', facet: true, index: true, optional: true },
    { name: 'authenticationStatus', type: 'string', facet: true, index: true, optional: true },
    { name: 'sellerPerformanceBand', type: 'string', facet: true, index: true, optional: true },
    { name: 'freeShipping', type: 'bool', facet: true, index: true },
    { name: 'ownerUserId', type: 'string', index: true },
    { name: 'storefrontCategoryId', type: 'string', facet: true, index: true, optional: true },

    // ── Numeric / sort fields ───────────────────────────────────────────
    { name: 'priceCents', type: 'int32', index: true },
    { name: 'originalPriceCents', type: 'int32', index: false, optional: true },
    { name: 'shippingCents', type: 'int32', index: true, optional: true },
    { name: 'availableQuantity', type: 'int32', index: true, optional: true },
    { name: 'sellerScore', type: 'int32', index: true },
    { name: 'sellerTotalReviews', type: 'int32', index: true },
    { name: 'boostPercent', type: 'float', index: true, optional: true },
    { name: 'activatedAt', type: 'int64', index: true },
    { name: 'createdAt', type: 'int64', index: true },

    // ── Display-only fields (not searchable) ────────────────────────────
    { name: 'slug', type: 'string', index: false, optional: true },
    { name: 'dealBadgeType', type: 'string', index: false, optional: true },
    { name: 'sellerName', type: 'string', index: false, optional: true },
    { name: 'sellerUsername', type: 'string', index: false, optional: true },
    { name: 'sellerAvatarUrl', type: 'string', index: false, optional: true },
    { name: 'sellerAverageRating', type: 'float', index: false, optional: true },
    { name: 'sellerShowStars', type: 'bool', index: false, optional: true },
    { name: 'primaryImageUrl', type: 'string', index: false, optional: true },
    { name: 'primaryImageAlt', type: 'string', index: false, optional: true },
  ],
};

/** Fields to query against with their default weights. */
export const DEFAULT_QUERY_BY = 'title,description,brand,tags,categoryName';
export const DEFAULT_QUERY_WEIGHTS = '10,3,5,2,4';
