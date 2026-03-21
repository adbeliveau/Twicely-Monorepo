// ─── Hub Types ──────────────────────────────────────────────────────────────
// Reference: TWICELY_V3_UNIFIED_HUB_CANONICAL.md §3.1

import type { StoreTier, ListerTier, PerformanceBand, SellerType } from './enums';

/**
 * UserCapabilities — determines what hub sections/items are visible
 *
 * Computed from user + sellerProfile tables. Used by filterHubNav()
 * to show/hide sidebar sections based on capability gates.
 */
export type UserCapabilities = {
  // Identity
  isSeller: boolean;                         // SellerProfile exists + status === ACTIVE
  sellerType: SellerType;                    // 'PERSONAL' | 'BUSINESS'

  // Store Subscription (axis 1)
  storeTier: StoreTier | null;               // v3.2: NONE | STARTER | PRO | POWER | ENTERPRISE
  hasStore: boolean;                         // storeTier !== NONE && sellerType === BUSINESS

  // Crosslister Subscription (axis 2)
  listerTier: ListerTier | null;             // v3.2: NONE | FREE | LITE | PRO
  hasCrosslister: boolean;                   // listerTier !== NONE

  // Automation Add-On
  hasAutomation: boolean;                    // Requires Lister LITE+

  // Performance Band (axis 3 — earned, not purchased)
  performanceBand: PerformanceBand | null;

  // Delegation (staff acting on behalf)
  isStaff: boolean;                          // Acting via DelegatedAccess
  delegatedScopes: string[];                 // What staff can do
};

/**
 * Gate types used for hub navigation visibility
 */
export type HubGate = 'ALWAYS' | 'IS_SELLER' | 'HAS_CROSSLISTER' | 'HAS_STORE';
