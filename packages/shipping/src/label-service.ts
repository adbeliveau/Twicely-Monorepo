/**
 * @twicely/shipping - Label purchase/void/refund lifecycle
 *
 * All costs in integer cents. Every cost creates a ledger entry.
 * Idempotency via idempotencyKey on label + ledger.
 */

import { db } from '@twicely/db';
import { shippingLabel, shipment, order } from '@twicely/db/schema';
import { ledgerEntry } from '@twicely/db/schema';
import { getPlatformSetting } from '@twicely/db/queries/platform-settings';
import { eq } from 'drizzle-orm';
import { logger } from '@twicely/logger';
import { createId } from '@paralleldrive/cuid2';
import { getProvider } from './providers/provider-factory';
import { isValidLabelTransition } from './state-machine';
import type { LabelRequest, LabelResponse, PurchasedLabel, VoidLabelInput, VoidResult } from './types';

/**
 * Purchase a shipping label.
 *
 * 1. Check kill switch
 * 2. Auto-add signature/insurance if above thresholds
 * 3. Call provider purchaseLabel
 * 4. In transaction: insert label, post ledger entries, update shipment + order
 */
export async function purchaseLabel(input: LabelRequest): Promise<LabelResponse> {
  // 1. Kill switch
  const enabled = await getPlatformSetting('fulfillment.shipping.labelGenerationEnabled', true);
  if (!enabled) {
    return { success: false, error: 'Label generation is disabled' };
  }

  // 2. Auto-signature threshold
  const sigThreshold = await getPlatformSetting('fulfillment.shipping.signatureRequiredAboveCents', 75000);
  let signatureType = input.signatureType;
  if (!signatureType && input.insuredValueCents && input.insuredValueCents > sigThreshold) {
    signatureType = 'STANDARD';
  }

  // 3. Auto-insurance threshold
  const insureThreshold = await getPlatformSetting('fulfillment.shipping.autoInsureAboveCents', 0);
  let includeInsurance = input.includeInsurance ?? false;
  const insuredValueCents = input.insuredValueCents ?? 0;
  if (insureThreshold > 0 && insuredValueCents > insureThreshold) {
    includeInsurance = true;
  }

  // 4. Label format
  const labelFormat = input.labelFormat ?? await getPlatformSetting('fulfillment.shipping.labelFormat', 'PDF');

  // 5. Call provider
  const provider = await getProvider();
  let labelResult;
  try {
    labelResult = await provider.purchaseLabel(input.providerRateId, {
      includeInsurance,
      insuredValueCents,
      signatureType,
      labelFormat,
    });
  } catch (err) {
    logger.error('[label-service] Provider purchaseLabel failed', { error: String(err) });
    return { success: false, error: 'Failed to purchase label from provider' };
  }

  // 6. Calculate markup/discount
  const commissionPercent = await getPlatformSetting('fulfillment.shipping.platformCommissionPercent', 0);
  const discountPercent = await getPlatformSetting('fulfillment.shipping.labelDiscountPercent', 0);
  const platformMarkupCents = commissionPercent > 0
    ? Math.round(labelResult.totalCostCents * (commissionPercent / 100))
    : 0;
  const platformDiscountCents = discountPercent > 0
    ? Math.round(labelResult.totalCostCents * (discountPercent / 100))
    : 0;
  const sellerPaidCents = labelResult.totalCostCents + platformMarkupCents - platformDiscountCents;

  const labelId = createId();
  const idempotencyKey = 'shipping_label:' + labelId;
  const savingsCents = labelResult.retailRateCents
    ? labelResult.retailRateCents - labelResult.totalCostCents
    : null;

  // 7. Atomic transaction
  try {
    await db.transaction(async (tx) => {
      // a. Insert shippingLabel
      await tx.insert(shippingLabel).values({
        id: labelId,
        orderId: input.orderId,
        shipmentId: input.shipmentId,
        sellerId: input.sellerId,
        provider: 'shippo',
        providerLabelId: labelResult.providerLabelId,
        providerRateId: labelResult.providerRateId,
        providerShipmentId: labelResult.providerShipmentId ?? null,
        status: 'PURCHASED',
        carrier: labelResult.carrier,
        carrierAccountId: labelResult.carrierAccountId ?? null,
        service: labelResult.service,
        trackingNumber: labelResult.trackingNumber,
        labelUrl: labelResult.labelUrl,
        labelFormat: labelResult.labelFormat,
        rateCents: labelResult.rateCents,
        surchargesCents: labelResult.surchargesCents,
        insuranceCostCents: labelResult.insuranceCostCents,
        totalCostCents: labelResult.totalCostCents,
        platformMarkupCents,
        platformDiscountCents,
        sellerPaidCents,
        currency: 'USD',
        retailRateCents: labelResult.retailRateCents ?? null,
        savingsCents,
        idempotencyKey,
        fromAddressJson: input.fromAddress,
        toAddressJson: input.toAddress,
        weightOz: input.parcel.weightOz,
        lengthIn: input.parcel.lengthIn,
        widthIn: input.parcel.widthIn,
        heightIn: input.parcel.heightIn,
        packageType: input.parcel.packageType ?? 'CUSTOM',
        isInsured: includeInsurance,
        insuredValueCents: includeInsurance ? insuredValueCents : null,
        signatureRequired: !!signatureType,
        signatureType: signatureType ?? null,
        isReturnLabel: false,
      });

      // b. Post SHIPPING_LABEL_PURCHASE ledger entry
      const purchaseLedgerId = createId();
      await tx.insert(ledgerEntry).values({
        id: purchaseLedgerId,
        type: 'SHIPPING_LABEL_PURCHASE',
        status: 'POSTED',
        amountCents: -sellerPaidCents,
        currency: 'USD',
        userId: input.sellerId,
        orderId: input.orderId,
        idempotencyKey,
      });

      // Update label with ledger ID
      await tx.update(shippingLabel)
        .set({ ledgerEntryId: purchaseLedgerId })
        .where(eq(shippingLabel.id, labelId));

      // c. Platform commission ledger entry (if applicable)
      if (platformMarkupCents > 0) {
        await tx.insert(ledgerEntry).values({
          id: createId(),
          type: 'SHIPPING_LABEL_PURCHASE',
          status: 'POSTED',
          amountCents: platformMarkupCents,
          currency: 'USD',
          userId: null,
          orderId: input.orderId,
          idempotencyKey: 'shipping_label_commission:' + labelId,
        });
      }

      // d. Update shipment
      await tx.update(shipment)
        .set({
          labelUrl: labelResult.labelUrl,
          tracking: labelResult.trackingNumber,
          carrier: labelResult.carrier,
          service: labelResult.service,
          shippingLabelId: labelId,
          status: 'LABEL_CREATED',
          updatedAt: new Date(),
        })
        .where(eq(shipment.id, input.shipmentId));

      // e. Update order
      await tx.update(order)
        .set({
          trackingNumber: labelResult.trackingNumber,
          carrierCode: labelResult.carrierCode,
          updatedAt: new Date(),
        })
        .where(eq(order.id, input.orderId));
    });
  } catch (err) {
    logger.error('[label-service] Transaction failed', { error: String(err), labelId });
    return { success: false, error: 'Failed to save label' };
  }

  const purchasedLabel: PurchasedLabel = {
    id: labelId,
    trackingNumber: labelResult.trackingNumber,
    labelUrl: labelResult.labelUrl,
    carrier: labelResult.carrier,
    service: labelResult.service,
    sellerPaidCents,
    totalCostCents: labelResult.totalCostCents,
    labelFormat: labelResult.labelFormat,
  };

  logger.info('[label-service] Label purchased', { labelId, orderId: input.orderId, sellerPaidCents });
  return { success: true, label: purchasedLabel };
}

