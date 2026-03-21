import type { AuthCostSplit } from './types';

export function calculateAuthCostSplit(
  initiator: 'BUYER' | 'SELLER',
  result: 'AUTHENTICATED' | 'COUNTERFEIT' | 'INCONCLUSIVE',
  totalFeeCents: number
): AuthCostSplit {
  if (result === 'INCONCLUSIVE') {
    // Twicely absorbs -- neither party pays
    return { totalFeeCents, buyerShareCents: 0, sellerShareCents: 0 };
  }

  if (result === 'COUNTERFEIT') {
    // Seller pays all regardless of who initiated
    return { totalFeeCents, buyerShareCents: 0, sellerShareCents: totalFeeCents };
  }

  // AUTHENTICATED
  if (initiator === 'SELLER') {
    // Seller-initiated pre-listing: seller already paid full upfront
    return { totalFeeCents, buyerShareCents: 0, sellerShareCents: totalFeeCents };
  }

  // Buyer-initiated: 50/50 split
  const buyerShare = Math.floor(totalFeeCents / 2);
  const sellerShare = totalFeeCents - buyerShare; // Ensures no cent is lost
  return { totalFeeCents, buyerShareCents: buyerShare, sellerShareCents: sellerShare };
}
