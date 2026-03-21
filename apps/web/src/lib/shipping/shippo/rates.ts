import { getShippo } from './client';
import type { ShippoRate } from './types';

export interface ShippingAddress {
  name: string;
  street1: string;
  street2?: string;
  city: string;
  state: string;
  zip: string;
  country: string;
}

export interface Parcel {
  lengthIn: number;
  widthIn: number;
  heightIn: number;
  weightOz: number;
}

export interface ShippingRate {
  carrier: string;
  service: string;
  amount: number;
  currency: string;
  estimatedDays: number | null;
  objectId: string;
}

export interface GetShippingRatesResult {
  success: boolean;
  rates?: ShippingRate[];
  error?: string;
}

/**
 * Get shipping rates from Shippo for a package
 * @param fromAddress Origin address
 * @param toAddress Destination address
 * @param parcel Package dimensions and weight
 * @returns Array of shipping rates sorted by price ascending, or error
 */
export async function getShippingRates(
  fromAddress: ShippingAddress,
  toAddress: ShippingAddress,
  parcel: Parcel
): Promise<GetShippingRatesResult> {
  try {
    const shippo = getShippo();

    // Create shipment to get rates
    const shipment = await shippo.shipments.create({
      addressFrom: {
        name: fromAddress.name,
        street1: fromAddress.street1,
        street2: fromAddress.street2 || '',
        city: fromAddress.city,
        state: fromAddress.state,
        zip: fromAddress.zip,
        country: fromAddress.country,
      },
      addressTo: {
        name: toAddress.name,
        street1: toAddress.street1,
        street2: toAddress.street2 || '',
        city: toAddress.city,
        state: toAddress.state,
        zip: toAddress.zip,
        country: toAddress.country,
      },
      parcels: [
        {
          length: parcel.lengthIn.toString(),
          width: parcel.widthIn.toString(),
          height: parcel.heightIn.toString(),
          distanceUnit: 'in',
          weight: parcel.weightOz.toString(),
          massUnit: 'oz',
        },
      ],
      async: false,
    });

    // Extract rates from shipment
    const rates = shipment.rates || [];

    // Map and sort rates by price
    const mappedRates: ShippingRate[] = rates
      .map((rate: ShippoRate) => ({
        carrier: rate.provider || 'Unknown',
        service: rate.servicelevel?.name || rate.servicelevel?.token || 'Unknown',
        amount: parseFloat(rate.amount || '0'),
        currency: rate.currency || 'USD',
        estimatedDays: rate.estimatedDays || null,
        objectId: rate.objectId || '',
      }))
      .filter((rate: ShippingRate) => rate.objectId && rate.amount > 0)
      .sort((a: ShippingRate, b: ShippingRate) => a.amount - b.amount);

    return {
      success: true,
      rates: mappedRates,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Failed to fetch shipping rates';

    return {
      success: false,
      error: errorMessage,
    };
  }
}
