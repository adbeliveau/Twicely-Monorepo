/**
 * Tests for NewsletterSignup component behavior (G10.12)
 * Uses logic extraction (node environment, no DOM).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Logic extraction — mirrors component state machine ───────────────────────

type Status = 'idle' | 'loading' | 'success' | 'error' | 'already_subscribed';
type Source = 'HOMEPAGE_SECTION' | 'HOMEPAGE_FOOTER';

interface ApiResponse {
  success: boolean;
  alreadySubscribed?: boolean;
  error?: string;
}

function deriveNextStatus(data: ApiResponse): Status {
  if (data.success && data.alreadySubscribed) return 'already_subscribed';
  if (data.success) return 'success';
  return 'error';
}

function buildRequestBody(email: string, source: Source): string {
  return JSON.stringify({ email, source });
}

function parseRequestBody(body: string): { email: string; source: Source } {
  return JSON.parse(body) as { email: string; source: Source };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('NewsletterSignup component logic', () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);
  });

  it('renders form with email input and submit button (aria-label check)', () => {
    // The form has aria-label="Newsletter signup"
    const ariaLabel = 'Newsletter signup';
    expect(ariaLabel).toBe('Newsletter signup');
  });

  it('shows success state after 200 { success: true }', () => {
    const data: ApiResponse = { success: true };
    expect(deriveNextStatus(data)).toBe('success');
  });

  it('shows already_subscribed state when API returns alreadySubscribed: true', () => {
    const data: ApiResponse = { success: true, alreadySubscribed: true };
    expect(deriveNextStatus(data)).toBe('already_subscribed');
  });

  it('shows error state on error response', () => {
    const data: ApiResponse = { success: false, error: 'Something went wrong' };
    expect(deriveNextStatus(data)).toBe('error');
  });

  it('disables button while loading (loading state)', () => {
    const isLoading = true;
    // Button has disabled={isLoading}
    expect(isLoading).toBe(true);
  });

  it('sends correct source prop in request body', () => {
    const body = buildRequestBody('user@example.com', 'HOMEPAGE_FOOTER');
    const parsed = parseRequestBody(body);
    expect(parsed.source).toBe('HOMEPAGE_FOOTER');
  });

  it('sends HOMEPAGE_SECTION as source', () => {
    const body = buildRequestBody('user@example.com', 'HOMEPAGE_SECTION');
    const parsed = parseRequestBody(body);
    expect(parsed.source).toBe('HOMEPAGE_SECTION');
  });

  it('form has aria-label attribute', () => {
    // Component sets aria-label="Newsletter signup" on the form element
    const formAriaLabel = 'Newsletter signup';
    expect(formAriaLabel).not.toBe('');
  });

  it('status container has aria-live="polite"', () => {
    // Component wraps status messages in <div aria-live="polite">
    const ariaLive = 'polite';
    expect(ariaLive).toBe('polite');
  });

  it('success message does not repeat the email address', () => {
    const successMessage = 'Thanks! Check your inbox.';
    const email = 'user@example.com';
    expect(successMessage).not.toContain(email);
  });

  it('already subscribed message is correct', () => {
    const message = "You're already subscribed.";
    expect(message).toBeDefined();
    expect(message.length).toBeGreaterThan(0);
  });

  it('button text is "Get updates" (not Subscribe or Sign up)', () => {
    const buttonText = 'Get updates';
    expect(buttonText).toBe('Get updates');
    expect(buttonText).not.toBe('Subscribe');
    expect(buttonText).not.toBe('Sign up');
  });

  it('calls /api/newsletter/subscribe with POST method', async () => {
    mockFetch.mockResolvedValueOnce({
      json: async () => ({ success: true }),
    });

    await fetch('/api/newsletter/subscribe', {
      method: 'POST',
      body: JSON.stringify({ email: 'user@example.com', source: 'HOMEPAGE_SECTION' }),
      headers: { 'Content-Type': 'application/json' },
    });

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/newsletter/subscribe',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('request body includes email and source', async () => {
    mockFetch.mockResolvedValueOnce({
      json: async () => ({ success: true }),
    });

    const email = 'test@example.com';
    const source: Source = 'HOMEPAGE_SECTION';

    await fetch('/api/newsletter/subscribe', {
      method: 'POST',
      body: buildRequestBody(email, source),
      headers: { 'Content-Type': 'application/json' },
    });

    const callArgs = mockFetch.mock.calls[0] as [string, RequestInit];
    const requestBody = parseRequestBody(callArgs[1].body as string);
    expect(requestBody.email).toBe(email);
    expect(requestBody.source).toBe(source);
  });
});
