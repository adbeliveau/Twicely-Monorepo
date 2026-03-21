import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@twicely/db/queries/platform-settings', () => ({
  getPlatformSetting: vi.fn().mockResolvedValue(10),
}));

import {
  canPoll,
  recordPoll,
  resetAllPollBudgets,
} from '../poll-budget';
import { getPlatformSetting } from '@twicely/db/queries/platform-settings';

describe('poll-budget', () => {
  beforeEach(() => {
    resetAllPollBudgets();
    vi.clearAllMocks();
  });

  it('canPoll returns true for new seller with no prior polls', async () => {
    vi.mocked(getPlatformSetting).mockResolvedValue(10);
    const result = await canPoll('seller-1', 'NONE');
    expect(result).toBe(true);
  });

  it('canPoll returns false when budget is zero', async () => {
    vi.mocked(getPlatformSetting).mockResolvedValue(0);
    const result = await canPoll('seller-1', 'NONE');
    expect(result).toBe(false);
  });

  it('canPoll returns false after budget exhausted within hour', async () => {
    vi.mocked(getPlatformSetting).mockResolvedValue(3);
    await recordPoll('seller-1');
    await recordPoll('seller-1');
    await recordPoll('seller-1');
    const result = await canPoll('seller-1', 'NONE');
    expect(result).toBe(false);
  });

  it('canPoll returns true when count is below budget', async () => {
    vi.mocked(getPlatformSetting).mockResolvedValue(5);
    await recordPoll('seller-1');
    await recordPoll('seller-1');
    const result = await canPoll('seller-1', 'NONE');
    expect(result).toBe(true);
  });

  it('canPoll resets window after HOUR_MS elapses', async () => {
    vi.mocked(getPlatformSetting).mockResolvedValue(2);
    await recordPoll('seller-1');
    await recordPoll('seller-1');
    expect(await canPoll('seller-1', 'NONE')).toBe(false);

    // Advance time past one hour
    const originalNow = Date.now;
    Date.now = () => originalNow() + 3_600_001;
    expect(await canPoll('seller-1', 'NONE')).toBe(true);
    Date.now = originalNow;
  });

  it('recordPoll increments count for existing window', async () => {
    vi.mocked(getPlatformSetting).mockResolvedValue(5);
    await recordPoll('seller-1');
    await recordPoll('seller-1');
    await recordPoll('seller-1');
    // Count is 3, budget is 5 — should still be able to poll
    expect(await canPoll('seller-1', 'NONE')).toBe(true);
  });

  it('resetAllPollBudgets clears all seller windows', async () => {
    vi.mocked(getPlatformSetting).mockResolvedValue(1);
    await recordPoll('seller-1');
    expect(await canPoll('seller-1', 'NONE')).toBe(false);
    resetAllPollBudgets();
    vi.mocked(getPlatformSetting).mockResolvedValue(1);
    expect(await canPoll('seller-1', 'NONE')).toBe(true);
  });

  it('canPoll uses tier-specific budget key from getPlatformSetting', async () => {
    vi.mocked(getPlatformSetting).mockResolvedValue(1000);
    await canPoll('seller-1', 'PRO');
    expect(getPlatformSetting).toHaveBeenCalledWith(
      'crosslister.polling.budget.PRO',
      1000,
    );
  });

  it('NONE tier uses budget key crosslister.polling.budget.NONE with fallback 10', async () => {
    vi.mocked(getPlatformSetting).mockResolvedValue(10);
    await canPoll('seller-1', 'NONE');
    expect(getPlatformSetting).toHaveBeenCalledWith(
      'crosslister.polling.budget.NONE',
      10,
    );
  });
});
