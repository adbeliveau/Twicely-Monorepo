import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { listingQuestion, curatedCollection, curatedCollectionItem, watcherOffer, liveSession, liveSessionProduct } from '../schema';
import { USER_IDS } from './seed-users';
import { LISTING_IDS } from './seed-listings';

// Hardcoded IDs for idempotency
const QUESTION_IDS = {
  q1: 'seed-lq-001', q2: 'seed-lq-002', q3: 'seed-lq-003', q4: 'seed-lq-004', q5: 'seed-lq-005',
};

const COLLECTION_IDS = {
  summer: 'seed-cc-001',
  holiday: 'seed-cc-002',
};

const COLLECTION_ITEM_IDS = {
  ci1: 'seed-cci-001', ci2: 'seed-cci-002', ci3: 'seed-cci-003', ci4: 'seed-cci-004', ci5: 'seed-cci-005',
};

const WATCHER_OFFER_IDS = {
  wo1: 'seed-wo-001',
  wo2: 'seed-wo-002',
};

const LIVE_SESSION_IDS = {
  ended: 'seed-ls-001',
  scheduled: 'seed-ls-002',
};

const LIVE_SESSION_PRODUCT_IDS = {
  lsp1: 'seed-lsp-001',
  lsp2: 'seed-lsp-002',
  lsp3: 'seed-lsp-003',
};

