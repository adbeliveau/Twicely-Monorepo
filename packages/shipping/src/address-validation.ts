/**
 * @twicely/shipping — Address Validation
 *
 * Canonical 06 Section 8: Address validation via provider.
 * Validates and suggests corrections for shipping addresses.
 */

import { logger } from '@twicely/logger';
import { getPlatformSetting } from '@twicely/db/queries/platform-settings';
import type { AddressInput, AddressValidationResult } from './types';
import type { ShippingProviderInterface } from './provider-interface';

/**
 * Validate a shipping address using the configured provider.
 * Falls back to basic validation if provider is unavailable.
 */
export async function validateAddress(
  address: AddressInput,
  provider: ShippingProviderInterface,
): Promise<AddressValidationResult> {
  const enabled = await getPlatformSetting<boolean>(
    'shipping.addressValidation.enabled',
    true,
  );

  if (!enabled) {
    return basicValidation(address);
  }

  try {
    return await provider.validateAddress(address);
  } catch (err) {
    logger.warn('shipping.address_validation.provider_error', {
      error: err instanceof Error ? err.message : String(err),
    });
    return basicValidation(address);
  }
}

/**
 * Basic address validation without external provider.
 * Checks required fields are present.
 */
function basicValidation(address: AddressInput): AddressValidationResult {
  const messages: string[] = [];

  if (!address.name?.trim()) messages.push('Name is required');
  if (!address.street1?.trim()) messages.push('Street address is required');
  if (!address.city?.trim()) messages.push('City is required');
  if (!address.state?.trim()) messages.push('State is required');
  if (!address.zip?.trim()) messages.push('ZIP code is required');
  if (!address.country?.trim()) messages.push('Country is required');

  // Basic US ZIP validation
  if (address.country === 'US' && address.zip) {
    const zipRegex = /^\d{5}(-\d{4})?$/;
    if (!zipRegex.test(address.zip)) {
      messages.push('Invalid US ZIP code format');
    }
  }

  return {
    isValid: messages.length === 0,
    messages,
  };
}

/**
 * Normalize an address by trimming whitespace and standardizing format.
 */
export function normalizeAddress(address: AddressInput): AddressInput {
  return {
    name: address.name.trim(),
    street1: address.street1.trim(),
    street2: address.street2?.trim(),
    city: address.city.trim(),
    state: address.state.trim().toUpperCase(),
    zip: address.zip.trim(),
    country: address.country.trim().toUpperCase(),
    phone: address.phone?.trim(),
    email: address.email?.trim().toLowerCase(),
  };
}
