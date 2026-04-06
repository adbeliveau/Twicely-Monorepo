/**
 * seed-demo.ts — Comprehensive demo seed (20 users, ~112 listings, full lifecycle)
 *
 * Run: cd packages/db && npx tsx src/seed/seed-demo.ts
 * All IDs prefixed `seed-demo-` for easy identification.
 * Password for all users: DemoPass123!
 */
import crypto from 'crypto';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import {
  user, account, sellerProfile, businessInfo,
  listing, listingImage, listingOffer,
  order, orderItem,
  review, sellerPerformance, buyerReview,
  storeSubscription, listerSubscription, financeSubscription, bundleSubscription,
  storefront, storefrontCustomCategory,
  shippingProfile,
  promotion, promotedListing,
  follow, watchlistItem, savedSearch,
  conversation, message,
  helpdeskCase, caseMessage,
  enforcementAction, contentReport,
  affiliate, referral, promoCode,
  crosslisterAccount, channelProjection, importBatch,
  localTransaction, safeMeetupLocation,
  sellerScoreSnapshot,
} from '../schema';
import { CATEGORY_IDS } from './seed-categories';

// ─── Password Helper ────────────────────────────────────────
function hashDemoPassword(): string {
  const fixedSalt = Buffer.from('476b6aa85662638ff0a546cecfa44780', 'hex');
  const hash = crypto.scryptSync('DemoPass123!', fixedSalt, 64);
  return `${fixedSalt.toString('hex')}:${hash.toString('hex')}`;
}

// ─── Date Helpers ───────────────────────────────────────────
const NOW = new Date();
const ago = (days: number) => new Date(NOW.getTime() - days * 86_400_000);
const future = (days: number) => new Date(NOW.getTime() + days * 86_400_000);

// ─── Hardcoded IDs ──────────────────────────────────────────
const U = {
  olivia:   'seed-demo-u01', marcus:   'seed-demo-u02', sarah:    'seed-demo-u03',
  jake:     'seed-demo-u04', diana:    'seed-demo-u05', ryan:     'seed-demo-u06',
  priya:    'seed-demo-u07', bob:      'seed-demo-u08', mia:      'seed-demo-u09',
  alex:     'seed-demo-u10', emma:     'seed-demo-u11', james:    'seed-demo-u12',
  sofia:    'seed-demo-u13', liam:     'seed-demo-u14', noah:     'seed-demo-u15',
  ava:      'seed-demo-u16', ethan:    'seed-demo-u17', isabella: 'seed-demo-u18',
  daniel:   'seed-demo-u19', zoe:      'seed-demo-u20',
} as const;

const SP = {
  olivia: 'seed-demo-sp01', marcus: 'seed-demo-sp02', sarah:  'seed-demo-sp03',
  jake:   'seed-demo-sp04', diana:  'seed-demo-sp05', ryan:   'seed-demo-sp06',
  priya:  'seed-demo-sp07', bob:    'seed-demo-sp08', mia:    'seed-demo-sp09',
  liam:   'seed-demo-sp14', ava:    'seed-demo-sp16', ethan:  'seed-demo-sp17',
  zoe:    'seed-demo-sp20',
} as const;

// Listing IDs: seed-demo-l001 .. seed-demo-l112
const L: string[] = [];
for (let i = 1; i <= 112; i++) L.push(`seed-demo-l${String(i).padStart(3, '0')}`);

// Order IDs
const O: string[] = [];
for (let i = 1; i <= 40; i++) O.push(`seed-demo-o${String(i).padStart(3, '0')}`);

// ─── Unsplash Image URLs ────────────────────────────────────
const img = (id: string) => `https://images.unsplash.com/photo-${id}?w=800&q=80&fit=crop`;
const IMAGES = {
  // Phones
  iphone:     img('1592899677977-9c10ca588bbd'),
  samsung:    img('1610945415295-d67c20e5e5a0'),
  pixel:      img('1598327105666-5b89351aff97'),
  ipad:       img('1544244015-0df4b3ffc6b0'),
  oneplus:    img('1585060544812-6b45742d762f'),
  galaxyTab:  img('1561154464-82e9adf32764'),
  // Computers
  macbookPro: img('1517336714731-489689fd1ca8'),
  dellXps:    img('1593642632559-0c6d3fc62b89'),
  macbookAir: img('1611186871348-b1ce696e52c9'),
  thinkpad:   img('1588872657578-7efd1f1555ed'),
  rogLaptop:  img('1593642702749-b7d2a804c1ea'),
  surface:    img('1612815154858-60aa4c59eaa6'),
  hpSpectre:  img('1496181133206-80ce9b88a853'),
  // Cameras
  sonyA7:     img('1516035069371-29a1b244cc32'),
  canonR6:    img('1502920917128-1aa500764cbd'),
  fujiXT5:    img('1581591524425-c7e0978cca44'),
  djiDrone:   img('1473968512647-3e447244af8f'),
  gopro:      img('1526170375885-4d8ecf77b99f'),
  nikonZ6:    img('1495707902641-a3b5f64e6a94'),
  // Apparel Women
  lululemon:  img('1506629082955-511b1aa562c8'),
  freePeople: img('1515886657613-9f3515b0c78f'),
  reformation:img('1594938298603-c8148c4dae35'),
  aritzia:    img('1591369822527-2100ad9ea04b'),
  anthro:     img('1496747611176-843222e1e57c'),
  allsaints:  img('1551028719-00167b16eac5'),
  // Apparel Men
  patagonia:  img('1556821840-3a63f95609a7'),
  ralphLauren:img('1602810318383-e386cc2a3ccf'),
  carhartt:   img('1591047139829-d91aecb6caea'),
  arcteryx:   img('1544966503-7cc5c5f0e51c'),
  // Shoes
  jordan:     img('1542291026-7eec264c27ff'),
  newBalance: img('1539185441755-769473a23570'),
  birkenstock:img('1603487742131-4160ec999306'),
  everlane:   img('1543163521-1bf539c55dd2'),
  ultraboost: img('1556906781-9a412961c28c'),
  // Watches & Jewelry
  rolex:      img('1523170335258-f5ed11844a49'),
  omega:      img('1524805444758-089113d48a6d'),
  cartier:    img('1515562141-5a400c6153d8'),
  // Handbags
  lv:         img('1548036328-c11d31192c95'),
  chanel:     img('1584917865442-de89df76afd3'),
  hermes:     img('1566150905458-c3eb21691164'),
  // Trading Cards
  pokemon:    img('1613771404721-1f92b2e86e4e'),
  mtg:        img('1578662996442-48f60103fc96'),
  yugioh:     img('1606107557195-0e29a4b5b4aa'),
  // Kitchen & Home
  leCreuset:  img('1556909114-f6e7ad7d3136'),
  kitchenaid: img('1574269909862-7e1d70bb8078'),
  aeron:      img('1524758631624-e2822e304c36'),
  westElm:    img('1555041469-a586c94d1ba2'),
  // Garden
  weber:      img('1555658636-6cf4e4ef2b7b'),
  traeger:    img('1558618666-fcd25c85f1aa'),
  // Collectibles
  vintageWatch: img('1508685096489-7aacd43f6d8d'),
  // Furniture
  diningTable:  img('1617806118233-18e1de247200'),
  bookshelf:    img('1594620302200-9a762e3015b0'),
};

// ─── 1. SEED USERS ──────────────────────────────────────────
async function seedDemoUsers(db: PostgresJsDatabase) {
  const pw = hashDemoPassword();

  const users: (typeof user.$inferInsert)[] = [
    { id: U.olivia, name: 'Olivia Chen', email: 'olivia@demo.twicely.co', emailVerified: true, username: 'olivia_chen', isSeller: true, completedPurchaseCount: 2, isBanned: false, marketingOptIn: true },
    { id: U.marcus, name: 'Marcus Rivera', email: 'marcus@demo.twicely.co', emailVerified: true, username: 'marcus_rivera', isSeller: true, completedPurchaseCount: 0, isBanned: false, marketingOptIn: true },
    { id: U.sarah, name: 'Sarah Kim', email: 'sarah@demo.twicely.co', emailVerified: true, username: 'sarah_kim', isSeller: true, completedPurchaseCount: 1, isBanned: false, marketingOptIn: false },
    { id: U.jake, name: 'Jake Thompson', email: 'jake@demo.twicely.co', emailVerified: true, username: 'jake_t', isSeller: true, completedPurchaseCount: 0, isBanned: false, marketingOptIn: false },
    { id: U.diana, name: 'Diana Okafor', email: 'diana@demo.twicely.co', emailVerified: true, username: 'diana_okafor', isSeller: true, completedPurchaseCount: 0, isBanned: false, marketingOptIn: true },
    { id: U.ryan, name: 'Ryan Mitchell', email: 'ryan@demo.twicely.co', emailVerified: true, username: 'ryan_mitchell', isSeller: true, completedPurchaseCount: 0, isBanned: false, marketingOptIn: false, localTransactionCount: 8, localCompletionRate: 0.95 },
    { id: U.priya, name: 'Priya Patel', email: 'priya@demo.twicely.co', emailVerified: true, username: 'priya_patel', isSeller: true, completedPurchaseCount: 0, isBanned: false, marketingOptIn: true },
    { id: U.bob, name: 'Bob Harris', email: 'bob@demo.twicely.co', emailVerified: true, username: 'bob_harris', isSeller: true, completedPurchaseCount: 0, isBanned: true, bannedAt: ago(10), bannedReason: 'Multiple policy violations', marketingOptIn: false },
    { id: U.mia, name: 'Mia Zhang', email: 'mia@demo.twicely.co', emailVerified: true, username: 'mia_zhang', isSeller: true, completedPurchaseCount: 0, isBanned: false, marketingOptIn: false },
    { id: U.alex, name: 'Alex Torres', email: 'alex@demo.twicely.co', emailVerified: true, username: 'alex_torres', isSeller: false, completedPurchaseCount: 3, isBanned: false, marketingOptIn: true },
    { id: U.emma, name: 'Emma Brooks', email: 'emma@demo.twicely.co', emailVerified: true, username: 'emma_brooks', isSeller: false, completedPurchaseCount: 8, isBanned: false, marketingOptIn: true },
    { id: U.james, name: 'James Wilson', email: 'james@demo.twicely.co', emailVerified: true, username: 'james_wilson', isSeller: false, completedPurchaseCount: 4, isBanned: false, marketingOptIn: false },
    { id: U.sofia, name: 'Sofia Garcia', email: 'sofia@demo.twicely.co', emailVerified: false, username: 'sofia_garcia', isSeller: false, completedPurchaseCount: 0, isBanned: false, marketingOptIn: false },
    { id: U.liam, name: "Liam O'Brien", email: 'liam@demo.twicely.co', emailVerified: true, username: 'liam_obrien', isSeller: true, completedPurchaseCount: 5, isBanned: false, marketingOptIn: true },
    { id: U.noah, name: 'Noah Kim', email: 'noah@demo.twicely.co', emailVerified: true, username: 'noah_kim', isSeller: false, completedPurchaseCount: 6, isBanned: false, marketingOptIn: false },
    { id: U.ava, name: 'Ava Martinez', email: 'ava@demo.twicely.co', emailVerified: true, username: 'ava_martinez', isSeller: true, completedPurchaseCount: 0, isBanned: false, marketingOptIn: false },
    { id: U.ethan, name: 'Ethan Park', email: 'ethan@demo.twicely.co', emailVerified: true, username: 'ethan_park', isSeller: true, completedPurchaseCount: 1, isBanned: false, marketingOptIn: true },
    { id: U.isabella, name: 'Isabella Wright', email: 'isabella@demo.twicely.co', emailVerified: true, username: 'isabella_w', isSeller: false, completedPurchaseCount: 2, isBanned: false, marketingOptIn: false },
    { id: U.daniel, name: 'Daniel Lee', email: 'daniel@demo.twicely.co', emailVerified: true, username: 'daniel_lee', isSeller: false, completedPurchaseCount: 3, isBanned: false, marketingOptIn: false, localTransactionCount: 5, localCompletionRate: 1.0 },
    { id: U.zoe, name: 'Zoe Harper', email: 'zoe@demo.twicely.co', emailVerified: true, username: 'zoe_harper', isSeller: true, completedPurchaseCount: 0, isBanned: false, marketingOptIn: true },
  ];
  await db.insert(user).values(users).onConflictDoNothing();

  // Accounts (credential)
  const accounts: (typeof account.$inferInsert)[] = Object.entries(U).map(([key, id]) => ({
    id: `seed-demo-acct-${key}`,
    userId: id,
    accountId: id,
    providerId: 'credential',
    password: pw,
  }));
  await db.insert(account).values(accounts).onConflictDoNothing();
}

