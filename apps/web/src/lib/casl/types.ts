import { type MongoAbility } from '@casl/ability';

// Re-export for convenience
export type { Subject } from './subjects';
export type { Action } from './action-types';

// Platform staff roles — enum values from platformRoleEnum
export type PlatformRole =
  | 'HELPDESK_AGENT'
  | 'HELPDESK_LEAD'
  | 'HELPDESK_MANAGER'
  | 'SUPPORT'
  | 'MODERATION'
  | 'FINANCE'
  | 'DEVELOPER'
  | 'SRE'
  | 'ADMIN'
  | 'SUPER_ADMIN';

// The session shape used by the ability factory
export interface CaslSession {
  userId: string;
  email: string;

  // Marketplace identity
  isSeller: boolean;
  sellerId: string | null;
  sellerStatus: string | null;

  // Delegation (populated when staff acts for a seller)
  delegationId: string | null;
  onBehalfOfSellerId: string | null;       // seller's user.id — for business tables
  onBehalfOfSellerProfileId: string | null; // sellerProfile.id — for subscription/delegation tables
  delegatedScopes: string[];

  // Platform staff
  isPlatformStaff: boolean;
  platformRoles: PlatformRole[];

  // Optional custom role permissions (loaded for platform staff only)
  customRolePermissions?: Array<{ subject: string; action: string }>;
}

/**
 * The CASL ability type for this app.
 *
 * Uses unparameterized MongoAbility to avoid CASL's TypeScript strict-mode
 * incompatibility with the subject() helper's ForcedSubject<T> return type.
 * Subject validation is enforced by our sub() helper and builder functions.
 */
export type AppAbility = MongoAbility;

// Delegation scopes - the valid values for delegatedScopes array
export type DelegationScope =
  | 'dashboard.view'
  | 'listings.view'
  | 'listings.manage'
  | 'orders.view'
  | 'orders.manage'
  | 'shipping.manage'
  | 'returns.respond'
  | 'messages.view'
  | 'messages.send'
  | 'finance.view'
  | 'analytics.view'
  | 'promotions.view'
  | 'promotions.manage'
  | 'settings.view'
  | 'settings.manage'
  | 'staff.manage'
  | 'crosslister.read'
  | 'crosslister.publish'
  | 'crosslister.import'
  | 'crosslister.manage';
