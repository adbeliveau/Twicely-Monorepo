import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@twicely/casl', () => ({
  authorize: vi.fn(),
  sub: (type: string, conds: Record<string, unknown>) => ({ ...conds, __caslSubjectType__: type }),
}));
vi.mock('@twicely/db', () => ({ db: { select: vi.fn(), update: vi.fn(), insert: vi.fn() } }));
vi.mock('@twicely/db/schema', () => ({
  sellerProfile: { userId: 'user_id', hasAutomation: 'has_automation' },
  automationSetting: { sellerId: 'seller_id', id: 'id' },
}));
vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a, b) => ({ type: 'eq', a, b })),
}));

import { authorize } from '@twicely/casl';
import { db } from '@twicely/db';
import { updateAutomationSettingsAction } from '../automation-settings';

const mockAuthorize = vi.mocked(authorize);
const mockSelect = vi.mocked(db.select);
const mockUpdate = vi.mocked(db.update);
const mockInsert = vi.mocked(db.insert);

function mockSession(userId = 'user1') {
  return {
    ability: { can: vi.fn(() => true) } as never,
    session: { userId, email: 'test@example.com', isSeller: true } as never,
  };
}

function makeChain(rows: unknown[]) {
  const chain: Record<string, unknown> = {};
  chain.from = vi.fn().mockReturnValue(chain);
  chain.where = vi.fn().mockReturnValue(chain);
  chain.limit = vi.fn().mockResolvedValue(rows);
  chain.set = vi.fn().mockReturnValue(chain);
  return chain as unknown as ReturnType<typeof db.select>;
}

function makeUpdateChain() {
  const chain: Record<string, unknown> = {};
  chain.set = vi.fn().mockReturnValue(chain);
  chain.where = vi.fn().mockResolvedValue([]);
  return chain as unknown as ReturnType<typeof db.update>;
}

function makeInsertChain() {
  const chain: Record<string, unknown> = {};
  chain.values = vi.fn().mockResolvedValue([]);
  return chain as unknown as ReturnType<typeof db.insert>;
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe('updateAutomationSettingsAction', () => {
  it('saves settings with valid input', async () => {
    mockAuthorize.mockResolvedValue(mockSession());
    mockSelect
      .mockReturnValueOnce(makeChain([{ hasAutomation: true }])) // sellerProfile
      .mockReturnValueOnce(makeChain([{ id: 'setting1' }])); // existing automationSetting
    mockUpdate.mockReturnValue(makeUpdateChain());

    const result = await updateAutomationSettingsAction({
      autoRelistEnabled: true,
      autoRelistDays: 30,
    });
    expect(result.success).toBe(true);
    expect(mockUpdate).toHaveBeenCalled();
  });

  it('returns error when user is unauthenticated', async () => {
    mockAuthorize.mockResolvedValue({ ability: { can: vi.fn(() => false) } as never, session: null });
    const result = await updateAutomationSettingsAction({ autoRelistEnabled: true });
    expect(result.success).toBe(false);
    expect(result.error).toBe('Unauthorized');
  });

  it('returns error when CASL check fails', async () => {
    mockAuthorize.mockResolvedValue({
      ability: { can: vi.fn(() => false) } as never,
      session: { userId: 'user1', email: 'test@example.com' } as never,
    });
    const result = await updateAutomationSettingsAction({ autoRelistEnabled: true });
    expect(result.success).toBe(false);
    expect(result.error).toBe('Forbidden');
  });

  it('returns error when hasAutomation=false', async () => {
    mockAuthorize.mockResolvedValue(mockSession());
    mockSelect.mockReturnValueOnce(makeChain([{ hasAutomation: false }]));

    const result = await updateAutomationSettingsAction({ autoRelistEnabled: true });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Automation add-on is required');
  });

  it('rejects unknown keys (strict mode)', async () => {
    mockAuthorize.mockResolvedValue(mockSession());
    mockSelect.mockReturnValueOnce(makeChain([{ hasAutomation: true }]));

    const result = await updateAutomationSettingsAction(
      { autoRelistEnabled: true, unknownField: 'bad' } as never
    );
    expect(result.success).toBe(false);
  });

  it('inserts new row when no existing setting', async () => {
    mockAuthorize.mockResolvedValue(mockSession());
    mockSelect
      .mockReturnValueOnce(makeChain([{ hasAutomation: true }]))
      .mockReturnValueOnce(makeChain([])); // no existing setting
    mockInsert.mockReturnValue(makeInsertChain());

    const result = await updateAutomationSettingsAction({ priceDropEnabled: true });
    expect(result.success).toBe(true);
    expect(mockInsert).toHaveBeenCalled();
  });
});
