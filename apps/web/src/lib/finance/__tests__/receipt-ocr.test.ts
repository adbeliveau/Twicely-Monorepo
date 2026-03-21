import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

const PROVIDER_URL = 'https://ocr.test/api/extract';
const API_KEY = 'test-api-key-001';

function setEnv(url?: string, key?: string) {
  if (url) {
    process.env.RECEIPT_OCR_PROVIDER_URL = url;
  } else {
    delete process.env.RECEIPT_OCR_PROVIDER_URL;
  }
  if (key) {
    process.env.RECEIPT_OCR_API_KEY = key;
  } else {
    delete process.env.RECEIPT_OCR_API_KEY;
  }
}

function makeOkResponse(body: unknown) {
  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve(body),
  });
}

function makeErrorResponse(status = 500) {
  return Promise.resolve({
    ok: false,
    status,
    json: () => Promise.resolve({}),
  });
}

const NULL_RESULT = {
  vendor: null,
  amountCents: null,
  date: null,
  suggestedCategory: null,
  confidence: 0,
  rawText: null,
};

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('extractReceiptData — R2 URL hostname validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_R2_URL;
    setEnv(undefined, undefined);
  });

  it('extractReceiptData rejects URL with different hostname than R2', async () => {
    process.env.NEXT_PUBLIC_R2_URL = 'https://r2.twicely.com';
    const { extractReceiptData } = await import('../receipt-ocr');
    const result = await extractReceiptData('https://evil.example.com/receipt.jpg');
    expect(result).toEqual(NULL_RESULT);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('rejects malformed imageUrl when R2 prefix is set', async () => {
    process.env.NEXT_PUBLIC_R2_URL = 'https://r2.twicely.com';
    const { extractReceiptData } = await import('../receipt-ocr');
    const result = await extractReceiptData('not-a-url');
    expect(result).toEqual(NULL_RESULT);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('rejects hostname spoofing attempt via prefix match', async () => {
    process.env.NEXT_PUBLIC_R2_URL = 'https://r2.twicely.com';
    const { extractReceiptData } = await import('../receipt-ocr');
    const result = await extractReceiptData('https://r2.twicely.com.evil.com/receipt.jpg');
    expect(result).toEqual(NULL_RESULT);
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

describe('extractReceiptData — dev fallback (no env)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    setEnv(undefined, undefined);
  });

  afterEach(() => {
    setEnv(undefined, undefined);
  });

  it('returns null-result when RECEIPT_OCR_PROVIDER_URL is not set', async () => {
    const { extractReceiptData } = await import('../receipt-ocr');
    const result = await extractReceiptData('https://cdn.test/receipt.jpg');

    expect(result).toEqual(NULL_RESULT);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('returns null-result when RECEIPT_OCR_API_KEY is not set (URL present)', async () => {
    setEnv(PROVIDER_URL, undefined);
    const { extractReceiptData } = await import('../receipt-ocr');
    const result = await extractReceiptData('https://cdn.test/receipt.jpg');

    expect(result).toEqual(NULL_RESULT);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('returns null-result when RECEIPT_OCR_PROVIDER_URL is not set (key present)', async () => {
    setEnv(undefined, API_KEY);
    const { extractReceiptData } = await import('../receipt-ocr');
    const result = await extractReceiptData('https://cdn.test/receipt.jpg');

    expect(result).toEqual(NULL_RESULT);
  });
});

describe('extractReceiptData — provider error handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    setEnv(PROVIDER_URL, API_KEY);
  });

  afterEach(() => {
    setEnv(undefined, undefined);
  });

  it('returns null-result when provider returns non-ok status', async () => {
    mockFetch.mockReturnValue(makeErrorResponse(422));
    const { extractReceiptData } = await import('../receipt-ocr');
    const result = await extractReceiptData('https://cdn.test/receipt.jpg');

    expect(result).toEqual(NULL_RESULT);
  });

  it('returns null-result when fetch throws (network error)', async () => {
    mockFetch.mockRejectedValue(new Error('Network failure'));
    const { extractReceiptData } = await import('../receipt-ocr');
    const result = await extractReceiptData('https://cdn.test/receipt.jpg');

    expect(result).toEqual(NULL_RESULT);
  });

  it('returns null-result when provider returns 500', async () => {
    mockFetch.mockReturnValue(makeErrorResponse(500));
    const { extractReceiptData } = await import('../receipt-ocr');
    const result = await extractReceiptData('https://cdn.test/receipt.jpg');

    expect(result).toEqual(NULL_RESULT);
  });
});

describe('extractReceiptData — happy path', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    setEnv(PROVIDER_URL, API_KEY);
  });

  afterEach(() => {
    setEnv(undefined, undefined);
  });

  it('extracts all fields from a successful provider response', async () => {
    mockFetch.mockReturnValue(makeOkResponse({
      vendor: 'USPS',
      amount: 15.99,
      date: '2026-03-04',
      category: 'Shipping Supplies',
      confidence: 0.97,
      rawText: 'USPS receipt\n$15.99',
    }));

    const { extractReceiptData } = await import('../receipt-ocr');
    const result = await extractReceiptData('https://cdn.test/receipt.jpg');

    expect(result.vendor).toBe('USPS');
    expect(result.amountCents).toBe(1599);
    expect(result.date).toBe('2026-03-04');
    expect(result.suggestedCategory).toBe('Shipping Supplies');
    expect(result.confidence).toBe(0.97);
    expect(result.rawText).toBe('USPS receipt\n$15.99');
  });

  it('converts dollar amount to integer cents via Math.round', async () => {
    mockFetch.mockReturnValue(makeOkResponse({
      vendor: 'Test',
      amount: 9.999,
      date: '2026-03-04',
      category: 'Equipment',
      confidence: 0.8,
      rawText: null,
    }));

    const { extractReceiptData } = await import('../receipt-ocr');
    const result = await extractReceiptData('https://cdn.test/receipt.jpg');

    expect(result.amountCents).toBe(1000);
  });

  it('rejects category not in EXPENSE_CATEGORIES list', async () => {
    mockFetch.mockReturnValue(makeOkResponse({
      vendor: 'Amazon',
      amount: 25.00,
      date: '2026-03-04',
      category: 'INVALID_CATEGORY',
      confidence: 0.75,
      rawText: 'test',
    }));

    const { extractReceiptData } = await import('../receipt-ocr');
    const result = await extractReceiptData('https://cdn.test/receipt.jpg');

    expect(result.suggestedCategory).toBeNull();
    expect(result.amountCents).toBe(2500);
  });

  it('accepts valid category "Equipment" from the list', async () => {
    mockFetch.mockReturnValue(makeOkResponse({
      vendor: 'Best Buy',
      amount: 299.99,
      date: '2026-03-01',
      category: 'Equipment',
      confidence: 0.91,
      rawText: null,
    }));

    const { extractReceiptData } = await import('../receipt-ocr');
    const result = await extractReceiptData('https://cdn.test/receipt.jpg');

    expect(result.suggestedCategory).toBe('Equipment');
    expect(result.amountCents).toBe(29999);
  });

  it('defaults confidence to 0 when not a number', async () => {
    mockFetch.mockReturnValue(makeOkResponse({
      vendor: 'Shop',
      amount: 5.00,
      date: '2026-03-04',
      category: 'Other',
      confidence: 'high',
      rawText: null,
    }));

    const { extractReceiptData } = await import('../receipt-ocr');
    const result = await extractReceiptData('https://cdn.test/receipt.jpg');

    expect(result.confidence).toBe(0);
  });

  it('nulls out amountCents when amount field is missing', async () => {
    mockFetch.mockReturnValue(makeOkResponse({
      vendor: 'Shop',
      date: '2026-03-04',
      category: 'Packaging',
      confidence: 0.6,
      rawText: 'receipt text',
    }));

    const { extractReceiptData } = await import('../receipt-ocr');
    const result = await extractReceiptData('https://cdn.test/receipt.jpg');

    expect(result.amountCents).toBeNull();
  });

  it('sends POST with Authorization header and imageUrl in body', async () => {
    mockFetch.mockReturnValue(makeOkResponse({
      vendor: null,
      confidence: 0,
    }));

    const { extractReceiptData } = await import('../receipt-ocr');
    await extractReceiptData('https://cdn.test/receipt123.jpg');

    expect(mockFetch).toHaveBeenCalledWith(
      PROVIDER_URL,
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: `Bearer ${API_KEY}`,
          'Content-Type': 'application/json',
        }),
      }),
    );

    const call = mockFetch.mock.calls[0]?.[1] as { body: string };
    const bodyParsed = JSON.parse(call.body) as { imageUrl: string; categories: string[] };
    expect(bodyParsed.imageUrl).toBe('https://cdn.test/receipt123.jpg');
    expect(Array.isArray(bodyParsed.categories)).toBe(true);
    expect(bodyParsed.categories.length).toBeGreaterThan(0);
  });
});
