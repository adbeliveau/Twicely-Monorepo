/**
 * TypeScript interfaces for Shopify Admin REST API responses.
 * Source: H3.1 install prompt §3
 *
 * NOT a 'use server' file — plain TypeScript module.
 */

// Shopify OAuth access token response
export interface ShopifyAccessTokenResponse {
  access_token: string;
  scope: string;
  error?: string;
  error_description?: string;
}

// Shopify shop info response (GET /admin/api/{version}/shop.json)
export interface ShopifyShop {
  id: number;
  name: string;
  email: string;
  domain: string;
  myshopify_domain: string;
  currency: string;
  money_format: string;
  primary_locale: string;
  country_code: string;
  plan_name: string;
}

export interface ShopifyShopResponse {
  shop: ShopifyShop;
}

// Shopify product (used in H3.2, defined here for completeness)
export interface ShopifyProduct {
  id: number;
  title: string;
  body_html: string | null;
  vendor: string;
  product_type: string;
  status: 'active' | 'archived' | 'draft';
  tags: string;
  variants: ShopifyVariant[];
  images: ShopifyImage[];
  created_at: string;
  updated_at: string;
  published_at: string | null;
  handle: string;
}

export interface ShopifyVariant {
  id: number;
  product_id: number;
  title: string;
  price: string; // Decimal string e.g. "29.99"
  sku: string | null;
  inventory_quantity: number;
  weight: number | null;
  weight_unit: string | null;
  barcode: string | null;
}

export interface ShopifyImage {
  id: number;
  product_id: number;
  position: number;
  src: string;
  width: number | null;
  height: number | null;
  alt: string | null;
}

// Shopify products list response (GET /admin/api/{version}/products.json)
export interface ShopifyProductsResponse {
  products: ShopifyProduct[];
}

/** Shopify product input for POST /admin/api/{version}/products.json */
export interface ShopifyProductInput {
  title: string;
  body_html: string;
  vendor: string;
  product_type: string;
  tags: string;
  status: 'active' | 'draft';
  variants: Array<{
    price: string;
    inventory_quantity: number;
    sku: string | null;
    barcode: string | null;
    weight: number | null;
    weight_unit: string | null;
  }>;
  images: Array<{
    src: string;
    position: number;
  }>;
  metafields?: Array<{
    namespace: string;
    key: string;
    value: string;
    type: string;
  }>;
}

/** Shopify create product response */
export interface ShopifyCreateProductResponse {
  product: {
    id: number;
    handle: string;
    title: string;
    status: string;
    variants: Array<{ id: number; product_id: number }>;
  };
}

/** Shopify error response (422 validation) */
export interface ShopifyErrorResponse {
  errors: Record<string, string[]> | string;
}

// ─── Webhook types (H3.4) ─────────────────────────────────────────────────────

/** Shopify webhook topic values from X-Shopify-Topic header. */
export type ShopifyWebhookTopic =
  | 'products/create'
  | 'products/update'
  | 'products/delete'
  | 'orders/create'
  | 'orders/paid'
  | 'app/uninstalled';

/** Shopify webhook order payload (orders/create and orders/paid topics). */
export interface ShopifyWebhookOrderPayload {
  id: number;
  name: string;
  financial_status: string;
  fulfillment_status: string | null;
  total_price: string;
  currency: string;
  line_items: Array<{
    id: number;
    product_id: number | null;
    variant_id: number | null;
    title: string;
    quantity: number;
    price: string;
  }>;
  customer: {
    id: number;
    email: string | null;
    first_name: string | null;
    last_name: string | null;
  } | null;
  created_at: string;
  updated_at: string;
}
