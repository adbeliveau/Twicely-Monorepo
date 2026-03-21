/**
 * Tests for connector-registry.ts — runtime connector registration and lookup.
 * Source: connector-registry.ts, Lister Canonical Section 9.2
 *
 * NOTE: The registry is a module-level Map. Each test imports a fresh module
 * via vi.resetModules() + dynamic import to prevent state leakage between tests.
 */

import { describe, test, expect, beforeEach, vi } from 'vitest';
import type { PlatformConnector } from '../connector-interface';
import type { ExternalChannel } from '../types';

// Minimal stub that satisfies the PlatformConnector interface shape enough
// for registration tests. We only test the registry, not connector behavior.
function makeConnector(channel: ExternalChannel): PlatformConnector {
  return {
    channel,
    tier: 'A',
    version: '1.0.0',
    capabilities: {
      canImport: true,
      canPublish: true,
      canUpdate: true,
      canDelist: true,
      hasWebhooks: true,
      hasStructuredCategories: true,
      canAutoRelist: true,
      canMakeOffers: true,
      canShare: false,
      maxImagesPerListing: 24,
      maxTitleLength: 80,
      maxDescriptionLength: 4000,
      supportedImageFormats: ['jpg'],
    },
    authenticate: vi.fn(),
    refreshAuth: vi.fn(),
    revokeAuth: vi.fn(),
    fetchListings: vi.fn(),
    fetchSingleListing: vi.fn(),
    createListing: vi.fn(),
    updateListing: vi.fn(),
    delistListing: vi.fn(),
    verifyListing: vi.fn(),
    healthCheck: vi.fn(),
  };
}

// Reset modules before each test for isolation — registry Map is module-level state
beforeEach(() => {
  vi.resetModules();
});

describe('connector-registry: initial state', () => {
  test('registry starts with no registered connectors', async () => {
    const { getRegisteredChannels } = await import('../connector-registry');
    expect(getRegisteredChannels()).toHaveLength(0);
  });

  test('getRegisteredChannels returns an array', async () => {
    const { getRegisteredChannels } = await import('../connector-registry');
    expect(Array.isArray(getRegisteredChannels())).toBe(true);
  });
});

describe('connector-registry: registerConnector', () => {
  test('registerConnector adds a connector to the registry', async () => {
    const { registerConnector, hasConnector } = await import('../connector-registry');
    const connector = makeConnector('EBAY');

    expect(hasConnector('EBAY')).toBe(false);
    registerConnector(connector);
    expect(hasConnector('EBAY')).toBe(true);
  });

  test('registerConnector allows multiple different channels', async () => {
    const { registerConnector, getRegisteredChannels } = await import('../connector-registry');
    registerConnector(makeConnector('EBAY'));
    registerConnector(makeConnector('POSHMARK'));

    const channels = getRegisteredChannels();
    expect(channels).toContain('EBAY');
    expect(channels).toContain('POSHMARK');
    expect(channels).toHaveLength(2);
  });

  test('registering same channel twice replaces the previous connector', async () => {
    const { registerConnector, getConnector } = await import('../connector-registry');
    const first = makeConnector('EBAY');
    const second = makeConnector('EBAY');

    registerConnector(first);
    registerConnector(second);

    const retrieved = getConnector('EBAY');
    // The second registration must be the one returned
    expect(retrieved).toBe(second);
    expect(retrieved).not.toBe(first);
  });
});

describe('connector-registry: getConnector', () => {
  test('getConnector returns the registered connector', async () => {
    const { registerConnector, getConnector } = await import('../connector-registry');
    const connector = makeConnector('MERCARI');

    registerConnector(connector);
    const retrieved = getConnector('MERCARI');

    expect(retrieved).toBe(connector);
    expect(retrieved.channel).toBe('MERCARI');
  });

  test('getConnector throws for an unregistered channel', async () => {
    const { getConnector } = await import('../connector-registry');

    expect(() => getConnector('GRAILED')).toThrow(
      'No connector registered for channel: GRAILED',
    );
  });
});

describe('connector-registry: hasConnector', () => {
  test('hasConnector returns false before registration', async () => {
    const { hasConnector } = await import('../connector-registry');
    expect(hasConnector('ETSY')).toBe(false);
  });

  test('hasConnector returns true after registration', async () => {
    const { registerConnector, hasConnector } = await import('../connector-registry');
    registerConnector(makeConnector('ETSY'));
    expect(hasConnector('ETSY')).toBe(true);
  });
});

describe('connector-registry: getRegisteredChannels', () => {
  test('getRegisteredChannels reflects all registered channels', async () => {
    const { registerConnector, getRegisteredChannels } = await import('../connector-registry');
    registerConnector(makeConnector('DEPOP'));
    registerConnector(makeConnector('FB_MARKETPLACE'));
    registerConnector(makeConnector('THEREALREAL'));

    const channels = getRegisteredChannels();
    expect(channels).toContain('DEPOP');
    expect(channels).toContain('FB_MARKETPLACE');
    expect(channels).toContain('THEREALREAL');
    expect(channels).toHaveLength(3);
  });
});