// ─── 2. SEED SELLER PROFILES ────────────────────────────────
async function seedDemoSellerProfiles(db: PostgresJsDatabase) {
  const profiles: (typeof sellerProfile.$inferInsert)[] = [
    { id: SP.olivia, userId: U.olivia, sellerType: 'PERSONAL', storeTier: 'POWER', listerTier: 'PRO', performanceBand: 'POWER_SELLER', status: 'ACTIVE', payoutsEnabled: true, storeName: "Olivia's Tech & Style", storeSlug: 'olivia-tech-style', handlingTimeDays: 1, vacationMode: false, stripeOnboarded: true, trustScore: 98, isNew: false, sellerScore: 95, hasAutomation: true, financeTier: 'PRO', bundleTier: 'POWER' },
    { id: SP.marcus, userId: U.marcus, sellerType: 'PERSONAL', storeTier: 'PRO', listerTier: 'LITE', performanceBand: 'TOP_RATED', status: 'ACTIVE', payoutsEnabled: true, storeName: 'Rivera Luxury', storeSlug: 'rivera-luxury', handlingTimeDays: 2, vacationMode: false, stripeOnboarded: true, trustScore: 96, isAuthenticatedSeller: true, isNew: false, sellerScore: 90 },
    { id: SP.sarah, userId: U.sarah, sellerType: 'PERSONAL', storeTier: 'STARTER', listerTier: 'LITE', performanceBand: 'ESTABLISHED', status: 'ACTIVE', payoutsEnabled: true, storeName: "Sarah's Fashion", storeSlug: 'sarahs-fashion', handlingTimeDays: 2, vacationMode: false, stripeOnboarded: true, trustScore: 85, isNew: false, sellerScore: 78 },
    { id: SP.jake, userId: U.jake, sellerType: 'PERSONAL', storeTier: 'NONE', listerTier: 'FREE', performanceBand: 'EMERGING', status: 'ACTIVE', payoutsEnabled: false, storeName: "Jake's Finds", storeSlug: 'jakes-finds', handlingTimeDays: 3, vacationMode: false, stripeOnboarded: false, trustScore: 60, isNew: true, sellerScore: 50 },
    { id: SP.diana, userId: U.diana, sellerType: 'BUSINESS', storeTier: 'ENTERPRISE', listerTier: 'PRO', performanceBand: 'POWER_SELLER', status: 'ACTIVE', payoutsEnabled: true, storeName: 'Okafor Enterprise', storeSlug: 'okafor-enterprise', handlingTimeDays: 1, vacationMode: false, stripeOnboarded: true, trustScore: 99, isNew: false, sellerScore: 97, hasAutomation: true, financeTier: 'PRO' },
    { id: SP.ryan, userId: U.ryan, sellerType: 'PERSONAL', storeTier: 'STARTER', listerTier: 'FREE', performanceBand: 'ESTABLISHED', status: 'ACTIVE', payoutsEnabled: true, storeName: 'Ryan Local Deals', storeSlug: 'ryan-local-deals', handlingTimeDays: 0, vacationMode: false, stripeOnboarded: true, trustScore: 82, maxMeetupDistanceMiles: 25 },
    { id: SP.priya, userId: U.priya, sellerType: 'PERSONAL', storeTier: 'PRO', listerTier: 'PRO', performanceBand: 'TOP_RATED', status: 'ACTIVE', payoutsEnabled: true, storeName: "Priya's Crosslist", storeSlug: 'priyas-crosslist', handlingTimeDays: 2, vacationMode: false, stripeOnboarded: true, trustScore: 92, isNew: false, sellerScore: 88 },
    { id: SP.bob, userId: U.bob, sellerType: 'PERSONAL', storeTier: 'NONE', listerTier: 'FREE', performanceBand: 'SUSPENDED', status: 'SUSPENDED', payoutsEnabled: false, storeName: "Bob's Deals", storeSlug: 'bobs-deals', handlingTimeDays: 5, vacationMode: false, stripeOnboarded: false, trustScore: 10, enforcementLevel: 'SUSPENSION', enforcementStartedAt: ago(10), sellerScore: 15 },
    { id: SP.mia, userId: U.mia, sellerType: 'PERSONAL', storeTier: 'STARTER', listerTier: 'LITE', performanceBand: 'ESTABLISHED', status: 'ACTIVE', payoutsEnabled: true, storeName: "Mia's Wardrobe", storeSlug: 'mias-wardrobe', handlingTimeDays: 3, vacationMode: true, vacationMessage: 'On vacation until next week!', vacationModeType: 'PAUSE_SALES', stripeOnboarded: true, trustScore: 84 },
    { id: SP.liam, userId: U.liam, sellerType: 'PERSONAL', storeTier: 'STARTER', listerTier: 'LITE', performanceBand: 'EMERGING', status: 'ACTIVE', payoutsEnabled: true, storeName: "Liam's Camera Gear", storeSlug: 'liams-camera-gear', handlingTimeDays: 3, vacationMode: false, stripeOnboarded: true, trustScore: 72, isNew: false, sellerScore: 65 },
    { id: SP.ava, userId: U.ava, sellerType: 'PERSONAL', storeTier: 'STARTER', listerTier: 'FREE', performanceBand: 'EMERGING', status: 'ACTIVE', payoutsEnabled: false, storeName: "Ava's Home", storeSlug: 'avas-home', handlingTimeDays: 3, vacationMode: false, stripeOnboarded: false, trustScore: 55, isNew: true, trialStoreUsed: true },
    { id: SP.ethan, userId: U.ethan, sellerType: 'PERSONAL', storeTier: 'PRO', listerTier: 'PRO', performanceBand: 'ESTABLISHED', status: 'ACTIVE', payoutsEnabled: true, storeName: "Ethan's Collectibles", storeSlug: 'ethans-collectibles', handlingTimeDays: 2, vacationMode: false, stripeOnboarded: true, trustScore: 87, bundleTier: 'PRO', isNew: false, sellerScore: 82 },
    { id: SP.zoe, userId: U.zoe, sellerType: 'PERSONAL', storeTier: 'PRO', listerTier: 'LITE', performanceBand: 'ESTABLISHED', status: 'ACTIVE', payoutsEnabled: true, storeName: "Zoe's Closet", storeSlug: 'zoes-closet', handlingTimeDays: 2, vacationMode: false, stripeOnboarded: true, trustScore: 80, isNew: false, sellerScore: 75 },
  ];
  await db.insert(sellerProfile).values(profiles).onConflictDoNothing();

  // Business info for Diana (Enterprise / Corporation)
  await db.insert(businessInfo).values({
    id: 'seed-demo-bi01',
    userId: U.diana,
    businessName: 'Okafor Enterprise LLC',
    businessType: 'CORPORATION',
    address1: '100 Commerce Blvd',
    city: 'Chicago',
    state: 'IL',
    zip: '60601',
    country: 'US',
    phone: '+13125550100',
  }).onConflictDoNothing();
}

// ─── 3. SEED SUBSCRIPTIONS ──────────────────────────────────
async function seedDemoSubscriptions(db: PostgresJsDatabase) {
  const periodStart = ago(15);
  const periodEnd = future(15);
  const trialEnd = future(7);

  // Store subscriptions
  await db.insert(storeSubscription).values([
    { id: 'seed-demo-ss01', sellerProfileId: SP.olivia, tier: 'POWER', status: 'ACTIVE', currentPeriodStart: periodStart, currentPeriodEnd: periodEnd },
    { id: 'seed-demo-ss02', sellerProfileId: SP.marcus, tier: 'PRO', status: 'ACTIVE', currentPeriodStart: periodStart, currentPeriodEnd: periodEnd },
    { id: 'seed-demo-ss03', sellerProfileId: SP.sarah, tier: 'STARTER', status: 'ACTIVE', currentPeriodStart: periodStart, currentPeriodEnd: periodEnd },
    { id: 'seed-demo-ss05', sellerProfileId: SP.diana, tier: 'ENTERPRISE', status: 'ACTIVE', currentPeriodStart: periodStart, currentPeriodEnd: periodEnd },
    { id: 'seed-demo-ss06', sellerProfileId: SP.ryan, tier: 'STARTER', status: 'ACTIVE', currentPeriodStart: periodStart, currentPeriodEnd: periodEnd },
    { id: 'seed-demo-ss07', sellerProfileId: SP.priya, tier: 'PRO', status: 'ACTIVE', currentPeriodStart: periodStart, currentPeriodEnd: periodEnd },
    { id: 'seed-demo-ss09', sellerProfileId: SP.mia, tier: 'STARTER', status: 'ACTIVE', currentPeriodStart: periodStart, currentPeriodEnd: periodEnd },
    { id: 'seed-demo-ss14', sellerProfileId: SP.liam, tier: 'STARTER', status: 'ACTIVE', currentPeriodStart: periodStart, currentPeriodEnd: periodEnd },
    { id: 'seed-demo-ss16', sellerProfileId: SP.ava, tier: 'STARTER', status: 'TRIALING', trialEndsAt: trialEnd, currentPeriodStart: periodStart, currentPeriodEnd: periodEnd },
    { id: 'seed-demo-ss17', sellerProfileId: SP.ethan, tier: 'PRO', status: 'ACTIVE', currentPeriodStart: periodStart, currentPeriodEnd: periodEnd },
    { id: 'seed-demo-ss20', sellerProfileId: SP.zoe, tier: 'PRO', status: 'PAST_DUE', currentPeriodStart: ago(35), currentPeriodEnd: ago(5) },
  ]).onConflictDoNothing();

  // Lister subscriptions
  await db.insert(listerSubscription).values([
    { id: 'seed-demo-ls01', sellerProfileId: SP.olivia, tier: 'PRO', status: 'ACTIVE', currentPeriodStart: periodStart, currentPeriodEnd: periodEnd },
    { id: 'seed-demo-ls02', sellerProfileId: SP.marcus, tier: 'LITE', status: 'ACTIVE', currentPeriodStart: periodStart, currentPeriodEnd: periodEnd },
    { id: 'seed-demo-ls03', sellerProfileId: SP.sarah, tier: 'LITE', status: 'ACTIVE', currentPeriodStart: periodStart, currentPeriodEnd: periodEnd },
    { id: 'seed-demo-ls05', sellerProfileId: SP.diana, tier: 'PRO', status: 'ACTIVE', currentPeriodStart: periodStart, currentPeriodEnd: periodEnd },
    { id: 'seed-demo-ls07', sellerProfileId: SP.priya, tier: 'PRO', status: 'ACTIVE', currentPeriodStart: periodStart, currentPeriodEnd: periodEnd },
    { id: 'seed-demo-ls14', sellerProfileId: SP.liam, tier: 'LITE', status: 'ACTIVE', currentPeriodStart: periodStart, currentPeriodEnd: periodEnd },
    { id: 'seed-demo-ls17', sellerProfileId: SP.ethan, tier: 'PRO', status: 'ACTIVE', currentPeriodStart: periodStart, currentPeriodEnd: periodEnd },
  ]).onConflictDoNothing();

  // Finance subscriptions
  await db.insert(financeSubscription).values([
    { id: 'seed-demo-fs01', sellerProfileId: SP.olivia, tier: 'PRO', status: 'ACTIVE', currentPeriodStart: periodStart, currentPeriodEnd: periodEnd },
    { id: 'seed-demo-fs05', sellerProfileId: SP.diana, tier: 'PRO', status: 'ACTIVE', currentPeriodStart: periodStart, currentPeriodEnd: periodEnd },
  ]).onConflictDoNothing();

  // Bundle subscriptions
  await db.insert(bundleSubscription).values([
    { id: 'seed-demo-bs01', sellerProfileId: SP.olivia, tier: 'POWER', status: 'ACTIVE', currentPeriodStart: periodStart, currentPeriodEnd: periodEnd },
    { id: 'seed-demo-bs17', sellerProfileId: SP.ethan, tier: 'PRO', status: 'ACTIVE', currentPeriodStart: periodStart, currentPeriodEnd: periodEnd },
  ]).onConflictDoNothing();
}

