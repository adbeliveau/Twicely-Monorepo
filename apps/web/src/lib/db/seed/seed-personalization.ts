import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { interestTag, userInterest } from '@twicely/db/schema';
import { USER_IDS } from './seed-users';

// Hardcoded IDs for idempotency
const TAG_IDS = {
  // Fashion
  streetwear: 'seed-tag-001',
  vintage: 'seed-tag-002',
  designer: 'seed-tag-003',
  athleisure: 'seed-tag-004',
  y2k: 'seed-tag-005',
  cottagecore: 'seed-tag-006',
  sustainableFashion: 'seed-tag-007',
  // Electronics
  smartphones: 'seed-tag-008',
  laptops: 'seed-tag-009',
  gaming: 'seed-tag-010',
  audio: 'seed-tag-011',
  cameras: 'seed-tag-012',
  smartHome: 'seed-tag-013',
  // Sports
  running: 'seed-tag-014',
  basketball: 'seed-tag-015',
  golf: 'seed-tag-016',
  cycling: 'seed-tag-017',
  yoga: 'seed-tag-018',
  outdoorGear: 'seed-tag-019',
  // Home
  homeDecor: 'seed-tag-020',
  kitchen: 'seed-tag-021',
  outdoorGarden: 'seed-tag-022',
  furniture: 'seed-tag-023',
  vintageHome: 'seed-tag-024',
  // Collectibles
  tradingCards: 'seed-tag-025',
  vinylRecords: 'seed-tag-026',
  sneakerCollecting: 'seed-tag-027',
  watches: 'seed-tag-028',
  art: 'seed-tag-029',
  coinsCurrency: 'seed-tag-030',
  sportsMemorabilia: 'seed-tag-031',
  funkoFigures: 'seed-tag-032',
  // Lifestyle
  books: 'seed-tag-033',
  fitness: 'seed-tag-034',
  beauty: 'seed-tag-035',
  musicalInstruments: 'seed-tag-036',
  craftsDiy: 'seed-tag-037',
};

const USER_INTEREST_IDS = {
  // Buyer 1 interests
  b1_i1: 'seed-ui-001', b1_i2: 'seed-ui-002', b1_i3: 'seed-ui-003', b1_i4: 'seed-ui-004',
  // Buyer 2 interests
  b2_i1: 'seed-ui-005', b2_i2: 'seed-ui-006', b2_i3: 'seed-ui-007',
  // Buyer 3 interests
  b3_i1: 'seed-ui-008', b3_i2: 'seed-ui-009', b3_i3: 'seed-ui-010', b3_i4: 'seed-ui-011', b3_i5: 'seed-ui-012',
};

