/**
 * Policy validation service — validates a listing against a target platform's
 * requirements BEFORE publishing.
 * Source: Lister Canonical Section 15.1 (Policy Engine)
 *
 * NOT a 'use server' file. Plain TypeScript module.
 */

import { db } from '@twicely/db';
import { channelPolicyRule } from '@twicely/db/schema';
import { eq, and } from 'drizzle-orm';
import { getChannelMetadata } from '../channel-registry';
import type { ExternalChannel } from '../types';
import type { CanonicalListingData, CanonicalImageData } from '@twicely/crosslister/services/listing-transform';

export type PolicyResult =
  | { status: 'ALLOW' }
  | { status: 'DENY'; reason: string }
  | { status: 'REQUIRE_FIELDS'; fields: string[] }
  | { status: 'REQUIRE_CHANGES'; changes: Array<{ field: string; guidance: string }> };

/** Evaluate a single channelPolicyRule constraint against listing data. */
function evaluateConstraint(
  constraint: Record<string, unknown>,
  listing: CanonicalListingData,
): boolean {
  // Simple field presence check: { "field": "brand", "op": "required" }
  if (constraint['op'] === 'required') {
    const field = constraint['field'] as keyof CanonicalListingData;
    const val = listing[field];
    return val !== null && val !== undefined && val !== '';
  }
  // Min value check: { "field": "priceCents", "op": "min", "value": 100 }
  if (constraint['op'] === 'min') {
    const field = constraint['field'] as keyof CanonicalListingData;
    const val = Number(listing[field]);
    return isFinite(val) && val >= Number(constraint['value']);
  }
  // Unknown constraint: pass
  return true;
}

/**
 * Validate a listing against platform requirements before publishing.
 * Returns ALLOW if all checks pass; DENY if a blocking issue exists;
 * REQUIRE_CHANGES if warnings are found (non-blocking after auto-fix).
 */
export async function validateForChannel(
  listing: CanonicalListingData,
  images: CanonicalImageData[],
  channel: ExternalChannel,
): Promise<PolicyResult> {
  const metadata = getChannelMetadata(channel);
  const caps = metadata.defaultCapabilities;

  // Rule 1: Title required
  if (!listing.title || listing.title.trim() === '') {
    return { status: 'DENY', reason: 'Listing title is required' };
  }

  // Rule 2: At least 1 image required
  if (images.length === 0) {
    return { status: 'DENY', reason: 'At least one image is required' };
  }

  // Rule 3: Price > 0 cents
  if (!listing.priceCents || listing.priceCents <= 0) {
    return { status: 'DENY', reason: 'Price must be greater than zero' };
  }

  // Collect REQUIRE_CHANGES items
  const changes: Array<{ field: string; guidance: string }> = [];

  // Rule 4: Title length
  if (listing.title.length > caps.maxTitleLength) {
    changes.push({
      field: 'title',
      guidance: `Title exceeds ${caps.maxTitleLength} characters for ${metadata.displayName}. It will be truncated automatically.`,
    });
  }

  // Rule 5: Description length
  const descLen = listing.description?.length ?? 0;
  if (descLen > caps.maxDescriptionLength) {
    changes.push({
      field: 'description',
      guidance: `Description exceeds ${caps.maxDescriptionLength} characters for ${metadata.displayName}. It will be truncated automatically.`,
    });
  }

  // Rule 6: Image count warning (transform auto-trims, but warn)
  if (images.length > caps.maxImagesPerListing) {
    changes.push({
      field: 'images',
      guidance: `Only the first ${caps.maxImagesPerListing} images will be published to ${metadata.displayName}.`,
    });
  }

  // Rule 7: Channel policy rules from DB
  const policyRules = await db
    .select()
    .from(channelPolicyRule)
    .where(and(eq(channelPolicyRule.channel, channel), eq(channelPolicyRule.isActive, true)));

  for (const rule of policyRules) {
    const constraint = rule.constraintJson as Record<string, unknown>;
    const passes = evaluateConstraint(constraint, listing);
    if (!passes) {
      if (rule.severity === 'BLOCK') {
        return { status: 'DENY', reason: rule.guidance ?? `Blocked by policy rule: ${rule.field}` };
      }
      // WARN severity -> REQUIRE_CHANGES
      changes.push({
        field: rule.field,
        guidance: rule.guidance ?? `Field ${rule.field} does not meet ${metadata.displayName} requirements.`,
      });
    }
  }

  if (changes.length > 0) {
    return { status: 'REQUIRE_CHANGES', changes };
  }

  return { status: 'ALLOW' };
}
