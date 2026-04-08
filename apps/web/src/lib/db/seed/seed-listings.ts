import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { sql } from 'drizzle-orm';
import { listing, listingImage } from '@twicely/db/schema';
import { USER_IDS } from './seed-users';
import { SEED_IDS } from './seed-system';

// Listing IDs (50 total)
export const LISTING_IDS: string[] = [];
for (let i = 1; i <= 50; i++) {
  LISTING_IDS.push(`seed-listing-${String(i).padStart(3, '0')}`);
}

// Image IDs (50 total)
const IMAGE_IDS: string[] = [];
for (let i = 1; i <= 50; i++) {
  IMAGE_IDS.push(`seed-img-${String(i).padStart(3, '0')}`);
}

const CAT = SEED_IDS.categories;

// Listing definitions by seller
interface ListingDef {
  title: string;
  categoryId: string;
  categorySlug: string;
  priceCents: number;
  condition: 'NEW_WITH_TAGS' | 'NEW_WITHOUT_TAGS' | 'LIKE_NEW' | 'VERY_GOOD' | 'GOOD';
  tags: string[];
  allowOffers?: boolean;
  autoAcceptOfferCents?: number;
  autoDeclineOfferCents?: number;
}

// Seller 1 (Mike) - 20 Electronics listings
const seller1Listings: ListingDef[] = [
  { title: 'iPhone 14 Pro Max 256GB Space Black', categoryId: CAT.phones, categorySlug: 'phones-tablets', priceCents: 89900, condition: 'LIKE_NEW', tags: ['apple', 'iphone', 'smartphone'] },
  { title: 'Samsung Galaxy S23 Ultra 512GB', categoryId: CAT.phones, categorySlug: 'phones-tablets', priceCents: 79900, condition: 'VERY_GOOD', tags: ['samsung', 'android', 'smartphone'] },
  { title: 'iPad Air 5th Gen 64GB WiFi', categoryId: CAT.phones, categorySlug: 'phones-tablets', priceCents: 44900, condition: 'LIKE_NEW', tags: ['apple', 'ipad', 'tablet'] },
  { title: 'Google Pixel 7 Pro 128GB', categoryId: CAT.phones, categorySlug: 'phones-tablets', priceCents: 54900, condition: 'VERY_GOOD', tags: ['google', 'pixel', 'android'] },
  { title: 'MacBook Pro 14" M2 Pro 16GB 512GB', categoryId: CAT.computers, categorySlug: 'computers-laptops', priceCents: 159900, condition: 'LIKE_NEW', tags: ['apple', 'macbook', 'laptop'], allowOffers: true, autoAcceptOfferCents: 145000, autoDeclineOfferCents: 120000 },
  { title: 'Dell XPS 15 Intel i7 32GB RAM', categoryId: CAT.computers, categorySlug: 'computers-laptops', priceCents: 129900, condition: 'VERY_GOOD', tags: ['dell', 'xps', 'laptop'] },
  { title: 'MacBook Air M2 8GB 256GB Midnight', categoryId: CAT.computers, categorySlug: 'computers-laptops', priceCents: 89900, condition: 'LIKE_NEW', tags: ['apple', 'macbook', 'laptop'] },
  { title: 'Lenovo ThinkPad X1 Carbon Gen 10', categoryId: CAT.computers, categorySlug: 'computers-laptops', priceCents: 119900, condition: 'GOOD', tags: ['lenovo', 'thinkpad', 'business'] },
  { title: 'Sony A7 IV Full Frame Mirrorless', categoryId: CAT.cameras, categorySlug: 'cameras-photo', priceCents: 199900, condition: 'LIKE_NEW', tags: ['sony', 'mirrorless', 'full-frame'], allowOffers: true, autoAcceptOfferCents: 185000, autoDeclineOfferCents: 160000 },
  { title: 'Canon EOS R6 Mark II Body Only', categoryId: CAT.cameras, categorySlug: 'cameras-photo', priceCents: 189900, condition: 'VERY_GOOD', tags: ['canon', 'mirrorless', 'full-frame'] },
  { title: 'Fujifilm X-T5 Body Silver', categoryId: CAT.cameras, categorySlug: 'cameras-photo', priceCents: 149900, condition: 'LIKE_NEW', tags: ['fujifilm', 'mirrorless', 'aps-c'] },
  { title: 'DJI Mini 3 Pro Drone with RC', categoryId: CAT.cameras, categorySlug: 'cameras-photo', priceCents: 75900, condition: 'VERY_GOOD', tags: ['dji', 'drone', 'aerial'] },
  { title: 'Samsung Galaxy Tab S9+ 256GB', categoryId: CAT.phones, categorySlug: 'phones-tablets', priceCents: 69900, condition: 'LIKE_NEW', tags: ['samsung', 'tablet', 'android'] },
  { title: 'iPhone 13 128GB Starlight', categoryId: CAT.phones, categorySlug: 'phones-tablets', priceCents: 49900, condition: 'VERY_GOOD', tags: ['apple', 'iphone', 'smartphone'] },
  { title: 'ASUS ROG Zephyrus G14 Gaming Laptop', categoryId: CAT.computers, categorySlug: 'computers-laptops', priceCents: 139900, condition: 'LIKE_NEW', tags: ['asus', 'gaming', 'laptop'] },
  { title: 'Microsoft Surface Pro 9 i7 16GB', categoryId: CAT.computers, categorySlug: 'computers-laptops', priceCents: 119900, condition: 'GOOD', tags: ['microsoft', 'surface', '2-in-1'] },
  { title: 'GoPro HERO11 Black Creator Edition', categoryId: CAT.cameras, categorySlug: 'cameras-photo', priceCents: 44900, condition: 'VERY_GOOD', tags: ['gopro', 'action-camera', 'waterproof'] },
  { title: 'Nikon Z6 III Body Only', categoryId: CAT.cameras, categorySlug: 'cameras-photo', priceCents: 229900, condition: 'NEW_WITHOUT_TAGS', tags: ['nikon', 'mirrorless', 'full-frame'] },
  { title: 'OnePlus 11 5G 256GB Titan Black', categoryId: CAT.phones, categorySlug: 'phones-tablets', priceCents: 59900, condition: 'LIKE_NEW', tags: ['oneplus', 'android', '5g'] },
  { title: 'HP Spectre x360 14" OLED', categoryId: CAT.computers, categorySlug: 'computers-laptops', priceCents: 109900, condition: 'VERY_GOOD', tags: ['hp', 'spectre', 'convertible'] },
];

