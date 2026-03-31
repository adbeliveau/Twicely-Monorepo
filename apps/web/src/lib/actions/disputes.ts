'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { zodId } from '@/lib/validations/shared';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import {
  assignDispute,
  resolveDispute,
  getOpenDisputes,
  getAssignedDisputes,
  getDisputeById,
  type DisputeResolution,
} from '@twicely/commerce/disputes';
import { processProtectionClaim } from '@twicely/commerce/buyer-protection';

// ─── Zod Schemas ────────────────────────────────────────────────────────────

const assignDisputeSchema = z.object({
  disputeId: zodId,
}).strict();

const resolveDisputeSchema = z.object({
  disputeId: zodId,
  resolution: z.enum(['RESOLVED_BUYER', 'RESOLVED_SELLER', 'RESOLVED_PARTIAL']),
  resolutionNote: z.string().min(1),
  resolutionAmountCents: z.number().int().positive().optional(),
}).strict();

const processClaimSchema = z.object({
  claimId: zodId,
  approved: z.boolean(),
  resolutionNote: z.string().min(1),
  refundAmountCents: z.number().int().positive().optional(),
}).strict();

const getDisputeSchema = z.object({
  disputeId: zodId,
}).strict();

interface ActionResult {
  success: boolean;
  error?: string;
}

/**
 * Admin assigns themselves to a dispute.
 */
export async function assignDisputeAction(disputeId: string): Promise<ActionResult> {
  const { session, ability } = await staffAuthorize();
  if (!ability.can('manage', 'Dispute')) return { success: false, error: 'Not authorized' };

  const parsed = assignDisputeSchema.safeParse({ disputeId });
  if (!parsed.success) return { success: false, error: 'Invalid input' };

  const result = await assignDispute(session.staffUserId, parsed.data.disputeId);
  if (result.success) {
    revalidatePath('/mod/cases');
  }

  return result;
}

/**
 * Admin resolves a dispute.
 */
export async function resolveDisputeAction(
  disputeId: string,
  resolution: DisputeResolution,
  resolutionNote: string,
  resolutionAmountCents?: number
): Promise<ActionResult> {
  const { session, ability } = await staffAuthorize();
  if (!ability.can('manage', 'Dispute')) return { success: false, error: 'Not authorized' };

  const parsed = resolveDisputeSchema.safeParse({ disputeId, resolution, resolutionNote, resolutionAmountCents });
  if (!parsed.success) return { success: false, error: 'Invalid input' };

  const result = await resolveDispute({
    adminId: session.staffUserId,
    disputeId: parsed.data.disputeId,
    resolution: parsed.data.resolution,
    resolutionNote: parsed.data.resolutionNote,
    resolutionAmountCents: parsed.data.resolutionAmountCents,
  });

  if (result.success) {
    revalidatePath('/mod/cases');
  }

  return result;
}

/**
 * Admin processes a protection claim (approve or deny).
 */
export async function processProtectionClaimAction(
  claimId: string,
  approved: boolean,
  resolutionNote: string,
  refundAmountCents?: number
): Promise<ActionResult> {
  const { session, ability } = await staffAuthorize();
  if (!ability.can('manage', 'Dispute')) return { success: false, error: 'Not authorized' };

  const parsed = processClaimSchema.safeParse({ claimId, approved, resolutionNote, refundAmountCents });
  if (!parsed.success) return { success: false, error: 'Invalid input' };

  const result = await processProtectionClaim({
    adminId: session.staffUserId,
    claimId: parsed.data.claimId,
    approved: parsed.data.approved,
    resolutionNote: parsed.data.resolutionNote,
    refundAmountCents: parsed.data.refundAmountCents,
  });

  if (result.success) {
    revalidatePath('/mod/cases');
  }

  return result;
}

/**
 * Get all open disputes (for admin dashboard).
 */
export async function getOpenDisputesAction() {
  const { ability } = await staffAuthorize();
  if (!ability.can('manage', 'Dispute')) return [];

  return getOpenDisputes();
}

/**
 * Get disputes assigned to the current admin.
 */
export async function getAssignedDisputesAction() {
  const { session, ability } = await staffAuthorize();
  if (!ability.can('manage', 'Dispute')) return [];

  return getAssignedDisputes(session.staffUserId);
}

/**
 * Get a specific dispute by ID.
 */
export async function getDisputeByIdAction(disputeId: string) {
  const { ability } = await staffAuthorize();
  if (!ability.can('manage', 'Dispute')) return null;

  const parsed = getDisputeSchema.safeParse({ disputeId });
  if (!parsed.success) return null;

  return getDisputeById(parsed.data.disputeId);
}
