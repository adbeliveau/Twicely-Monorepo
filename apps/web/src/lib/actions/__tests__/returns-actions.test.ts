import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockAuthorize, mockSub,
  mockApproveReturn, mockDeclineReturn, mockMarkReturnShipped, mockMarkReturnReceived,
} = vi.hoisted(() => ({
  mockAuthorize: vi.fn(),
  mockSub: vi.fn((type: string, obj: Record<string, unknown>) => ({ __caslSubjectType__: type, ...obj })),
  mockApproveReturn: vi.fn(),
  mockDeclineReturn: vi.fn(),
  mockMarkReturnShipped: vi.fn(),
  mockMarkReturnReceived: vi.fn(),
}));

vi.mock('@twicely/casl', () => ({ authorize: mockAuthorize, sub: mockSub }));
vi.mock('@twicely/commerce/returns-lifecycle', () => ({
  approveReturn: mockApproveReturn,
  declineReturn: mockDeclineReturn,
  markReturnShipped: mockMarkReturnShipped,
  markReturnReceived: mockMarkReturnReceived,
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

import {
  approveReturnAction,
  declineReturnAction,
  markReturnShippedAction,
  markReturnReceivedAction,
} from '../returns-actions';

const VALID_RETURN_ID = 'z123456789012345678901234';
const SELLER_ID = 'seller-test-001';
const BUYER_ID = 'buyer-test-001';

function makeAbility(canUpdate = true) {
  return { can: vi.fn().mockReturnValue(canUpdate) };
}

describe('approveReturnAction', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns Unauthorized when not authenticated', async () => {
    mockAuthorize.mockResolvedValue({ ability: makeAbility(), session: null });
    const result = await approveReturnAction(VALID_RETURN_ID);
    expect(result).toEqual({ success: false, error: 'Unauthorized' });
  });

  it('returns Not authorized when ability denies update Return', async () => {
    mockAuthorize.mockResolvedValue({ ability: makeAbility(false), session: { userId: SELLER_ID, delegationId: null } });
    const result = await approveReturnAction(VALID_RETURN_ID);
    expect(result).toEqual({ success: false, error: 'Not authorized' });
  });

  it('returns Invalid input for empty returnId', async () => {
    mockAuthorize.mockResolvedValue({ ability: makeAbility(), session: { userId: SELLER_ID, delegationId: null } });
    const result = await approveReturnAction('');
    expect(result).toEqual({ success: false, error: 'Invalid input' });
  });

  it('delegates to approveReturn with seller ID', async () => {
    mockAuthorize.mockResolvedValue({ ability: makeAbility(), session: { userId: SELLER_ID, delegationId: null } });
    mockApproveReturn.mockResolvedValue({ success: true });
    const result = await approveReturnAction(VALID_RETURN_ID);
    expect(result.success).toBe(true);
    expect(mockApproveReturn).toHaveBeenCalledWith(SELLER_ID, VALID_RETURN_ID);
  });

  it('uses onBehalfOfSellerId when delegationId is set', async () => {
    mockAuthorize.mockResolvedValue({
      ability: makeAbility(),
      session: { userId: 'staff-1', delegationId: 'del-1', onBehalfOfSellerId: 'seller-2' },
    });
    mockApproveReturn.mockResolvedValue({ success: true });
    await approveReturnAction(VALID_RETURN_ID);
    expect(mockApproveReturn).toHaveBeenCalledWith('seller-2', VALID_RETURN_ID);
  });

  it('propagates error from commerce approveReturn', async () => {
    mockAuthorize.mockResolvedValue({ ability: makeAbility(), session: { userId: SELLER_ID, delegationId: null } });
    mockApproveReturn.mockResolvedValue({ success: false, error: 'Return already approved' });
    const result = await approveReturnAction(VALID_RETURN_ID);
    expect(result).toEqual({ success: false, error: 'Return already approved' });
  });
});

