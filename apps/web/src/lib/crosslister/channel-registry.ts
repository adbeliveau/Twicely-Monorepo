/**
 * Static metadata for each supported external channel.
 * This is compile-time data — channel capabilities and rate limits
 * are defined here. Platform settings in the DB control runtime feature flags.
 *
 * Source: Lister Canonical Sections 9.1, 8.3, 19.2, 27.2
 */

import type { ExternalChannel, ConnectorTier, ConnectorCapabilities } from '@twicely/crosslister/types';

export interface ChannelMetadata {
  channel: ExternalChannel;
  displayName: string;
  tier: ConnectorTier;
  authMethod: 'OAUTH' | 'API_KEY' | 'SESSION';
  iconSlug: string;
  color: string;
  defaultCapabilities: ConnectorCapabilities;
  rateLimit: {
    callsPerHourPerSeller: number;
    burstAllowance: number;
  };
  featureFlags: {
    importEnabled: string;
    crosslistEnabled: string;
    automationEnabled: string;
  };
  /** Master switch — false means UI hides this channel entirely */
  enabled: boolean;
}

// Tier A default capabilities (full API + webhooks)
function tierACapabilities(
  maxImages: number,
  maxTitle: number,
  maxDescription: number,
): ConnectorCapabilities {
  return {
    canImport: true,
    canPublish: true,
    canUpdate: true,
    canDelist: true,
    hasWebhooks: true,
    hasStructuredCategories: true,
    canAutoRelist: true,
    canMakeOffers: true,
    canShare: false,
    maxImagesPerListing: maxImages,
    maxTitleLength: maxTitle,
    maxDescriptionLength: maxDescription,
    supportedImageFormats: ['jpg', 'jpeg', 'png', 'webp'],
  };
}

// Tier B default capabilities (standard API, no webhooks)
function tierBCapabilities(
  maxImages: number,
  maxTitle: number,
  maxDescription: number,
): ConnectorCapabilities {
  return {
    canImport: true,
    canPublish: true,
    canUpdate: true,
    canDelist: true,
    hasWebhooks: false,
    hasStructuredCategories: true,
    canAutoRelist: false,
    canMakeOffers: false,
    canShare: false,
    maxImagesPerListing: maxImages,
    maxTitleLength: maxTitle,
    maxDescriptionLength: maxDescription,
    supportedImageFormats: ['jpg', 'jpeg', 'png'],
  };
}

// Tier C default capabilities (session-based)
function tierCCapabilities(
  maxImages: number,
  maxTitle: number,
  maxDescription: number,
  canShare: boolean,
): ConnectorCapabilities {
  return {
    canImport: true,
    canPublish: true,
    canUpdate: false,
    canDelist: true,
    hasWebhooks: false,
    hasStructuredCategories: false,
    canAutoRelist: false,
    canMakeOffers: false,
    canShare,
    maxImagesPerListing: maxImages,
    maxTitleLength: maxTitle,
    maxDescriptionLength: maxDescription,
    supportedImageFormats: ['jpg', 'jpeg', 'png'],
  };
}

