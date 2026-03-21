/**
 * Generic normalizer dispatcher — maps raw platform data to ExternalListing
 * by delegating to the channel-specific normalizer.
 *
 * Validates raw JSON with Zod schemas before passing to normalizers.
 * Returns null if validation fails (malformed data from external platform).
 *
 * Add new channels here as connectors are added in Phase F.
 * Source: F2 install prompt §2.0.1; F3 install prompt
 */

import type { ExternalListing, ExternalChannel } from '../types';
import type { EbayInventoryItem } from '../connectors/ebay-types';
import type { PoshmarkListing } from '../connectors/poshmark-types';
import type { MercariItem } from '../connectors/mercari-types';
import type { EtsyListing } from '../connectors/etsy-types';
import type { FbCommerceListing } from '../connectors/fb-marketplace-types';
import type { GrailedListing } from '../connectors/grailed-types';
import type { TrrConsignment } from '../connectors/therealreal-types';
import type { DepopProduct } from '../connectors/depop-types';
import type { WhatnotListing } from '../connectors/whatnot-types';
import type { ShopifyProductParsed } from '../connectors/shopify-schemas';
import type { VestiaireListing } from '../connectors/vestiaire-types';
import { normalizeVestiaireListing, toExternalListing as vestiaireToExternal } from '../connectors/vestiaire-normalizer';
import { VestiaireListingSchema } from '../connectors/vestiaire-schemas';
import { normalizeEbayListing, toExternalListing as ebayToExternal } from '../connectors/ebay-normalizer';
import { normalizePoshmarkListing, toExternalListing as poshmarkToExternal } from '../connectors/poshmark-normalizer';
import { normalizeMercariListing, toExternalListing as mercariToExternal } from '../connectors/mercari-normalizer';
import { normalizeEtsyListing, toExternalListing as etsyToExternal } from '../connectors/etsy-normalizer';
import { normalizeFbMarketplaceListing, toExternalListing as fbToExternal } from '../connectors/fb-marketplace-normalizer';
import { normalizeGrailedListing, toExternalListing as grailedToExternal } from '../connectors/grailed-normalizer';
import { normalizeTrrListing, toExternalListing as trrToExternal } from '../connectors/therealreal-normalizer';
import { normalizeDepopListing, toExternalListing as depopToExternal } from '../connectors/depop-normalizer';
import { normalizeWhatnotListing, toExternalListing as whatnotToExternal } from '../connectors/whatnot-normalizer';
import { normalizeShopifyProduct, toExternalListing as shopifyToExternal } from '../connectors/shopify-normalizer';
import { EbayInventoryItemSchema } from '../connectors/ebay-schemas';
import { PoshmarkListingSchema } from '../connectors/poshmark-schemas';
import { MercariItemSchema } from '../connectors/mercari-schemas';
import { EtsyListingSchema } from '../connectors/etsy-schemas';
import { FbCommerceListingSchema } from '../connectors/fb-marketplace-schemas';
import { GrailedListingSchema } from '../connectors/grailed-schemas';
import { TrrConsignmentSchema } from '../connectors/therealreal-schemas';
import { DepopProductSchema } from '../connectors/depop-schemas';
import { WhatnotListingSchema } from '../connectors/whatnot-schemas';
import { ShopifyProductSchema } from '../connectors/shopify-schemas';
import { logger } from '@twicely/logger';

/**
 * Normalize raw listing data from any supported channel.
 * Validates with Zod schema, then dispatches to channel-specific normalizer.
 * Returns null if schema validation fails.
 */