export async function seedSocial(db: PostgresJsDatabase): Promise<void> {
  const now = new Date();
  const daysAgo = (days: number) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const hoursFromNow = (hours: number) => new Date(now.getTime() + hours * 60 * 60 * 1000);

  // 1. Listing Questions (5 across 3 listings: 2 answered, 1 pinned, 2 unanswered)
  await db.insert(listingQuestion).values([
    // Listing 4 (MacBook Pro) - 2 questions, 1 answered & pinned, 1 unanswered
    {
      id: QUESTION_IDS.q1,
      listingId: LISTING_IDS[4]!,
      askerId: USER_IDS.buyer1,
      questionText: 'Does this come with the original charger and box?',
      answerText: 'Yes, it includes the original 96W USB-C charger and the original Apple box with all documentation.',
      answeredAt: daysAgo(3),
      answeredBy: USER_IDS.seller1,
      isPinned: true,
      isHidden: false,
      createdAt: daysAgo(5),
    },
    {
      id: QUESTION_IDS.q2,
      listingId: LISTING_IDS[4]!,
      askerId: USER_IDS.buyer2,
      questionText: 'How many battery cycles does it have?',
      answerText: null,
      answeredAt: null,
      answeredBy: null,
      isPinned: false,
      isHidden: false,
      createdAt: daysAgo(1),
    },
    // Listing 27 (Nike Jordan 1) - 2 questions, 1 answered, 1 unanswered
    {
      id: QUESTION_IDS.q3,
      listingId: LISTING_IDS[27]!,
      askerId: USER_IDS.buyer3,
      questionText: 'What size are these?',
      answerText: 'These are Men\'s US Size 10.',
      answeredAt: daysAgo(2),
      answeredBy: USER_IDS.seller2,
      isPinned: false,
      isHidden: false,
      createdAt: daysAgo(4),
    },
    {
      id: QUESTION_IDS.q4,
      listingId: LISTING_IDS[27]!,
      askerId: USER_IDS.buyer1,
      questionText: 'Are these the high or low version?',
      answerText: null,
      answeredAt: null,
      answeredBy: null,
      isPinned: false,
      isHidden: false,
      createdAt: daysAgo(1),
    },
    // Listing 35 (Pokemon Charizard) - 1 question, answered
    {
      id: QUESTION_IDS.q5,
      listingId: LISTING_IDS[35]!,
      askerId: USER_IDS.buyer2,
      questionText: 'Is this the 1st edition or unlimited?',
      answerText: 'This is an Unlimited Base Set Charizard, graded PSA 8. The case is in perfect condition with no scratches.',
      answeredAt: daysAgo(6),
      answeredBy: USER_IDS.seller3,
      isPinned: false,
      isHidden: false,
      createdAt: daysAgo(8),
    },
  ]).onConflictDoNothing();

  // 2. Curated Collections (2: 1 published, 1 draft)
  const summerStart = new Date(now.getFullYear(), 5, 1); // June 1
  const summerEnd = new Date(now.getFullYear(), 8, 30); // September 30

  await db.insert(curatedCollection).values([
    {
      id: COLLECTION_IDS.summer,
      title: 'Summer Essentials',
      slug: 'summer-essentials',
      description: 'Stay cool and stylish with our curated summer picks. From outdoor gear to beach-ready fashion.',
      coverImageUrl: 'https://placehold.co/1200x600/0ea5e9/fff?text=Summer+Essentials',
      curatedBy: USER_IDS.seller1,
      isPublished: true,
      startDate: summerStart,
      endDate: summerEnd,
      sortOrder: 0,
    },
    {
      id: COLLECTION_IDS.holiday,
      title: 'Holiday Gift Guide',
      slug: 'holiday-gift-guide',
      description: 'Find the perfect gift for everyone on your list. Luxury items, tech gadgets, and more.',
      coverImageUrl: 'https://placehold.co/1200x600/dc2626/fff?text=Holiday+Gifts',
      curatedBy: USER_IDS.seller1,
      isPublished: false,
      startDate: null,
      endDate: null,
      sortOrder: 1,
    },
  ]).onConflictDoNothing();

  // 3. Curated Collection Items (5 in summer collection)
  await db.insert(curatedCollectionItem).values([
    { id: COLLECTION_ITEM_IDS.ci1, collectionId: COLLECTION_IDS.summer, listingId: LISTING_IDS[24]!, sortOrder: 0, addedBy: USER_IDS.seller1 }, // Patagonia fleece
    { id: COLLECTION_ITEM_IDS.ci2, collectionId: COLLECTION_IDS.summer, listingId: LISTING_IDS[28]!, sortOrder: 1, addedBy: USER_IDS.seller1 }, // New Balance
    { id: COLLECTION_ITEM_IDS.ci3, collectionId: COLLECTION_IDS.summer, listingId: LISTING_IDS[49]!, sortOrder: 2, addedBy: USER_IDS.seller1 }, // Traeger grill
    { id: COLLECTION_ITEM_IDS.ci4, collectionId: COLLECTION_IDS.summer, listingId: LISTING_IDS[11]!, sortOrder: 3, addedBy: USER_IDS.seller1 }, // DJI drone
    { id: COLLECTION_ITEM_IDS.ci5, collectionId: COLLECTION_IDS.summer, listingId: LISTING_IDS[29]!, sortOrder: 4, addedBy: USER_IDS.seller1 }, // Birkenstock
  ]).onConflictDoNothing();

  // 4. Watcher Offers (2 from seller1: 1 active, 1 expired)
  await db.insert(watcherOffer).values([
    // Active offer on iPhone listing
    {
      id: WATCHER_OFFER_IDS.wo1,
      listingId: LISTING_IDS[0]!,
      sellerId: USER_IDS.seller1,
      discountedPriceCents: 79900, // $799 (down from $899)
      currency: 'USD',
      expiresAt: hoursFromNow(48),
      watchersNotifiedCount: 3,
      createdAt: daysAgo(1),
    },
    // Expired offer on Samsung listing
    {
      id: WATCHER_OFFER_IDS.wo2,
      listingId: LISTING_IDS[1]!,
      sellerId: USER_IDS.seller1,
      discountedPriceCents: 69900, // $699 (down from $799)
      currency: 'USD',
      expiresAt: daysAgo(2), // Already expired
      watchersNotifiedCount: 5,
      createdAt: daysAgo(5),
    },
  ]).onConflictDoNothing();

  // 5. Live Sessions (2: 1 ended with stats, 1 scheduled for future)
  await db.insert(liveSession).values([
    {
      id: LIVE_SESSION_IDS.ended,
      sellerId: USER_IDS.seller1,
      title: 'Vintage Tech Haul — iPhones, MacBooks & More',
      description: 'Showing off our latest vintage tech finds. Live pricing, Q&A, and exclusive deals.',
      status: 'ENDED',
      scheduledAt: daysAgo(3),
      startedAt: daysAgo(3),
      endedAt: new Date(daysAgo(3).getTime() + 90 * 60 * 1000), // 90 min session
      viewerCount: 0,
      peakViewerCount: 47,
      streamUrl: null,
      thumbnailUrl: 'https://placehold.co/640x360/1e293b/fff?text=Vintage+Tech+Haul',
    },
    {
      id: LIVE_SESSION_IDS.scheduled,
      sellerId: USER_IDS.seller2,
      title: 'Sneaker Drop Preview — Jordan, Yeezy, New Balance',
      description: 'Preview of new sneaker inventory before it goes live. First dibs for viewers!',
      status: 'SCHEDULED',
      scheduledAt: hoursFromNow(72),
      startedAt: null,
      endedAt: null,
      viewerCount: 0,
      peakViewerCount: 0,
      streamUrl: null,
      thumbnailUrl: 'https://placehold.co/640x360/7c3aed/fff?text=Sneaker+Drop',
    },
  ]).onConflictDoNothing();

  // 6. Live Session Products (3 products in the ended session)
  await db.insert(liveSessionProduct).values([
    { id: LIVE_SESSION_PRODUCT_IDS.lsp1, sessionId: LIVE_SESSION_IDS.ended, listingId: LISTING_IDS[0]!, sortOrder: 0, featuredAt: daysAgo(3) },
    { id: LIVE_SESSION_PRODUCT_IDS.lsp2, sessionId: LIVE_SESSION_IDS.ended, listingId: LISTING_IDS[4]!, sortOrder: 1, featuredAt: daysAgo(3) },
    { id: LIVE_SESSION_PRODUCT_IDS.lsp3, sessionId: LIVE_SESSION_IDS.ended, listingId: LISTING_IDS[1]!, sortOrder: 2, featuredAt: daysAgo(3) },
  ]).onConflictDoNothing();
}

// Export IDs for use in other seeders
export const SOCIAL_IDS = {
  questions: QUESTION_IDS,
  collections: COLLECTION_IDS,
  collectionItems: COLLECTION_ITEM_IDS,
  watcherOffers: WATCHER_OFFER_IDS,
  liveSessions: LIVE_SESSION_IDS,
  liveSessionProducts: LIVE_SESSION_PRODUCT_IDS,
};