// ─── 4. SEED STOREFRONTS ────────────────────────────────────
async function seedDemoStorefronts(db: PostgresJsDatabase) {
  await db.insert(storefront).values([
    { id: 'seed-demo-sf01', ownerUserId: U.olivia, slug: 'olivia-tech-style', name: "Olivia's Tech & Style", bannerUrl: 'https://placehold.co/1200x300/3b82f6/fff?text=Olivia+Tech', logoUrl: 'https://placehold.co/200x200/3b82f6/fff?text=OC', accentColor: '#3b82f6', announcement: 'Free shipping on all orders over $100!', isPublished: true, vacationMode: false, defaultView: 'GRID' },
    { id: 'seed-demo-sf02', ownerUserId: U.marcus, slug: 'rivera-luxury', name: 'Rivera Luxury', bannerUrl: 'https://placehold.co/1200x300/1c1917/fbbf24?text=Rivera+Luxury', logoUrl: 'https://placehold.co/200x200/1c1917/fbbf24?text=RL', accentColor: '#fbbf24', announcement: 'Authentication certificate included with every purchase', isPublished: true, vacationMode: false, defaultView: 'LIST' },
    { id: 'seed-demo-sf03', ownerUserId: U.sarah, slug: 'sarahs-fashion', name: "Sarah's Fashion", bannerUrl: 'https://placehold.co/1200x300/ec4899/fff?text=Sarahs+Fashion', logoUrl: 'https://placehold.co/200x200/ec4899/fff?text=SK', accentColor: '#ec4899', isPublished: true, vacationMode: false, defaultView: 'GRID' },
    { id: 'seed-demo-sf05', ownerUserId: U.diana, slug: 'okafor-enterprise', name: 'Okafor Enterprise', bannerUrl: 'https://placehold.co/1200x300/059669/fff?text=Okafor+Enterprise', logoUrl: 'https://placehold.co/200x200/059669/fff?text=OE', accentColor: '#059669', isPublished: true, vacationMode: false, defaultView: 'GRID' },
    { id: 'seed-demo-sf07', ownerUserId: U.priya, slug: 'priyas-crosslist', name: "Priya's Crosslist", bannerUrl: 'https://placehold.co/1200x300/8b5cf6/fff?text=Priyas+Crosslist', logoUrl: 'https://placehold.co/200x200/8b5cf6/fff?text=PP', accentColor: '#8b5cf6', isPublished: true, vacationMode: false, defaultView: 'GRID' },
    { id: 'seed-demo-sf09', ownerUserId: U.mia, slug: 'mias-wardrobe', name: "Mia's Wardrobe", bannerUrl: 'https://placehold.co/1200x300/f59e0b/fff?text=Mias+Wardrobe', logoUrl: 'https://placehold.co/200x200/f59e0b/fff?text=MZ', accentColor: '#f59e0b', announcement: 'On vacation - back soon!', isPublished: true, vacationMode: true, defaultView: 'GRID' },
    { id: 'seed-demo-sf17', ownerUserId: U.ethan, slug: 'ethans-collectibles', name: "Ethan's Collectibles", bannerUrl: 'https://placehold.co/1200x300/dc2626/fff?text=Ethans+Collectibles', logoUrl: 'https://placehold.co/200x200/dc2626/fff?text=EP', accentColor: '#dc2626', isPublished: true, vacationMode: false, defaultView: 'GRID' },
    { id: 'seed-demo-sf20', ownerUserId: U.zoe, slug: 'zoes-closet', name: "Zoe's Closet", bannerUrl: 'https://placehold.co/1200x300/6366f1/fff?text=Zoes+Closet', logoUrl: 'https://placehold.co/200x200/6366f1/fff?text=ZH', accentColor: '#6366f1', isPublished: true, vacationMode: false, defaultView: 'GRID' },
  ]).onConflictDoNothing();
}

// ─── 5. SEED SHIPPING PROFILES ──────────────────────────────
async function seedDemoShippingProfiles(db: PostgresJsDatabase) {
  await db.insert(shippingProfile).values([
    { id: 'seed-demo-ship01', userId: U.olivia, name: 'Standard Electronics', carrier: 'USPS', service: 'Priority', handlingTimeDays: 1, isDefault: true },
    { id: 'seed-demo-ship02', userId: U.marcus, name: 'Insured Luxury', carrier: 'FedEx', service: 'Express', handlingTimeDays: 1, isDefault: true },
    { id: 'seed-demo-ship03', userId: U.sarah, name: 'Fashion Standard', carrier: 'USPS', service: 'First Class', handlingTimeDays: 2, isDefault: true },
    { id: 'seed-demo-ship05', userId: U.diana, name: 'Enterprise Shipping', carrier: 'UPS', service: 'Ground', handlingTimeDays: 1, isDefault: true },
    { id: 'seed-demo-ship06', userId: U.ryan, name: 'Local Pickup Only', carrier: 'LOCAL', handlingTimeDays: 0, isDefault: true },
    { id: 'seed-demo-ship07', userId: U.priya, name: 'Multi-Platform Ship', carrier: 'USPS', service: 'Priority', handlingTimeDays: 2, isDefault: true },
    { id: 'seed-demo-ship17', userId: U.ethan, name: 'Collectibles Insured', carrier: 'USPS', service: 'Priority Express', handlingTimeDays: 1, isDefault: true },
    { id: 'seed-demo-ship20', userId: U.zoe, name: 'Apparel Standard', carrier: 'USPS', service: 'First Class', handlingTimeDays: 2, isDefault: true },
  ]).onConflictDoNothing();
}

// ─── EXPORT & MAIN ──────────────────────────────────────────
export {
  U as DEMO_USER_IDS,
  SP as DEMO_SELLER_PROFILE_IDS,
  L as DEMO_LISTING_IDS,
  O as DEMO_ORDER_IDS,
};

export async function seedDemo(db: PostgresJsDatabase): Promise<void> {
  console.log('[seed-demo] Starting comprehensive demo seed...');

  console.log('[seed-demo] 1/9 Users & accounts...');
  await seedDemoUsers(db);

  console.log('[seed-demo] 2/9 Seller profiles...');
  await seedDemoSellerProfiles(db);

  console.log('[seed-demo] 3/9 Subscriptions...');
  await seedDemoSubscriptions(db);

  console.log('[seed-demo] 4/9 Storefronts...');
  await seedDemoStorefronts(db);

  console.log('[seed-demo] 5/9 Shipping profiles...');
  await seedDemoShippingProfiles(db);

  console.log('[seed-demo] 6/9 Listings & images...');
  await seedDemoListings(db);

  console.log('[seed-demo] 7/9 Orders, reviews, offers...');
  await seedDemoCommerce(db);

  console.log('[seed-demo] 8/9 Social, promotions, performance...');
  await seedDemoSocialAndPromos(db);

  console.log('[seed-demo] 9/9 Helpdesk, enforcement, affiliates, crosslister, local...');
  await seedDemoMisc(db);

  console.log('[seed-demo] Done! 20 users, ~112 listings seeded.');
}