/**
 * Void a shipping label.
 *
 * 1. Verify label exists, belongs to seller, status is PURCHASED/PRINTED
 * 2. Verify shipment status is LABEL_CREATED
 * 3. Call provider void
 * 4. Update label status to VOID_PENDING -> VOIDED -> REFUNDED
 * 5. Post refund ledger entry
 * 6. Reset shipment
 */
export async function voidLabel(input: VoidLabelInput): Promise<VoidResult> {
  // 1. Find label
  const [label] = await db
    .select()
    .from(shippingLabel)
    .where(eq(shippingLabel.id, input.labelId))
    .limit(1);

  if (!label) {
    return { success: false, error: 'Label not found' };
  }

  if (label.sellerId !== input.sellerId) {
    return { success: false, error: 'Label does not belong to seller' };
  }

  if (label.status !== 'PURCHASED' && label.status !== 'PRINTED') {
    return { success: false, error: 'Label cannot be voided in status: ' + label.status };
  }

  // 2. Check shipment status
  if (label.shipmentId) {
    const [shp] = await db
      .select({ status: shipment.status })
      .from(shipment)
      .where(eq(shipment.id, label.shipmentId))
      .limit(1);

    if (shp && shp.status !== 'LABEL_CREATED') {
      return { success: false, error: 'Cannot void: shipment already in transit' };
    }
  }

  // 3. Validate label transition
  if (!isValidLabelTransition(label.status, 'VOID_PENDING')) {
    return { success: false, error: 'Invalid label status transition' };
  }

  // 4. Call provider void
  const provider = await getProvider(label.provider);
  const voidResult = await provider.voidLabel(label.providerLabelId);

  if (!voidResult.success) {
    return { success: false, error: voidResult.error ?? 'Provider void failed' };
  }

  // 5. Update in transaction
  try {
    await db.transaction(async (tx) => {
      const now = new Date();

      // Update label: VOID_PENDING -> VOIDED -> REFUNDED
      await tx.update(shippingLabel)
        .set({
          status: 'REFUNDED',
          voidedAt: now,
          refundedAt: now,
          updatedAt: now,
        })
        .where(eq(shippingLabel.id, label.id));

      // Post SHIPPING_LABEL_REFUND ledger entry
      const refundLedgerId = createId();
      await tx.insert(ledgerEntry).values({
        id: refundLedgerId,
        type: 'SHIPPING_LABEL_REFUND',
        status: 'POSTED',
        amountCents: label.sellerPaidCents,
        currency: 'USD',
        userId: label.sellerId,
        orderId: label.orderId,
        idempotencyKey: 'shipping_label_refund:' + label.id,
      });

      // Update label with refund ledger ID
      await tx.update(shippingLabel)
        .set({ refundLedgerEntryId: refundLedgerId })
        .where(eq(shippingLabel.id, label.id));

      // Reset shipment if linked
      if (label.shipmentId) {
        await tx.update(shipment)
          .set({
            labelUrl: null,
            tracking: null,
            carrier: null,
            service: null,
            shippingLabelId: null,
            status: 'PENDING',
            updatedAt: now,
          })
          .where(eq(shipment.id, label.shipmentId));
      }
    });
  } catch (err) {
    logger.error('[label-service] Void transaction failed', { error: String(err), labelId: label.id });
    return { success: false, error: 'Failed to process void' };
  }

  logger.info('[label-service] Label voided and refunded', { labelId: label.id, refundCents: label.sellerPaidCents });
  return { success: true };
}

