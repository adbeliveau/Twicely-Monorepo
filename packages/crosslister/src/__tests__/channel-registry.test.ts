/**
 * Tests for channel-registry.ts — static channel metadata, helper functions.
 * Source: channel-registry.ts, Lister Canonical Sections 9.1, 8.3
 */

import { describe, test, expect } from 'vitest';
import {
  CHANNEL_REGISTRY,
  getChannelMetadata,
  getEnabledChannels,
  getChannelsByTier,
  isChannelEnabled,
} from '../channel-registry';
import type { ExternalChannel } from '../types';

const ALL_CHANNELS: ExternalChannel[] = [
  'EBAY',
  'POSHMARK',
  'MERCARI',
  'DEPOP',
  'FB_MARKETPLACE',
  'ETSY',
  'GRAILED',
  'THEREALREAL',
  'WHATNOT',
  'SHOPIFY',
  'VESTIAIRE',
];

// ─── Registry completeness ────────────────────────────────────────────────────

describe('CHANNEL_REGISTRY completeness', () => {
  test('contains exactly 8 channels', () => {
    expect(CHANNEL_REGISTRY.size).toBe(11);
  });

  test('contains all expected channel keys', () => {
    for (const channel of ALL_CHANNELS) {
      expect(CHANNEL_REGISTRY.has(channel)).toBe(true);
    }
  });
});

// ─── getChannelMetadata ───────────────────────────────────────────────────────

describe('getChannelMetadata', () => {
  test('returns metadata for EBAY', () => {
    const metadata = getChannelMetadata('EBAY');
    expect(metadata.channel).toBe('EBAY');
    expect(metadata.displayName).toBe('eBay');
    expect(metadata.tier).toBe('A');
    expect(metadata.authMethod).toBe('OAUTH');
  });

  test('returns metadata for POSHMARK', () => {
    const metadata = getChannelMetadata('POSHMARK');
    expect(metadata.channel).toBe('POSHMARK');
    expect(metadata.tier).toBe('C');
    expect(metadata.authMethod).toBe('SESSION');
  });

  test('throws for an unknown channel', () => {
    expect(() =>
      getChannelMetadata('UNKNOWN_CHANNEL' as ExternalChannel),
    ).toThrow('Channel not found in registry: UNKNOWN_CHANNEL');
  });

  test('every channel entry has all required metadata fields', () => {
    for (const channel of ALL_CHANNELS) {
      const metadata = getChannelMetadata(channel);
      expect(metadata.channel).toBe(channel);
      expect(typeof metadata.displayName).toBe('string');
      expect(metadata.displayName.length).toBeGreaterThan(0);
      expect(['A', 'B', 'C']).toContain(metadata.tier);
      expect(['OAUTH', 'API_KEY', 'SESSION']).toContain(metadata.authMethod);
      expect(typeof metadata.iconSlug).toBe('string');
      expect(typeof metadata.color).toBe('string');
      expect(typeof metadata.enabled).toBe('boolean');
    }
  });

  test('every channel has valid rate limits (positive numbers)', () => {
    for (const channel of ALL_CHANNELS) {
      const metadata = getChannelMetadata(channel);
      expect(metadata.rateLimit.callsPerHourPerSeller).toBeGreaterThan(0);
      expect(metadata.rateLimit.burstAllowance).toBeGreaterThan(0);
    }
  });

  test('every channel has all three featureFlag keys', () => {
    for (const channel of ALL_CHANNELS) {
      const { featureFlags } = getChannelMetadata(channel);
      expect(typeof featureFlags.importEnabled).toBe('string');
      expect(typeof featureFlags.crosslistEnabled).toBe('string');
      expect(typeof featureFlags.automationEnabled).toBe('string');
    }
  });

  test('every channel has valid defaultCapabilities', () => {
    for (const channel of ALL_CHANNELS) {
      const { defaultCapabilities } = getChannelMetadata(channel);
      expect(typeof defaultCapabilities.canImport).toBe('boolean');
      expect(typeof defaultCapabilities.canPublish).toBe('boolean');
      expect(defaultCapabilities.maxImagesPerListing).toBeGreaterThan(0);
      expect(defaultCapabilities.maxTitleLength).toBeGreaterThan(0);
      expect(defaultCapabilities.maxDescriptionLength).toBeGreaterThan(0);
      expect(Array.isArray(defaultCapabilities.supportedImageFormats)).toBe(true);
      expect(defaultCapabilities.supportedImageFormats.length).toBeGreaterThan(0);
    }
  });
});

