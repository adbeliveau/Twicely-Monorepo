/**
 * TypeScript types for eBay Inventory API responses.
 * Source: eBay Sell Inventory API v1
 * Reference: F1.1 install prompt §2.1
 */

/** eBay pricing value (decimal string) */
export interface EbayAmount {
  value: string;
  currency: string;
}

/** eBay price summary in an offer */
export interface EbayPricingSummary {
  price: EbayAmount;
}

/** eBay availability quantity */
export interface EbayShipToLocationAvailability {
  quantity: number;
}

export interface EbayAvailability {
  shipToLocationAvailability: EbayShipToLocationAvailability;
}

/** eBay offer record (from inventory offer) */
export interface EbayOffer {
  offerId?: string;
  listingId?: string;
  pricingSummary: EbayPricingSummary;
  status?: string;
}

/** eBay product details */
export interface EbayProduct {
  title?: string;
  description?: string;
  imageUrls?: string[];
  aspects?: Record<string, string[]>;
  brand?: string;
}

/**
 * eBay inventory item — returned by GET /sell/inventory/v1/inventory_item
 */
export interface EbayInventoryItem {
  sku: string;
  condition?: string;
  product?: EbayProduct;
  availability?: EbayAvailability;
  /** Offers are fetched separately but joined here for convenience */
  offers?: EbayOffer[];
}

/**
 * eBay paginated inventory response
 * GET /sell/inventory/v1/inventory_item
 */
export interface EbayInventoryResponse {
  inventoryItems?: EbayInventoryItem[];
  total?: number;
  size?: number;
  offset?: number;
  limit?: number;
}

/**
 * eBay OAuth token response
 * POST /identity/v1/oauth2/token
 */
export interface EbayTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  error?: string;
  error_description?: string;
}