// Seller 2 (Sarah) - 15 Apparel listings
const seller2Listings: ListingDef[] = [
  { title: 'Lululemon Align High-Rise Leggings 25"', categoryId: CAT.womens, categorySlug: 'womens-clothing', priceCents: 6800, condition: 'LIKE_NEW', tags: ['lululemon', 'athleisure', 'yoga'] },
  { title: 'Free People Maxi Dress Floral Print', categoryId: CAT.womens, categorySlug: 'womens-clothing', priceCents: 8500, condition: 'VERY_GOOD', tags: ['free-people', 'bohemian', 'dress'] },
  { title: 'Reformation Silk Midi Skirt Navy', categoryId: CAT.womens, categorySlug: 'womens-clothing', priceCents: 9500, condition: 'LIKE_NEW', tags: ['reformation', 'sustainable', 'silk'], allowOffers: true, autoAcceptOfferCents: 8500, autoDeclineOfferCents: 7000 },
  { title: 'Aritzia Babaton Blazer Wool Blend', categoryId: CAT.womens, categorySlug: 'womens-clothing', priceCents: 12500, condition: 'VERY_GOOD', tags: ['aritzia', 'blazer', 'workwear'] },
  { title: 'Patagonia Better Sweater Fleece Mens', categoryId: CAT.mens, categorySlug: 'mens-clothing', priceCents: 8900, condition: 'LIKE_NEW', tags: ['patagonia', 'outdoor', 'fleece'] },
  { title: 'Ralph Lauren Polo Classic Fit XL', categoryId: CAT.mens, categorySlug: 'mens-clothing', priceCents: 4500, condition: 'VERY_GOOD', tags: ['ralph-lauren', 'polo', 'classic'] },
  { title: 'Carhartt WIP Detroit Jacket Brown', categoryId: CAT.mens, categorySlug: 'mens-clothing', priceCents: 15900, condition: 'GOOD', tags: ['carhartt', 'workwear', 'jacket'] },
  { title: 'Nike Air Jordan 1 Retro High OG', categoryId: CAT.shoes, categorySlug: 'shoes-sneakers', priceCents: 22500, condition: 'NEW_WITH_TAGS', tags: ['nike', 'jordan', 'sneakers'], allowOffers: true, autoAcceptOfferCents: 20000, autoDeclineOfferCents: 18000 },
  { title: 'New Balance 990v5 Grey Made in USA', categoryId: CAT.shoes, categorySlug: 'shoes-sneakers', priceCents: 17500, condition: 'LIKE_NEW', tags: ['new-balance', 'running', 'usa'] },
  { title: 'Birkenstock Arizona Soft Footbed', categoryId: CAT.shoes, categorySlug: 'shoes-sneakers', priceCents: 9900, condition: 'VERY_GOOD', tags: ['birkenstock', 'sandals', 'comfort'] },
  { title: 'Everlane The Day Glove Flat Black', categoryId: CAT.shoes, categorySlug: 'shoes-sneakers', priceCents: 6500, condition: 'LIKE_NEW', tags: ['everlane', 'flats', 'minimal'] },
  { title: 'Anthropologie Maeve Wrap Dress', categoryId: CAT.womens, categorySlug: 'womens-clothing', priceCents: 7800, condition: 'VERY_GOOD', tags: ['anthropologie', 'wrap-dress', 'casual'] },
  { title: 'AllSaints Leather Biker Jacket Womens', categoryId: CAT.womens, categorySlug: 'womens-clothing', priceCents: 29900, condition: 'GOOD', tags: ['allsaints', 'leather', 'biker'], allowOffers: true, autoAcceptOfferCents: 27000, autoDeclineOfferCents: 22000 },
  { title: 'Arc\'teryx Beta AR Jacket Mens M', categoryId: CAT.mens, categorySlug: 'mens-clothing', priceCents: 44900, condition: 'LIKE_NEW', tags: ['arcteryx', 'gore-tex', 'outdoor'] },
  { title: 'Adidas Ultraboost 22 Running Shoes', categoryId: CAT.shoes, categorySlug: 'shoes-sneakers', priceCents: 12900, condition: 'VERY_GOOD', tags: ['adidas', 'running', 'boost'] },
];

