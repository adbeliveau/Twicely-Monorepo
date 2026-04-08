import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { storefront, storefrontCustomCategory } from '@twicely/db/schema';
import { USER_IDS } from './seed-users';

// Hardcoded IDs for idempotency
const STOREFRONT_IDS = {
  seller1: 'seed-storefront-001',
  seller2: 'seed-storefront-002',
  seller3: 'seed-storefront-003',
};

const CATEGORY_IDS = {
  // Seller 1 categories
  s1_phones: 'seed-scc-001',
  s1_laptops: 'seed-scc-002',
  s1_cameras: 'seed-scc-003',
  // Seller 2 categories
  s2_womens: 'seed-scc-004',
  s2_mens: 'seed-scc-005',
  s2_shoes: 'seed-scc-006',
  // Seller 3 categories
  s3_cards: 'seed-scc-007',
  s3_luxury: 'seed-scc-008',
};

export async function seedStorefronts(db: PostgresJsDatabase): Promise<void> {
  // 1. Storefronts (3)
  await db.insert(storefront).values([
    {
      id: STOREFRONT_IDS.seller1,
      ownerUserId: USER_IDS.seller1,
      slug: 'mikes-electronics',
      name: "Mike's Electronics",
      bannerUrl: 'https://placehold.co/1200x300/1a1a2e/eee?text=Mikes+Electronics',
      logoUrl: 'https://placehold.co/200x200/1a1a2e/eee?text=ME',
      accentColor: '#3b82f6',
      announcement: 'Free shipping on orders over $500!',
      aboutHtml: '<p>Your trusted source for quality electronics since 2020. All items tested and verified.</p>',
      socialLinksJson: { instagram: 'mikes_electronics', twitter: 'mikes_elec' },
      defaultView: 'GRID',
      returnPolicy: 'Returns accepted within 14 days for items in original condition.',
      shippingPolicy: 'All items ship within 3 business days via USPS Priority.',
      isPublished: true,
      vacationMode: false,
    },
    {
      id: STOREFRONT_IDS.seller2,
      ownerUserId: USER_IDS.seller2,
      slug: 'sarahs-closet',
      name: "Sarah's Closet",
      bannerUrl: 'https://placehold.co/1200x300/fdf2f8/ec4899?text=Sarahs+Closet',
      logoUrl: 'https://placehold.co/200x200/fdf2f8/ec4899?text=SC',
      accentColor: '#ec4899',
      announcement: 'New arrivals every week!',
      aboutHtml: '<p>Curated fashion finds from top brands. Authenticity guaranteed on all designer items.</p>',
      socialLinksJson: { instagram: 'sarahs_closet', tiktok: 'sarahscloset' },
      defaultView: 'GRID',
      returnPolicy: 'Returns accepted within 7 days. Buyer pays return shipping.',
      shippingPolicy: 'Ships within 2 business days. Free shipping on orders over $75.',
      isPublished: true,
      vacationMode: false,
    },
    {
      id: STOREFRONT_IDS.seller3,
      ownerUserId: USER_IDS.seller3,
      slug: 'vintage-vault',
      name: 'Vintage Vault LLC',
      bannerUrl: 'https://placehold.co/1200x300/1c1917/fbbf24?text=Vintage+Vault',
      logoUrl: 'https://placehold.co/200x200/1c1917/fbbf24?text=VV',
      accentColor: '#fbbf24',
      announcement: 'Authentication certificates included with all luxury items',
      aboutHtml: '<p>Premium collectibles and luxury goods. Every item authenticated by experts. Family-owned since 2018.</p>',
      socialLinksJson: { instagram: 'vintage_vault', youtube: 'VintageVaultLLC', website: 'https://vintagevault.example.com' },
      defaultView: 'LIST',
      returnPolicy: 'All sales final on authenticated items. Returns accepted on non-authenticated items within 14 days.',
      shippingPolicy: 'Insured shipping on all orders. High-value items ship via FedEx with signature required.',
      isPublished: true,
      vacationMode: false,
    },
  ]).onConflictDoNothing();

  // 2. Storefront custom categories (8)
  await db.insert(storefrontCustomCategory).values([
    // Seller 1 categories
    { id: CATEGORY_IDS.s1_phones, storefrontId: STOREFRONT_IDS.seller1, name: 'Phones & Tablets', description: 'Latest smartphones and tablets', sortOrder: 0 },
    { id: CATEGORY_IDS.s1_laptops, storefrontId: STOREFRONT_IDS.seller1, name: 'Laptops & Computers', description: 'MacBooks, PCs, and accessories', sortOrder: 1 },
    { id: CATEGORY_IDS.s1_cameras, storefrontId: STOREFRONT_IDS.seller1, name: 'Cameras & Drones', description: 'Professional and consumer cameras', sortOrder: 2 },
    // Seller 2 categories
    { id: CATEGORY_IDS.s2_womens, storefrontId: STOREFRONT_IDS.seller2, name: "Women's Fashion", description: 'Dresses, tops, and outerwear', sortOrder: 0 },
    { id: CATEGORY_IDS.s2_mens, storefrontId: STOREFRONT_IDS.seller2, name: "Men's Fashion", description: 'Shirts, jackets, and more', sortOrder: 1 },
    { id: CATEGORY_IDS.s2_shoes, storefrontId: STOREFRONT_IDS.seller2, name: 'Shoes & Sneakers', description: 'Footwear for every occasion', sortOrder: 2 },
    // Seller 3 categories
    { id: CATEGORY_IDS.s3_cards, storefrontId: STOREFRONT_IDS.seller3, name: 'Trading Cards', description: 'Pokemon, MTG, Yu-Gi-Oh', sortOrder: 0 },
    { id: CATEGORY_IDS.s3_luxury, storefrontId: STOREFRONT_IDS.seller3, name: 'Luxury Goods', description: 'Watches, handbags, and jewelry', sortOrder: 1 },
  ]).onConflictDoNothing();
}

// Export IDs for use in other seeders
export const STOREFRONT_SEED_IDS = STOREFRONT_IDS;
export const STOREFRONT_CATEGORY_IDS = CATEGORY_IDS;
