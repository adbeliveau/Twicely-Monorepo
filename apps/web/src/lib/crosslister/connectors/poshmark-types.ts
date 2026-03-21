/**
 * TypeScript interfaces for Poshmark internal API responses.
 * Source: F2 install prompt §2.1.1; Lister Canonical Section 9.4
 *
 * Poshmark has no official public API. These types reflect the internal
 * mobile API (undocumented but stable for reseller tooling).
 */

/** Poshmark price amount — returned as decimal string */
export interface PoshmarkPriceAmount {
  val: string;
  currency_code: string;
}

/** One size + quantity entry in Poshmark inventory */
export interface PoshmarkSizeQuantity {
  size_id: string;
  quantity_available: number;
}

/** Poshmark catalog metadata */
export interface PoshmarkCatalog {
  department_obj?: { display: string };
  category_obj?: { display: string };
}

/** Poshmark brand metadata */
export interface PoshmarkBrand {
  display: string;
}

/** Poshmark listing picture */
export interface PoshmarkPicture {
  url: string;
}

/** Poshmark covershot (primary image) */
export interface PoshmarkCovershot {
  url: string;
}

/** Poshmark listing data (from internal API /api/posts) */
export interface PoshmarkListing {
  id: string;
  title: string;
  description: string;
  price_amount: PoshmarkPriceAmount;
  original_price_amount?: PoshmarkPriceAmount;
  inventory: { size_quantities: PoshmarkSizeQuantity[] };
  catalog: PoshmarkCatalog;
  pictures: PoshmarkPicture[];
  brand?: PoshmarkBrand;
  condition?: string;
  /** 'available', 'sold', 'not_for_sale', 'removed' */
  status: string;
  created_at: string;
  updated_at: string;
  covershot?: PoshmarkCovershot;
}

/** Poshmark paginated listings response */
export interface PoshmarkListingsResponse {
  data: PoshmarkListing[];
  more_available: boolean;
  next_max_id?: string;
}

/** Poshmark auth response (internal login API) */
export interface PoshmarkAuthResponse {
  user?: {
    id: string;
    username: string;
  };
  jwt?: string;
  error?: string;
}

/** Session data stored in crosslisterAccount.sessionData */
export interface PoshmarkSessionData {
  jwt: string;
  username: string;
  [key: string]: unknown;
}
