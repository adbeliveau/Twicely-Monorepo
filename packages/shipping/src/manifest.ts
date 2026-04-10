/**
 * @twicely/shipping — Manifest Service
 *
 * Canonical 06 Section 10: End-of-day manifest batching.
 * High-volume sellers can batch labels into a carrier manifest
 * for pickup. One manifest per carrier per ship date.
 */

import { db } from '@twicely/db';
import { shippingManifest, shippingLabel } from '@twicely/db/schema';
import { eq, and } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import { logger } from '@twicely/logger';
import { getPlatformSetting } from '@twicely/db/queries/platform-settings';
import type {
  ManifestInput,
  ManifestResult,
  ManifestData,
} from './types';
import type { ShippingProviderInterface } from './provider-interface';

/**
 * Create an end-of-day manifest for a seller's labels.
 * Groups purchased, non-voided labels for the given carrier and ship date.
 */
export async function createManifest(
  input: ManifestInput,
  provider: ShippingProviderInterface,
): Promise<{
  success: boolean;
  manifest?: ManifestData;
  error?: string;
}> {
  const minLabelsForManifest = await getPlatformSetting<number>(
    'shipping.manifest.minLabels',
    1,
  );

  // Find all purchased labels for this seller + carrier + date
  const labels = await db
    .select({
      id: shippingLabel.id,
      providerLabelId: shippingLabel.providerLabelId,
    })
    .from(shippingLabel)
    .where(
      and(
        eq(shippingLabel.sellerId, input.sellerId),
        eq(shippingLabel.carrier, input.carrier),
        eq(shippingLabel.status, 'PURCHASED'),
      ),
    );

  if (labels.length < minLabelsForManifest) {
    return {
      success: false,
      error: `Need at least ${minLabelsForManifest} labels for a manifest (found ${labels.length})`,
    };
  }

  try {
    const providerLabelIds = labels.map((l) => l.providerLabelId);
    const result: ManifestResult = await provider.createManifest(
      input.carrier,
      providerLabelIds,
      input.shipDate,
    );

    const manifestId = createId();

    await db.insert(shippingManifest).values({
      id: manifestId,
      sellerId: input.sellerId,
      carrier: input.carrier,
      providerManifestId: result.providerManifestId,
      manifestUrl: result.manifestUrl ?? null,
      labelCount: result.labelCount,
      shipDate: input.shipDate,
      status: 'CREATED',
    });

    // Mark labels as manifested
    for (const label of labels) {
      await db
        .update(shippingLabel)
        .set({ status: 'USED', updatedAt: new Date() })
        .where(eq(shippingLabel.id, label.id));
    }

    logger.info('shipping.manifest.created', {
      manifestId,
      sellerId: input.sellerId,
      carrier: input.carrier,
      labelCount: result.labelCount,
    });

    return {
      success: true,
      manifest: {
        id: manifestId,
        carrier: input.carrier,
        labelCount: result.labelCount,
        manifestUrl: result.manifestUrl,
        status: 'CREATED',
      },
    };
  } catch (err) {
    logger.error('shipping.manifest.failed', {
      sellerId: input.sellerId,
      carrier: input.carrier,
      error: err instanceof Error ? err.message : String(err),
    });
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Manifest creation failed',
    };
  }
}

/**
 * Get manifests for a seller, ordered by ship date descending.
 */
export async function getSellerManifests(
  sellerId: string,
  limit = 20,
): Promise<ManifestData[]> {
  const rows = await db
    .select({
      id: shippingManifest.id,
      carrier: shippingManifest.carrier,
      labelCount: shippingManifest.labelCount,
      manifestUrl: shippingManifest.manifestUrl,
      status: shippingManifest.status,
    })
    .from(shippingManifest)
    .where(eq(shippingManifest.sellerId, sellerId))
    .limit(limit);

  return rows.map((r) => ({
    id: r.id,
    carrier: r.carrier,
    labelCount: r.labelCount,
    manifestUrl: r.manifestUrl ?? undefined,
    status: r.status,
  }));
}
