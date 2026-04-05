/**
 * Unit tests for auth-notifier.ts — G10.2
 * Verifies template mapping, seller+buyer notification logic, and fire-and-forget error suppression.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ──────────────────────────────────────────────────────────────────

const mockNotify = vi.fn();
const mockLoggerError = vi.fn();

vi.mock('@twicely/notifications/service', () => ({
  notify: (...args: unknown[]) => mockNotify(...args),
}));

vi.mock('@twicely/logger', () => ({
  logger: { error: (...args: unknown[]) => mockLoggerError(...args) },
}));

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('notifyAuthResult', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mockNotify.mockResolvedValue(undefined);
  });

  // ─── Template mapping ─────────────────────────────────────────────────────

  it('uses auth.ai.authenticated template for AUTHENTICATED result', async () => {
    const { notifyAuthResult } = await import('../auth-notifier');
    await notifyAuthResult('seller-1', null, 'listing-1', 'Test Item', 'AUTHENTICATED', 0.99);
    expect(mockNotify).toHaveBeenCalledWith(
      'seller-1',
      'auth.ai.authenticated',
      expect.any(Object),
    );
  });

  it('uses auth.ai.counterfeit template for COUNTERFEIT result', async () => {
    const { notifyAuthResult } = await import('../auth-notifier');
    await notifyAuthResult('seller-1', null, 'listing-1', 'Test Item', 'COUNTERFEIT', 0.95);
    expect(mockNotify).toHaveBeenCalledWith(
      'seller-1',
      'auth.ai.counterfeit',
      expect.any(Object),
    );
  });

  it('uses auth.ai.inconclusive template for INCONCLUSIVE result', async () => {
    const { notifyAuthResult } = await import('../auth-notifier');
    await notifyAuthResult('seller-1', null, 'listing-1', 'Test Item', 'INCONCLUSIVE', 0.4);
    expect(mockNotify).toHaveBeenCalledWith(
      'seller-1',
      'auth.ai.inconclusive',
      expect.any(Object),
    );
  });

  // ─── Seller-only notification ─────────────────────────────────────────────

  it('notifies only seller when buyerId is null', async () => {
    const { notifyAuthResult } = await import('../auth-notifier');
    await notifyAuthResult('seller-2', null, 'listing-2', 'Bag', 'AUTHENTICATED', 0.99);
    expect(mockNotify).toHaveBeenCalledTimes(1);
    expect(mockNotify).toHaveBeenCalledWith('seller-2', expect.any(String), expect.any(Object));
  });

  it('notifies both seller and buyer when buyerId is provided', async () => {
    const { notifyAuthResult } = await import('../auth-notifier');
    await notifyAuthResult('seller-3', 'buyer-3', 'listing-3', 'Sneakers', 'AUTHENTICATED', 0.99);
    expect(mockNotify).toHaveBeenCalledTimes(2);
    expect(mockNotify).toHaveBeenCalledWith('seller-3', expect.any(String), expect.any(Object));
    expect(mockNotify).toHaveBeenCalledWith('buyer-3', expect.any(String), expect.any(Object));
  });

  it('notifies only seller when buyerId equals sellerId', async () => {
    const { notifyAuthResult } = await import('../auth-notifier');
    // Implementation skips buyer notify when buyerId === sellerId
    await notifyAuthResult('user-same', 'user-same', 'listing-4', 'Watch', 'INCONCLUSIVE');
    expect(mockNotify).toHaveBeenCalledTimes(1);
  });

  // ─── Notification data shape ──────────────────────────────────────────────

  it('includes itemTitle in notification data', async () => {
    const { notifyAuthResult } = await import('../auth-notifier');
    await notifyAuthResult('seller-4', null, 'listing-4', 'Luxury Watch', 'AUTHENTICATED', 0.98);
    expect(mockNotify).toHaveBeenCalledWith(
      'seller-4',
      expect.any(String),
      expect.objectContaining({ itemTitle: 'Luxury Watch' }),
    );
  });

  it('includes listingId in notification data', async () => {
    const { notifyAuthResult } = await import('../auth-notifier');
    await notifyAuthResult('seller-5', null, 'listing-5', 'Bag', 'COUNTERFEIT', 0.95);
    expect(mockNotify).toHaveBeenCalledWith(
      'seller-5',
      expect.any(String),
      expect.objectContaining({ listingId: 'listing-5' }),
    );
  });

  it('includes confidencePercent as rounded percentage string', async () => {
    const { notifyAuthResult } = await import('../auth-notifier');
    await notifyAuthResult('seller-6', null, 'listing-6', 'Item', 'AUTHENTICATED', 0.9751);
    expect(mockNotify).toHaveBeenCalledWith(
      'seller-6',
      expect.any(String),
      expect.objectContaining({ confidencePercent: '98' }),
    );
  });

  it('uses N/A for confidencePercent when confidence is not provided', async () => {
    const { notifyAuthResult } = await import('../auth-notifier');
    await notifyAuthResult('seller-7', null, 'listing-7', 'Item', 'INCONCLUSIVE');
    expect(mockNotify).toHaveBeenCalledWith(
      'seller-7',
      expect.any(String),
      expect.objectContaining({ confidencePercent: 'N/A' }),
    );
  });

  // ─── Fire-and-forget error suppression ───────────────────────────────────

  it('logs error but does NOT rethrow when notify throws', async () => {
    mockNotify.mockRejectedValue(new Error('Notification service unavailable'));
    const { notifyAuthResult } = await import('../auth-notifier');
    // Must resolve (not reject) despite inner failure
    await expect(
      notifyAuthResult('seller-8', null, 'listing-8', 'Item', 'AUTHENTICATED', 0.99),
    ).resolves.toBeUndefined();
    expect(mockLoggerError).toHaveBeenCalledWith(
      '[notifyAuthResult] Failed to send notification',
      expect.objectContaining({ result: 'AUTHENTICATED' }),
    );
  });

  it('logs the sellerId and listingId in the error log', async () => {
    mockNotify.mockRejectedValue(new Error('Down'));
    const { notifyAuthResult } = await import('../auth-notifier');
    await notifyAuthResult('seller-err', 'buyer-err', 'listing-err', 'Item', 'COUNTERFEIT', 0.9);
    expect(mockLoggerError).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ sellerId: 'seller-err', listingId: 'listing-err' }),
    );
  });
});
