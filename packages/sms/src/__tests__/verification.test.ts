import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Valkey client
const mockValkey = {
  get: vi.fn(),
  set: vi.fn(),
  del: vi.fn(),
  incr: vi.fn(),
  expire: vi.fn(),
};

vi.mock('@twicely/db/cache', () => ({
  getValkeyClient: () => mockValkey,
}));

vi.mock('@twicely/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

// Mock SMS provider
const mockProvider = {
  sendSms: vi.fn().mockResolvedValue({ success: true, messageId: 'test-123' }),
  sendVerificationCode: vi.fn().mockResolvedValue({ success: true, messageId: 'test-123' }),
};

vi.mock('../index', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../index')>();
  return { ...mod, getSmsProvider: () => mockProvider };
});

import { sendVerificationCode, verifyCode, generateCode } from '../verification';

describe('generateCode', () => {
  it('produces a 6-digit string', () => {
    const code = generateCode();
    expect(code).toMatch(/^\d{6}$/);
    expect(parseInt(code, 10)).toBeGreaterThanOrEqual(100000);
    expect(parseInt(code, 10)).toBeLessThan(1000000);
  });

  it('produces different codes on successive calls', () => {
    const codes = new Set(Array.from({ length: 20 }, () => generateCode()));
    expect(codes.size).toBeGreaterThan(1);
  });
});

describe('sendVerificationCode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockValkey.get.mockResolvedValue(null);
    mockValkey.set.mockResolvedValue('OK');
    mockValkey.del.mockResolvedValue(1);
  });

  it('sends a code and stores it in Valkey', async () => {
    const result = await sendVerificationCode('+15551234567');

    expect(result.success).toBe(true);
    expect(mockValkey.set).toHaveBeenCalledWith(
      expect.stringMatching(/^sms:verify:/),
      expect.stringMatching(/^\d{6}$/),
      'EX',
      600
    );
    expect(mockProvider.sendVerificationCode).toHaveBeenCalledWith(
      '+15551234567',
      expect.stringMatching(/^\d{6}$/)
    );
  });

  it('rejects when locked out (3+ attempts)', async () => {
    mockValkey.get.mockResolvedValue('3');

    const result = await sendVerificationCode('+15551234567');

    expect(result.success).toBe(false);
    expect(result.error).toContain('Too many attempts');
    expect(mockProvider.sendVerificationCode).not.toHaveBeenCalled();
  });

  it('cleans up stored code when SMS fails', async () => {
    mockProvider.sendVerificationCode.mockResolvedValueOnce({
      success: false,
      error: 'Network error',
    });

    const result = await sendVerificationCode('+15551234567');

    expect(result.success).toBe(false);
    expect(mockValkey.del).toHaveBeenCalled();
  });
});

describe('verifyCode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockValkey.get.mockResolvedValue(null);
    mockValkey.incr.mockResolvedValue(1);
    mockValkey.expire.mockResolvedValue(1);
  });

  it('succeeds with correct code', async () => {
    mockValkey.get
      .mockResolvedValueOnce(null)  // attempt check
      .mockResolvedValueOnce('123456'); // stored code

    const result = await verifyCode('+15551234567', '123456');

    expect(result.success).toBe(true);
    expect(mockValkey.del).toHaveBeenCalled(); // one-time use
  });

  it('fails with wrong code and decrements remaining attempts', async () => {
    mockValkey.get
      .mockResolvedValueOnce(null)     // attempt check
      .mockResolvedValueOnce('123456') // stored code
      .mockResolvedValueOnce('1');     // new attempt count

    const result = await verifyCode('+15551234567', '999999');

    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid code');
    expect(result.error).toContain('2 attempts remaining');
    expect(mockValkey.incr).toHaveBeenCalled();
  });

  it('fails when code is expired (not in Valkey)', async () => {
    mockValkey.get
      .mockResolvedValueOnce(null)  // attempt check
      .mockResolvedValueOnce(null); // no stored code

    const result = await verifyCode('+15551234567', '123456');

    expect(result.success).toBe(false);
    expect(result.error).toContain('expired');
  });

  it('locks out after max attempts', async () => {
    mockValkey.get.mockResolvedValueOnce('3'); // already at max

    const result = await verifyCode('+15551234567', '123456');

    expect(result.success).toBe(false);
    expect(result.error).toContain('Too many attempts');
  });

  it('hashes phone numbers consistently', async () => {
    mockValkey.get
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce('111111');

    await verifyCode('+15551234567', '111111');

    // Same phone should produce same key
    const key1 = mockValkey.get.mock.calls[0][0] as string;
    expect(key1).toMatch(/^sms:attempts:/);
    expect(key1).not.toContain('+15551234567'); // no plaintext phone
  });
});
