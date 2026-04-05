import type { AbilityBuilder } from '@casl/ability';
import type { AppAbility, CaslSession } from './types';

/**
 * Define abilities for seller staff (delegated access)
 */
export function defineStaffAbilities(
  builder: AbilityBuilder<AppAbility>,
  session: CaslSession,
  defineBuyerAbilities: (b: AbilityBuilder<AppAbility>, s: CaslSession) => void,
): void {
  const { can, cannot } = builder;
  const {
    onBehalfOfSellerId: sellerId,           // user.id — for business tables
    onBehalfOfSellerProfileId: profileId,   // sellerProfile.id — for subscription/delegation tables
    delegatedScopes: scopes,
  } = session;

  // Staff retain their personal buyer permissions
  defineBuyerAbilities(builder, session);

  if (!sellerId || scopes.length === 0) return;

  // Map scopes to CASL rules
  if (scopes.includes('dashboard.view')) {
    can('read', 'Analytics', { sellerId });
  }

  if (scopes.includes('listings.view')) {
    can('read', 'Listing', { ownerUserId: sellerId });
  }

  if (scopes.includes('listings.manage')) {
    can('read', 'Listing', { ownerUserId: sellerId });
    can('create', 'Listing', { ownerUserId: sellerId });
    can('update', 'Listing', { ownerUserId: sellerId });
    can('delete', 'Listing', { ownerUserId: sellerId });
    // Staff can read auth requests for delegated seller's listings, but cannot create
    can('read', 'AuthenticationRequest', { sellerId });
  }

  if (scopes.includes('orders.view')) {
    can('read', 'Order', { sellerId });
    can('read', 'CombinedShippingQuote', { sellerId });
    can('read', 'LocalTransaction', { sellerId });
  }

  if (scopes.includes('orders.manage')) {
    can('read', 'Order', { sellerId });
    can('update', 'Order', { sellerId });
    can('read', 'CombinedShippingQuote', { sellerId });
    can('update', 'CombinedShippingQuote', { sellerId });
    can('read', 'LocalTransaction', { sellerId });
    can('update', 'LocalTransaction', { sellerId });
  }

  if (scopes.includes('shipping.manage')) {
    can('read', 'Shipment', { sellerId });
    can('create', 'Shipment', { sellerId });
    can('update', 'Shipment', { sellerId });
    // Shipping profiles - staff with shipping.manage can manage profiles
    can('manage', 'ShippingProfile', { userId: sellerId });
  }

  if (scopes.includes('returns.respond')) {
    can('read', 'Return', { sellerId });
    can('update', 'Return', { sellerId });
  }

  if (scopes.includes('messages.view')) {
    can('read', 'Message', { sellerId });
    can('read', 'Conversation', { sellerId });
  }

  if (scopes.includes('messages.send')) {
    can('read', 'Message', { sellerId });
    can('create', 'Message');
  }

  if (scopes.includes('finance.view')) {
    can('read', 'Payout', { userId: sellerId });
    can('read', 'LedgerEntry', { userId: sellerId });
    can('read', 'Expense', { userId: sellerId });
    can('read', 'FinancialReport', { userId: sellerId });
    can('read', 'MileageEntry', { userId: sellerId });
  }

  if (scopes.includes('analytics.view')) {
    can('read', 'Analytics', { sellerId });
  }

  if (scopes.includes('promotions.view')) {
    can('read', 'Promotion', { sellerId });
    can('read', 'PromotedListing', { sellerId });
  }

  if (scopes.includes('promotions.manage')) {
    can('manage', 'Promotion', { sellerId });
    can('manage', 'PromotedListing', { sellerId });
  }

  if (scopes.includes('settings.view')) {
    can('read', 'SellerProfile', { userId: sellerId });
  }

  if (scopes.includes('settings.manage')) {
    can('read', 'SellerProfile', { userId: sellerId });
    can('update', 'SellerProfile', { userId: sellerId });
  }

  if (scopes.includes('staff.manage') && profileId) {
    can('manage', 'DelegatedAccess', { sellerId: profileId });
  }

  if (scopes.includes('crosslister.read')) {
    can('read', 'CrosslisterAccount', { sellerId });
    can('read', 'ChannelProjection', { sellerId });
    can('read', 'CrossJob', { sellerId });
    can('read', 'ImportBatch', { sellerId });
    can('read', 'AutomationSetting', { sellerId });
  }

  if (scopes.includes('crosslister.publish')) {
    can('read', 'CrosslisterAccount', { sellerId });
    can('create', 'ChannelProjection', { sellerId });
    can('read', 'ChannelProjection', { sellerId });
    can('read', 'CrossJob', { sellerId });
  }

  if (scopes.includes('crosslister.import')) {
    can('read', 'CrosslisterAccount', { sellerId });
    can('create', 'ImportBatch', { sellerId });
    can('read', 'ImportBatch', { sellerId });
    can('read', 'CrossJob', { sellerId });
  }

  if (scopes.includes('crosslister.manage')) {
    can('manage', 'CrosslisterAccount', { sellerId });
    can('manage', 'ChannelProjection', { sellerId });
    can('manage', 'CrossJob', { sellerId });
    can('manage', 'ImportBatch', { sellerId });
    can('manage', 'AutomationSetting', { sellerId });
  }

  // Accounting integrations — G10.3 (staff can view, manage for any user)
  if (scopes.includes('finance.view')) {
    can(['read', 'manage'], 'AccountingIntegration');
  }

  // Staff can NEVER do these regardless of scopes
  cannot('create', 'AuthenticationRequest');
  cannot('manage', 'Subscription');
  // Payout: granular deny so finance.view can still grant read access
  cannot('create', 'Payout');
  cannot('update', 'Payout');
  cannot('delete', 'Payout');
  cannot('delete', 'SellerProfile');
  cannot('update', 'User', { id: sellerId }); // Cannot modify the owner's account
}
