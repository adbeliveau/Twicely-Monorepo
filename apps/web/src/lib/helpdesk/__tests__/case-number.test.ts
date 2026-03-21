import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockUpdate = vi.fn();
const mockDb = { update: mockUpdate };

vi.mock('@twicely/db', () => ({ db: mockDb }));

function makeUpdateChain(returnVal: unknown[]) {
  return {
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue(returnVal),
  };
}

describe('generateCaseNumber', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('generates HD-000001 for first case', async () => {
    mockUpdate.mockReturnValue(makeUpdateChain([{ currentValue: 1, prefix: 'HD-', paddedWidth: 6 }]));

    const { generateCaseNumber } = await import('../case-number');
    const result = await generateCaseNumber();
    expect(result).toBe('HD-000001');
  });

  it('pads case number to configured width', async () => {
    mockUpdate.mockReturnValue(makeUpdateChain([{ currentValue: 42, prefix: 'HD-', paddedWidth: 6 }]));

    const { generateCaseNumber } = await import('../case-number');
    const result = await generateCaseNumber();
    expect(result).toBe('HD-000042');
  });

  it('uses configured prefix from sequence counter', async () => {
    mockUpdate.mockReturnValue(makeUpdateChain([{ currentValue: 100, prefix: 'CASE-', paddedWidth: 6 }]));

    const { generateCaseNumber } = await import('../case-number');
    const result = await generateCaseNumber();
    expect(result).toBe('CASE-000100');
  });

  it('throws when sequence counter row not found', async () => {
    mockUpdate.mockReturnValue(makeUpdateChain([]));

    const { generateCaseNumber } = await import('../case-number');
    await expect(generateCaseNumber()).rejects.toThrow('Sequence counter "case_number" not found');
  });

  it('increments atomically via SQL update', async () => {
    mockUpdate.mockReturnValue(makeUpdateChain([{ currentValue: 5, prefix: 'HD-', paddedWidth: 6 }]));

    const { generateCaseNumber } = await import('../case-number');
    await generateCaseNumber();
    expect(mockUpdate).toHaveBeenCalled();
    // The update uses .set() with SQL increment expression
    const updateChain = mockUpdate.mock.results[0]?.value;
    expect(updateChain.set).toHaveBeenCalled();
  });

  it('handles large case numbers without truncation', async () => {
    mockUpdate.mockReturnValue(makeUpdateChain([{ currentValue: 999999, prefix: 'HD-', paddedWidth: 6 }]));

    const { generateCaseNumber } = await import('../case-number');
    const result = await generateCaseNumber();
    expect(result).toBe('HD-999999');
  });
});
