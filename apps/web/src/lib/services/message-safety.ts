// Off-platform transaction detection patterns
// Feature Lock-in Section 19: phone numbers, email addresses, external payment mentions

const OFF_PLATFORM_KEYWORDS = [
  'venmo', 'cashapp', 'cash app', 'paypal', 'wire transfer',
  'zelle', 'western union', 'money order', 'bitcoin', 'btc', 'crypto',
] as const;

// Phone pattern: 10+ digit sequences with optional separators
const PHONE_PATTERN = /\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/;

// Simple email pattern
const EMAIL_PATTERN = /\b[^\s@]+@[^\s@]+\.[^\s@]+\b/;

export interface SafetyCheckResult {
  isFlagged: boolean;
  flagReason: string | null;
}

export function checkMessageSafety(body: string): SafetyCheckResult {
  const lowerBody = body.toLowerCase();

  // Check keywords (uses includes() — matches substrings by design per Feature Lock-in Section 19)
  for (const keyword of OFF_PLATFORM_KEYWORDS) {
    if (lowerBody.includes(keyword)) {
      return { isFlagged: true, flagReason: 'Off-platform transaction detected' };
    }
  }

  // Check phone numbers
  if (PHONE_PATTERN.test(body)) {
    return { isFlagged: true, flagReason: 'Off-platform transaction detected' };
  }

  // Check email addresses
  if (EMAIL_PATTERN.test(body)) {
    return { isFlagged: true, flagReason: 'Off-platform transaction detected' };
  }

  return { isFlagged: false, flagReason: null };
}