// Placeholder functions — will be filled in next
async function seedDemoListings(db: PostgresJsDatabase) {
  type LI = typeof listing.$inferInsert;
  type II = typeof listingImage.$inferInsert;
  const listings: LI[] = [];
  const images: II[] = [];
  let idx = 0;

  function add(owner: string, title: string, cat: string, cents: number, cond: string, status: string, imgUrl: string, opts?: Partial<LI>) {
    const id = L[idx]!;
    listings.push({
      id, ownerUserId: owner, status: status as LI['status'], title,
      description: `${title}. Quality guaranteed.`,
      categoryId: cat, condition: cond as LI['condition'],
      priceCents: cents, currency: 'USD', quantity: 1,
      availableQuantity: status === 'SOLD' || status === 'REMOVED' ? 0 : 1,
      soldQuantity: status === 'SOLD' ? 1 : 0,
      slug: `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 45)}-${id}`,
      allowOffers: cents > 5000, freeShipping: cents >= 10000,
      shippingCents: cents >= 10000 ? 0 : 899,
      enforcementState: status === 'REMOVED' ? 'REMOVED' : 'CLEAR',
      tags: [title.split(' ')[0]!.toLowerCase()],
      autoRenew: true,
      activatedAt: status === 'DRAFT' ? undefined : ago(20 - (idx % 20)),
      soldAt: status === 'SOLD' ? ago(5 + (idx % 10)) : undefined,
      createdAt: ago(25 - (idx % 20)),
      updatedAt: ago(1 + (idx % 5)),
      ...opts,
    });
    images.push({
      id: `seed-demo-img${String(idx + 1).padStart(3, '0')}`,
      listingId: id, url: imgUrl, position: 0, isPrimary: true,
      width: 800, height: 800, altText: title,
    });
    idx++;
  }

  const C = CATEGORY_IDS;

  // Olivia (18): Electronics + Apparel, mixed statuses
  add(U.olivia, 'iPhone 14 Pro Max 256GB', C.phones, 89900, 'LIKE_NEW', 'ACTIVE', IMAGES.iphone);
  add(U.olivia, 'Samsung Galaxy S23 Ultra', C.phones, 79900, 'VERY_GOOD', 'ACTIVE', IMAGES.samsung);
  add(U.olivia, 'Google Pixel 7 Pro', C.phones, 54900, 'GOOD', 'ACTIVE', IMAGES.pixel);
  add(U.olivia, 'iPad Air 5th Gen 64GB', C.phones, 44900, 'LIKE_NEW', 'SOLD', IMAGES.ipad);
  add(U.olivia, 'MacBook Pro 14" M2 Pro', C.computers, 159900, 'LIKE_NEW', 'ACTIVE', IMAGES.macbookPro);
  add(U.olivia, 'Dell XPS 15 Intel i7', C.computers, 129900, 'VERY_GOOD', 'ACTIVE', IMAGES.dellXps);
  add(U.olivia, 'MacBook Air M2 256GB', C.computers, 89900, 'LIKE_NEW', 'SOLD', IMAGES.macbookAir);
  add(U.olivia, 'Lenovo ThinkPad X1 Carbon', C.computers, 119900, 'GOOD', 'ACTIVE', IMAGES.thinkpad);
  add(U.olivia, 'Sony A7 IV Mirrorless Camera', C.cameras, 199900, 'LIKE_NEW', 'ACTIVE', IMAGES.sonyA7);
  add(U.olivia, 'Canon EOS R6 Mark II', C.cameras, 189900, 'VERY_GOOD', 'ACTIVE', IMAGES.canonR6);
  add(U.olivia, 'Fujifilm X-T5 Silver', C.cameras, 149900, 'LIKE_NEW', 'ACTIVE', IMAGES.fujiXT5);
  add(U.olivia, 'DJI Mini 3 Pro Drone', C.cameras, 75900, 'VERY_GOOD', 'SOLD', IMAGES.djiDrone);
  add(U.olivia, 'Lululemon Align Leggings', C.womens, 6800, 'LIKE_NEW', 'ACTIVE', IMAGES.lululemon);
  add(U.olivia, 'Free People Maxi Dress', C.womens, 8500, 'VERY_GOOD', 'ACTIVE', IMAGES.freePeople);
  add(U.olivia, 'Nike Air Jordan 1 Retro', C.shoes, 22500, 'NEW_WITH_TAGS', 'RESERVED', IMAGES.jordan);
  add(U.olivia, 'New Balance 990v5 Grey', C.shoes, 17500, 'LIKE_NEW', 'PAUSED', IMAGES.newBalance);
  add(U.olivia, 'Samsung Galaxy Tab S9+', C.phones, 69900, 'LIKE_NEW', 'ACTIVE', IMAGES.galaxyTab);
  add(U.olivia, 'OnePlus 11 5G 256GB', C.phones, 59900, 'LIKE_NEW', 'DRAFT', IMAGES.oneplus);

  // Marcus (10): Watches + Handbags (luxury)
  add(U.marcus, 'Rolex Submariner Date', C.watches, 1150000, 'LIKE_NEW', 'ACTIVE', IMAGES.rolex, { authenticationStatus: 'EXPERT_AUTHENTICATED' });
  add(U.marcus, 'Omega Speedmaster Moonwatch', C.watches, 550000, 'VERY_GOOD', 'ACTIVE', IMAGES.omega, { authenticationStatus: 'EXPERT_AUTHENTICATED' });
  add(U.marcus, 'Cartier Love Bracelet 18K', C.watches, 680000, 'LIKE_NEW', 'ACTIVE', IMAGES.cartier, { authenticationStatus: 'SELLER_VERIFIED' });
  add(U.marcus, 'Louis Vuitton Neverfull MM', C.handbags, 145000, 'VERY_GOOD', 'ACTIVE', IMAGES.lv, { authenticationStatus: 'EXPERT_AUTHENTICATED' });
  add(U.marcus, 'Chanel Classic Flap Medium', C.handbags, 750000, 'LIKE_NEW', 'ACTIVE', IMAGES.chanel, { authenticationStatus: 'EXPERT_AUTHENTICATED' });
  add(U.marcus, 'Hermes Birkin 30 Togo Gold', C.handbags, 1450000, 'VERY_GOOD', 'ACTIVE', IMAGES.hermes, { authenticationStatus: 'EXPERT_AUTHENTICATED' });
  add(U.marcus, 'Vintage Rolex Datejust 36mm', C.watches, 850000, 'GOOD', 'ACTIVE', IMAGES.vintageWatch, { authenticationStatus: 'SELLER_VERIFIED' });
  add(U.marcus, 'TAG Heuer Carrera Chrono', C.watches, 320000, 'LIKE_NEW', 'SOLD', IMAGES.omega);
  add(U.marcus, 'Gucci GG Marmont Mini Bag', C.handbags, 120000, 'VERY_GOOD', 'ACTIVE', IMAGES.lv);
  add(U.marcus, 'Prada Saffiano Tote Black', C.handbags, 180000, 'LIKE_NEW', 'SOLD', IMAGES.chanel);

  // Sarah (8): Women's + Shoes
  add(U.sarah, 'Reformation Silk Midi Skirt', C.womens, 9500, 'LIKE_NEW', 'ACTIVE', IMAGES.reformation);
  add(U.sarah, 'Aritzia Babaton Blazer', C.womens, 12500, 'VERY_GOOD', 'ACTIVE', IMAGES.aritzia);
  add(U.sarah, 'Anthropologie Wrap Dress', C.womens, 7800, 'GOOD', 'ACTIVE', IMAGES.anthro);
  add(U.sarah, 'AllSaints Leather Biker Jacket', C.womens, 29900, 'GOOD', 'ACTIVE', IMAGES.allsaints);
  add(U.sarah, 'Birkenstock Arizona Sandals', C.shoes, 9900, 'VERY_GOOD', 'ACTIVE', IMAGES.birkenstock);
  add(U.sarah, 'Everlane Day Glove Flat', C.shoes, 6500, 'LIKE_NEW', 'ACTIVE', IMAGES.everlane);
  add(U.sarah, 'Adidas Ultraboost 22', C.shoes, 12900, 'VERY_GOOD', 'SOLD', IMAGES.ultraboost);
  add(U.sarah, 'Zara Oversized Coat Camel', C.womens, 8900, 'GOOD', 'DRAFT', IMAGES.aritzia);

  // Jake (3): Computers + Phones (new seller)
  add(U.jake, 'HP Spectre x360 OLED', C.computers, 109900, 'VERY_GOOD', 'ACTIVE', IMAGES.hpSpectre);
  add(U.jake, 'iPhone 13 128GB Starlight', C.phones, 49900, 'GOOD', 'ACTIVE', IMAGES.iphone);
  add(U.jake, 'ASUS ROG Gaming Laptop', C.computers, 139900, 'LIKE_NEW', 'DRAFT', IMAGES.rogLaptop);

  // Diana (12): Electronics + Computers (enterprise)
  add(U.diana, 'Dell PowerEdge Server R740', C.computers, 289900, 'NEW_WITHOUT_TAGS', 'ACTIVE', IMAGES.dellXps);
  add(U.diana, 'Cisco Meraki MR46 AP', C.computers, 89900, 'NEW_WITH_TAGS', 'ACTIVE', IMAGES.surface);
  add(U.diana, 'HP EliteBook 840 G9', C.computers, 119900, 'LIKE_NEW', 'ACTIVE', IMAGES.hpSpectre);
  add(U.diana, 'Lenovo ThinkStation P360', C.computers, 179900, 'NEW_WITHOUT_TAGS', 'ACTIVE', IMAGES.thinkpad);
  add(U.diana, 'Apple Mac Studio M2 Ultra', C.computers, 399900, 'LIKE_NEW', 'ACTIVE', IMAGES.macbookPro);
  add(U.diana, 'Dell UltraSharp 32" 4K Monitor', C.computers, 64900, 'LIKE_NEW', 'ACTIVE', IMAGES.dellXps);
  add(U.diana, 'Microsoft Surface Hub 2S', C.computers, 499900, 'NEW_WITH_TAGS', 'ACTIVE', IMAGES.surface);
  add(U.diana, 'Samsung Galaxy S24 Ultra Bulk 5x', C.phones, 449900, 'NEW_WITH_TAGS', 'ACTIVE', IMAGES.samsung);
  add(U.diana, 'iPad Pro 12.9" M2 Bulk 3x', C.phones, 329900, 'NEW_WITH_TAGS', 'ACTIVE', IMAGES.ipad);
  add(U.diana, 'Logitech Rally Plus Conference', C.computers, 199900, 'LIKE_NEW', 'ACTIVE', IMAGES.macbookAir);
  add(U.diana, 'Cisco IP Phone 8845 Lot', C.phones, 89900, 'GOOD', 'SOLD', IMAGES.pixel);
  add(U.diana, 'HP LaserJet Enterprise Fleet', C.computers, 259900, 'VERY_GOOD', 'SOLD', IMAGES.hpSpectre);

  // Ryan (6): Furniture + Kitchen (local-only)
  add(U.ryan, 'Herman Miller Aeron Chair B', C.furniture, 89900, 'GOOD', 'ACTIVE', IMAGES.aeron, { fulfillmentType: 'LOCAL_ONLY' });
  add(U.ryan, 'West Elm Coffee Table Walnut', C.furniture, 34900, 'VERY_GOOD', 'ACTIVE', IMAGES.westElm, { fulfillmentType: 'LOCAL_ONLY' });
  add(U.ryan, 'KitchenAid Stand Mixer Red', C.kitchen, 29900, 'VERY_GOOD', 'ACTIVE', IMAGES.kitchenaid, { fulfillmentType: 'LOCAL_ONLY' });
  add(U.ryan, 'Le Creuset Dutch Oven 5.5qt', C.kitchen, 24900, 'LIKE_NEW', 'ACTIVE', IMAGES.leCreuset, { fulfillmentType: 'LOCAL_ONLY' });
  add(U.ryan, 'Solid Oak Dining Table 6-seat', C.furniture, 75000, 'GOOD', 'SOLD', IMAGES.diningTable, { fulfillmentType: 'LOCAL_ONLY' });
  add(U.ryan, 'IKEA Billy Bookcase Walnut', C.furniture, 12500, 'ACCEPTABLE', 'SOLD', IMAGES.bookshelf, { fulfillmentType: 'LOCAL_ONLY' });

  // Priya (10): Apparel + Shoes (crosslister)
  add(U.priya, 'Patagonia Better Sweater Mens', C.mens, 8900, 'LIKE_NEW', 'ACTIVE', IMAGES.patagonia, { importedFromChannel: 'POSHMARK' });
  add(U.priya, 'Ralph Lauren Polo Classic XL', C.mens, 4500, 'VERY_GOOD', 'ACTIVE', IMAGES.ralphLauren, { importedFromChannel: 'EBAY' });
  add(U.priya, 'Carhartt WIP Detroit Jacket', C.mens, 15900, 'GOOD', 'ACTIVE', IMAGES.carhartt, { importedFromChannel: 'MERCARI' });
  add(U.priya, "Arc'teryx Beta AR Jacket", C.mens, 44900, 'LIKE_NEW', 'ACTIVE', IMAGES.arcteryx);
  add(U.priya, 'Lululemon Scuba Oversized', C.womens, 11800, 'LIKE_NEW', 'ACTIVE', IMAGES.lululemon, { importedFromChannel: 'POSHMARK' });
  add(U.priya, 'Nike Dunk Low Panda', C.shoes, 13500, 'NEW_WITH_TAGS', 'ACTIVE', IMAGES.jordan, { importedFromChannel: 'EBAY' });
  add(U.priya, 'Adidas Samba OG White', C.shoes, 11000, 'LIKE_NEW', 'ACTIVE', IMAGES.ultraboost);
  add(U.priya, 'Converse Chuck 70 High', C.shoes, 7500, 'GOOD', 'ACTIVE', IMAGES.everlane, { importedFromChannel: 'DEPOP' });
  add(U.priya, 'Everlane Way-High Jean', C.womens, 6800, 'VERY_GOOD', 'SOLD', IMAGES.reformation);
  add(U.priya, 'Madewell Transport Tote', C.womens, 14800, 'LIKE_NEW', 'PAUSED', IMAGES.allsaints);

  // Bob (5): All REMOVED (suspended seller)
  add(U.bob, 'Fake iPhone 15 Pro Max', C.phones, 29900, 'NEW_WITH_TAGS', 'REMOVED', IMAGES.iphone);
  add(U.bob, 'Replica Rolex Submariner', C.watches, 15000, 'NEW_WITH_TAGS', 'REMOVED', IMAGES.rolex);
  add(U.bob, 'Knockoff AirPods Pro', C.phones, 4900, 'NEW_WITH_TAGS', 'REMOVED', IMAGES.samsung);
  add(U.bob, 'Counterfeit LV Bag', C.handbags, 8000, 'NEW_WITH_TAGS', 'REMOVED', IMAGES.lv);
  add(U.bob, 'Stolen MacBook Pro 16"', C.computers, 99900, 'LIKE_NEW', 'REMOVED', IMAGES.macbookPro);

  // Mia (8): All PAUSED (vacation mode)
  add(U.mia, 'Zara Knit Midi Dress', C.womens, 6900, 'VERY_GOOD', 'PAUSED', IMAGES.freePeople);
  add(U.mia, 'H&M Oversized Blazer', C.womens, 4500, 'LIKE_NEW', 'PAUSED', IMAGES.aritzia);
  add(U.mia, 'COS Wool Blend Coat', C.womens, 17500, 'LIKE_NEW', 'PAUSED', IMAGES.allsaints);
  add(U.mia, 'Massimo Dutti Silk Blouse', C.womens, 8900, 'VERY_GOOD', 'PAUSED', IMAGES.anthro);
  add(U.mia, 'Uniqlo Cashmere Sweater', C.womens, 7900, 'LIKE_NEW', 'PAUSED', IMAGES.reformation);
  add(U.mia, 'Mango Pleated Skirt', C.womens, 5500, 'GOOD', 'PAUSED', IMAGES.lululemon);
  add(U.mia, 'Sandro Tweed Jacket', C.womens, 22500, 'VERY_GOOD', 'PAUSED', IMAGES.aritzia);
  add(U.mia, 'Reiss Wool Trousers', C.womens, 13500, 'LIKE_NEW', 'PAUSED', IMAGES.freePeople);

  // Liam (6): Cameras + Electronics (buyer-seller hybrid)
  add(U.liam, 'GoPro HERO12 Black', C.cameras, 44900, 'VERY_GOOD', 'ACTIVE', IMAGES.gopro);
  add(U.liam, 'Sony ZV-E10 Vlog Camera', C.cameras, 64900, 'LIKE_NEW', 'ACTIVE', IMAGES.sonyA7);
  add(U.liam, 'DJI Osmo Pocket 3', C.cameras, 39900, 'GOOD', 'ACTIVE', IMAGES.djiDrone);
  add(U.liam, 'Canon EF 50mm f/1.4 Lens', C.cameras, 29900, 'GOOD', 'ACTIVE', IMAGES.canonR6);
  add(U.liam, 'Fujifilm Instax Mini 12', C.cameras, 7900, 'LIKE_NEW', 'SOLD', IMAGES.fujiXT5);
  add(U.liam, 'Ring Light 18" Professional', C.cameras, 4500, 'NEW_WITHOUT_TAGS', 'DRAFT', IMAGES.gopro);

  // Ava (4): Home + Garden (trial user)
  add(U.ava, 'Weber Genesis Gas Grill', C.garden, 79900, 'LIKE_NEW', 'ACTIVE', IMAGES.weber);
  add(U.ava, 'Traeger Pro 575 Pellet', C.garden, 69900, 'VERY_GOOD', 'ACTIVE', IMAGES.traeger);
  add(U.ava, 'Dyson V15 Detect Vacuum', C.kitchen, 54900, 'NEW_WITHOUT_TAGS', 'ACTIVE', IMAGES.kitchenaid);
  add(U.ava, 'Roomba j7+ Self-Emptying', C.kitchen, 44900, 'GOOD', 'DRAFT', IMAGES.leCreuset);

  // Ethan (8): Trading Cards + Collectibles
  add(U.ethan, 'Pokemon Charizard PSA 8', C.tradingCards, 45000, 'VERY_GOOD', 'ACTIVE', IMAGES.pokemon);
  add(U.ethan, 'MTG Black Lotus HP', C.tradingCards, 250000, 'GOOD', 'ACTIVE', IMAGES.mtg);
  add(U.ethan, 'Yu-Gi-Oh Blue Eyes 1st Ed', C.tradingCards, 18500, 'VERY_GOOD', 'ACTIVE', IMAGES.yugioh);
  add(U.ethan, 'Pokemon Booster Box Sealed', C.tradingCards, 35000, 'NEW_WITH_TAGS', 'ACTIVE', IMAGES.pokemon);
  add(U.ethan, 'MTG Commander Legends Box', C.tradingCards, 22000, 'NEW_WITH_TAGS', 'ACTIVE', IMAGES.mtg);
  add(U.ethan, 'Topps Chrome Baseball Hobby', C.tradingCards, 28000, 'NEW_WITH_TAGS', 'ACTIVE', IMAGES.yugioh);
  add(U.ethan, 'Pokemon Pikachu VMAX RR', C.tradingCards, 8500, 'LIKE_NEW', 'SOLD', IMAGES.pokemon);
  add(U.ethan, 'MTG Mox Diamond LP', C.tradingCards, 42000, 'GOOD', 'SOLD', IMAGES.mtg);

  // Zoe (14): Apparel + Mens (past-due subscription)
  add(U.zoe, 'Patagonia Nano Puff Jacket', C.mens, 14900, 'LIKE_NEW', 'ACTIVE', IMAGES.patagonia);
  add(U.zoe, 'J.Crew Ludlow Suit Navy', C.mens, 34900, 'VERY_GOOD', 'ACTIVE', IMAGES.ralphLauren);
  add(U.zoe, 'Brooks Brothers Oxford Shirt', C.mens, 6500, 'GOOD', 'ACTIVE', IMAGES.carhartt);
  add(U.zoe, 'Bonobos Stretch Chinos', C.mens, 5800, 'VERY_GOOD', 'ACTIVE', IMAGES.arcteryx);
  add(U.zoe, 'Theory Wool Blazer Slim', C.mens, 22500, 'LIKE_NEW', 'ACTIVE', IMAGES.aritzia);
  add(U.zoe, 'Vince Cashmere Crew', C.mens, 18500, 'VERY_GOOD', 'ACTIVE', IMAGES.patagonia);
  add(U.zoe, 'Todd Snyder Pocket Tee', C.mens, 6800, 'GOOD', 'ACTIVE', IMAGES.ralphLauren);
  add(U.zoe, 'Barbour Ashby Wax Jacket', C.mens, 27500, 'VERY_GOOD', 'ACTIVE', IMAGES.carhartt);
  add(U.zoe, 'Cole Haan Grand Crosscourt', C.shoes, 9900, 'LIKE_NEW', 'ACTIVE', IMAGES.newBalance);
  add(U.zoe, 'Common Projects Achilles Low', C.shoes, 32000, 'GOOD', 'ACTIVE', IMAGES.everlane);
  add(U.zoe, 'Filson Mackinaw Cruiser', C.mens, 29500, 'VERY_GOOD', 'SOLD', IMAGES.arcteryx);
  add(U.zoe, 'Rag & Bone Fit 2 Slim Jean', C.mens, 16500, 'GOOD', 'SOLD', IMAGES.carhartt);
  add(U.zoe, 'Golden Goose Superstar', C.shoes, 42500, 'LIKE_NEW', 'SOLD', IMAGES.jordan);
  add(U.zoe, 'Norse Projects Nunk Jacket', C.mens, 28500, 'VERY_GOOD', 'PAUSED', IMAGES.patagonia);

  await db.insert(listing).values(listings).onConflictDoNothing();
  await db.insert(listingImage).values(images).onConflictDoNothing();
}
async function seedDemoCommerce(db: PostgresJsDatabase) {
  // ── Orders (25 across various statuses) ──
  const addr = (name: string, city: string, state: string, zip: string) =>
    JSON.stringify({ name, address1: '123 Demo St', city, state, zip, country: 'US' });

  const orders: (typeof order.$inferInsert)[] = [
    // Emma (active buyer) — 8 orders
    { id: O[0], orderNumber: 'TW-D00001', buyerId: U.emma, sellerId: U.olivia, status: 'COMPLETED', itemSubtotalCents: 89900, shippingCents: 0, taxCents: 0, discountCents: 0, totalCents: 89900, shippingAddressJson: addr('Emma Brooks', 'Portland', 'OR', '97201'), paidAt: ago(30), shippedAt: ago(28), deliveredAt: ago(25), completedAt: ago(22) },
    { id: O[1], orderNumber: 'TW-D00002', buyerId: U.emma, sellerId: U.olivia, status: 'COMPLETED', itemSubtotalCents: 44900, shippingCents: 0, taxCents: 0, discountCents: 0, totalCents: 44900, shippingAddressJson: addr('Emma Brooks', 'Portland', 'OR', '97201'), paidAt: ago(25), shippedAt: ago(23), deliveredAt: ago(20), completedAt: ago(17) },
    { id: O[2], orderNumber: 'TW-D00003', buyerId: U.emma, sellerId: U.marcus, status: 'COMPLETED', itemSubtotalCents: 320000, shippingCents: 0, taxCents: 0, discountCents: 0, totalCents: 320000, shippingAddressJson: addr('Emma Brooks', 'Portland', 'OR', '97201'), paidAt: ago(20), shippedAt: ago(18), deliveredAt: ago(15), completedAt: ago(12) },
    { id: O[3], orderNumber: 'TW-D00004', buyerId: U.emma, sellerId: U.sarah, status: 'COMPLETED', itemSubtotalCents: 12900, shippingCents: 899, taxCents: 0, discountCents: 0, totalCents: 13799, shippingAddressJson: addr('Emma Brooks', 'Portland', 'OR', '97201'), paidAt: ago(18), shippedAt: ago(16), deliveredAt: ago(13), completedAt: ago(10) },
    { id: O[4], orderNumber: 'TW-D00005', buyerId: U.emma, sellerId: U.priya, status: 'SHIPPED', itemSubtotalCents: 8900, shippingCents: 899, taxCents: 0, discountCents: 0, totalCents: 9799, shippingAddressJson: addr('Emma Brooks', 'Portland', 'OR', '97201'), paidAt: ago(3), shippedAt: ago(1), trackingNumber: '9400111899223000001' },
    { id: O[5], orderNumber: 'TW-D00006', buyerId: U.emma, sellerId: U.ethan, status: 'COMPLETED', itemSubtotalCents: 8500, shippingCents: 899, taxCents: 0, discountCents: 0, totalCents: 9399, shippingAddressJson: addr('Emma Brooks', 'Portland', 'OR', '97201'), paidAt: ago(15), shippedAt: ago(13), deliveredAt: ago(10), completedAt: ago(7) },
    { id: O[6], orderNumber: 'TW-D00007', buyerId: U.emma, sellerId: U.zoe, status: 'COMPLETED', itemSubtotalCents: 29500, shippingCents: 0, taxCents: 0, discountCents: 0, totalCents: 29500, shippingAddressJson: addr('Emma Brooks', 'Portland', 'OR', '97201'), paidAt: ago(12), shippedAt: ago(10), deliveredAt: ago(7), completedAt: ago(4) },
    { id: O[7], orderNumber: 'TW-D00008', buyerId: U.emma, sellerId: U.liam, status: 'DELIVERED', itemSubtotalCents: 7900, shippingCents: 899, taxCents: 0, discountCents: 0, totalCents: 8799, shippingAddressJson: addr('Emma Brooks', 'Portland', 'OR', '97201'), paidAt: ago(8), shippedAt: ago(6), deliveredAt: ago(2) },

    // James (bargain hunter) — 4 orders
    { id: O[8], orderNumber: 'TW-D00009', buyerId: U.james, sellerId: U.olivia, status: 'COMPLETED', itemSubtotalCents: 89900, shippingCents: 0, taxCents: 0, discountCents: 0, totalCents: 89900, shippingAddressJson: addr('James Wilson', 'Seattle', 'WA', '98101'), paidAt: ago(20), shippedAt: ago(18), deliveredAt: ago(15), completedAt: ago(12) },
    { id: O[9], orderNumber: 'TW-D00010', buyerId: U.james, sellerId: U.sarah, status: 'COMPLETED', itemSubtotalCents: 9500, shippingCents: 899, taxCents: 0, discountCents: 0, totalCents: 10399, shippingAddressJson: addr('James Wilson', 'Seattle', 'WA', '98101'), paidAt: ago(15), shippedAt: ago(13), deliveredAt: ago(10), completedAt: ago(7) },
    { id: O[10], orderNumber: 'TW-D00011', buyerId: U.james, sellerId: U.ethan, status: 'PAID', itemSubtotalCents: 42000, shippingCents: 0, taxCents: 0, discountCents: 0, totalCents: 42000, shippingAddressJson: addr('James Wilson', 'Seattle', 'WA', '98101'), paidAt: ago(1) },
    { id: O[11], orderNumber: 'TW-D00012', buyerId: U.james, sellerId: U.zoe, status: 'CANCELED', itemSubtotalCents: 16500, shippingCents: 0, taxCents: 0, discountCents: 0, totalCents: 16500, shippingAddressJson: addr('James Wilson', 'Seattle', 'WA', '98101'), cancelInitiator: 'BUYER', cancelReason: 'Found a better deal', canceledAt: ago(5) },

    // Noah (dispute buyer) — 6 orders
    { id: O[12], orderNumber: 'TW-D00013', buyerId: U.noah, sellerId: U.olivia, status: 'COMPLETED', itemSubtotalCents: 75900, shippingCents: 0, taxCents: 0, discountCents: 0, totalCents: 75900, shippingAddressJson: addr('Noah Kim', 'Denver', 'CO', '80202'), paidAt: ago(30), shippedAt: ago(28), deliveredAt: ago(25), completedAt: ago(22) },
    { id: O[13], orderNumber: 'TW-D00014', buyerId: U.noah, sellerId: U.marcus, status: 'COMPLETED', itemSubtotalCents: 180000, shippingCents: 0, taxCents: 0, discountCents: 0, totalCents: 180000, shippingAddressJson: addr('Noah Kim', 'Denver', 'CO', '80202'), paidAt: ago(25), shippedAt: ago(23), deliveredAt: ago(20), completedAt: ago(17) },
    { id: O[14], orderNumber: 'TW-D00015', buyerId: U.noah, sellerId: U.diana, status: 'DISPUTED', itemSubtotalCents: 89900, shippingCents: 0, taxCents: 0, discountCents: 0, totalCents: 89900, shippingAddressJson: addr('Noah Kim', 'Denver', 'CO', '80202'), paidAt: ago(15), shippedAt: ago(13), deliveredAt: ago(10) },
    { id: O[15], orderNumber: 'TW-D00016', buyerId: U.noah, sellerId: U.priya, status: 'COMPLETED', itemSubtotalCents: 6800, shippingCents: 899, taxCents: 0, discountCents: 0, totalCents: 7699, shippingAddressJson: addr('Noah Kim', 'Denver', 'CO', '80202'), paidAt: ago(20), shippedAt: ago(18), deliveredAt: ago(15), completedAt: ago(12) },
    { id: O[16], orderNumber: 'TW-D00017', buyerId: U.noah, sellerId: U.zoe, status: 'REFUNDED', itemSubtotalCents: 42500, shippingCents: 0, taxCents: 0, discountCents: 0, totalCents: 42500, shippingAddressJson: addr('Noah Kim', 'Denver', 'CO', '80202'), paidAt: ago(20), shippedAt: ago(18), deliveredAt: ago(15) },
    { id: O[17], orderNumber: 'TW-D00018', buyerId: U.noah, sellerId: U.ethan, status: 'PAID', itemSubtotalCents: 45000, shippingCents: 0, taxCents: 0, discountCents: 0, totalCents: 45000, shippingAddressJson: addr('Noah Kim', 'Denver', 'CO', '80202'), paidAt: ago(2) },

    // Liam (hybrid) — 5 orders as buyer
    { id: O[18], orderNumber: 'TW-D00019', buyerId: U.liam, sellerId: U.olivia, status: 'COMPLETED', itemSubtotalCents: 149900, shippingCents: 0, taxCents: 0, discountCents: 0, totalCents: 149900, shippingAddressJson: addr("Liam O'Brien", 'Austin', 'TX', '78701'), paidAt: ago(25), shippedAt: ago(23), deliveredAt: ago(20), completedAt: ago(17) },
    { id: O[19], orderNumber: 'TW-D00020', buyerId: U.liam, sellerId: U.marcus, status: 'COMPLETED', itemSubtotalCents: 550000, shippingCents: 0, taxCents: 0, discountCents: 0, totalCents: 550000, shippingAddressJson: addr("Liam O'Brien", 'Austin', 'TX', '78701'), paidAt: ago(20), shippedAt: ago(18), deliveredAt: ago(15), completedAt: ago(12) },
    { id: O[20], orderNumber: 'TW-D00021', buyerId: U.liam, sellerId: U.diana, status: 'SHIPPED', itemSubtotalCents: 64900, shippingCents: 0, taxCents: 0, discountCents: 0, totalCents: 64900, shippingAddressJson: addr("Liam O'Brien", 'Austin', 'TX', '78701'), paidAt: ago(4), shippedAt: ago(2), trackingNumber: '9400111899223000021' },
    { id: O[21], orderNumber: 'TW-D00022', buyerId: U.liam, sellerId: U.sarah, status: 'COMPLETED', itemSubtotalCents: 7800, shippingCents: 899, taxCents: 0, discountCents: 0, totalCents: 8699, shippingAddressJson: addr("Liam O'Brien", 'Austin', 'TX', '78701'), paidAt: ago(15), shippedAt: ago(13), deliveredAt: ago(10), completedAt: ago(7) },
    { id: O[22], orderNumber: 'TW-D00023', buyerId: U.liam, sellerId: U.ethan, status: 'COMPLETED', itemSubtotalCents: 22000, shippingCents: 0, taxCents: 0, discountCents: 0, totalCents: 22000, shippingAddressJson: addr("Liam O'Brien", 'Austin', 'TX', '78701'), paidAt: ago(10), shippedAt: ago(8), deliveredAt: ago(5), completedAt: ago(2) },

    // Alex, Isabella, Daniel — misc orders
    { id: O[23], orderNumber: 'TW-D00024', buyerId: U.alex, sellerId: U.olivia, status: 'COMPLETED', itemSubtotalCents: 54900, shippingCents: 0, taxCents: 0, discountCents: 0, totalCents: 54900, shippingAddressJson: addr('Alex Torres', 'Miami', 'FL', '33101'), paidAt: ago(20), shippedAt: ago(18), deliveredAt: ago(15), completedAt: ago(12) },
    { id: O[24], orderNumber: 'TW-D00025', buyerId: U.isabella, sellerId: U.zoe, status: 'COMPLETED', itemSubtotalCents: 14900, shippingCents: 0, taxCents: 0, discountCents: 0, totalCents: 14900, shippingAddressJson: addr('Isabella Wright', 'Boston', 'MA', '02101'), paidAt: ago(15), shippedAt: ago(13), deliveredAt: ago(10), completedAt: ago(7) },
    // Daniel → Ryan local pickup orders
    { id: O[25], orderNumber: 'TW-D00026', buyerId: U.daniel, sellerId: U.ryan, status: 'COMPLETED', itemSubtotalCents: 45000, shippingCents: 0, taxCents: 0, discountCents: 0, totalCents: 45000, shippingAddressJson: addr('Daniel Lee', 'Portland', 'OR', '97211'), paidAt: ago(14), deliveredAt: ago(12), completedAt: ago(12), isLocalPickup: true },
    { id: O[26], orderNumber: 'TW-D00027', buyerId: U.daniel, sellerId: U.ryan, status: 'PAID', itemSubtotalCents: 32000, shippingCents: 0, taxCents: 0, discountCents: 0, totalCents: 32000, shippingAddressJson: addr('Daniel Lee', 'Portland', 'OR', '97211'), paidAt: ago(1), isLocalPickup: true },
  ];
  await db.insert(order).values(orders).onConflictDoNothing();

  // ── Order Items ──
  // Map each order to a listing (using SOLD listings where possible)
  const oi: (typeof orderItem.$inferInsert)[] = [
    { id: 'seed-demo-oi001', orderId: O[0]!, listingId: L[0]!, title: 'iPhone 14 Pro Max 256GB', quantity: 1, unitPriceCents: 89900 },
    { id: 'seed-demo-oi002', orderId: O[1]!, listingId: L[3]!, title: 'iPad Air 5th Gen 64GB', quantity: 1, unitPriceCents: 44900 },
    { id: 'seed-demo-oi003', orderId: O[2]!, listingId: L[25]!, title: 'TAG Heuer Carrera Chrono', quantity: 1, unitPriceCents: 320000 },
    { id: 'seed-demo-oi004', orderId: O[3]!, listingId: L[34]!, title: 'Adidas Ultraboost 22', quantity: 1, unitPriceCents: 12900 },
    { id: 'seed-demo-oi005', orderId: O[4]!, listingId: L[48]!, title: 'Patagonia Better Sweater Mens', quantity: 1, unitPriceCents: 8900 },
    { id: 'seed-demo-oi006', orderId: O[5]!, listingId: L[94]!, title: 'Pokemon Pikachu VMAX RR', quantity: 1, unitPriceCents: 8500 },
    { id: 'seed-demo-oi007', orderId: O[6]!, listingId: L[98]!, title: 'Filson Mackinaw Cruiser', quantity: 1, unitPriceCents: 29500 },
    { id: 'seed-demo-oi008', orderId: O[7]!, listingId: L[82]!, title: 'Fujifilm Instax Mini 12', quantity: 1, unitPriceCents: 7900 },
    { id: 'seed-demo-oi009', orderId: O[8]!, listingId: L[6]!, title: 'MacBook Air M2 256GB', quantity: 1, unitPriceCents: 89900 },
    { id: 'seed-demo-oi010', orderId: O[9]!, listingId: L[28]!, title: 'Reformation Silk Midi Skirt', quantity: 1, unitPriceCents: 9500 },
    { id: 'seed-demo-oi011', orderId: O[10]!, listingId: L[95]!, title: 'MTG Mox Diamond LP', quantity: 1, unitPriceCents: 42000 },
    { id: 'seed-demo-oi012', orderId: O[11]!, listingId: L[99]!, title: 'Rag & Bone Fit 2 Slim Jean', quantity: 1, unitPriceCents: 16500 },
    { id: 'seed-demo-oi013', orderId: O[12]!, listingId: L[11]!, title: 'DJI Mini 3 Pro Drone', quantity: 1, unitPriceCents: 75900 },
    { id: 'seed-demo-oi014', orderId: O[13]!, listingId: L[27]!, title: 'Prada Saffiano Tote Black', quantity: 1, unitPriceCents: 180000 },
    { id: 'seed-demo-oi015', orderId: O[14]!, listingId: L[48]!, title: 'Cisco IP Phone 8845 Lot', quantity: 1, unitPriceCents: 89900 },
    { id: 'seed-demo-oi016', orderId: O[15]!, listingId: L[56]!, title: 'Everlane Way-High Jean', quantity: 1, unitPriceCents: 6800 },
    { id: 'seed-demo-oi017', orderId: O[16]!, listingId: L[100]!, title: 'Golden Goose Superstar', quantity: 1, unitPriceCents: 42500 },
    { id: 'seed-demo-oi018', orderId: O[17]!, listingId: L[88]!, title: 'Pokemon Charizard PSA 8', quantity: 1, unitPriceCents: 45000 },
    { id: 'seed-demo-oi019', orderId: O[18]!, listingId: L[10]!, title: 'Fujifilm X-T5 Silver', quantity: 1, unitPriceCents: 149900 },
    { id: 'seed-demo-oi020', orderId: O[19]!, listingId: L[19]!, title: 'Omega Speedmaster Moonwatch', quantity: 1, unitPriceCents: 550000 },
    { id: 'seed-demo-oi021', orderId: O[20]!, listingId: L[43]!, title: 'Dell UltraSharp 32" 4K Monitor', quantity: 1, unitPriceCents: 64900 },
    { id: 'seed-demo-oi022', orderId: O[21]!, listingId: L[30]!, title: 'Anthropologie Wrap Dress', quantity: 1, unitPriceCents: 7800 },
    { id: 'seed-demo-oi023', orderId: O[22]!, listingId: L[92]!, title: 'MTG Commander Legends Box', quantity: 1, unitPriceCents: 22000 },
    { id: 'seed-demo-oi024', orderId: O[23]!, listingId: L[2]!, title: 'Google Pixel 7 Pro', quantity: 1, unitPriceCents: 54900 },
    { id: 'seed-demo-oi025', orderId: O[24]!, listingId: L[96]!, title: 'Patagonia Nano Puff Jacket', quantity: 1, unitPriceCents: 14900 },
    // Daniel → Ryan local pickup order items
    { id: 'seed-demo-oi026', orderId: O[25]!, listingId: L[57]!, title: 'West Elm Mid-Century Dresser', quantity: 1, unitPriceCents: 45000 },
    { id: 'seed-demo-oi027', orderId: O[26]!, listingId: L[55]!, title: 'Pottery Barn Coffee Table', quantity: 1, unitPriceCents: 32000 },
  ];
  await db.insert(orderItem).values(oi).onConflictDoNothing();

  // ── Reviews (15 seller reviews from completed orders) ──
  const reviews: (typeof review.$inferInsert)[] = [
    { id: 'seed-demo-rv01', orderId: O[0]!, reviewerUserId: U.emma, sellerId: U.olivia, rating: 5, title: 'Perfect condition!', body: 'Exactly as described, fast shipping.', dsrItemAsDescribed: 5, dsrShippingSpeed: 5, dsrCommunication: 5, dsrPackaging: 5, isVerifiedPurchase: true, visibleAt: ago(20) },
    { id: 'seed-demo-rv02', orderId: O[1]!, reviewerUserId: U.emma, sellerId: U.olivia, rating: 5, body: 'Great seller, would buy again.', dsrItemAsDescribed: 5, dsrShippingSpeed: 4, dsrCommunication: 5, dsrPackaging: 5, isVerifiedPurchase: true, visibleAt: ago(15) },
    { id: 'seed-demo-rv03', orderId: O[2]!, reviewerUserId: U.emma, sellerId: U.marcus, rating: 5, title: 'Authentic luxury', body: 'Beautiful watch, came with authentication certificate.', dsrItemAsDescribed: 5, dsrShippingSpeed: 5, dsrCommunication: 5, dsrPackaging: 5, isVerifiedPurchase: true, visibleAt: ago(10) },
    { id: 'seed-demo-rv04', orderId: O[3]!, reviewerUserId: U.emma, sellerId: U.sarah, rating: 4, body: 'Good shoes, minor scuff not in photos.', dsrItemAsDescribed: 3, dsrShippingSpeed: 4, dsrCommunication: 4, dsrPackaging: 4, isVerifiedPurchase: true, visibleAt: ago(8) },
    { id: 'seed-demo-rv05', orderId: O[5]!, reviewerUserId: U.emma, sellerId: U.ethan, rating: 5, body: 'Card was in great condition, well packaged.', dsrItemAsDescribed: 5, dsrShippingSpeed: 5, dsrCommunication: 5, dsrPackaging: 5, isVerifiedPurchase: true, visibleAt: ago(5) },
    { id: 'seed-demo-rv06', orderId: O[6]!, reviewerUserId: U.emma, sellerId: U.zoe, rating: 4, body: 'Nice jacket. Shipping took a few days.', dsrItemAsDescribed: 5, dsrShippingSpeed: 3, dsrCommunication: 4, dsrPackaging: 4, isVerifiedPurchase: true, visibleAt: ago(2) },
    { id: 'seed-demo-rv07', orderId: O[8]!, reviewerUserId: U.james, sellerId: U.olivia, rating: 5, body: 'MacBook was flawless.', dsrItemAsDescribed: 5, dsrShippingSpeed: 5, dsrCommunication: 5, dsrPackaging: 5, isVerifiedPurchase: true, visibleAt: ago(10) },
    { id: 'seed-demo-rv08', orderId: O[9]!, reviewerUserId: U.james, sellerId: U.sarah, rating: 4, body: 'Lovely skirt, true to description.', dsrItemAsDescribed: 4, dsrShippingSpeed: 4, dsrCommunication: 5, dsrPackaging: 4, isVerifiedPurchase: true, visibleAt: ago(5) },
    { id: 'seed-demo-rv09', orderId: O[12]!, reviewerUserId: U.noah, sellerId: U.olivia, rating: 3, body: 'Drone works but had cosmetic damage.', dsrItemAsDescribed: 2, dsrShippingSpeed: 4, dsrCommunication: 3, dsrPackaging: 3, isVerifiedPurchase: true, visibleAt: ago(20) },
    { id: 'seed-demo-rv10', orderId: O[13]!, reviewerUserId: U.noah, sellerId: U.marcus, rating: 2, title: 'Disappointed', body: 'Bag had wear not mentioned in listing.', dsrItemAsDescribed: 1, dsrShippingSpeed: 4, dsrCommunication: 2, dsrPackaging: 3, isVerifiedPurchase: true, visibleAt: ago(15) },
    { id: 'seed-demo-rv11', orderId: O[15]!, reviewerUserId: U.noah, sellerId: U.priya, rating: 5, body: 'Perfect! Love the jeans.', dsrItemAsDescribed: 5, dsrShippingSpeed: 5, dsrCommunication: 5, dsrPackaging: 5, isVerifiedPurchase: true, visibleAt: ago(10) },
    { id: 'seed-demo-rv12', orderId: O[18]!, reviewerUserId: U.liam, sellerId: U.olivia, rating: 5, body: 'Camera in perfect condition.', dsrItemAsDescribed: 5, dsrShippingSpeed: 5, dsrCommunication: 5, dsrPackaging: 5, isVerifiedPurchase: true, visibleAt: ago(15) },
    { id: 'seed-demo-rv13', orderId: O[19]!, reviewerUserId: U.liam, sellerId: U.marcus, rating: 5, title: 'Stunning watch', body: 'The Speedmaster is gorgeous. Authentic and well-packaged.', dsrItemAsDescribed: 5, dsrShippingSpeed: 5, dsrCommunication: 5, dsrPackaging: 5, isVerifiedPurchase: true, visibleAt: ago(10) },
    { id: 'seed-demo-rv14', orderId: O[23]!, reviewerUserId: U.alex, sellerId: U.olivia, rating: 4, body: 'Good phone, arrived quickly.', dsrItemAsDescribed: 4, dsrShippingSpeed: 5, dsrCommunication: 4, dsrPackaging: 4, isVerifiedPurchase: true, visibleAt: ago(10) },
    { id: 'seed-demo-rv15', orderId: O[24]!, reviewerUserId: U.isabella, sellerId: U.zoe, rating: 4, body: 'Nice jacket, fits well.', dsrItemAsDescribed: 4, dsrShippingSpeed: 4, dsrCommunication: 4, dsrPackaging: 4, isVerifiedPurchase: true, visibleAt: ago(5) },
  ];
  await db.insert(review).values(reviews).onConflictDoNothing();

  // ── Offers (10 across various statuses) ──
  const offers: (typeof listingOffer.$inferInsert)[] = [
    { id: 'seed-demo-of01', listingId: L[4]!, buyerId: U.james, sellerId: U.olivia, offerCents: 140000, currency: 'USD', status: 'PENDING', type: 'BEST_OFFER', expiresAt: future(2), createdAt: ago(1) },
    { id: 'seed-demo-of02', listingId: L[18]!, buyerId: U.emma, sellerId: U.marcus, offerCents: 1000000, currency: 'USD', status: 'DECLINED', type: 'BEST_OFFER', expiresAt: ago(1), respondedAt: ago(2), createdAt: ago(3) },
    { id: 'seed-demo-of03', listingId: L[22]!, buyerId: U.james, sellerId: U.marcus, offerCents: 600000, currency: 'USD', status: 'PENDING', type: 'BEST_OFFER', expiresAt: future(1), createdAt: ago(1) },
    { id: 'seed-demo-of04', listingId: L[31]!, buyerId: U.emma, sellerId: U.sarah, offerCents: 25000, currency: 'USD', status: 'ACCEPTED', type: 'BEST_OFFER', expiresAt: ago(4), respondedAt: ago(5), createdAt: ago(6) },
    { id: 'seed-demo-of05', listingId: L[89]!, buyerId: U.noah, sellerId: U.ethan, offerCents: 220000, currency: 'USD', status: 'COUNTERED', type: 'BEST_OFFER', expiresAt: ago(1), createdAt: ago(2) },
    { id: 'seed-demo-of06', listingId: L[89]!, buyerId: U.noah, sellerId: U.ethan, offerCents: 235000, currency: 'USD', status: 'PENDING', type: 'BEST_OFFER', parentOfferId: 'seed-demo-of05', counterByRole: 'SELLER', counterCount: 1, expiresAt: future(1), createdAt: ago(1) },
    { id: 'seed-demo-of07', listingId: L[36]!, buyerId: U.james, sellerId: U.jake, offerCents: 95000, currency: 'USD', status: 'EXPIRED', type: 'BEST_OFFER', expiresAt: ago(1), createdAt: ago(4) },
    { id: 'seed-demo-of08', listingId: L[59]!, buyerId: U.daniel, sellerId: U.ryan, offerCents: 80000, currency: 'USD', status: 'ACCEPTED', type: 'BEST_OFFER', expiresAt: ago(9), respondedAt: ago(10), createdAt: ago(11) },
    { id: 'seed-demo-of09', listingId: L[96]!, buyerId: U.sofia, sellerId: U.zoe, offerCents: 12000, currency: 'USD', status: 'PENDING', type: 'BEST_OFFER', expiresAt: future(2), createdAt: ago(1) },
    { id: 'seed-demo-of10', listingId: L[41]!, buyerId: U.liam, sellerId: U.diana, offerCents: 350000, currency: 'USD', status: 'DECLINED', type: 'BEST_OFFER', expiresAt: ago(2), respondedAt: ago(3), createdAt: ago(4) },
  ];
  await db.insert(listingOffer).values(offers).onConflictDoNothing();

  // ── Seller Performance Records ──
  const perf: (typeof sellerPerformance.$inferInsert)[] = [
    { id: 'seed-demo-perf01', sellerProfileId: SP.olivia, totalOrders: 25, completedOrders: 22, canceledOrders: 1, totalReviews: 6, averageRating: 4.7, lateShipmentRate: 0.02, cancelRate: 0.04, returnRate: 0.01, defectRate: 0.01, currentBand: 'POWER_SELLER', displayStars: 4.7, showStars: true, onTimeShippingPct: 0.98 },
    { id: 'seed-demo-perf02', sellerProfileId: SP.marcus, totalOrders: 15, completedOrders: 14, canceledOrders: 0, totalReviews: 3, averageRating: 4.0, lateShipmentRate: 0.0, cancelRate: 0.0, returnRate: 0.05, defectRate: 0.02, currentBand: 'TOP_RATED', displayStars: 4.0, showStars: true, onTimeShippingPct: 1.0 },
    { id: 'seed-demo-perf03', sellerProfileId: SP.sarah, totalOrders: 10, completedOrders: 8, canceledOrders: 1, totalReviews: 2, averageRating: 4.0, lateShipmentRate: 0.05, cancelRate: 0.1, returnRate: 0.02, defectRate: 0.03, currentBand: 'ESTABLISHED', displayStars: 4.0, showStars: true },
    { id: 'seed-demo-perf05', sellerProfileId: SP.diana, totalOrders: 30, completedOrders: 28, canceledOrders: 0, totalReviews: 0, averageRating: null, lateShipmentRate: 0.0, cancelRate: 0.0, returnRate: 0.01, defectRate: 0.0, currentBand: 'POWER_SELLER' },
    { id: 'seed-demo-perf07', sellerProfileId: SP.priya, totalOrders: 12, completedOrders: 11, canceledOrders: 0, totalReviews: 1, averageRating: 5.0, lateShipmentRate: 0.0, cancelRate: 0.0, returnRate: 0.0, defectRate: 0.0, currentBand: 'TOP_RATED', displayStars: 5.0, showStars: true },
    { id: 'seed-demo-perf08', sellerProfileId: SP.bob, totalOrders: 8, completedOrders: 3, canceledOrders: 3, totalReviews: 2, averageRating: 1.5, lateShipmentRate: 0.4, cancelRate: 0.375, returnRate: 0.2, defectRate: 0.5, currentBand: 'SUSPENDED' },
    { id: 'seed-demo-perf17', sellerProfileId: SP.ethan, totalOrders: 8, completedOrders: 7, canceledOrders: 0, totalReviews: 1, averageRating: 5.0, lateShipmentRate: 0.0, cancelRate: 0.0, returnRate: 0.0, defectRate: 0.0, currentBand: 'ESTABLISHED', displayStars: 5.0, showStars: true },
    { id: 'seed-demo-perf20', sellerProfileId: SP.zoe, totalOrders: 10, completedOrders: 8, canceledOrders: 0, totalReviews: 2, averageRating: 4.0, lateShipmentRate: 0.1, cancelRate: 0.0, returnRate: 0.05, defectRate: 0.03, currentBand: 'ESTABLISHED', displayStars: 4.0, showStars: true },
  ];
  await db.insert(sellerPerformance).values(perf).onConflictDoNothing();
}
async function seedDemoSocialAndPromos(db: PostgresJsDatabase) {
  // ── Follows ──
  await db.insert(follow).values([
    { id: 'seed-demo-fol01', followerId: U.emma, followedId: U.olivia },
    { id: 'seed-demo-fol02', followerId: U.emma, followedId: U.marcus },
    { id: 'seed-demo-fol03', followerId: U.emma, followedId: U.sarah },
    { id: 'seed-demo-fol04', followerId: U.emma, followedId: U.ethan },
    { id: 'seed-demo-fol05', followerId: U.james, followedId: U.olivia },
    { id: 'seed-demo-fol06', followerId: U.james, followedId: U.marcus },
    { id: 'seed-demo-fol07', followerId: U.liam, followedId: U.olivia },
    { id: 'seed-demo-fol08', followerId: U.liam, followedId: U.marcus },
    { id: 'seed-demo-fol09', followerId: U.noah, followedId: U.priya },
    { id: 'seed-demo-fol10', followerId: U.alex, followedId: U.olivia },
    { id: 'seed-demo-fol11', followerId: U.daniel, followedId: U.ryan },
    { id: 'seed-demo-fol12', followerId: U.isabella, followedId: U.zoe },
  ]).onConflictDoNothing();

  // ── Watchlist Items ──
  await db.insert(watchlistItem).values([
    { id: 'seed-demo-wl01', userId: U.emma, listingId: L[18]!, notifyPriceDrop: true },
    { id: 'seed-demo-wl02', userId: U.emma, listingId: L[22]! },
    { id: 'seed-demo-wl03', userId: U.james, listingId: L[4]!, notifyPriceDrop: true },
    { id: 'seed-demo-wl04', userId: U.james, listingId: L[89]!, notifyPriceDrop: true },
    { id: 'seed-demo-wl05', userId: U.james, listingId: L[18]! },
    { id: 'seed-demo-wl06', userId: U.liam, listingId: L[8]! },
    { id: 'seed-demo-wl07', userId: U.noah, listingId: L[88]! },
    { id: 'seed-demo-wl08', userId: U.sofia, listingId: L[12]! },
    { id: 'seed-demo-wl09', userId: U.daniel, listingId: L[59]! },
    { id: 'seed-demo-wl10', userId: U.isabella, listingId: L[96]! },
  ]).onConflictDoNothing();

  // ── Saved Searches ──
  await db.insert(savedSearch).values([
    { id: 'seed-demo-ss-01', userId: U.james, name: 'Cheap iPhones', queryJson: { q: 'iphone', maxPrice: 50000, categoryId: CATEGORY_IDS.phones }, notifyNewMatches: true },
    { id: 'seed-demo-ss-02', userId: U.james, name: 'Rolex under 10k', queryJson: { q: 'rolex', maxPrice: 1000000, categoryId: CATEGORY_IDS.watches }, notifyNewMatches: true },
    { id: 'seed-demo-ss-03', userId: U.emma, name: 'Lululemon LIKE_NEW', queryJson: { q: 'lululemon', condition: 'LIKE_NEW' }, notifyNewMatches: true },
    { id: 'seed-demo-ss-04', userId: U.noah, name: 'Pokemon PSA', queryJson: { q: 'pokemon psa', categoryId: CATEGORY_IDS.tradingCards } },
  ]).onConflictDoNothing();

  // ── Promotions ──
  await db.insert(promotion).values([
    { id: 'seed-demo-promo01', sellerId: U.olivia, name: 'Summer Sale 15% Off', type: 'PERCENT_OFF', scope: 'STORE_WIDE', discountPercent: 15, isActive: true, startsAt: ago(5), endsAt: future(10), maxUsesTotal: 50, usageCount: 3 },
    { id: 'seed-demo-promo02', sellerId: U.olivia, name: '$20 Off Electronics', type: 'AMOUNT_OFF', scope: 'CATEGORY', discountAmountCents: 2000, applicableCategoryIds: [CATEGORY_IDS.phones, CATEGORY_IDS.computers], isActive: true, startsAt: ago(2), endsAt: future(5), couponCode: 'OLIVIA20' },
    { id: 'seed-demo-promo03', sellerId: U.marcus, name: 'Luxury Welcome 10%', type: 'PERCENT_OFF', scope: 'STORE_WIDE', discountPercent: 10, isActive: true, startsAt: ago(10), endsAt: future(20), maxUsesPerBuyer: 1, couponCode: 'LUXURY10' },
    { id: 'seed-demo-promo04', sellerId: U.ethan, name: 'Card Collector Special', type: 'PERCENT_OFF', scope: 'STORE_WIDE', discountPercent: 5, isActive: true, startsAt: ago(3), endsAt: future(7) },
    { id: 'seed-demo-promo05', sellerId: U.zoe, name: 'Expired Flash Sale', type: 'PERCENT_OFF', scope: 'STORE_WIDE', discountPercent: 20, isActive: false, startsAt: ago(30), endsAt: ago(20), usageCount: 8 },
  ]).onConflictDoNothing();

  // ── Promoted Listings ──
  await db.insert(promotedListing).values([
    { id: 'seed-demo-pl01', listingId: L[0]!, sellerId: U.olivia, boostPercent: 15, isActive: true, impressions: 1250, clicks: 87, sales: 0 },
    { id: 'seed-demo-pl02', listingId: L[4]!, sellerId: U.olivia, boostPercent: 20, isActive: true, impressions: 890, clicks: 45, sales: 0 },
    { id: 'seed-demo-pl03', listingId: L[8]!, sellerId: U.olivia, boostPercent: 10, isActive: true, impressions: 560, clicks: 32, sales: 0 },
    { id: 'seed-demo-pl04', listingId: L[18]!, sellerId: U.marcus, boostPercent: 25, isActive: true, impressions: 2100, clicks: 156, sales: 0 },
    { id: 'seed-demo-pl05', listingId: L[22]!, sellerId: U.marcus, boostPercent: 20, isActive: true, impressions: 1800, clicks: 134, sales: 0 },
    { id: 'seed-demo-pl06', listingId: L[88]!, sellerId: U.ethan, boostPercent: 15, isActive: true, impressions: 720, clicks: 53, sales: 0 },
    { id: 'seed-demo-pl07', listingId: L[89]!, sellerId: U.ethan, boostPercent: 10, isActive: true, impressions: 450, clicks: 28, sales: 0 },
    { id: 'seed-demo-pl08', listingId: L[96]!, sellerId: U.zoe, boostPercent: 12, isActive: true, impressions: 380, clicks: 22, sales: 1 },
  ]).onConflictDoNothing();

  // ── Seller Score Snapshots ──
  const cs = (shipping: number, inad: number, review: number, response: number, ret: number, cancel: number) =>
    ({ shipping, inad, review, response, return: ret, cancellation: cancel });
  await db.insert(sellerScoreSnapshot).values([
    { id: 'seed-demo-snap01', sellerProfileId: SP.olivia, overallScore: 95, componentScoresJson: cs(950, 980, 920, 900, 960, 970), performanceBand: 'POWER_SELLER', periodStart: ago(30), periodEnd: NOW, orderCount: 25, defectCount: 1 },
    { id: 'seed-demo-snap02', sellerProfileId: SP.marcus, overallScore: 90, componentScoresJson: cs(900, 950, 880, 870, 920, 940), performanceBand: 'TOP_RATED', periodStart: ago(30), periodEnd: NOW, orderCount: 15, defectCount: 1 },
    { id: 'seed-demo-snap03', sellerProfileId: SP.sarah, overallScore: 78, componentScoresJson: cs(800, 750, 780, 760, 800, 790), performanceBand: 'ESTABLISHED', periodStart: ago(30), periodEnd: NOW, orderCount: 10, defectCount: 2 },
    { id: 'seed-demo-snap05', sellerProfileId: SP.diana, overallScore: 97, componentScoresJson: cs(990, 980, 960, 950, 990, 980), performanceBand: 'POWER_SELLER', periodStart: ago(30), periodEnd: NOW, orderCount: 30, defectCount: 0 },
    { id: 'seed-demo-snap07', sellerProfileId: SP.priya, overallScore: 88, componentScoresJson: cs(880, 900, 860, 850, 890, 900), performanceBand: 'TOP_RATED', periodStart: ago(30), periodEnd: NOW, orderCount: 12, defectCount: 0 },
    { id: 'seed-demo-snap08', sellerProfileId: SP.bob, overallScore: 15, componentScoresJson: cs(200, 100, 150, 300, 100, 50), performanceBand: 'SUSPENDED', periodStart: ago(30), periodEnd: NOW, orderCount: 8, defectCount: 5 },
    { id: 'seed-demo-snap17', sellerProfileId: SP.ethan, overallScore: 82, componentScoresJson: cs(850, 820, 800, 810, 830, 840), performanceBand: 'ESTABLISHED', periodStart: ago(30), periodEnd: NOW, orderCount: 8, defectCount: 0 },
    { id: 'seed-demo-snap20', sellerProfileId: SP.zoe, overallScore: 75, componentScoresJson: cs(770, 730, 750, 740, 760, 750), performanceBand: 'ESTABLISHED', periodStart: ago(30), periodEnd: NOW, orderCount: 10, defectCount: 1 },
  ]).onConflictDoNothing();
}
async function seedDemoMisc(db: PostgresJsDatabase) {
  // ── Helpdesk Cases ──
  await db.insert(helpdeskCase).values([
    { id: 'seed-demo-hc01', caseNumber: 'DEMO-001', type: 'SUPPORT', subject: 'Cannot track my shipment', description: 'Tracking number shows no updates for 5 days.', status: 'OPEN', priority: 'NORMAL', requesterId: U.emma, requesterEmail: 'emma@demo.twicely.co', requesterType: 'buyer', orderId: O[4], lastActivityAt: ago(1), createdAt: ago(2) },
    { id: 'seed-demo-hc02', caseNumber: 'DEMO-002', type: 'RETURN', subject: 'Item not as described', description: 'Received a different model than what was listed.', status: 'PENDING_USER', priority: 'HIGH', requesterId: U.noah, requesterEmail: 'noah@demo.twicely.co', requesterType: 'buyer', orderId: O[14], lastActivityAt: ago(1), createdAt: ago(5) },
    { id: 'seed-demo-hc03', caseNumber: 'DEMO-003', type: 'DISPUTE', subject: 'Refund not received', description: 'Order was refunded 10 days ago but no money back yet.', status: 'RESOLVED', priority: 'URGENT', requesterId: U.noah, requesterEmail: 'noah@demo.twicely.co', requesterType: 'buyer', orderId: O[16], resolvedAt: ago(2), lastActivityAt: ago(2), createdAt: ago(10) },
  ]).onConflictDoNothing();

  // ── Helpdesk Messages ──
  await db.insert(caseMessage).values([
    { id: 'seed-demo-cm01', caseId: 'seed-demo-hc01', senderType: 'user', senderId: U.emma, senderName: 'Emma Brooks', direction: 'INBOUND', body: 'My tracking number 9400111899223000001 has not updated in 5 days. Can you help?' },
    { id: 'seed-demo-cm02', caseId: 'seed-demo-hc02', senderType: 'user', senderId: U.noah, senderName: 'Noah Kim', direction: 'INBOUND', body: 'I ordered a Cisco IP Phone 8845 but received a different model. I want to return it.' },
    { id: 'seed-demo-cm03', caseId: 'seed-demo-hc02', senderType: 'system', senderId: 'system', senderName: 'System', direction: 'SYSTEM', body: 'Return request created. Waiting for seller response.' },
    { id: 'seed-demo-cm04', caseId: 'seed-demo-hc03', senderType: 'user', senderId: U.noah, senderName: 'Noah Kim', direction: 'INBOUND', body: 'My refund for the Golden Goose shoes was processed but I have not received it.' },
    { id: 'seed-demo-cm05', caseId: 'seed-demo-hc03', senderType: 'agent', senderId: 'system', senderName: 'Support Agent', direction: 'OUTBOUND', body: 'We have verified the refund was processed. Please allow 5-10 business days for it to appear in your account.' },
  ]).onConflictDoNothing();

  // ── Enforcement Actions (Bob's violations) ──
  await db.insert(enforcementAction).values([
    { id: 'seed-demo-ea01', userId: U.bob, actionType: 'WARNING', trigger: 'CONTENT_REPORT', status: 'EXPIRED', reason: 'Listing removed: suspected counterfeit item', createdAt: ago(30), expiresAt: ago(15) },
    { id: 'seed-demo-ea02', userId: U.bob, actionType: 'RESTRICTION', trigger: 'POLICY_VIOLATION', status: 'EXPIRED', reason: 'Multiple counterfeit listings detected', createdAt: ago(20), expiresAt: ago(12) },
    { id: 'seed-demo-ea03', userId: U.bob, actionType: 'SUSPENSION', trigger: 'SCORE_BASED', status: 'ACTIVE', reason: 'Account suspended: pattern of counterfeit goods and policy violations', createdAt: ago(10) },
  ]).onConflictDoNothing();

  // ── Content Reports (Isabella's reports) ──
  await db.insert(contentReport).values([
    { id: 'seed-demo-cr01', reporterUserId: U.isabella, targetType: 'LISTING', targetId: L[58]!, reason: 'COUNTERFEIT', description: 'This appears to be a fake iPhone listing.', status: 'CONFIRMED', reviewedAt: ago(25), reviewNotes: 'Confirmed counterfeit. Listing removed.' },
    { id: 'seed-demo-cr02', reporterUserId: U.isabella, targetType: 'LISTING', targetId: L[59]!, reason: 'COUNTERFEIT', description: 'Replica Rolex being sold as genuine.', status: 'CONFIRMED', reviewedAt: ago(20), reviewNotes: 'Counterfeit watch confirmed.' },
    { id: 'seed-demo-cr03', reporterUserId: U.isabella, targetType: 'USER', targetId: U.bob, reason: 'COUNTERFEIT', description: 'This seller has multiple counterfeit listings.', status: 'CONFIRMED', reviewedAt: ago(15) },
    { id: 'seed-demo-cr04', reporterUserId: U.isabella, targetType: 'LISTING', targetId: L[96]!, reason: 'MISLEADING', description: 'Price seems too low for this brand, might be fake.', status: 'DISMISSED', reviewedAt: ago(3), reviewNotes: 'Verified authentic by seller.' },
  ]).onConflictDoNothing();

  // ── Affiliate (Alex Torres) ──
  await db.insert(affiliate).values({
    id: 'seed-demo-aff01',
    userId: U.alex,
    tier: 'INFLUENCER',
    status: 'ACTIVE',
    referralCode: 'ALEX2024',
    commissionRateBps: 500,
    cookieDurationDays: 30,
    commissionDurationMonths: 12,
    pendingBalanceCents: 15000,
    availableBalanceCents: 42500,
    totalEarnedCents: 85000,
    totalPaidCents: 27500,
    taxInfoProvided: true,
  }).onConflictDoNothing();

  await db.insert(promoCode).values({
    id: 'seed-demo-pc01',
    code: 'ALEXREFS',
    type: 'AFFILIATE',
    affiliateId: 'seed-demo-aff01',
    discountType: 'PERCENTAGE',
    discountValue: 1000,
    durationMonths: 1,
    isActive: true,
    createdByUserId: U.alex,
  }).onConflictDoNothing();

  await db.insert(referral).values([
    { id: 'seed-demo-ref01', affiliateId: 'seed-demo-aff01', referredUserId: U.emma, status: 'CONVERTED', clickedAt: ago(45), signedUpAt: ago(44), convertedAt: ago(30), expiresAt: ago(15) },
    { id: 'seed-demo-ref02', affiliateId: 'seed-demo-aff01', referredUserId: U.sofia, status: 'SIGNED_UP', clickedAt: ago(10), signedUpAt: ago(9), expiresAt: future(20) },
    { id: 'seed-demo-ref03', affiliateId: 'seed-demo-aff01', status: 'CLICKED', clickedAt: ago(2), utmSource: 'instagram', utmMedium: 'story', expiresAt: future(28) },
  ]).onConflictDoNothing();

  // ── Crosslister (Priya) ──
  await db.insert(crosslisterAccount).values([
    { id: 'seed-demo-cx01', sellerId: U.priya, channel: 'POSHMARK', externalAccountId: 'priya_posh', externalUsername: 'priya_patel', authMethod: 'OAUTH', status: 'ACTIVE', lastSyncAt: ago(1), firstImportCompletedAt: ago(20) },
    { id: 'seed-demo-cx02', sellerId: U.priya, channel: 'EBAY', externalAccountId: 'priya_ebay_123', externalUsername: 'priya.patel.shop', authMethod: 'OAUTH', status: 'ACTIVE', lastSyncAt: ago(1), firstImportCompletedAt: ago(15) },
    { id: 'seed-demo-cx03', sellerId: U.priya, channel: 'MERCARI', externalAccountId: 'priya_mercari', externalUsername: 'priyap', authMethod: 'SESSION', status: 'ACTIVE', lastSyncAt: ago(2), firstImportCompletedAt: ago(10) },
    { id: 'seed-demo-cx04', sellerId: U.priya, channel: 'DEPOP', externalAccountId: 'priya_depop', externalUsername: 'priyastyle', authMethod: 'SESSION', status: 'PAUSED', lastSyncAt: ago(7) },
  ]).onConflictDoNothing();

  await db.insert(importBatch).values({
    id: 'seed-demo-ib01',
    sellerId: U.priya,
    accountId: 'seed-demo-cx01',
    channel: 'POSHMARK',
    status: 'COMPLETED',
    totalItems: 5,
    processedItems: 5,
    createdItems: 3,
    deduplicatedItems: 1,
    failedItems: 0,
    skippedItems: 1,
    isFirstImport: true,
    startedAt: ago(20),
    completedAt: ago(20),
  }).onConflictDoNothing();

  // ── Local Transactions (Ryan ↔ Daniel) ──
  await db.insert(safeMeetupLocation).values({
    id: 'seed-demo-sml01',
    name: 'Portland Police North Precinct',
    address: '449 NE Emerson St',
    city: 'Portland',
    state: 'OR',
    zip: '97211',
    country: 'US',
    latitude: 45.5586,
    longitude: -122.6746,
    type: 'police_station',
    verifiedSafe: true,
    isActive: true,
    meetupCount: 15,
    rating: 4.8,
  }).onConflictDoNothing();

  await db.insert(localTransaction).values([
    { id: 'seed-demo-lt01', orderId: O[25]!, buyerId: U.daniel, sellerId: U.ryan, meetupLocationId: 'seed-demo-sml01', status: 'COMPLETED', scheduledAt: ago(12), sellerCheckedIn: true, sellerCheckedInAt: ago(12), buyerCheckedIn: true, buyerCheckedInAt: ago(12), confirmedAt: ago(12), confirmationMode: 'QR_ONLINE', sellerConfirmationCode: 'SELL-LT01-A1B2', sellerOfflineCode: '1234', buyerConfirmationCode: 'BUY-LT01-C3D4', buyerOfflineCode: '5678' },
    { id: 'seed-demo-lt02', orderId: O[26]!, buyerId: U.daniel, sellerId: U.ryan, meetupLocationId: 'seed-demo-sml01', status: 'SCHEDULED', scheduledAt: future(3), confirmationMode: 'QR_ONLINE', sellerConfirmationCode: 'SELL-LT02-E5F6', sellerOfflineCode: '9012', buyerConfirmationCode: 'BUY-LT02-G7H8', buyerOfflineCode: '3456' },
  ]).onConflictDoNothing();

  // ── Messaging (3 conversations) ──
  await db.insert(conversation).values([
    { id: 'seed-demo-conv01', listingId: L[4]!, buyerId: U.james, sellerId: U.olivia, subject: 'Question about MacBook Pro', status: 'OPEN', lastMessageAt: ago(1), buyerUnreadCount: 0, sellerUnreadCount: 1 },
    { id: 'seed-demo-conv02', listingId: L[18]!, buyerId: U.emma, sellerId: U.marcus, subject: 'Rolex authentication details', status: 'OPEN', lastMessageAt: ago(2), buyerUnreadCount: 1, sellerUnreadCount: 0 },
    { id: 'seed-demo-conv03', listingId: L[59]!, buyerId: U.daniel, sellerId: U.ryan, subject: 'Meetup location for furniture', status: 'OPEN', lastMessageAt: ago(1), buyerUnreadCount: 0, sellerUnreadCount: 0 },
  ]).onConflictDoNothing();

  await db.insert(message).values([
    { id: 'seed-demo-msg01', conversationId: 'seed-demo-conv01', senderUserId: U.james, body: 'Hi! Is the battery health still above 90%?', isRead: true, readAt: ago(1) },
    { id: 'seed-demo-msg02', conversationId: 'seed-demo-conv01', senderUserId: U.olivia, body: 'Yes, battery health is at 94%. Would you like more photos?', isRead: true, readAt: ago(1) },
    { id: 'seed-demo-msg03', conversationId: 'seed-demo-conv01', senderUserId: U.james, body: 'That would be great, thanks! Also, would you accept $1,400?', isRead: false },
    { id: 'seed-demo-msg04', conversationId: 'seed-demo-conv02', senderUserId: U.emma, body: 'Can you share the authentication certificate?', isRead: true, readAt: ago(3) },
    { id: 'seed-demo-msg05', conversationId: 'seed-demo-conv02', senderUserId: U.marcus, body: 'Of course! Here is the certificate number: AUTH-2024-RLX-0451. Full docs available upon purchase.', isRead: false },
    { id: 'seed-demo-msg06', conversationId: 'seed-demo-conv03', senderUserId: U.daniel, body: 'Can we meet at the police precinct on Saturday at 2pm?', isRead: true, readAt: ago(2) },
    { id: 'seed-demo-msg07', conversationId: 'seed-demo-conv03', senderUserId: U.ryan, body: 'Saturday 2pm works! See you there.', isRead: true, readAt: ago(1) },
  ]).onConflictDoNothing();
}
