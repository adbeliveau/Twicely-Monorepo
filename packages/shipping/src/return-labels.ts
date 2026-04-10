/**
 * @twicely/shipping — Return Labels
 *
 * Canonical 06 Section 9: Return label generation for approved returns.
 * Cost allocated by fault (buyer error, seller error, platform error).
 */

import { db } from '@twicely/db';
import { shippingLabel } from '@twicely/db/schema';
import { createId } from '@paralleldrive/cuid2';
import { logger } from '@twicely/logger';
import { getPlatformSetting } from '@twicely/db/queries/platform-settings';
import type {
  ReturnLabelInput,
  ReturnShippingPayer,
  LabelResult,
  PurchasedLabel,
} from './types';
import type { ShippingProviderInterface } from './provider-interface';

/**
 * Determine who pays for return shipping based on return reason and platform policy.
 */
export async function determineReturnShippingPayer(
  returnReason: string,
  sellerFault: boolean,
): Promise<ReturnShippingPayer> {
  const sellerFaultReasons = await getPlatformSetting<string[]>(
    'shipping.returns.sellerFaultReasons',
    ['wrong_item', 'defective', 'not_as_described', 'missing_parts'],
  );

  if (sellerFault || sellerFaultReasons.includes(returnReason)) {
    return 'SELLER';
  }

  const platformPaysReturns = await getPlatformSetting<boolean>(
    'shipping.returns.platformPaysForBuyerRemorse',
    false,
  );

  return platformPaysReturns ? 'PLATFORM' : 'BUYER';
}

/**
 * Generate a return label using the shipping provider.
 * Addresses are swapped (buyer sends to seller).
 * Cost is allocated to the responsible party via ledger entry.
 */
export async function generateReturnLabel(
  input: ReturnLabelInput,
  provider: ShippingProviderInterface,
): Promise<{
  success: boolean;
  label?: PurchasedLabel;
  error?: string;
}> {
  const maxReturnValueCents = await getPlatformSetting<number>(
    'shipping.returns.maxLabelValueCents',
    5000,
  );

  try {
    // Get rates for the return shipment
    const rates = await provider.getRates({
      fromAddress: input.fromAddress,
      toAddress: input.toAddress,
      parcel: input.parcel,
    });

    if (rates.length === 0) {
      return { success: false, error: 'No rates available for return shipment' };
    }

    // Pick cheapest rate for returns
    const cheapestRate = rates.reduce((min, rate) =>
      rate.totalCents < min.totalCents ? rate : min,
    );

    if (cheapestRate.totalCents > maxReturnValueCents) {
      logger.warn('shipping.return_label.exceeds_max', {
        rateCents: cheapestRate.totalCents,
        maxCents: maxReturnValueCents,
      });
      return { success: false, error: 'Return shipping cost exceeds maximum allowed' };
    }

    // Purchase the label
    const labelResult: LabelResult = await provider.purchaseLabel(
      cheapestRate.providerRateId,
      {
        includeInsurance: false,
        insuredValueCents: 0,
        labelFormat: 'PDF',
      },
    );

    const labelId = createId();

    // Store in DB
    await db.insert(shippingLabel).values({
      id: labelId,
      orderId: input.orderId,
      sellerId: input.sellerId,
      provider: provider.name,
      providerLabelId: labelResult.providerLabelId,
      providerRateId: labelResult.providerRateId,
      providerShipmentId: labelResult.providerShipmentId ?? null,
      carrier: labelResult.carrier,
      service: labelResult.service,
      trackingNumber: labelResult.trackingNumber,
      labelUrl: labelResult.labelUrl,
      labelFormat: labelResult.labelFormat,
      rateCents: labelResult.rateCents,
      surchargesCents: labelResult.surchargesCents,
      insuranceCostCents: 0,
      totalCostCents: labelResult.totalCostCents,
      platformMarkupCents: 0,
      platformDiscountCents: 0,
      sellerPaidCents: input.paidBy === 'SELLER' ? labelResult.totalCostCents : 0,
      fromAddressJson: input.fromAddress,
      toAddressJson: input.toAddress,
      isReturnLabel: true,
      returnRequestId: input.returnRequestId,
      returnShippingPayer: input.paidBy,
      idempotencyKey: `return-${input.returnRequestId}`,
    });

    logger.info('shipping.return_label.created', {
      labelId,
      returnRequestId: input.returnRequestId,
      paidBy: input.paidBy,
      totalCostCents: labelResult.totalCostCents,
    });

    return {
      success: true,
      label: {
        id: labelId,
        trackingNumber: labelResult.trackingNumber,
        labelUrl: labelResult.labelUrl,
        carrier: labelResult.carrier,
        service: labelResult.service,
        sellerPaidCents: input.paidBy === 'SELLER' ? labelResult.totalCostCents : 0,
        totalCostCents: labelResult.totalCostCents,
        labelFormat: labelResult.labelFormat,
      },
    };
  } catch (err) {
    logger.error('shipping.return_label.failed', {
      returnRequestId: input.returnRequestId,
      error: err instanceof Error ? err.message : String(err),
    });
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Return label generation failed',
    };
  }
}
