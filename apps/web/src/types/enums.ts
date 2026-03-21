// ─── TypeScript Enum Types ──────────────────────────────────────────────────
// Mirrors the Drizzle pgEnum definitions in src/lib/db/schema/enums.ts

// §1.1 Identity & Auth
export type SellerType = 'PERSONAL' | 'BUSINESS';
export type SellerStatus = 'ACTIVE' | 'RESTRICTED' | 'SUSPENDED';

// §1.2 Subscriptions
// v3.2: StoreTier simplified to 5 values (removed BASIC, PREMIUM, ELITE; added POWER)
export type StoreTier = 'NONE' | 'STARTER' | 'PRO' | 'POWER' | 'ENTERPRISE';
export type SubscriptionStatus = 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'PAUSED' | 'TRIALING' | 'PENDING';

// §1.9 Finance
export type FeeBucket = 'ELECTRONICS' | 'APPAREL_ACCESSORIES' | 'HOME_GENERAL' | 'COLLECTIBLES_LUXURY';
// v3.2: ListerTier simplified to 4 values (removed PLUS, POWER, MAX, ENTERPRISE)
export type ListerTier = 'NONE' | 'FREE' | 'LITE' | 'PRO';
export type FinanceTier = 'FREE' | 'PRO';
export type BundleTier = 'NONE' | 'STARTER' | 'PRO' | 'POWER';
// G4.1: SUSPENDED added to enum (admin-only, never score-derived)
export type PerformanceBand = 'POWER_SELLER' | 'TOP_RATED' | 'ESTABLISHED' | 'EMERGING' | 'SUSPENDED';
