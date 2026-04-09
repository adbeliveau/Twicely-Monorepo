import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockStaffAuthorize, mockComputeAndStoreSellerScore } = vi.hoisted(() => ({
  mockStaffAuthorize: vi.fn(),
  mockComputeAndStoreSellerScore: vi.fn(),
}));

vi.mock('@twicely/casl/staff-authorize', () => ({ staffAuthorize: mockStaffAuthorize }));
vi.mock('@twicely/commerce/seller-score-compute', () => ({
  computeAndStoreSellerScore: mockComputeAndStoreSellerScore,
}));

import { refreshSellerScore } from '../seller-score';

function makeStaffAbility(canManage = true) {
  return {
    ability: { can: vi.fn().mockReturnValue(canManage) },
    session: {
      staffUserId: 'staff-test-1', email: 'staff@example.com',
      displayName: 'Staff User', isPlatformStaff: true as const, platformRoles: [] as never[],
    },
  };
}

describe('refreshSellerScore', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns Forbidden when staff cannot manage SellerProfile', async () => {
    mockStaffAuthorize.mockResolvedValue(makeStaffAbility(false));
    const result = await refreshSellerScore({ sellerId: 'z123456789012345678901234' });
    expect(result).toEqual({ error: 'Forbidden' });
  });

  it('returns Invalid input for missing sellerId', async () => {
    mockStaffAuthorize.mockResolvedValue(makeStaffAbility(true));
    const result = await refreshSellerScore({});
    expect(result).toEqual({ error: 'Invalid input' });
  });

  it('returns Invalid input for empty string sellerId', async () => {
    mockStaffAuthorize.mockResolvedValue(makeStaffAbility(true));
    const result = await refreshSellerScore({ sellerId: '' });
    expect(result).toEqual({ error: 'Invalid input' });
  });

  it('returns Invalid input for extra fields (strict mode)', async () => {
    mockStaffAuthorize.mockResolvedValue(makeStaffAbility(true));
    const result = await refreshSellerScore({ sellerId: 'z123456789012345678901234', extra: 'field' });
    expect(result).toEqual({ error: 'Invalid input' });
  });

  it('returns error when score computation fails', async () => {
    mockStaffAuthorize.mockResolvedValue(makeStaffAbility(true));
    mockComputeAndStoreSellerScore.mockResolvedValue({ success: false, error: 'Insufficient data' });
    const result = await refreshSellerScore({ sellerId: 'z123456789012345678901234' });
    expect(result).toEqual({ error: 'Insufficient data' });
  });

  it('returns generic error when computation fails without message', async () => {
    mockStaffAuthorize.mockResolvedValue(makeStaffAbility(true));
    mockComputeAndStoreSellerScore.mockResolvedValue({ success: false });
    const result = await refreshSellerScore({ sellerId: 'z123456789012345678901234' });
    expect(result).toEqual({ error: 'Score computation failed' });
  });

  it('returns score and band on success', async () => {
    mockStaffAuthorize.mockResolvedValue(makeStaffAbility(true));
    mockComputeAndStoreSellerScore.mockResolvedValue({
      success: true, score: 87, band: 'TOP_RATED', isNew: false,
    });
    const result = await refreshSellerScore({ sellerId: 'z123456789012345678901234' });
    expect(result).toEqual({ success: true, score: 87, band: 'TOP_RATED', isNew: false });
  });

  it('returns isNew=true for first-time score computation', async () => {
    mockStaffAuthorize.mockResolvedValue(makeStaffAbility(true));
    mockComputeAndStoreSellerScore.mockResolvedValue({
      success: true, score: 50, band: 'EMERGING', isNew: true,
    });
    const result = await refreshSellerScore({ sellerId: 'z123456789012345678901234' });
    expect(result).toMatchObject({ success: true, isNew: true });
  });
});
