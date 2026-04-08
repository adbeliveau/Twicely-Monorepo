/**
 * D3-S5: Bundle Component Constants — pure data only
 *
 * Maps each bundle tier to its individual product tiers (store/lister/finance + automation).
 * Lives in a standalone file so client components can import it without pulling in
 * `bundle-resolution.ts` (which transitively imports the postgres-driven price-map).
 *
 * Spec: TWICELY_V3_PRICING_PAYMENTS_PAYOUT_CANONICAL §6.5
 */

import type { StoreTier, ListerTier, FinanceTier, BundleTier } from '@twicely/db/types';

export interface BundleComponents {
  storeTier: StoreTier;
  listerTier: ListerTier;
  financeTier: FinanceTier;
  hasAutomation: boolean;
}

export const BUNDLE_COMPONENTS: Record<BundleTier, BundleComponents> = {
  NONE: { storeTier: 'NONE', listerTier: 'NONE', financeTier: 'FREE', hasAutomation: false },
  STARTER: { storeTier: 'STARTER', listerTier: 'NONE', financeTier: 'PRO', hasAutomation: false },
  PRO: { storeTier: 'PRO', listerTier: 'PRO', financeTier: 'PRO', hasAutomation: false },
  POWER: { storeTier: 'POWER', listerTier: 'PRO', financeTier: 'PRO', hasAutomation: true },
};