export function normalizeExternalListing(
  raw: Record<string, unknown>,
  channel: ExternalChannel,
): ExternalListing | null {
  switch (channel) {
    case 'EBAY': {
      const parsed = EbayInventoryItemSchema.safeParse(raw);
      if (!parsed.success) {
        logger.warn('[normalizerDispatch] Schema validation failed', {
          channel: 'EBAY',
          errors: parsed.error.flatten(),
        });
        return null;
      }
      return ebayToExternal(normalizeEbayListing(parsed.data as EbayInventoryItem));
    }
    case 'POSHMARK': {
      const parsed = PoshmarkListingSchema.safeParse(raw);
      if (!parsed.success) {
        logger.warn('[normalizerDispatch] Schema validation failed', {
          channel: 'POSHMARK',
          errors: parsed.error.flatten(),
        });
        return null;
      }
      return poshmarkToExternal(normalizePoshmarkListing(parsed.data as PoshmarkListing));
    }
    case 'MERCARI': {
      const parsed = MercariItemSchema.safeParse(raw);
      if (!parsed.success) {
        logger.warn('[normalizerDispatch] Schema validation failed', {
          channel: 'MERCARI',
          errors: parsed.error.flatten(),
        });
        return null;
      }
      return mercariToExternal(normalizeMercariListing(parsed.data as MercariItem));
    }
    case 'ETSY': {
      const parsed = EtsyListingSchema.safeParse(raw);
      if (!parsed.success) {
        logger.warn('[normalizerDispatch] Schema validation failed', {
          channel: 'ETSY',
          errors: parsed.error.flatten(),
        });
        return null;
      }
      return etsyToExternal(normalizeEtsyListing(parsed.data as EtsyListing));
    }
    case 'FB_MARKETPLACE': {
      const parsed = FbCommerceListingSchema.safeParse(raw);
      if (!parsed.success) {
        logger.warn('[normalizerDispatch] Schema validation failed', {
          channel: 'FB_MARKETPLACE',
          errors: parsed.error.flatten(),
        });
        return null;
      }
      return fbToExternal(normalizeFbMarketplaceListing(parsed.data as FbCommerceListing));
    }
    case 'GRAILED': {
      const parsed = GrailedListingSchema.safeParse(raw);
      if (!parsed.success) {
        logger.warn('[normalizerDispatch] Schema validation failed', {
          channel: 'GRAILED',
          errors: parsed.error.flatten(),
        });
        return null;
      }
      return grailedToExternal(normalizeGrailedListing(parsed.data as GrailedListing));
    }
    case 'THEREALREAL': {
      const parsed = TrrConsignmentSchema.safeParse(raw);
      if (!parsed.success) {
        logger.warn('[normalizerDispatch] Schema validation failed', {
          channel: 'THEREALREAL',
          errors: parsed.error.flatten(),
        });
        return null;
      }
      return trrToExternal(normalizeTrrListing(parsed.data as TrrConsignment));
    }
    case 'DEPOP': {
      const parsed = DepopProductSchema.safeParse(raw);
      if (!parsed.success) {
        logger.warn('[normalizerDispatch] Schema validation failed', {
          channel: 'DEPOP',
          errors: parsed.error.flatten(),
        });
        return null;
      }
      return depopToExternal(normalizeDepopListing(parsed.data as DepopProduct));
    }
    case 'WHATNOT': {
      const parsed = WhatnotListingSchema.safeParse(raw);
      if (!parsed.success) {
        logger.warn('[normalizerDispatch] Schema validation failed', {
          channel: 'WHATNOT',
          errors: parsed.error.flatten(),
        });
        return null;
      }
      return whatnotToExternal(normalizeWhatnotListing(parsed.data as WhatnotListing));
    }
    case 'SHOPIFY': {
      const parsed = ShopifyProductSchema.safeParse(raw);
      if (!parsed.success) {
        logger.warn('[normalizerDispatch] Schema validation failed', {
          channel: 'SHOPIFY',
          errors: parsed.error.flatten(),
        });
        return null;
      }
      return shopifyToExternal(normalizeShopifyProduct(parsed.data as ShopifyProductParsed));
    }
    case 'VESTIAIRE': {
      const parsed = VestiaireListingSchema.safeParse(raw);
      if (!parsed.success) {
        logger.warn('[normalizerDispatch] Schema validation failed', {
          channel: 'VESTIAIRE',
          errors: parsed.error.flatten(),
        });
        return null;
      }
      return vestiaireToExternal(normalizeVestiaireListing(parsed.data as VestiaireListing));
    }
    default:
      throw new Error(`No normalizer for channel: ${channel}`);
  }
}