// ─── getEnabledChannels ───────────────────────────────────────────────────────

describe('getEnabledChannels', () => {
  test('returns only enabled channels', () => {
    const enabled = getEnabledChannels();
    // Only EBAY, POSHMARK, MERCARI are enabled at launch
    expect(enabled).toContain('EBAY');
    expect(enabled).toContain('POSHMARK');
    expect(enabled).toContain('MERCARI');
  });

  test('includes all 11 launch channels', () => {
    const enabled = getEnabledChannels();
    expect(enabled).toContain('DEPOP');
    expect(enabled).toContain('FB_MARKETPLACE');
    expect(enabled).toContain('ETSY');
    expect(enabled).toContain('GRAILED');
    expect(enabled).toContain('THEREALREAL');
    expect(enabled).toHaveLength(11);
  });
});

// ─── getChannelsByTier ────────────────────────────────────────────────────────

describe('getChannelsByTier', () => {
  test('tier A includes EBAY and ETSY', () => {
    const tierA = getChannelsByTier('A');
    expect(tierA).toContain('EBAY');
    expect(tierA).toContain('ETSY');
  });

  test('tier B includes MERCARI, DEPOP, FB_MARKETPLACE, GRAILED', () => {
    const tierB = getChannelsByTier('B');
    expect(tierB).toContain('MERCARI');
    expect(tierB).toContain('DEPOP');
    expect(tierB).toContain('FB_MARKETPLACE');
    expect(tierB).toContain('GRAILED');
  });

  test('tier C includes POSHMARK and THEREALREAL', () => {
    const tierC = getChannelsByTier('C');
    expect(tierC).toContain('POSHMARK');
    expect(tierC).toContain('THEREALREAL');
  });

  test('tier A channels have webhooks enabled', () => {
    const tierA = getChannelsByTier('A');
    for (const channel of tierA) {
      const { defaultCapabilities } = getChannelMetadata(channel);
      expect(defaultCapabilities.hasWebhooks).toBe(true);
    }
  });

  test('tier C channels cannot update listings', () => {
    const tierC = getChannelsByTier('C');
    for (const channel of tierC) {
      const { defaultCapabilities } = getChannelMetadata(channel);
      expect(defaultCapabilities.canUpdate).toBe(false);
    }
  });

  test('all tiers together cover all 11 channels exactly once', () => {
    const all = [
      ...getChannelsByTier('A'),
      ...getChannelsByTier('B'),
      ...getChannelsByTier('C'),
    ];
    expect(all).toHaveLength(11);
    const unique = new Set(all);
    expect(unique.size).toBe(11);
  });
});

// ─── isChannelEnabled ─────────────────────────────────────────────────────────

describe('isChannelEnabled', () => {
  test('returns true for EBAY', () => {
    expect(isChannelEnabled('EBAY')).toBe(true);
  });

  test('returns true for DEPOP', () => {
    expect(isChannelEnabled('DEPOP')).toBe(true);
  });

  test('returns true for FB_MARKETPLACE', () => {
    expect(isChannelEnabled('FB_MARKETPLACE')).toBe(true);
  });

  test('returns false for unknown channel without throwing', () => {
    expect(isChannelEnabled('UNKNOWN' as ExternalChannel)).toBe(false);
  });
});
