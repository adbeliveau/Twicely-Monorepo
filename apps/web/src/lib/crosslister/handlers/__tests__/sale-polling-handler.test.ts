import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@twicely/db', () => ({
  db: {
    update: vi.fn(),
  },
}));

vi.mock('@twicely/db/schema', () => ({
  channelProjection: {
    id: 'id',
    status: 'status',
    updatedAt: 'updated_at',
  },
}));

vi.mock('@twicely/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

vi.mock('../../services/sale-detection', () => ({
  handleDetectedSale: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../services/platform-fees', () => ({
  getPlatformFeeRate: vi.fn().mockResolvedValue(1500), // 15% in bps
  calculatePlatformFee: vi.fn().mockReturnValue(750),
}));

import { db } from '@twicely/db';
import { handleDetectedSale } from '../../services/sale-detection';
import { parsePollResult } from '../sale-polling-handler';
import type { ChannelProjection } from '../../db-types';

const makeUpdateChain = () => ({
  set: vi.fn().mockReturnValue({
    where: vi.fn().mockResolvedValue(undefined),
  }),
});

// Minimal ChannelProjection with only the fields parsePollResult uses
const ACTIVE_PROJECTION = {
  id: 'proj-test-1',
  status: 'ACTIVE',
  channel: 'POSHMARK',
  listingId: 'listing-test-1',
  externalId: 'ext-posh-123',
  accountId: 'acc-test-1',
  sellerId: 'seller-test-1',
  pollTier: 'COLD',
  prePollTier: null,
  nextPollAt: null,
  lastPolledAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
} as unknown as ChannelProjection;

describe('sale-polling-handler — parsePollResult', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('SOLD result → calls handleDetectedSale (triggers EMERGENCY_DELIST pipeline)', async () => {
    await parsePollResult(ACTIVE_PROJECTION, {
      externalId: 'ext-posh-123',
      status: 'SOLD',
      priceCents: 5000,
      soldPriceCents: 4800,
      externalOrderId: 'order-posh-abc',
      buyerUsername: 'buyer_jane',
    });

    expect(handleDetectedSale).toHaveBeenCalledOnce();
    expect(handleDetectedSale).toHaveBeenCalledWith(
      expect.objectContaining({
        listingId: 'listing-test-1',
        projectionId: 'proj-test-1',
        channel: 'POSHMARK',
        externalOrderId: 'order-posh-abc',
        salePriceCents: 4800,
        buyerUsername: 'buyer_jane',
      }),
    );
  });

  it('SOLD result without externalOrderId → generates synthetic order id', async () => {
    await parsePollResult(ACTIVE_PROJECTION, {
      externalId: 'ext-posh-123',
      status: 'SOLD',
      priceCents: 3000,
    });

    expect(handleDetectedSale).toHaveBeenCalledOnce();
    const call = (handleDetectedSale as ReturnType<typeof vi.fn>).mock.calls[0];
    const arg = call![0] as Record<string, unknown>;
    expect(typeof arg.externalOrderId).toBe('string');
    expect((arg.externalOrderId as string).startsWith('poll-POSHMARK-ext-posh-123-')).toBe(true);
  });

  it('ENDED result → updates projection status to ENDED, does NOT call handleDetectedSale', async () => {
    const updateChain = makeUpdateChain();
    vi.mocked(db.update).mockReturnValue(updateChain as never);

    await parsePollResult(ACTIVE_PROJECTION, {
      externalId: 'ext-posh-123',
      status: 'ENDED',
      priceCents: 5000,
    });

    expect(handleDetectedSale).not.toHaveBeenCalled();
    expect(db.update).toHaveBeenCalledOnce();
    const setCall = updateChain.set.mock.calls[0]![0] as Record<string, unknown>;
    expect(setCall.status).toBe('ENDED');
  });

  it('ACTIVE result → no DB writes, no handleDetectedSale', async () => {
    await parsePollResult(ACTIVE_PROJECTION, {
      externalId: 'ext-posh-123',
      status: 'ACTIVE',
      priceCents: 5000,
    });

    expect(handleDetectedSale).not.toHaveBeenCalled();
    expect(db.update).not.toHaveBeenCalled();
  });

  it('non-ACTIVE projection → returns early, no side effects', async () => {
    const soldProjection = { ...ACTIVE_PROJECTION, status: 'SOLD' } as unknown as ChannelProjection;

    await parsePollResult(soldProjection, {
      externalId: 'ext-posh-123',
      status: 'SOLD',
      priceCents: 5000,
    });

    expect(handleDetectedSale).not.toHaveBeenCalled();
    expect(db.update).not.toHaveBeenCalled();
  });

  it('SOLD result uses soldPriceCents when available, falls back to priceCents', async () => {
    await parsePollResult(ACTIVE_PROJECTION, {
      externalId: 'ext-posh-123',
      status: 'SOLD',
      priceCents: 5000,
      soldPriceCents: 4500,
    });

    const call = (handleDetectedSale as ReturnType<typeof vi.fn>).mock.calls[0];
    const arg = call![0] as Record<string, unknown>;
    expect(arg.salePriceCents).toBe(4500);
  });

  it('SOLD result with no price → salePriceCents defaults to 0', async () => {
    await parsePollResult(ACTIVE_PROJECTION, {
      externalId: 'ext-posh-123',
      status: 'SOLD',
      priceCents: null,
    });

    const call = (handleDetectedSale as ReturnType<typeof vi.fn>).mock.calls[0];
    const arg = call![0] as Record<string, unknown>;
    expect(arg.salePriceCents).toBe(0);
  });
});
