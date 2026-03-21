import { getShippo } from './client';
import type { ShippoTransactionRate } from './types';

export interface PurchasedLabel {
  trackingNumber: string;
  labelUrl: string;
  carrier: string;
  service: string;
  costCents: number;
}

export interface PurchaseLabelResult {
  success: boolean;
  label?: PurchasedLabel;
  error?: string;
}

/**
 * Purchase a shipping label using a rate's objectId from Shippo
 * @param rateObjectId The rate object ID from Shippo
 * @returns Purchased label details or error
 */
export async function purchaseLabel(
  rateObjectId: string
): Promise<PurchaseLabelResult> {
  try {
    const shippo = getShippo();

    // Purchase the label (create transaction)
    const transaction = await shippo.transactions.create({
      rate: rateObjectId,
      labelFileType: 'PDF',
      async: false,
    });

    // Check transaction status
    if (transaction.status !== 'SUCCESS') {
      return {
        success: false,
        error: `Label purchase failed: ${transaction.status}`,
      };
    }

    // Extract label details
    const trackingNumber = transaction.trackingNumber || '';
    const labelUrl = transaction.labelUrl || '';

    // Handle rate (can be string or object)
    const rate = transaction.rate as ShippoTransactionRate | string;
    const carrier = typeof rate === 'object' && rate?.provider ? rate.provider : 'Unknown';
    const service = typeof rate === 'object' && rate?.servicelevel?.name ? rate.servicelevel.name : 'Unknown';
    const costCents = typeof rate === 'object' && rate?.amount
      ? Math.round(parseFloat(rate.amount) * 100)
      : 0;

    if (!trackingNumber || !labelUrl) {
      return {
        success: false,
        error: 'Label purchase succeeded but missing tracking number or label URL',
      };
    }

    return {
      success: true,
      label: {
        trackingNumber,
        labelUrl,
        carrier,
        service,
        costCents,
      },
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Failed to purchase shipping label';

    return {
      success: false,
      error: errorMessage,
    };
  }
}