// Seller 3 (Vintage Vault) - 15 Collectibles + Home listings
const seller3Listings: ListingDef[] = [
  { title: 'Pokemon Base Set Charizard Holo PSA 8', categoryId: CAT.tradingCards, categorySlug: 'trading-cards', priceCents: 45000, condition: 'VERY_GOOD', tags: ['pokemon', 'charizard', 'psa'], allowOffers: true, autoAcceptOfferCents: 42000, autoDeclineOfferCents: 35000 },
  { title: 'Magic The Gathering Black Lotus HP', categoryId: CAT.tradingCards, categorySlug: 'trading-cards', priceCents: 250000, condition: 'GOOD', tags: ['mtg', 'power-nine', 'vintage'] },
  { title: 'Yu-Gi-Oh Blue Eyes White Dragon 1st Ed', categoryId: CAT.tradingCards, categorySlug: 'trading-cards', priceCents: 18500, condition: 'VERY_GOOD', tags: ['yugioh', 'blue-eyes', '1st-edition'] },
  { title: 'Rolex Submariner Date 116610LN', categoryId: CAT.watches, categorySlug: 'watches-jewelry', priceCents: 1150000, condition: 'LIKE_NEW', tags: ['rolex', 'submariner', 'luxury'], allowOffers: true, autoAcceptOfferCents: 1100000, autoDeclineOfferCents: 950000 },
  { title: 'Omega Speedmaster Professional Moonwatch', categoryId: CAT.watches, categorySlug: 'watches-jewelry', priceCents: 550000, condition: 'VERY_GOOD', tags: ['omega', 'speedmaster', 'chronograph'] },
  { title: 'Cartier Love Bracelet 18K Yellow Gold', categoryId: CAT.watches, categorySlug: 'watches-jewelry', priceCents: 680000, condition: 'LIKE_NEW', tags: ['cartier', 'love', 'gold'] },
  { title: 'Louis Vuitton Neverfull MM Monogram', categoryId: CAT.handbags, categorySlug: 'designer-handbags', priceCents: 145000, condition: 'VERY_GOOD', tags: ['louis-vuitton', 'neverfull', 'monogram'] },
  { title: 'Chanel Classic Flap Medium Caviar Black', categoryId: CAT.handbags, categorySlug: 'designer-handbags', priceCents: 750000, condition: 'LIKE_NEW', tags: ['chanel', 'classic-flap', 'caviar'], allowOffers: true, autoAcceptOfferCents: 720000, autoDeclineOfferCents: 650000 },
  { title: 'Hermes Birkin 30 Togo Gold', categoryId: CAT.handbags, categorySlug: 'designer-handbags', priceCents: 1450000, condition: 'VERY_GOOD', tags: ['hermes', 'birkin', 'togo'] },
  { title: 'Le Creuset Dutch Oven 5.5qt Flame', categoryId: CAT.kitchen, categorySlug: 'kitchen-dining', priceCents: 24900, condition: 'LIKE_NEW', tags: ['le-creuset', 'dutch-oven', 'cast-iron'] },
  { title: 'KitchenAid Artisan Stand Mixer Empire Red', categoryId: CAT.kitchen, categorySlug: 'kitchen-dining', priceCents: 29900, condition: 'VERY_GOOD', tags: ['kitchenaid', 'stand-mixer', 'baking'] },
  { title: 'Herman Miller Aeron Chair Size B', categoryId: CAT.furniture, categorySlug: 'furniture', priceCents: 89900, condition: 'GOOD', tags: ['herman-miller', 'aeron', 'ergonomic'] },
  { title: 'West Elm Mid-Century Coffee Table', categoryId: CAT.furniture, categorySlug: 'furniture', priceCents: 34900, condition: 'VERY_GOOD', tags: ['west-elm', 'mid-century', 'walnut'] },
  { title: 'Weber Genesis II E-335 Gas Grill', categoryId: CAT.garden, categorySlug: 'garden-outdoor', priceCents: 79900, condition: 'LIKE_NEW', tags: ['weber', 'gas-grill', 'outdoor'] },
  { title: 'Traeger Pro 575 Pellet Grill Bronze', categoryId: CAT.garden, categorySlug: 'garden-outdoor', priceCents: 69900, condition: 'VERY_GOOD', tags: ['traeger', 'pellet-grill', 'smoker'] },
];