/**
 * Process a refund after label void confirmation.
 * Called when provider confirms void (webhook or polling).
 */
export async function refundLabel(labelId: string): Promise<VoidResult> {
  const [label] = await db
    .select()
    .from(shippingLabel)
    .where(eq(shippingLabel.id, labelId))
    .limit(1);

  if (!label) {
    return { success: false, error: 'Label not found' };
  }

  if (label.status !== 'VOIDED') {
    return { success: false, error: 'Label must be VOIDED to refund, current: ' + label.status };
  }

  if (!isValidLabelTransition('VOIDED', 'REFUNDED')) {
    return { success: false, error: 'Invalid label status transition' };
  }

  await db.transaction(async (tx) => {
    const refundLedgerId = createId();

    await tx.insert(ledgerEntry).values({
      id: refundLedgerId,
      type: 'SHIPPING_LABEL_REFUND',
      status: 'POSTED',
      amountCents: label.sellerPaidCents,
      currency: 'USD',
      userId: label.sellerId,
      orderId: label.orderId,
      idempotencyKey: 'shipping_label_refund:' + label.id,
    });

    await tx.update(shippingLabel)
      .set({
        status: 'REFUNDED',
        refundedAt: new Date(),
        refundLedgerEntryId: refundLedgerId,
        updatedAt: new Date(),
      })
      .where(eq(shippingLabel.id, label.id));
  });

  return { success: true };
}
