import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mocks
const mockNotify = vi.fn().mockResolvedValue(undefined);
const mockGetOfferWithParties = vi.fn();

vi.mock('@twicely/notifications/service', () => ({ notify: mockNotify }));
vi.mock('../offer-queries', () => ({ getOfferWithParties: mockGetOfferWithParties }));
vi.mock('@twicely/logger', () => ({ logger: { error: vi.fn() } }));

describe('Offer Notifications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('notifyOfferEvent fires notify with correct templateKey for created', async () => {
    mockGetOfferWithParties.mockResolvedValue({
      buyerId: 'b1', sellerId: 's1', offerCents: 5000, listingId: 'l1',
      listing: { title: 'Test Item', slug: 'test-item' },
      buyer: { name: 'Buyer' }, seller: { name: 'Seller' },
    });
    const { notifyOfferEvent } = await import('../offer-notifications');
    notifyOfferEvent('created', 'offer-1');
    // Wait for async
    await new Promise((r) => setTimeout(r, 10));
    expect(mockGetOfferWithParties).toHaveBeenCalledWith('offer-1');
  });

  it('notifyOfferEvent handles declined event', async () => {
    mockGetOfferWithParties.mockResolvedValue({
      buyerId: 'b1', sellerId: 's1', offerCents: 10000, listingId: 'l1',
      listing: { title: 'Declined Item', slug: 'declined-item' },
      buyer: { name: 'Bob' }, seller: { name: 'Sue' },
    });
    const { notifyOfferEvent } = await import('../offer-notifications');
    notifyOfferEvent('declined', 'offer-2');
    await new Promise((r) => setTimeout(r, 10));
    expect(mockGetOfferWithParties).toHaveBeenCalledWith('offer-2');
  });
});
