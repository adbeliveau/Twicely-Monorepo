import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@twicely/db', () => ({
  db: {
    select: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock('@twicely/db/schema', () => ({
  channelProjection: {
    id: 'id',
    pollTier: 'poll_tier',
    prePollTier: 'pre_poll_tier',
    lastPolledAt: 'last_polled_at',
    sellerId: 'seller_id',
    nextPollAt: 'next_poll_at',
    updatedAt: 'updated_at',
  },
}));

vi.mock('@twicely/db/queries/platform-settings', () => ({
  getPlatformSetting: vi.fn().mockResolvedValue(90_000),
}));

import { db } from '@twicely/db';
import { getPlatformSetting } from '@twicely/db/queries/platform-settings';
import {
  promoteTier,
  demoteTier,
  scheduleNextPoll,
  applyDoubleSellElevation,
  resetIntervalCache,
} from '../poll-tier-manager';

const makeSelectChain = (rows: unknown[]) => ({
  from: vi.fn().mockReturnValue({
    where: vi.fn().mockReturnValue({
      limit: vi.fn().mockResolvedValue(rows),
    }),
  }),
});

const makeUpdateChain = () => ({
  set: vi.fn().mockReturnValue({
    where: vi.fn().mockResolvedValue(undefined),
  }),
});

describe('poll-tier-manager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetIntervalCache();
  });

  it('promoteTier WATCHER_ADDED promotes COLD projection to HOT', async () => {
    vi.mocked(db.select).mockReturnValue(makeSelectChain([
      { pollTier: 'COLD', prePollTier: null },
    ]) as never);
    vi.mocked(db.update).mockReturnValue(makeUpdateChain() as never);
    vi.mocked(getPlatformSetting).mockResolvedValue(90_000);

    await promoteTier('proj-1', 'WATCHER_ADDED');

    expect(db.update).toHaveBeenCalledTimes(2); // set HOT + scheduleNextPoll
  });

  it('promoteTier OFFER_RECEIVED promotes WARM projection to HOT', async () => {
    vi.mocked(db.select).mockReturnValue(makeSelectChain([
      { pollTier: 'WARM', prePollTier: 'COLD' },
    ]) as never);
    vi.mocked(db.update).mockReturnValue(makeUpdateChain() as never);
    vi.mocked(getPlatformSetting).mockResolvedValue(90_000);

    await promoteTier('proj-1', 'OFFER_RECEIVED');

    expect(db.update).toHaveBeenCalledTimes(2);
  });

  it('promoteTier PRICE_CHANGED promotes COLD projection to WARM', async () => {
    vi.mocked(db.select).mockReturnValue(makeSelectChain([
      { pollTier: 'COLD', prePollTier: null },
    ]) as never);
    vi.mocked(db.update).mockReturnValue(makeUpdateChain() as never);
    vi.mocked(getPlatformSetting).mockResolvedValue(600_000);

    await promoteTier('proj-1', 'PRICE_CHANGED');

    expect(db.update).toHaveBeenCalledTimes(2);
  });

  it('promoteTier PRICE_CHANGED does not demote HOT projection', async () => {
    const updateChain = makeUpdateChain();
    vi.mocked(db.select).mockReturnValue(makeSelectChain([
      { pollTier: 'HOT', prePollTier: 'COLD' },
    ]) as never);
    vi.mocked(db.update).mockReturnValue(updateChain as never);
    vi.mocked(getPlatformSetting).mockResolvedValue(90_000);

    await promoteTier('proj-1', 'PRICE_CHANGED');

    // Only scheduleNextPoll update (no tier change update)
    expect(db.update).toHaveBeenCalledTimes(1);
  });

  it('promoteTier SALE_DETECTED sets HOT with no nextPollAt', async () => {
    const updateChain = makeUpdateChain();
    vi.mocked(db.select).mockReturnValue(makeSelectChain([
      { pollTier: 'WARM', prePollTier: 'COLD' },
    ]) as never);
    vi.mocked(db.update).mockReturnValue(updateChain as never);

    await promoteTier('proj-1', 'SALE_DETECTED');

    // Only one update (no scheduleNextPoll for SALE_DETECTED)
    expect(db.update).toHaveBeenCalledTimes(1);
    const firstCall = updateChain.set.mock.calls[0];
    expect(firstCall).toBeDefined();
    const setCall = firstCall![0] as Record<string, unknown>;
    expect(setCall.nextPollAt).toBeNull();
    expect(setCall.pollTier).toBe('HOT');
  });

  it('promoteTier does nothing if projection not found', async () => {
    vi.mocked(db.select).mockReturnValue(makeSelectChain([]) as never);

    await promoteTier('proj-missing', 'WATCHER_ADDED');

    expect(db.update).not.toHaveBeenCalled();
  });

  it('demoteTier does nothing if projection has no lastPolledAt', async () => {
    vi.mocked(db.select).mockReturnValue(makeSelectChain([
      { pollTier: 'HOT', lastPolledAt: null, prePollTier: 'COLD' },
    ]) as never);

    await demoteTier('proj-1');

    expect(db.update).not.toHaveBeenCalled();
  });

  it('demoteTier demotes HOT to WARM within hotDecayDwellMs', async () => {
    const lastPolledAt = new Date(Date.now() - 10_000); // 10 seconds ago
    vi.mocked(db.select).mockReturnValue(makeSelectChain([
      { pollTier: 'HOT', lastPolledAt, prePollTier: 'COLD' },
    ]) as never);
    vi.mocked(db.update).mockReturnValue(makeUpdateChain() as never);
    vi.mocked(getPlatformSetting).mockResolvedValue(1_800_000); // 30 min decay

    await demoteTier('proj-1');

    expect(db.update).toHaveBeenCalledTimes(2); // set tier + scheduleNextPoll
  });

  it('scheduleNextPoll sets nextPollAt using tier interval from settings', async () => {
    const updateChain = makeUpdateChain();
    vi.mocked(db.update).mockReturnValue(updateChain as never);
    vi.mocked(getPlatformSetting).mockResolvedValue(600_000);

    const before = Date.now();
    await scheduleNextPoll('proj-1', 'WARM');
    const after = Date.now();

    const scheduleCall = updateChain.set.mock.calls[0];
    expect(scheduleCall).toBeDefined();
    const setCall = scheduleCall![0] as { nextPollAt: Date };
    expect(setCall.nextPollAt.getTime()).toBeGreaterThanOrEqual(before + 600_000);
    expect(setCall.nextPollAt.getTime()).toBeLessThanOrEqual(after + 600_000);
  });

  it('demoteTier: HOT decays to prePollTier LONGTAIL when hotDecayDwellMs exceeded', async () => {
    // lastPolledAt is 4 seconds ago (> 1800000ms dwell if we mock setting to 1ms)
    const lastPolledAt = new Date(Date.now() - 4_000_000);
    vi.mocked(db.select).mockReturnValue(makeSelectChain([
      { pollTier: 'HOT', lastPolledAt, prePollTier: 'LONGTAIL' },
    ]) as never);
    const updateChain = makeUpdateChain();
    vi.mocked(db.update).mockReturnValue(updateChain as never);
    // hotDecayDwellMs = 1ms so msSinceLastPoll always exceeds it → newTier = prePollTier = LONGTAIL
    vi.mocked(getPlatformSetting).mockResolvedValue(1);

    await demoteTier('proj-1');

    expect(db.update).toHaveBeenCalledTimes(2); // tier update + scheduleNextPoll
    const setCall = updateChain.set.mock.calls[0]![0] as Record<string, unknown>;
    expect(setCall.pollTier).toBe('LONGTAIL');
  });

  it('demoteTier: 8 days inactivity demotes WARM projection to COLD', async () => {
    const lastPolledAt = new Date(Date.now() - 8 * 86_400_000); // 8 days ago
    vi.mocked(db.select).mockReturnValue(makeSelectChain([
      { pollTier: 'WARM', lastPolledAt, prePollTier: null },
    ]) as never);
    const updateChain = makeUpdateChain();
    vi.mocked(db.update).mockReturnValue(updateChain as never);
    vi.mocked(getPlatformSetting).mockImplementation((key: string, fallback: unknown) => {
      if (key === 'crosslister.polling.longtailDemotionDays') return Promise.resolve(30);
      if (key === 'crosslister.polling.coldDemotionDays') return Promise.resolve(7);
      return Promise.resolve(fallback);
    });

    await demoteTier('proj-1');

    // WARM → COLD after 7+ days
    expect(db.update).toHaveBeenCalledTimes(2);
    const setCall = updateChain.set.mock.calls[0]![0] as Record<string, unknown>;
    expect(setCall.pollTier).toBe('COLD');
  });

  it('demoteTier: 31 days inactivity demotes WARM projection to LONGTAIL', async () => {
    const lastPolledAt = new Date(Date.now() - 31 * 86_400_000); // 31 days ago
    vi.mocked(db.select).mockReturnValue(makeSelectChain([
      { pollTier: 'WARM', lastPolledAt, prePollTier: null },
    ]) as never);
    const updateChain = makeUpdateChain();
    vi.mocked(db.update).mockReturnValue(updateChain as never);
    vi.mocked(getPlatformSetting).mockImplementation((key: string, fallback: unknown) => {
      if (key === 'crosslister.polling.longtailDemotionDays') return Promise.resolve(30);
      if (key === 'crosslister.polling.coldDemotionDays') return Promise.resolve(7);
      return Promise.resolve(fallback);
    });

    await demoteTier('proj-1');

    // WARM → LONGTAIL after 30+ days
    expect(db.update).toHaveBeenCalledTimes(2);
    const setCall = updateChain.set.mock.calls[0]![0] as Record<string, unknown>;
    expect(setCall.pollTier).toBe('LONGTAIL');
  });

  it('applyDoubleSellElevation updates all seller projections to HOT', async () => {
    const updateChain = makeUpdateChain();
    vi.mocked(db.update).mockReturnValue(updateChain as never);
    vi.mocked(getPlatformSetting).mockResolvedValue(90_000);

    await applyDoubleSellElevation('seller-1');

    expect(db.update).toHaveBeenCalledTimes(1);
    const elevateCall = updateChain.set.mock.calls[0];
    expect(elevateCall).toBeDefined();
    const setCall = elevateCall![0] as Record<string, unknown>;
    expect(setCall.pollTier).toBe('HOT');
    expect(setCall.prePollTier).toBe('COLD');
  });
});
