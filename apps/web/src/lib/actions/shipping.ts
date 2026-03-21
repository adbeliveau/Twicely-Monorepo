'use server';

import { authorize, sub } from '@twicely/casl';
import { getOrderDetail } from '@/lib/queries/orders';
import { getUserAddresses } from '@/lib/queries/address';
import { getShippingRates, type ShippingRate } from '@/lib/shipping/shippo/rates';
import { purchaseLabel } from '@/lib/shipping/shippo/labels';
import { markOrderShipped, type Carrier } from '@twicely/commerce/shipping';
import { db } from '@twicely/db';
import { shipment } from '@twicely/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

const fetchRatesSchema = z.object({
  orderId: z.string().cuid2(),
}).strict();

const purchaseLabelSchema = z.object({
  orderId: z.string().cuid2(),
  rateObjectId: z.string().min(1),
}).strict();

export interface FetchShippingRatesResult {
  success: boolean;
  rates?: ShippingRate[];
  error?: string;
}

export interface PurchaseShippingLabelResult {
  success: boolean;
  redirectUrl?: string;
  error?: string;
}

/**
 * Fetch shipping rates for an order
 * @param orderId The order ID
 * @returns Array of shipping rates sorted by price
 */
export async function fetchShippingRates(
  orderId: string
): Promise<FetchShippingRatesResult> {
  const parsedInput = fetchRatesSchema.safeParse({ orderId });
  if (!parsedInput.success) {
    return { success: false, error: parsedInput.error.issues[0]?.message ?? 'Invalid input' };
  }

  try {
    const { ability, session } = await authorize();
    if (!session) return { success: false, error: 'Unauthorized' };
    const userId = session.delegationId ? session.onBehalfOfSellerId! : session.userId;
    if (!ability.can('read', sub('Shipment', { sellerId: userId }))) {
      return { success: false, error: 'Forbidden' };
    }

    // Get order detail and verify seller ownership
    const orderData = await getOrderDetail(orderId, userId);

    if (!orderData) {
      return { success: false, error: 'Order not found' };
    }

    // Verify user is the seller
    if (orderData.order.sellerId !== userId) {
      return { success: false, error: 'Unauthorized' };
    }

    // Verify order is PAID
    if (orderData.order.status !== 'PAID') {
      return { success: false, error: 'Order must be in PAID status to fetch shipping rates' };
    }

    // Get seller's default address
    const addresses = await getUserAddresses(userId);
    const defaultAddress = addresses.find((a) => a.isDefault) ?? addresses[0];

    if (!defaultAddress) {
      return {
        success: false,
        error: 'No shipping address found. Please add an address in your settings.'
      };
    }

    // Parse order shipping address
    const toAddress = orderData.order.shippingAddressJson as {
      name: string;
      address1: string;
      address2?: string;
      city: string;
      state: string;
      zip: string;
      country: string;
    };

    // Use hardcoded default package dimensions (10x8x4 in, 16oz)
    // Phase D will add dimension input fields
    const parcel = {
      lengthIn: 10,
      widthIn: 8,
      heightIn: 4,
      weightOz: 16,
    };

    // Fetch rates from Shippo
    const result = await getShippingRates(
      {
        name: defaultAddress.name,
        street1: defaultAddress.address1,
        street2: defaultAddress.address2 || undefined,
        city: defaultAddress.city,
        state: defaultAddress.state,
        zip: defaultAddress.zip,
        country: defaultAddress.country,
      },
      {
        name: toAddress.name,
        street1: toAddress.address1,
        street2: toAddress.address2,
        city: toAddress.city,
        state: toAddress.state,
        zip: toAddress.zip,
        country: toAddress.country,
      },
      parcel
    );

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch shipping rates';
    return { success: false, error: errorMessage };
  }
}

/**
 * Purchase a shipping label for an order
 * @param orderId The order ID
 * @param rateObjectId The Shippo rate object ID
 * @returns Success status and redirect URL
 */
export async function purchaseShippingLabel(
  orderId: string,
  rateObjectId: string
): Promise<PurchaseShippingLabelResult> {
  const parsedInput = purchaseLabelSchema.safeParse({ orderId, rateObjectId });
  if (!parsedInput.success) {
    return { success: false, error: parsedInput.error.issues[0]?.message ?? 'Invalid input' };
  }

  try {
    const { ability, session } = await authorize();
    if (!session) return { success: false, error: 'Unauthorized' };
    const userId = session.delegationId ? session.onBehalfOfSellerId! : session.userId;
    if (!ability.can('create', sub('Shipment', { sellerId: userId }))) {
      return { success: false, error: 'Forbidden' };
    }

    // Get order detail and verify seller ownership
    const orderData = await getOrderDetail(orderId, userId);

    if (!orderData) {
      return { success: false, error: 'Order not found' };
    }

    // Verify user is the seller
    if (orderData.order.sellerId !== userId) {
      return { success: false, error: 'Unauthorized' };
    }

    // Verify order is PAID
    if (orderData.order.status !== 'PAID') {
      return { success: false, error: 'Order must be in PAID status to purchase a label' };
    }

    // Purchase the label from Shippo
    const labelResult = await purchaseLabel(rateObjectId);

    if (!labelResult.success || !labelResult.label) {
      return { success: false, error: labelResult.error || 'Failed to purchase label' };
    }

    const { trackingNumber, labelUrl, carrier } = labelResult.label;

    // Map Shippo carrier to our Carrier type
    const carrierUpper = carrier.toUpperCase();
    let normalizedCarrier: Carrier = 'OTHER';

    if (carrierUpper.includes('USPS')) {
      normalizedCarrier = 'USPS';
    } else if (carrierUpper.includes('UPS')) {
      normalizedCarrier = 'UPS';
    } else if (carrierUpper.includes('FEDEX')) {
      normalizedCarrier = 'FEDEX';
    }

    // Mark order as shipped (this creates the shipment record)
    const shipResult = await markOrderShipped(
      orderId,
      userId,
      normalizedCarrier,
      trackingNumber
    );

    if (!shipResult.success) {
      return { success: false, error: shipResult.error || 'Failed to mark order as shipped' };
    }

    // Update the shipment record with the label URL
    await db
      .update(shipment)
      .set({ labelUrl })
      .where(eq(shipment.orderId, orderId));

    return {
      success: true,
      redirectUrl: `/my/selling/orders/${orderId}`,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to purchase shipping label';
    return { success: false, error: errorMessage };
  }
}
