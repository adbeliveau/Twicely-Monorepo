/**
 * Runtime registry for platform connector implementations.
 *
 * Connectors self-register via registerConnector() when their module is loaded.
 * This allows connectors to be added incrementally in Phase F without modifying
 * framework code. The registry is an in-memory Map; no database involvement.
 *
 * Usage (in each connector module):
 *   registerConnector(new EbayConnector());
 *
 * Source: Lister Canonical Section 9.2, Architecture Rule §3.3
 */

import type { PlatformConnector } from './connector-interface';
import type { ExternalChannel } from './types';

// Map of channel -> connector instance
const connectors = new Map<ExternalChannel, PlatformConnector>();

/**
 * Register a concrete connector implementation.
 * If a connector for the same channel already exists, it is replaced.
 */
export function registerConnector(connector: PlatformConnector): void {
  connectors.set(connector.channel, connector);
}

/**
 * Retrieve a registered connector by channel.
 * Throws if the channel has no registered connector.
 */
export function getConnector(channel: ExternalChannel): PlatformConnector {
  const connector = connectors.get(channel);
  if (!connector) {
    throw new Error(`No connector registered for channel: ${channel}`);
  }
  return connector;
}

/**
 * Check whether a connector is registered for the given channel.
 */
export function hasConnector(channel: ExternalChannel): boolean {
  return connectors.has(channel);
}

/**
 * Return the list of channels that have registered connectors.
 */
export function getRegisteredChannels(): ExternalChannel[] {
  return Array.from(connectors.keys());
}