describe('declineReturnAction', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns Unauthorized when not authenticated', async () => {
    mockAuthorize.mockResolvedValue({ ability: makeAbility(), session: null });
    const result = await declineReturnAction(VALID_RETURN_ID, 'Item was fine.');
    expect(result).toEqual({ success: false, error: 'Unauthorized' });
  });

  it('returns Invalid input for empty responseNote', async () => {
    mockAuthorize.mockResolvedValue({ ability: makeAbility(), session: { userId: SELLER_ID, delegationId: null } });
    const result = await declineReturnAction(VALID_RETURN_ID, '');
    expect(result).toEqual({ success: false, error: 'Invalid input' });
  });

  it('returns Invalid input for responseNote > 2000 chars', async () => {
    mockAuthorize.mockResolvedValue({ ability: makeAbility(), session: { userId: SELLER_ID, delegationId: null } });
    const result = await declineReturnAction(VALID_RETURN_ID, 'x'.repeat(2001));
    expect(result).toEqual({ success: false, error: 'Invalid input' });
  });

  it('delegates to declineReturn with seller ID and note', async () => {
    mockAuthorize.mockResolvedValue({ ability: makeAbility(), session: { userId: SELLER_ID, delegationId: null } });
    mockDeclineReturn.mockResolvedValue({ success: true });
    const result = await declineReturnAction(VALID_RETURN_ID, 'Item was as described.');
    expect(result.success).toBe(true);
    expect(mockDeclineReturn).toHaveBeenCalledWith(SELLER_ID, VALID_RETURN_ID, 'Item was as described.');
  });
});

describe('markReturnShippedAction', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns Unauthorized when not authenticated', async () => {
    mockAuthorize.mockResolvedValue({ ability: makeAbility(), session: null });
    const result = await markReturnShippedAction(VALID_RETURN_ID, '1Z999AA1');
    expect(result).toEqual({ success: false, error: 'Unauthorized' });
  });

  it('returns Invalid input for empty tracking number', async () => {
    mockAuthorize.mockResolvedValue({ ability: makeAbility(), session: { userId: BUYER_ID } });
    const result = await markReturnShippedAction(VALID_RETURN_ID, '');
    expect(result).toEqual({ success: false, error: 'Invalid input' });
  });

  it('returns Invalid input for tracking number > 200 chars', async () => {
    mockAuthorize.mockResolvedValue({ ability: makeAbility(), session: { userId: BUYER_ID } });
    const result = await markReturnShippedAction(VALID_RETURN_ID, 'x'.repeat(201));
    expect(result).toEqual({ success: false, error: 'Invalid input' });
  });

  it('delegates to markReturnShipped with buyer session.userId', async () => {
    mockAuthorize.mockResolvedValue({ ability: makeAbility(), session: { userId: BUYER_ID } });
    mockMarkReturnShipped.mockResolvedValue({ success: true });
    const result = await markReturnShippedAction(VALID_RETURN_ID, '1Z999AA1', 'UPS');
    expect(result.success).toBe(true);
    expect(mockMarkReturnShipped).toHaveBeenCalledWith(BUYER_ID, VALID_RETURN_ID, '1Z999AA1', 'UPS');
  });

  it('passes undefined carrier when not provided', async () => {
    mockAuthorize.mockResolvedValue({ ability: makeAbility(), session: { userId: BUYER_ID } });
    mockMarkReturnShipped.mockResolvedValue({ success: true });
    await markReturnShippedAction(VALID_RETURN_ID, '1Z999AA1');
    expect(mockMarkReturnShipped).toHaveBeenCalledWith(BUYER_ID, VALID_RETURN_ID, '1Z999AA1', undefined);
  });
});

describe('markReturnReceivedAction', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns Unauthorized when not authenticated', async () => {
    mockAuthorize.mockResolvedValue({ ability: makeAbility(), session: null });
    const result = await markReturnReceivedAction(VALID_RETURN_ID);
    expect(result).toEqual({ success: false, error: 'Unauthorized' });
  });

  it('returns Not authorized when ability denies update Return', async () => {
    mockAuthorize.mockResolvedValue({ ability: makeAbility(false), session: { userId: SELLER_ID, delegationId: null } });
    const result = await markReturnReceivedAction(VALID_RETURN_ID);
    expect(result).toEqual({ success: false, error: 'Not authorized' });
  });

  it('delegates to markReturnReceived with seller ID', async () => {
    mockAuthorize.mockResolvedValue({ ability: makeAbility(), session: { userId: SELLER_ID, delegationId: null } });
    mockMarkReturnReceived.mockResolvedValue({ success: true });
    const result = await markReturnReceivedAction(VALID_RETURN_ID);
    expect(result.success).toBe(true);
    expect(mockMarkReturnReceived).toHaveBeenCalledWith(SELLER_ID, VALID_RETURN_ID);
  });

  it('propagates error from commerce markReturnReceived', async () => {
    mockAuthorize.mockResolvedValue({ ability: makeAbility(), session: { userId: SELLER_ID, delegationId: null } });
    mockMarkReturnReceived.mockResolvedValue({ success: false, error: 'Return not in correct state' });
    const result = await markReturnReceivedAction(VALID_RETURN_ID);
    expect(result).toEqual({ success: false, error: 'Return not in correct state' });
  });
});