export async function seedPersonalization(db: PostgresJsDatabase): Promise<void> {
  const now = new Date();
  const daysAgo = (days: number) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const daysFromNow = (days: number) => new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

  // 1. Interest Tags — all groups from the Personalization Canonical
  await db.insert(interestTag).values([
    // Fashion
    { id: TAG_IDS.streetwear, slug: 'streetwear', label: 'Streetwear', group: 'fashion', cardEmphasis: 'social', displayOrder: 0, isActive: true },
    { id: TAG_IDS.vintage, slug: 'vintage', label: 'Vintage Fashion', group: 'fashion', cardEmphasis: 'social', displayOrder: 1, isActive: true },
    { id: TAG_IDS.designer, slug: 'designer', label: 'Designer', group: 'fashion', cardEmphasis: 'social', displayOrder: 2, isActive: true },
    { id: TAG_IDS.athleisure, slug: 'athleisure', label: 'Athleisure', group: 'fashion', cardEmphasis: 'social', displayOrder: 3, isActive: true },
    { id: TAG_IDS.y2k, slug: 'y2k', label: 'Y2K', group: 'fashion', cardEmphasis: 'social', displayOrder: 4, isActive: true },
    { id: TAG_IDS.cottagecore, slug: 'cottagecore', label: 'Cottagecore', group: 'fashion', cardEmphasis: 'social', displayOrder: 5, isActive: true },
    { id: TAG_IDS.sustainableFashion, slug: 'sustainable-fashion', label: 'Sustainable Fashion', group: 'fashion', cardEmphasis: 'social', displayOrder: 6, isActive: true },
    // Electronics
    { id: TAG_IDS.smartphones, slug: 'smartphones', label: 'Smartphones', group: 'electronics', cardEmphasis: 'specs', displayOrder: 0, isActive: true },
    { id: TAG_IDS.laptops, slug: 'laptops', label: 'Laptops', group: 'electronics', cardEmphasis: 'specs', displayOrder: 1, isActive: true },
    { id: TAG_IDS.gaming, slug: 'gaming', label: 'Gaming', group: 'electronics', cardEmphasis: 'specs', displayOrder: 2, isActive: true },
    { id: TAG_IDS.audio, slug: 'audio', label: 'Audio', group: 'electronics', cardEmphasis: 'specs', displayOrder: 3, isActive: true },
    { id: TAG_IDS.cameras, slug: 'cameras', label: 'Cameras', group: 'electronics', cardEmphasis: 'specs', displayOrder: 4, isActive: true },
    { id: TAG_IDS.smartHome, slug: 'smart-home', label: 'Smart Home', group: 'electronics', cardEmphasis: 'specs', displayOrder: 5, isActive: true },
    // Sports
    { id: TAG_IDS.running, slug: 'running', label: 'Running', group: 'sports', cardEmphasis: 'default', displayOrder: 0, isActive: true },
    { id: TAG_IDS.basketball, slug: 'basketball', label: 'Basketball', group: 'sports', cardEmphasis: 'default', displayOrder: 1, isActive: true },
    { id: TAG_IDS.golf, slug: 'golf', label: 'Golf', group: 'sports', cardEmphasis: 'default', displayOrder: 2, isActive: true },
    { id: TAG_IDS.cycling, slug: 'cycling', label: 'Cycling', group: 'sports', cardEmphasis: 'default', displayOrder: 3, isActive: true },
    { id: TAG_IDS.yoga, slug: 'yoga', label: 'Yoga', group: 'sports', cardEmphasis: 'default', displayOrder: 4, isActive: true },
    { id: TAG_IDS.outdoorGear, slug: 'outdoor-gear', label: 'Outdoor Gear', group: 'sports', cardEmphasis: 'default', displayOrder: 5, isActive: true },
    // Home
    { id: TAG_IDS.homeDecor, slug: 'home-decor', label: 'Home Decor', group: 'home', cardEmphasis: 'default', displayOrder: 0, isActive: true },
    { id: TAG_IDS.kitchen, slug: 'kitchen', label: 'Kitchen', group: 'home', cardEmphasis: 'default', displayOrder: 1, isActive: true },
    { id: TAG_IDS.outdoorGarden, slug: 'outdoor-garden', label: 'Outdoor & Garden', group: 'home', cardEmphasis: 'default', displayOrder: 2, isActive: true },
    { id: TAG_IDS.furniture, slug: 'furniture', label: 'Furniture', group: 'home', cardEmphasis: 'default', displayOrder: 3, isActive: true },
    { id: TAG_IDS.vintageHome, slug: 'vintage-home', label: 'Vintage Home', group: 'home', cardEmphasis: 'default', displayOrder: 4, isActive: true },
    // Collectibles
    { id: TAG_IDS.tradingCards, slug: 'trading-cards', label: 'Trading Cards', group: 'collectibles', cardEmphasis: 'collectible', displayOrder: 0, isActive: true },
    { id: TAG_IDS.vinylRecords, slug: 'vinyl-records', label: 'Vinyl Records', group: 'collectibles', cardEmphasis: 'collectible', displayOrder: 1, isActive: true },
    { id: TAG_IDS.sneakerCollecting, slug: 'sneaker-collecting', label: 'Sneaker Collecting', group: 'collectibles', cardEmphasis: 'collectible', displayOrder: 2, isActive: true },
    { id: TAG_IDS.watches, slug: 'watches', label: 'Watches', group: 'collectibles', cardEmphasis: 'collectible', displayOrder: 3, isActive: true },
    { id: TAG_IDS.art, slug: 'art', label: 'Art', group: 'collectibles', cardEmphasis: 'collectible', displayOrder: 4, isActive: true },
    { id: TAG_IDS.coinsCurrency, slug: 'coins-currency', label: 'Coins & Currency', group: 'collectibles', cardEmphasis: 'collectible', displayOrder: 5, isActive: true },
    { id: TAG_IDS.sportsMemorabilia, slug: 'sports-memorabilia', label: 'Sports Memorabilia', group: 'collectibles', cardEmphasis: 'collectible', displayOrder: 6, isActive: true },
    { id: TAG_IDS.funkoFigures, slug: 'funko-figures', label: 'Funko & Figures', group: 'collectibles', cardEmphasis: 'collectible', displayOrder: 7, isActive: true },
    // Lifestyle
    { id: TAG_IDS.books, slug: 'books', label: 'Books', group: 'lifestyle', cardEmphasis: 'default', displayOrder: 0, isActive: true },
    { id: TAG_IDS.fitness, slug: 'fitness', label: 'Fitness', group: 'lifestyle', cardEmphasis: 'default', displayOrder: 1, isActive: true },
    { id: TAG_IDS.beauty, slug: 'beauty', label: 'Beauty', group: 'lifestyle', cardEmphasis: 'default', displayOrder: 2, isActive: true },
    { id: TAG_IDS.musicalInstruments, slug: 'musical-instruments', label: 'Musical Instruments', group: 'lifestyle', cardEmphasis: 'default', displayOrder: 3, isActive: true },
    { id: TAG_IDS.craftsDiy, slug: 'crafts-diy', label: 'Crafts & DIY', group: 'lifestyle', cardEmphasis: 'default', displayOrder: 4, isActive: true },
  ]).onConflictDoNothing();

  // 2. User Interests (12 total: 4 for buyer1, 3 for buyer2, 5 for buyer3)
  await db.insert(userInterest).values([
    // Buyer 1: tech enthusiast
    { id: USER_INTEREST_IDS.b1_i1, userId: USER_IDS.buyer1, tagSlug: 'gaming', weight: '10.0', source: 'EXPLICIT', expiresAt: null, createdAt: daysAgo(30) },
    { id: USER_INTEREST_IDS.b1_i2, userId: USER_IDS.buyer1, tagSlug: 'smartphones', weight: '1.8', source: 'PURCHASE', expiresAt: null, createdAt: daysAgo(20) },
    { id: USER_INTEREST_IDS.b1_i3, userId: USER_IDS.buyer1, tagSlug: 'sneaker-collecting', weight: '1.2', source: 'WATCHLIST', expiresAt: daysFromNow(60), createdAt: daysAgo(10) },
    { id: USER_INTEREST_IDS.b1_i4, userId: USER_IDS.buyer1, tagSlug: 'outdoor-gear', weight: '0.8', source: 'CLICK', expiresAt: daysFromNow(30), createdAt: daysAgo(5) },

    // Buyer 2: fashion + collectibles focus
    { id: USER_INTEREST_IDS.b2_i1, userId: USER_IDS.buyer2, tagSlug: 'designer', weight: '10.0', source: 'EXPLICIT', expiresAt: null, createdAt: daysAgo(45) },
    { id: USER_INTEREST_IDS.b2_i2, userId: USER_IDS.buyer2, tagSlug: 'vintage', weight: '1.5', source: 'PURCHASE', expiresAt: null, createdAt: daysAgo(15) },
    { id: USER_INTEREST_IDS.b2_i3, userId: USER_IDS.buyer2, tagSlug: 'watches', weight: '1.3', source: 'WATCHLIST', expiresAt: daysFromNow(45), createdAt: daysAgo(8) },

    // Buyer 3: diverse interests
    { id: USER_INTEREST_IDS.b3_i1, userId: USER_IDS.buyer3, tagSlug: 'home-decor', weight: '10.0', source: 'EXPLICIT', expiresAt: null, createdAt: daysAgo(60) },
    { id: USER_INTEREST_IDS.b3_i2, userId: USER_IDS.buyer3, tagSlug: 'vintage', weight: '10.0', source: 'EXPLICIT', expiresAt: null, createdAt: daysAgo(60) },
    { id: USER_INTEREST_IDS.b3_i3, userId: USER_IDS.buyer3, tagSlug: 'outdoor-gear', weight: '1.5', source: 'PURCHASE', expiresAt: null, createdAt: daysAgo(25) },
    { id: USER_INTEREST_IDS.b3_i4, userId: USER_IDS.buyer3, tagSlug: 'gaming', weight: '1.0', source: 'SEARCH', expiresAt: daysFromNow(30), createdAt: daysAgo(7) },
    { id: USER_INTEREST_IDS.b3_i5, userId: USER_IDS.buyer3, tagSlug: 'sneaker-collecting', weight: '0.7', source: 'CLICK', expiresAt: daysFromNow(14), createdAt: daysAgo(3) },
  ]).onConflictDoNothing();
}

// Export IDs for use in other seeders
export const PERSONALIZATION_IDS = {
  tags: TAG_IDS,
  userInterests: USER_INTEREST_IDS,
};
