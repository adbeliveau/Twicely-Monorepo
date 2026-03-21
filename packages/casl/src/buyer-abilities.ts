/**
 * CASL ability definitions for authenticated buyers.
 * Split from ability.ts to keep both files under the 300-line limit.
 */

import type { AbilityBuilder } from '@casl/ability';
import type { AppAbility, CaslSession } from './types';

export function defineGuestAbilities(builder: AbilityBuilder<AppAbility>): void {
  const { can } = builder;

  // Guests can browse public content
  can('read', 'Listing');
  can('read', 'Category');
  can('read', 'Review');
  can('read', 'SellerProfile');
  can('read', 'Policy');

  // Q&A is public (Amazon-style)
  can('read', 'ListingQuestion');

  // Guests can manage session-based cart
  can('read', 'Cart');
  can('create', 'Cart');
  can('update', 'Cart');
  can('delete', 'Cart');
}

export function defineBuyerAbilities(
  builder: AbilityBuilder<AppAbility>,
  session: CaslSession
): void {
  const { can } = builder;
  const { userId } = session;

  // Inherit guest abilities
  defineGuestAbilities(builder);

  // Cart - scoped to user
  can('manage', 'Cart', { userId });

  // Orders - buyer side
  can('read', 'Order', { buyerId: userId });
  can('create', 'Order');

  // Returns and disputes - buyer can create/read their own
  can('create', 'Return', { buyerId: userId });
  can('read', 'Return', { buyerId: userId });
  can('create', 'Dispute', { buyerId: userId });
  can('read', 'Dispute', { buyerId: userId });

  // Reviews
  can('read', 'Review');
  can('create', 'Review', { buyerId: userId });
  can('update', 'Review', { buyerId: userId });

  // Offers — buyers can create, read, update (counter), and cancel their offers
  can('create', 'Offer');
  can('read', 'Offer', { buyerId: userId });
  can('update', 'Offer', { buyerId: userId });
  can('delete', 'Offer', { buyerId: userId });

  // Orders — buyer can update own orders (e.g. confirmDelivery)
  can('update', 'Order', { buyerId: userId });

  // Messages
  can('read', 'Message', { participantId: userId });
  can('create', 'Message');

  // Conversations — buyer side
  can('read', 'Conversation', { buyerId: userId });
  can('create', 'Conversation');
  can('update', 'Conversation', { buyerId: userId });

  // Helpdesk — create, read own, update own (reply + reopen)
  can('read', 'HelpdeskCase', { userId });
  can('create', 'HelpdeskCase');
  can('update', 'HelpdeskCase', { userId });

  // KB — authenticated users can read published articles
  can('read', 'KbArticle');
  can('read', 'KbCategory');

  // CSAT — case requester can submit rating
  can('create', 'CaseCsat', { userId });

  // Notifications
  can('manage', 'Notification', { userId });

  // Own user account
  can('read', 'User', { id: userId });
  can('update', 'User', { id: userId });
  can('delete', 'User', { id: userId });

  // Authentication - buyer can request authentication on orders they own
  can('create', 'AuthenticationRequest', { buyerId: userId });
  can('read', 'AuthenticationRequest', { buyerId: userId });

  // Combined shipping quotes — buyer can read and respond to their own quotes
  can('read', 'CombinedShippingQuote', { buyerId: userId });
  can('update', 'CombinedShippingQuote', { buyerId: userId });

  // Coupons — applying a coupon updates the cart
  can('update', 'Cart');

  // Q&A — any authenticated user can ask a question
  can('create', 'ListingQuestion');

  // Watchlist — buyer manages own watchlist items
  can('manage', 'Watchlist', { userId });

  // Browsing history — buyer manages own history
  can('manage', 'BrowsingHistory', { userId });

  // Local transactions — buyer can read own and update (check-in, confirm receipt)
  can('read', 'LocalTransaction', { buyerId: userId });
  can('update', 'LocalTransaction', { buyerId: userId });
  can('read', 'SafeMeetupLocation');
  can('read', 'LocalReliabilityEvent', { userId }); // own events only
  can('create', 'LocalFraudFlag', { reporterId: userId }); // G2.15 — buyer can report fraud

  // G4 — Any authenticated user can report content
  can('create', 'ContentReport');

  // G6 — Any authenticated user can manage their own data export requests
  can('read', 'DataExportRequest', { userId });
  can('create', 'DataExportRequest', { userId });
}
