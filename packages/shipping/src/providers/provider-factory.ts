/**
 * @twicely/shipping - Provider factory + registry
 *
 * Map-based registry. Default provider from platform_settings.
 */

import type { ShippingProviderInterface } from '../provider-interface';
import { getPlatformSetting } from '@twicely/db/queries/platform-settings';
import { ShippoProvider } from './shippo';

const providers = new Map<string, ShippingProviderInterface>();

// Register Shippo as default provider
providers.set('shippo', new ShippoProvider());

export function registerProvider(name: string, provider: ShippingProviderInterface): void {
  providers.set(name, provider);
}

export async function getProvider(name?: string): Promise<ShippingProviderInterface> {
  const providerName = name ?? await getDefaultProviderName();
  const provider = providers.get(providerName);
  if (!provider) {
    throw new Error('Shipping provider "' + providerName + '" not registered');
  }
  return provider;
}

export function getProviderSync(name: string): ShippingProviderInterface {
  const provider = providers.get(name);
  if (!provider) {
    throw new Error('Shipping provider "' + name + '" not registered');
  }
  return provider;
}

async function getDefaultProviderName(): Promise<string> {
  return getPlatformSetting('fulfillment.shipping.defaultProvider', 'shippo');
}
