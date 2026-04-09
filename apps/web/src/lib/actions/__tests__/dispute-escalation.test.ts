import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockAuthorize, mockEscalateToDispute, mockCanEscalate } = vi.hoisted(() => ({
  mockAuthorize: vi.fn(),
  mockEscalateToDispute: vi.fn(),
  mockCanEscalate: vi.fn(),
}));

vi.mock('@twicely/casl', () => ({ authorize: mockAuthorize, sub: vi.fn() }));
vi.mock('@twicely/commerce/disputes', () => ({
  escalateToDispute: mockEscalateToDispute,
  canEscalate: mockCanEscalate,
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

import { canEscalateAction, escalateToDisputeAction } from '../dispute-escalation';

function makeAbility(canCreate = true, canRead = true) {
  return {
    can: vi.fn((action: string) => {
      if (action === 'create') return canCreate;
      if (action === 'read') return canRead;
      return false;
    }),
  };
}

const VALID_RETURN_ID = 'z123456789012345678901234';

describe('canEscalateAction', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns canEscalate=false when not authenticated', async () => {
    mockAuthorize.mockResolvedValue({ ability: makeAbility(), session: null });
    const result = await canEscalateAction(VALID_RETURN_ID);
    expect(result).toEqual({ canEscalate: false, reason: 'Not authenticated' });
  });

  it('returns canEscalate=false when cannot read Dispute', async () => {
    mockAuthorize.mockResolvedValue({ ability: makeAbility(true, false), session: { userId: 'u1' } });
    const result = await canEscalateAction(VALID_RETURN_ID);
    expect(result).toEqual({ canEscalate: false, reason: 'Not authorized' });
  });

  it('returns canEscalate=false for empty returnId (fails zodId min(1))', async () => {
    mockAuthorize.mockResolvedValue({ ability: makeAbility(), session: { userId: 'u1' } });
    const result = await canEscalateAction('');
    expect(result).toEqual({ canEscalate: false, reason: 'Invalid input' });
  });

  it('delegates to canEscalate commerce function', async () => {
    mockAuthorize.mockResolvedValue({ ability: makeAbility(), session: { userId: 'u1' } });
    mockCanEscalate.mockResolvedValue({ canEscalate: true });
    const result = await canEscalateAction(VALID_RETURN_ID);
    expect(result).toEqual({ canEscalate: true });
    expect(mockCanEscalate).toHaveBeenCalledWith(VALID_RETURN_ID);
  });

  it('passes through reason from commerce function when cannot escalate', async () => {
    mockAuthorize.mockResolvedValue({ ability: makeAbility(), session: { userId: 'u1' } });
    mockCanEscalate.mockResolvedValue({ canEscalate: false, reason: 'Dispute window expired' });
    const result = await canEscalateAction(VALID_RETURN_ID);
    expect(result).toEqual({ canEscalate: false, reason: 'Dispute window expired' });
  });
});

describe('escalateToDisputeAction', () => {
  beforeEach(() => vi.clearAllMocks());

  const validData = {
    returnId: VALID_RETURN_ID,
    description: 'Item was completely different from what was described in the listing.',
    evidencePhotos: [],
  };

  it('returns error when not authenticated', async () => {
    mockAuthorize.mockResolvedValue({ ability: makeAbility(), session: null });
    const result = await escalateToDisputeAction(validData);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Not authenticated');
  });

  it('returns error when cannot create Dispute', async () => {
    mockAuthorize.mockResolvedValue({ ability: makeAbility(false, true), session: { userId: 'u1' } });
    const result = await escalateToDisputeAction(validData);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Not authorized');
  });

  it('returns error for description too short (< 10 chars)', async () => {
    mockAuthorize.mockResolvedValue({ ability: makeAbility(), session: { userId: 'u1' } });
    const result = await escalateToDisputeAction({ ...validData, description: 'Short' });
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('returns error for description too long (> 2000 chars)', async () => {
    mockAuthorize.mockResolvedValue({ ability: makeAbility(), session: { userId: 'u1' } });
    const result = await escalateToDisputeAction({ ...validData, description: 'x'.repeat(2001) });
    expect(result.success).toBe(false);
  });

  it('returns error for more than 10 evidence photos', async () => {
    mockAuthorize.mockResolvedValue({ ability: makeAbility(), session: { userId: 'u1' } });
    const tooManyPhotos = Array.from({ length: 11 }, (_, i) => `https://cdn.example.com/img${i}.jpg`);
    const result = await escalateToDisputeAction({ ...validData, evidencePhotos: tooManyPhotos });
    expect(result.success).toBe(false);
  });

  it('returns error for non-URL evidence photos', async () => {
    mockAuthorize.mockResolvedValue({ ability: makeAbility(), session: { userId: 'u1' } });
    const result = await escalateToDisputeAction({ ...validData, evidencePhotos: ['not-a-url'] });
    expect(result.success).toBe(false);
  });

  it('calls escalateToDispute with buyer userId from session', async () => {
    mockAuthorize.mockResolvedValue({ ability: makeAbility(), session: { userId: 'buyer-1' } });
    mockEscalateToDispute.mockResolvedValue({ success: true, disputeId: 'disp-1' });
    await escalateToDisputeAction(validData);
    expect(mockEscalateToDispute).toHaveBeenCalledWith(
      expect.objectContaining({ buyerId: 'buyer-1', returnId: VALID_RETURN_ID })
    );
  });

  it('returns dispute ID on success', async () => {
    mockAuthorize.mockResolvedValue({ ability: makeAbility(), session: { userId: 'buyer-1' } });
    mockEscalateToDispute.mockResolvedValue({ success: true, disputeId: 'disp-abc' });
    const result = await escalateToDisputeAction(validData);
    expect(result.success).toBe(true);
    expect(result.disputeId).toBe('disp-abc');
  });

  it('rejects extra fields (strict schema)', async () => {
    mockAuthorize.mockResolvedValue({ ability: makeAbility(), session: { userId: 'u1' } });
    const result = await escalateToDisputeAction({ ...validData, extraField: 'bad' } as never);
    expect(result.success).toBe(false);
  });
});
