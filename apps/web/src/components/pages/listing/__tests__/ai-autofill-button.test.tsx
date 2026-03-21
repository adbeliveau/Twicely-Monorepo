/**
 * Tests for AiAutofillButton component logic (G1.1)
 * Uses pure-logic extraction pattern (Vitest environment: node, no DOM/RTL).
 */
import { describe, it, expect } from 'vitest';
import type { AiAutofillSuggestions } from '@/types/ai-autofill';

interface ButtonProps {
  imageUrls: string[];
  disabled?: boolean;
  remainingUses?: number;
}

// Pure functions mirroring component logic

function shouldShowButton(props: ButtonProps): boolean {
  return props.imageUrls.length >= 1;
}

function isButtonDisabled(props: ButtonProps, isLoading: boolean): boolean {
  return (props.disabled ?? false) || isLoading;
}

function getButtonLabel(isLoading: boolean): string {
  return isLoading ? 'Analyzing photos...' : 'Auto-fill with AI';
}

function getRemainingUsesDisplay(remainingUses: number | undefined):
  | { type: 'unlimited' }
  | { type: 'count'; value: number }
  | { type: 'hidden' } {
  if (remainingUses === -1) return { type: 'unlimited' };
  if (remainingUses !== undefined) return { type: 'count', value: remainingUses };
  return { type: 'hidden' };
}

function getUsesSuffix(count: number): string {
  return count !== 1 ? 's' : '';
}

function shouldProceedOnClick(props: ButtonProps, isLoading: boolean): boolean {
  const hasImages = props.imageUrls.length >= 1;
  const isDisabled = props.disabled ?? false;
  return hasImages && !isLoading && !isDisabled;
}

function parseApiResponse(
  data: unknown
): { ok: true; suggestions: AiAutofillSuggestions } | { ok: false; error: string } {
  if (
    data !== null &&
    typeof data === 'object' &&
    'success' in data &&
    (data as { success: unknown }).success === true &&
    'suggestions' in data
  ) {
    return {
      ok: true,
      suggestions: (data as { suggestions: AiAutofillSuggestions }).suggestions,
    };
  }

  const errorText =
    data !== null &&
    typeof data === 'object' &&
    'error' in data &&
    typeof (data as { error: unknown }).error === 'string'
      ? (data as { error: string }).error
      : 'Auto-fill unavailable, please fill in manually';

  return { ok: false, error: errorText };
}

// ─── Tests: visibility ────────────────────────────────────────────────────────

describe('AiAutofillButton — visibility', () => {
  it('returns null (hidden) when imageUrls is empty', () => {
    expect(shouldShowButton({ imageUrls: [] })).toBe(false);
  });

  it('renders when at least one image URL is present', () => {
    expect(shouldShowButton({ imageUrls: ['https://example.com/img1.jpg'] })).toBe(true);
  });

  it('renders with multiple image URLs', () => {
    expect(
      shouldShowButton({ imageUrls: ['https://a.com/1.jpg', 'https://b.com/2.jpg'] })
    ).toBe(true);
  });
});

// ─── Tests: button disabled state ────────────────────────────────────────────

describe('AiAutofillButton — disabled state', () => {
  it('is not disabled when disabled=false and not loading', () => {
    expect(isButtonDisabled({ imageUrls: ['https://example.com/img1.jpg'], disabled: false }, false)).toBe(false);
  });

  it('is disabled when disabled=true prop is passed', () => {
    expect(isButtonDisabled({ imageUrls: ['https://example.com/img1.jpg'], disabled: true }, false)).toBe(true);
  });

  it('is disabled when loading is true', () => {
    expect(isButtonDisabled({ imageUrls: ['https://example.com/img1.jpg'], disabled: false }, true)).toBe(true);
  });

  it('is disabled when both disabled=true and loading=true', () => {
    expect(isButtonDisabled({ imageUrls: ['https://example.com/img1.jpg'], disabled: true }, true)).toBe(true);
  });

  it('defaults disabled to false when prop is omitted', () => {
    expect(isButtonDisabled({ imageUrls: ['https://example.com/img1.jpg'] }, false)).toBe(false);
  });
});