export async function seedListings(db: PostgresJsDatabase): Promise<void> {
  const now = new Date();

  // Helper to get a random date in the last 30 days
  function randomActivatedAt(index: number): Date {
    // Use index for deterministic dates
    const daysAgo = (index * 7) % 30;
    return new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
  }

  // Build all listing values
  type ListingInsert = typeof listing.$inferInsert;
  type ImageInsert = typeof listingImage.$inferInsert;
  const listingValues: ListingInsert[] = [];
  const imageValues: ImageInsert[] = [];

  let idx = 0;

  // Seller 1 listings (20)
  for (const def of seller1Listings) {
    const activatedAt = randomActivatedAt(idx);
    listingValues.push({
      id: LISTING_IDS[idx],
      ownerUserId: USER_IDS.seller1,
      status: 'ACTIVE',
      title: def.title,
      description: `High-quality ${def.title}. In excellent condition and ready to ship.`,
      categoryId: def.categoryId,
      condition: def.condition,
      priceCents: def.priceCents,
      currency: 'USD',
      quantity: 1,
      availableQuantity: 1,
      soldQuantity: 0,
      slug: `${def.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 50)}-${LISTING_IDS[idx]}`,
      allowOffers: def.allowOffers ?? false,
      autoAcceptOfferCents: def.autoAcceptOfferCents,
      autoDeclineOfferCents: def.autoDeclineOfferCents,
      freeShipping: def.priceCents >= 100000, // Free shipping for items $1000+
      shippingCents: def.priceCents >= 100000 ? 0 : 899, // $8.99 shipping for electronics
      enforcementState: 'CLEAR',
      tags: def.tags,
      autoRenew: true,
      activatedAt,
      createdAt: activatedAt,
      updatedAt: activatedAt,
    });
    imageValues.push({
      id: IMAGE_IDS[idx],
      listingId: LISTING_IDS[idx]!,
      url: `https://placehold.co/800x800/eee/999?text=${encodeURIComponent(def.categorySlug)}`,
      position: 0,
      isPrimary: true,
      width: 800,
      height: 800,
      altText: def.title,
    });
    idx++;
  }

  // Seller 2 listings (15)
  for (const def of seller2Listings) {
    const activatedAt = randomActivatedAt(idx);
    listingValues.push({
      id: LISTING_IDS[idx],
      ownerUserId: USER_IDS.seller2,
      status: 'ACTIVE',
      title: def.title,
      description: `Authentic ${def.title}. Gently used with plenty of life left.`,
      categoryId: def.categoryId,
      condition: def.condition,
      priceCents: def.priceCents,
      currency: 'USD',
      quantity: 1,
      availableQuantity: 1,
      soldQuantity: 0,
      slug: `${def.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 50)}-${LISTING_IDS[idx]}`,
      allowOffers: def.allowOffers ?? false,
      autoAcceptOfferCents: def.autoAcceptOfferCents,
      autoDeclineOfferCents: def.autoDeclineOfferCents,
      freeShipping: false,
      shippingCents: 599, // $5.99 shipping for apparel/shoes
      enforcementState: 'CLEAR',
      tags: def.tags,
      autoRenew: true,
      activatedAt,
      createdAt: activatedAt,
      updatedAt: activatedAt,
    });
    imageValues.push({
      id: IMAGE_IDS[idx],
      listingId: LISTING_IDS[idx]!,
      url: `https://placehold.co/800x800/eee/999?text=${encodeURIComponent(def.categorySlug)}`,
      position: 0,
      isPrimary: true,
      width: 800,
      height: 800,
      altText: def.title,
    });
    idx++;
  }

  // Seller 3 listings (15)
  for (const def of seller3Listings) {
    const activatedAt = randomActivatedAt(idx);
    listingValues.push({
      id: LISTING_IDS[idx],
      ownerUserId: USER_IDS.seller3,
      status: 'ACTIVE',
      title: def.title,
      description: `Premium ${def.title}. Authenticated and verified.`,
      categoryId: def.categoryId,
      condition: def.condition,
      priceCents: def.priceCents,
      currency: 'USD',
      quantity: 1,
      availableQuantity: 1,
      soldQuantity: 0,
      slug: `${def.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 50)}-${LISTING_IDS[idx]}`,
      allowOffers: def.allowOffers ?? false,
      autoAcceptOfferCents: def.autoAcceptOfferCents,
      autoDeclineOfferCents: def.autoDeclineOfferCents,
      freeShipping: def.priceCents >= 50000, // Free shipping for items $500+
      shippingCents: def.priceCents >= 50000 ? 0 : 1299, // $12.99 shipping for collectibles
      enforcementState: 'CLEAR',
      tags: def.tags,
      autoRenew: true,
      activatedAt,
      createdAt: activatedAt,
      updatedAt: activatedAt,
    });
    imageValues.push({
      id: IMAGE_IDS[idx],
      listingId: LISTING_IDS[idx]!,
      url: `https://placehold.co/800x800/eee/999?text=${encodeURIComponent(def.categorySlug)}`,
      position: 0,
      isPrimary: true,
      width: 800,
      height: 800,
      altText: def.title,
    });
    idx++;
  }

  // Insert listings (update shippingCents/freeShipping on conflict)
  await db.insert(listing).values(listingValues).onConflictDoUpdate({
    target: listing.id,
    set: {
      shippingCents: sql`excluded.shipping_cents`,
      freeShipping: sql`excluded.free_shipping`,
    },
  });

  // Insert images
  await db.insert(listingImage).values(imageValues).onConflictDoNothing();
}
