/**
 * Zod validation schemas for Shopify API responses.
 * Source: H3.1 install prompt §4; H3.2 install prompt §2.1
 *
 * NOT a 'use server' file — plain TypeScript module.
 */

import { z } from 'zod';

export const ShopifyShopSchema = z.object({
  id: z.number(),
  name: z.string(),
  email: z.string(),
  domain: z.string(),
  myshopify_domain: z.string(),
  currency: z.string(),
  money_format: z.string().optional(),
  primary_locale: z.string().optional(),
  country_code: z.string().optional(),
  plan_name: z.string().optional(),
});

export const ShopifyAccessTokenSchema = z.object({
  access_token: z.string(),
  scope: z.string(),
});

export const ShopifyVariantSchema = z.object({
  id: z.number(),
  product_id: z.number(),
  title: z.string(),
  price: z.string(),                          // Decimal string e.g. "29.99"
  sku: z.string().nullable().optional(),
  inventory_quantity: z.number(),
  weight: z.number().nullable().optional(),
  weight_unit: z.string().nullable().optional(),
  barcode: z.string().nullable().optional(),
});

export const ShopifyImageSchema = z.object({
  id: z.number(),
  product_id: z.number(),
  position: z.number(),
  src: z.string(),
  width: z.number().nullable().optional(),
  height: z.number().nullable().optional(),
  alt: z.string().nullable().optional(),
});

export const ShopifyProductSchema = z.object({
  id: z.number(),
  title: z.string(),
  body_html: z.string().nullable(),
  vendor: z.string().optional().default(''),
  product_type: z.string().optional().default(''),
  status: z.enum(['active', 'archived', 'draft']),
  tags: z.string().optional().default(''),
  variants: z.array(ShopifyVariantSchema).optional().default([]),
  images: z.array(ShopifyImageSchema).optional().default([]),
  created_at: z.string(),
  updated_at: z.string(),
  published_at: z.string().nullable().optional(),
  handle: z.string().optional().default(''),
});

export type ShopifyProductParsed = z.infer<typeof ShopifyProductSchema>;

// ─── Webhook payload schemas (H3.4) ───────────────────────────────────────────

/**
 * Shopify webhook product payload.
 * Shopify sends the resource directly — NOT wrapped in an envelope.
 * The topic comes from the X-Shopify-Topic header.
 * This is the same shape as ShopifyProductSchema; reuse it directly.
 */
export const ShopifyWebhookProductSchema = ShopifyProductSchema;

/**
 * Shopify webhook order payload.
 * Used for orders/create and orders/paid topics.
 * Note: total_price is a decimal string (e.g. "49.99").
 * For multi-item orders, use per-line-item price, NOT total_price.
 */
export const ShopifyWebhookOrderSchema = z.object({
  id: z.number(),
  name: z.string(),                        // Order number e.g. "#1001"
  financial_status: z.string(),            // "paid", "pending", etc.
  fulfillment_status: z.string().nullable(),
  total_price: z.string(),                 // Decimal string e.g. "49.99"
  currency: z.string(),
  line_items: z.array(z.object({
    id: z.number(),
    product_id: z.number().nullable(),
    variant_id: z.number().nullable(),
    title: z.string(),
    quantity: z.number(),
    price: z.string(),                     // Decimal string per line item
  })),
  customer: z.object({
    id: z.number(),
    email: z.string().nullable().optional(),
    first_name: z.string().nullable().optional(),
    last_name: z.string().nullable().optional(),
  }).nullable().optional(),
  created_at: z.string(),
  updated_at: z.string(),
});