// ─── Tests: button label ──────────────────────────────────────────────────────

describe('AiAutofillButton — button label', () => {
  it('shows "Auto-fill with AI" when not loading', () => {
    expect(getButtonLabel(false)).toBe('Auto-fill with AI');
  });

  it('shows "Analyzing photos..." when loading', () => {
    expect(getButtonLabel(true)).toBe('Analyzing photos...');
  });
});

// ─── Tests: remaining uses display ───────────────────────────────────────────

describe('AiAutofillButton — remaining uses display', () => {
  it('shows "Unlimited uses" when remainingUses is -1', () => {
    expect(getRemainingUsesDisplay(-1)).toEqual({ type: 'unlimited' });
  });

  it('shows count when remainingUses is a positive number', () => {
    expect(getRemainingUsesDisplay(5)).toEqual({ type: 'count', value: 5 });
  });

  it('shows count when remainingUses is 0', () => {
    expect(getRemainingUsesDisplay(0)).toEqual({ type: 'count', value: 0 });
  });

  it('hides uses counter when remainingUses is undefined', () => {
    expect(getRemainingUsesDisplay(undefined)).toEqual({ type: 'hidden' });
  });

  it('uses singular "use" when remaining is exactly 1', () => {
    expect(getUsesSuffix(1)).toBe('');
  });

  it('uses plural "uses" when remaining is 0', () => {
    expect(getUsesSuffix(0)).toBe('s');
  });

  it('uses plural "uses" when remaining is more than 1', () => {
    expect(getUsesSuffix(47)).toBe('s');
  });
});

// ─── Tests: click guard ───────────────────────────────────────────────────────

describe('AiAutofillButton — click guard', () => {
  it('proceeds when images present, not loading, not disabled', () => {
    expect(
      shouldProceedOnClick({ imageUrls: ['https://example.com/img1.jpg'] }, false)
    ).toBe(true);
  });

  it('does not proceed when no images', () => {
    expect(shouldProceedOnClick({ imageUrls: [] }, false)).toBe(false);
  });

  it('does not proceed when loading', () => {
    expect(
      shouldProceedOnClick({ imageUrls: ['https://example.com/img1.jpg'] }, true)
    ).toBe(false);
  });

  it('does not proceed when disabled', () => {
    expect(
      shouldProceedOnClick(
        { imageUrls: ['https://example.com/img1.jpg'], disabled: true },
        false
      )
    ).toBe(false);
  });
});

// ─── Tests: API response parsing ─────────────────────────────────────────────

describe('AiAutofillButton — API response parsing', () => {
  const mockSuggestions: AiAutofillSuggestions = {
    title: 'Test Item',
    description: 'A test item',
    category: 'Other',
    brand: '',
    condition: 'GOOD',
    color: 'Black',
    tags: [],
    suggestedPriceMinCents: 1000,
    suggestedPriceMaxCents: 2000,
    confidence: 'MEDIUM',
  };

  it('returns ok=true with suggestions on a successful response', () => {
    const result = parseApiResponse({ success: true, suggestions: mockSuggestions });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.suggestions.title).toBe('Test Item');
    }
  });

  it('returns ok=false with error message on a failed response', () => {
    const result = parseApiResponse({ success: false, error: 'Monthly limit reached' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('Monthly limit reached');
    }
  });

  it('uses fallback error when response has no error field', () => {
    const result = parseApiResponse({ success: false });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('Auto-fill unavailable, please fill in manually');
    }
  });

  it('returns ok=false for null response', () => {
    const result = parseApiResponse(null);
    expect(result.ok).toBe(false);
  });

  it('returns ok=false for a non-object response', () => {
    const result = parseApiResponse('unexpected string');
    expect(result.ok).toBe(false);
  });

  it('returns ok=false when success=true but suggestions field is absent', () => {
    const result = parseApiResponse({ success: true });
    expect(result.ok).toBe(false);
  });
});
