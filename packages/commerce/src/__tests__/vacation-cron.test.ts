import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@twicely/db', () => ({
  db: { select: vi.fn(), update: vi.fn() },
}));

vi.mock('@twicely/db/schema', () => ({
  sellerProfile: {
    userId: 'user_id',
    vacationMode: 'vacation_mode',
    vacationModeType: 'vacation_mode_type',
    vacationMessage: 'vacation_message',
    vacationStartAt: 'vacation_start_at',
    vacationEndAt: 'vacation_end_at',
    updatedAt: 'updated_at',
  },
}));

vi.mock('@twicely/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn() },
}));

import { db } from '@twicely/db';
import { processVacationAutoEnd } from '../vacation-cron';

const mockDbSelect = vi.mocked(db.select);
const mockDbUpdate = vi.mocked(db.update);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeSelectChain(rows: unknown[]) {
  const chain = {
    from: vi.fn(),
    where: vi.fn().mockResolvedValue(rows),
  };
  chain.from.mockReturnValue(chain);
  return chain;
}

function makeUpdateChain() {
  const chain = { set: vi.fn() };
  chain.set.mockReturnValue({ where: vi.fn().mockResolvedValue([]) });
  return chain;
}

// ─── processVacationAutoEnd ───────────────────────────────────────────────────

describe('processVacationAutoEnd', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns 0 when no expired vacations found', async () => {
    mockDbSelect.mockReturnValueOnce(makeSelectChain([]) as never);

    const result = await processVacationAutoEnd();

    expect(result).toBe(0);
    expect(mockDbUpdate).not.toHaveBeenCalled();
  });

  it('updates each expired seller and returns count', async () => {
    mockDbSelect.mockReturnValueOnce(
      makeSelectChain([
        { userId: 'user-001' },
        { userId: 'user-002' },
      ]) as never,
    );
    mockDbUpdate
      .mockReturnValueOnce(makeUpdateChain() as never)
      .mockReturnValueOnce(makeUpdateChain() as never);

    const result = await processVacationAutoEnd();

    expect(result).toBe(2);
    expect(mockDbUpdate).toHaveBeenCalledTimes(2);
  });

  it('clears all vacation fields on the sellerProfile for each expired seller', async () => {
    mockDbSelect.mockReturnValueOnce(
      makeSelectChain([{ userId: 'user-expired-001' }]) as never,
    );
    const updateChain = makeUpdateChain();
    mockDbUpdate.mockReturnValueOnce(updateChain as never);

    await processVacationAutoEnd();

    expect(mockDbUpdate).toHaveBeenCalledTimes(1);
    const setArgs = updateChain.set.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(setArgs.vacationMode).toBe(false);
    expect(setArgs.vacationModeType).toBeNull();
    expect(setArgs.vacationMessage).toBeNull();
    expect(setArgs.vacationStartAt).toBeNull();
    expect(setArgs.vacationEndAt).toBeNull();
    expect(setArgs.updatedAt).toBeInstanceOf(Date);
  });

  it('returns 1 when exactly one expired vacation is found', async () => {
    mockDbSelect.mockReturnValueOnce(
      makeSelectChain([{ userId: 'user-single' }]) as never,
    );
    mockDbUpdate.mockReturnValueOnce(makeUpdateChain() as never);

    const result = await processVacationAutoEnd();

    expect(result).toBe(1);
  });

  it('processes multiple expired sellers sequentially', async () => {
    const sellers = [
      { userId: 'user-a' },
      { userId: 'user-b' },
      { userId: 'user-c' },
    ];
    mockDbSelect.mockReturnValueOnce(makeSelectChain(sellers) as never);
    for (let i = 0; i < sellers.length; i++) {
      mockDbUpdate.mockReturnValueOnce(makeUpdateChain() as never);
    }

    const result = await processVacationAutoEnd();

    expect(result).toBe(3);
    expect(mockDbUpdate).toHaveBeenCalledTimes(3);
  });
});
