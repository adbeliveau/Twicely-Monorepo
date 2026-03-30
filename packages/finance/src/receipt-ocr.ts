import { EXPENSE_CATEGORIES } from './expense-categories';

export interface ReceiptOcrResult {
  vendor: string | null;
  amountCents: number | null;
  date: string | null;
  suggestedCategory: string | null;
  confidence: number;
  rawText: string | null;
}

const MOCK_RESULT: ReceiptOcrResult = {
  vendor: null,
  amountCents: null,
  date: null,
  suggestedCategory: null,
  confidence: 0,
  rawText: null,
};

export async function extractReceiptData(
  imageUrl: string,
): Promise<ReceiptOcrResult> {
  const r2Prefix = process.env.NEXT_PUBLIC_R2_URL;
  if (r2Prefix) {
    try {
      const imageUrlParsed = new URL(imageUrl);
      const r2UrlParsed = new URL(r2Prefix);
      if (imageUrlParsed.hostname !== r2UrlParsed.hostname) {
        return MOCK_RESULT;
      }
    } catch {
      // Malformed URL -- reject
      return MOCK_RESULT;
    }
  }

  const providerUrl = process.env.RECEIPT_OCR_PROVIDER_URL;
  const apiKey = process.env.RECEIPT_OCR_API_KEY;

  if (!providerUrl || !apiKey) {
    return MOCK_RESULT;
  }

  try {
    const response = await fetch(providerUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        imageUrl,
        categories: [...EXPENSE_CATEGORIES],
      }),
    });

    if (!response.ok) {
      return MOCK_RESULT;
    }

    const data = await response.json() as {
      vendor?: string;
      amount?: number;
      date?: string;
      category?: string;
      confidence?: number;
      rawText?: string;
    };

    // Convert dollar amount to integer cents
    const amountCents = typeof data.amount === 'number'
      ? Math.round(data.amount * 100)
      : null;

    // Validate suggested category is in our list
    const validCategory = EXPENSE_CATEGORIES.includes(
      data.category as typeof EXPENSE_CATEGORIES[number]
    )
      ? data.category ?? null
      : null;

    return {
      vendor: data.vendor ?? null,
      amountCents,
      date: data.date ?? null,
      suggestedCategory: validCategory,
      confidence: typeof data.confidence === 'number' ? data.confidence : 0,
      rawText: data.rawText ?? null,
    };
  } catch {
    return MOCK_RESULT;
  }
}