export const CHANNEL_REGISTRY = new Map<ExternalChannel, ChannelMetadata>([
  [
    'EBAY',
    {
      channel: 'EBAY',
      displayName: 'eBay',
      tier: 'A',
      authMethod: 'OAUTH',
      iconSlug: 'ebay',
      color: '#E53238',
      defaultCapabilities: tierACapabilities(24, 80, 4000),
      rateLimit: { callsPerHourPerSeller: 200, burstAllowance: 20 },
      featureFlags: {
        importEnabled: 'crosslister.ebay.importEnabled',
        crosslistEnabled: 'crosslister.ebay.crosslistEnabled',
        automationEnabled: 'crosslister.ebay.automationEnabled',
      },
      enabled: true,
    },
  ],
  [
    'POSHMARK',
    {
      channel: 'POSHMARK',
      displayName: 'Poshmark',
      tier: 'C',
      authMethod: 'SESSION',
      iconSlug: 'poshmark',
      color: '#DE3163',
      defaultCapabilities: tierCCapabilities(16, 80, 1500, true),
      rateLimit: { callsPerHourPerSeller: 60, burstAllowance: 10 },
      featureFlags: {
        importEnabled: 'crosslister.poshmark.importEnabled',
        crosslistEnabled: 'crosslister.poshmark.crosslistEnabled',
        automationEnabled: 'crosslister.poshmark.automationEnabled',
      },
      enabled: true,
    },
  ],
  [
    'MERCARI',
    {
      channel: 'MERCARI',
      displayName: 'Mercari',
      tier: 'B',
      authMethod: 'OAUTH',
      iconSlug: 'mercari',
      color: '#FF4F00',
      defaultCapabilities: tierBCapabilities(12, 80, 1000),
      rateLimit: { callsPerHourPerSeller: 150, burstAllowance: 15 },
      featureFlags: {
        importEnabled: 'crosslister.mercari.importEnabled',
        crosslistEnabled: 'crosslister.mercari.crosslistEnabled',
        automationEnabled: 'crosslister.mercari.automationEnabled',
      },
      enabled: true,
    },
  ],
  [
    'DEPOP',
    {
      channel: 'DEPOP',
      displayName: 'Depop',
      tier: 'B',
      authMethod: 'OAUTH',
      iconSlug: 'depop',
      color: '#FF4040',
      defaultCapabilities: tierBCapabilities(4, 80, 1000),
      rateLimit: { callsPerHourPerSeller: 150, burstAllowance: 15 },
      featureFlags: {
        importEnabled: 'crosslister.depop.importEnabled',
        crosslistEnabled: 'crosslister.depop.crosslistEnabled',
        automationEnabled: 'crosslister.depop.automationEnabled',
      },
      enabled: true,
    },
  ],
  [
    'FB_MARKETPLACE',
    {
      channel: 'FB_MARKETPLACE',
      displayName: 'Facebook Marketplace',
      tier: 'B',
      authMethod: 'OAUTH',
      iconSlug: 'facebook-marketplace',
      color: '#1877F2',
      defaultCapabilities: tierBCapabilities(12, 80, 5000),
      rateLimit: { callsPerHourPerSeller: 100, burstAllowance: 10 },
      featureFlags: {
        importEnabled: 'crosslister.fbMarketplace.importEnabled',
        crosslistEnabled: 'crosslister.fbMarketplace.crosslistEnabled',
        automationEnabled: 'crosslister.fbMarketplace.automationEnabled',
      },
      enabled: true,
    },
  ],
  [
    'ETSY',
    {
      channel: 'ETSY',
      displayName: 'Etsy',
      tier: 'A',
      authMethod: 'OAUTH',
      iconSlug: 'etsy',
      color: '#F1641E',
      defaultCapabilities: tierACapabilities(10, 140, 5000),
      rateLimit: { callsPerHourPerSeller: 200, burstAllowance: 20 },
      featureFlags: {
        importEnabled: 'crosslister.etsy.importEnabled',
        crosslistEnabled: 'crosslister.etsy.crosslistEnabled',
        automationEnabled: 'crosslister.etsy.automationEnabled',
      },
      enabled: true,
    },
  ],
  [
    'GRAILED',
    {
      channel: 'GRAILED',
      displayName: 'Grailed',
      tier: 'B',
      authMethod: 'OAUTH',
      iconSlug: 'grailed',
      color: '#212121',
      defaultCapabilities: tierBCapabilities(12, 80, 1000),
      rateLimit: { callsPerHourPerSeller: 150, burstAllowance: 15 },
      featureFlags: {
        importEnabled: 'crosslister.grailed.importEnabled',
        crosslistEnabled: 'crosslister.grailed.crosslistEnabled',
        automationEnabled: 'crosslister.grailed.automationEnabled',
      },
      enabled: true,
    },
  ],
  [
    'THEREALREAL',
    {
      channel: 'THEREALREAL',
      displayName: 'The RealReal',
      tier: 'C',
      authMethod: 'SESSION',
      iconSlug: 'therealreal',
      color: '#1C1C1C',
      defaultCapabilities: tierCCapabilities(12, 80, 2000, false),
      rateLimit: { callsPerHourPerSeller: 60, burstAllowance: 10 },
      featureFlags: {
        importEnabled: 'crosslister.therealreal.importEnabled',
        crosslistEnabled: 'crosslister.therealreal.crosslistEnabled',
        automationEnabled: 'crosslister.therealreal.automationEnabled',
      },
      enabled: true,
    },
  ],
  [
    'WHATNOT',
    {
      channel: 'WHATNOT',
      displayName: 'Whatnot',
      tier: 'B',
      authMethod: 'OAUTH',
      iconSlug: 'whatnot',
      color: '#1DA1F2',
      defaultCapabilities: tierBCapabilities(12, 80, 2000),
      rateLimit: { callsPerHourPerSeller: 100, burstAllowance: 10 },
      featureFlags: {
        importEnabled: 'crosslister.whatnot.importEnabled',
        crosslistEnabled: 'crosslister.whatnot.crosslistEnabled',
        automationEnabled: 'crosslister.whatnot.automationEnabled',
      },
      enabled: true,
    },
  ],
  [
    'SHOPIFY',
    {
      channel: 'SHOPIFY',
      displayName: 'Shopify',
      tier: 'A',
      authMethod: 'OAUTH',
      iconSlug: 'shopify',
      color: '#96BF48',
      defaultCapabilities: tierACapabilities(10, 255, 5000),
      rateLimit: { callsPerHourPerSeller: 200, burstAllowance: 20 },
      featureFlags: {
        importEnabled: 'crosslister.shopify.importEnabled',
        crosslistEnabled: 'crosslister.shopify.crosslistEnabled',
        automationEnabled: 'crosslister.shopify.automationEnabled',
      },
      enabled: true,
    },
  ],
  [
    'VESTIAIRE',
    {
      channel: 'VESTIAIRE',
      displayName: 'Vestiaire Collective',
      tier: 'C',
      authMethod: 'SESSION',
      iconSlug: 'vestiaire',
      color: '#2D6B4C',
      defaultCapabilities: tierCCapabilities(12, 80, 2000, false),
      rateLimit: { callsPerHourPerSeller: 60, burstAllowance: 10 },
      featureFlags: {
        importEnabled: 'crosslister.vestiaire.importEnabled',
        crosslistEnabled: 'crosslister.vestiaire.crosslistEnabled',
        automationEnabled: 'crosslister.vestiaire.automationEnabled',
      },
      enabled: true,
    },
  ],
]);

/**
 * Get metadata for a specific channel.
 * Throws if the channel is not in the registry.
 */
export function getChannelMetadata(channel: ExternalChannel): ChannelMetadata {
  const metadata = CHANNEL_REGISTRY.get(channel);
  if (!metadata) {
    throw new Error(`Channel not found in registry: ${channel}`);
  }
  return metadata;
}

/**
 * Return all channels that are enabled at launch.
 */
export function getEnabledChannels(): ExternalChannel[] {
  return Array.from(CHANNEL_REGISTRY.values())
    .filter((m) => m.enabled)
    .map((m) => m.channel);
}

/**
 * Return all channels belonging to a specific connector tier.
 */
export function getChannelsByTier(tier: ConnectorTier): ExternalChannel[] {
  return Array.from(CHANNEL_REGISTRY.values())
    .filter((m) => m.tier === tier)
    .map((m) => m.channel);
}

/**
 * Check whether a channel is currently enabled.
 */
export function isChannelEnabled(channel: ExternalChannel): boolean {
  return CHANNEL_REGISTRY.get(channel)?.enabled ?? false;
}
