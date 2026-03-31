/**
 * TypeScript types derived from Drizzle pgEnum definitions.
 * Use `import type { StoreTier } from '@twicely/db/types'` instead of `@/types/enums`.
 */

import type {
  sellerTypeEnum,
  sellerStatusEnum,
  storeTierEnum,
  listerTierEnum,
  financeTierEnum,
  bundleTierEnum,
  subscriptionStatusEnum,
  feeBucketEnum,
  performanceBandEnum,
} from './schema/enums';

export type SellerType = (typeof sellerTypeEnum.enumValues)[number];
export type SellerStatus = (typeof sellerStatusEnum.enumValues)[number];
export type StoreTier = (typeof storeTierEnum.enumValues)[number];
export type ListerTier = (typeof listerTierEnum.enumValues)[number];
export type FinanceTier = (typeof financeTierEnum.enumValues)[number];
export type BundleTier = (typeof bundleTierEnum.enumValues)[number];
export type SubscriptionStatus = (typeof subscriptionStatusEnum.enumValues)[number];
export type FeeBucket = (typeof feeBucketEnum.enumValues)[number];
export type PerformanceBand = (typeof performanceBandEnum.enumValues)[number];
