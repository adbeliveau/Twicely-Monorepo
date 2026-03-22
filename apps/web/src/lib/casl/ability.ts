import { AbilityBuilder, createMongoAbility } from '@casl/ability';
import type { AppAbility, CaslSession } from '@twicely/casl/types';
import {
  definePlatformAgentAbilities,
  definePlatformAdminAbilities,
} from '@twicely/casl/platform-abilities';
import { defineStaffAbilities } from '@twicely/casl/staff-abilities';
import { defineBuyerAbilities, defineGuestAbilities } from '@twicely/casl/buyer-abilities';

/**
 * Define abilities for a seller
 */
function defineSellerAbilities(
  builder: AbilityBuilder<AppAbility>,
  session: CaslSession
): void {
  const { can } = builder;
  const { userId, sellerId } = session;

  // Inherit all buyer abilities
  defineBuyerAbilities(builder, session);

  if (!sellerId) return;

  // Listings - ownerUserId = userId per spec §4.2
  can('manage', 'Listing', { ownerUserId: userId });

  // Orders - seller side
  can('read', 'Order', { sellerId });
  can('update', 'Order', { sellerId });

  // Shipments
  can('manage', 'Shipment', { sellerId });

  // Shipping profiles
  can('manage', 'ShippingProfile', { userId });

  // Offers — sellers can read and manage offers on their listings
  can('read', 'Offer', { sellerId });
  can('update', 'Offer', { sellerId });

  // ReviewResponse — sellers can create and edit responses to reviews
  can('create', 'ReviewResponse', { sellerId });
  can('update', 'ReviewResponse', { sellerId });

  // Seller→buyer reviews use canonical Review subject
  can('create', 'Review', { sellerId });
  can('update', 'Review', { sellerId });

  // Returns - seller side (approve/reject)
  can('update', 'Return', { sellerId });

  // Disputes - seller side (respond)
  can('update', 'Dispute', { sellerId });

  // Payouts - payout table uses userId as ownership column
  can('read', 'Payout', { userId });

  // Messages (already inherited, but seller context)
  can('read', 'Message', { participantId: userId });
  can('create', 'Message');

  // Conversations — seller side
  can('read', 'Conversation', { sellerId: userId });
  can('update', 'Conversation', { sellerId: userId });

  // Seller profile (condition uses userId per spec §4.2)
  can('manage', 'SellerProfile', { userId });

  // Delegated access (staff management + invitation acceptance)
  can('manage', 'DelegatedAccess', { sellerId });
  // Invitees can accept/update delegation invitations addressed to them
  can('update', 'DelegatedAccess', { userId });

  // Subscriptions
  can('manage', 'Subscription', { sellerId });

  // Promotions
  can('manage', 'Promotion', { sellerId });
  can('manage', 'PromotedListing', { sellerId });

  // Analytics
  can('read', 'Analytics', { sellerId });

  // Finance Center
  can('read', 'LedgerEntry', { userId });
  can('manage', 'Expense', { userId });
  can('manage', 'FinancialReport', { userId });
  can('manage', 'MileageEntry', { userId });

  // Authentication - seller can request pre-listing auth (D6)
  can('create', 'AuthenticationRequest', { sellerId });
  can('read', 'AuthenticationRequest', { sellerId });
  can('update', 'AuthenticationRequest', { sellerId });

  // Combined shipping quotes — seller can read and submit quotes for their orders
  can('read', 'CombinedShippingQuote', { sellerId: userId });
  can('update', 'CombinedShippingQuote', { sellerId: userId });

  // Q&A — sellers can answer and hide questions on their listings
  // Action-level check verifies listing.ownerUserId === session.userId
  can('update', 'ListingQuestion');
  can('delete', 'ListingQuestion');

  // Crosslister — seller manages own channel accounts
  can('manage', 'CrosslisterAccount', { sellerId: userId });
  can('read', 'CrosslisterAccount', { sellerId: userId });

  // Channel projections — seller manages projections for own listings
  can('create', 'ChannelProjection', { sellerId: userId });
  can('manage', 'ChannelProjection', { sellerId: userId });
  can('delete', 'ChannelProjection', { sellerId: userId });

  // Import batches — seller can start and view own imports
  can('create', 'ImportBatch', { sellerId: userId });
  can('read', 'ImportBatch', { sellerId: userId });

  // Cross jobs — seller can view and cancel own jobs
  can('read', 'CrossJob', { sellerId: userId });
  can('delete', 'CrossJob', { sellerId: userId });

  // Automation settings — seller manages own automation config
  can('manage', 'AutomationSetting', { sellerId: userId });

  // Affiliate program — seller manages own affiliate record (create, read, update, delete)
  // Canonical Section 8: manage Affiliate scoped to own userId
  can('manage', 'Affiliate', { userId });
  can('read', 'Referral', { affiliateId: userId });
  can('create', 'PromoCode', { affiliateId: userId });
  can('read', 'PromoCode', { affiliateId: userId });
  can('update', 'PromoCode', { affiliateId: userId });
  can('delete', 'PromoCode', { affiliateId: userId });
  can('read', 'AffiliateCommission', { affiliateId: userId });
  can('read', 'AffiliatePayout', { affiliateId: userId });

  // Local transactions — seller can read own and update (check-in)
  can('read', 'LocalTransaction', { sellerId: userId });
  can('update', 'LocalTransaction', { sellerId: userId });
  can('read', 'SafeMeetupLocation');
  can('read', 'LocalReliabilityEvent', { userId }); // own events only

  // Tax info — seller can read and update own tax info (G5)
  can('read', 'TaxInfo', { userId });
  can('update', 'TaxInfo', { userId });

  // G6 — Identity verification + data export (own records only)
  can('read', 'IdentityVerification', { userId });
  can('create', 'IdentityVerification', { userId });
  can('read', 'DataExportRequest', { userId });
  can('create', 'DataExportRequest', { userId });
}

/**
 * Main ability factory - creates CASL abilities for a session
 */
export function defineAbilitiesFor(session: CaslSession | null): AppAbility {
  const builder = new AbilityBuilder<AppAbility>(createMongoAbility);

  if (!session) {
    // Guest
    defineGuestAbilities(builder);
  } else if (session.isPlatformStaff) {
    // Platform staff — check if admin or agent
    const isAdmin =
      session.platformRoles.includes('ADMIN') ||
      session.platformRoles.includes('SUPER_ADMIN');

    if (isAdmin) {
      definePlatformAdminAbilities(builder);
    } else {
      definePlatformAgentAbilities(builder, session.platformRoles);
    }

    // Step 2: Apply custom role permissions (additive only)
    if (session.customRolePermissions?.length) {
      for (const perm of session.customRolePermissions) {
        builder.can(perm.action, perm.subject);
      }
    }

    // Step 3: Apply hard ceilings for non-admin staff with custom roles
    // (Admin abilities already include cannot() ceilings via definePlatformAdminAbilities)
    if (!isAdmin) {
      builder.cannot('manage', 'CustomRole');
      builder.cannot('manage', 'StaffUser');
      builder.cannot('delete', 'AuditEvent');
      builder.cannot('update', 'LedgerEntry');
      builder.cannot('delete', 'LedgerEntry');
    }
  } else if (session.delegationId !== null) {
    // Seller Staff (delegated access)
    defineStaffAbilities(builder, session, defineBuyerAbilities);
  } else if (session.isSeller) {
    // Seller
    defineSellerAbilities(builder, session);
  } else {
    // Buyer
    defineBuyerAbilities(builder, session);
  }

  return builder.build();
}
