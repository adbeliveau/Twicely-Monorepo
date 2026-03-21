'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { eq, and, inArray } from 'drizzle-orm';
import { db } from '@twicely/db';
import { delegatedAccess, sellerProfile, user, platformSetting, auditEvent } from '@twicely/db/schema';
import { authorize, sub } from '@twicely/casl';
import { getDelegationById, getStaffCountForSeller } from '@/lib/queries/delegation';
import { getSellerProfileIdByUserId } from '@/lib/queries/subscriptions';
import { ALL_SCOPES, TIER_STAFF_LIMITS } from '@/lib/delegation/constants';

type ActionResult = { success: boolean; error?: string };
type InviteResult = { success: boolean; error?: string; delegationId?: string };

const inviteStaffSchema = z.object({
  email: z.string().email(),
  scopes: z.array(z.string()).min(1),
}).strict();

const updateScopesSchema = z.object({
  delegationId: z.string().cuid2(),
  scopes: z.array(z.string()).min(1),
}).strict();

const revokeSchema = z.object({
  delegationId: z.string().cuid2(),
}).strict();

const acceptSchema = z.object({
  delegationId: z.string().cuid2(),
}).strict();

async function readPlatformMaxStaff(): Promise<number> {
  const rows = await db
    .select({ value: platformSetting.value })
    .from(platformSetting)
    .where(eq(platformSetting.key, 'delegation.maxStaffPerSeller'))
    .limit(1);
  const raw = rows[0]?.value;
  const parsed = typeof raw === 'number' ? raw : Number(raw);
  return Number.isFinite(parsed) ? parsed : 10; // default to 10
}

function validateScopes(scopes: string[]): boolean {
  return scopes.every((s) => ALL_SCOPES.includes(s as (typeof ALL_SCOPES)[number]));
}

async function emitAuditEvent(
  actorId: string,
  action: string,
  subjectId: string,
  details: Record<string, unknown>,
): Promise<void> {
  await db.insert(auditEvent).values({
    actorType: 'user',
    actorId,
    action,
    subject: 'DelegatedAccess',
    subjectId,
    severity: 'LOW',
    detailsJson: details,
  });
}

export async function inviteStaffMember(input: unknown): Promise<InviteResult> {
  const { session, ability } = await authorize();
  if (!session) return { success: false, error: 'Unauthorized' };
  if (session.delegationId !== null) return { success: false, error: 'Staff members cannot invite other staff' };
  if (!session.sellerId) return { success: false, error: 'Seller profile required' };

  const canManage = ability.can('manage', sub('DelegatedAccess', { sellerId: session.sellerId }));
  if (!canManage) return { success: false, error: 'Forbidden' };

  const parsed = inviteStaffSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }
  const data = parsed.data;

  // Resolve sellerProfile.id — delegation tables FK to sellerProfile, not user
  const sellerProfileId = await getSellerProfileIdByUserId(session.userId);
  if (!sellerProfileId) return { success: false, error: 'Seller profile not found' };

  // Load seller profile to get storeTier
  const [seller] = await db
    .select({ storeTier: sellerProfile.storeTier })
    .from(sellerProfile)
    .where(eq(sellerProfile.id, sellerProfileId))
    .limit(1);

  if (!seller) return { success: false, error: 'Seller profile not found' };

  const tierLimit = TIER_STAFF_LIMITS[seller.storeTier] ?? 0;
  if (tierLimit === 0) {
    return { success: false, error: 'Staff management requires Store Pro or higher' };
  }

  const platformMax = await readPlatformMaxStaff();
  const effectiveLimit = Math.min(tierLimit, platformMax);

  const currentCount = await getStaffCountForSeller(sellerProfileId);
  if (currentCount >= effectiveLimit) {
    return { success: false, error: 'Staff limit reached for your current plan' };
  }

  if (!validateScopes(data.scopes)) {
    return { success: false, error: 'Invalid scope values' };
  }

  // Look up user by email
  const [existingUser] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, data.email))
    .limit(1);

  if (!existingUser) {
    return {
      success: false,
      error: 'No Twicely account found for this email. The person must create an account first.',
    };
  }

  // Reject inviting yourself
  if (existingUser.id === session.userId) {
    return { success: false, error: 'You cannot invite yourself as a staff member' };
  }

  // Check for existing active/pending delegation
  const [existing] = await db
    .select({ id: delegatedAccess.id })
    .from(delegatedAccess)
    .where(
      and(
        eq(delegatedAccess.sellerId, sellerProfileId),
        eq(delegatedAccess.userId, existingUser.id),
        inArray(delegatedAccess.status, ['ACTIVE', 'PENDING']),
      )
    )
    .limit(1);

  if (existing) {
    return { success: false, error: 'This person already has an active or pending invitation' };
  }

  const [newRecord] = await db
    .insert(delegatedAccess)
    .values({
      sellerId: sellerProfileId,
      userId: existingUser.id,
      email: data.email,
      scopes: data.scopes,
      status: 'PENDING',
    })
    .returning({ id: delegatedAccess.id });

  if (!newRecord) return { success: false, error: 'Failed to create delegation' };

  await emitAuditEvent(session.userId, 'delegation.invited', newRecord.id, {
    invitedEmail: data.email,
    scopes: data.scopes,
    sellerId: sellerProfileId,
  });

  revalidatePath('/my/selling/staff');
  return { success: true, delegationId: newRecord.id };
}

// ─── Action 2: updateStaffScopes ─────────────────────────────────────────────

export async function updateStaffScopes(input: unknown): Promise<ActionResult> {
  const { session, ability } = await authorize();
  if (!session) return { success: false, error: 'Unauthorized' };
  if (session.delegationId !== null) return { success: false, error: 'Staff members cannot modify delegations' };
  if (!session.sellerId) return { success: false, error: 'Seller profile required' };

  const canManage = ability.can('manage', sub('DelegatedAccess', { sellerId: session.sellerId }));
  if (!canManage) return { success: false, error: 'Forbidden' };

  const parsed = updateScopesSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }
  const data = parsed.data;

  // Resolve sellerProfile.id — delegation tables FK to sellerProfile, not user
  const sellerProfileId = await getSellerProfileIdByUserId(session.userId);
  if (!sellerProfileId) return { success: false, error: 'Seller profile not found' };

  const record = await getDelegationById(data.delegationId);
  if (!record) return { success: false, error: 'Delegation not found' };
  if (record.sellerId !== sellerProfileId) return { success: false, error: 'Forbidden' };
  if (record.status !== 'ACTIVE') return { success: false, error: 'Can only update scopes on active delegations' };

  if (!validateScopes(data.scopes)) {
    return { success: false, error: 'Invalid scope values' };
  }

  const oldScopes = record.scopes;

  await db
    .update(delegatedAccess)
    .set({ scopes: data.scopes, updatedAt: new Date() })
    .where(eq(delegatedAccess.id, data.delegationId));

  await emitAuditEvent(session.userId, 'delegation.scopes_updated', data.delegationId, {
    oldScopes,
    newScopes: data.scopes,
    sellerId: sellerProfileId,
  });

  revalidatePath('/my/selling/staff');
  return { success: true };
}

// ─── Action 3: revokeStaffMember ─────────────────────────────────────────────

export async function revokeStaffMember(input: unknown): Promise<ActionResult> {
  const { session, ability } = await authorize();
  if (!session) return { success: false, error: 'Unauthorized' };
  if (session.delegationId !== null) return { success: false, error: 'Staff members cannot revoke delegations' };
  if (!session.sellerId) return { success: false, error: 'Seller profile required' };

  const canManage = ability.can('manage', sub('DelegatedAccess', { sellerId: session.sellerId }));
  if (!canManage) return { success: false, error: 'Forbidden' };

  const parsed = revokeSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }
  const data = parsed.data;

  // Resolve sellerProfile.id — delegation tables FK to sellerProfile, not user
  const sellerProfileId = await getSellerProfileIdByUserId(session.userId);
  if (!sellerProfileId) return { success: false, error: 'Seller profile not found' };

  const record = await getDelegationById(data.delegationId);
  if (!record) return { success: false, error: 'Delegation not found' };
  if (record.sellerId !== sellerProfileId) return { success: false, error: 'Forbidden' };
  if (!['ACTIVE', 'PENDING'].includes(record.status)) {
    return { success: false, error: 'Delegation is already revoked or expired' };
  }

  const now = new Date();
  await db
    .update(delegatedAccess)
    .set({ status: 'REVOKED', revokedAt: now, revokedByUserId: session.userId, updatedAt: now })
    .where(eq(delegatedAccess.id, data.delegationId));

  await emitAuditEvent(session.userId, 'delegation.revoked', data.delegationId, {
    revokedUserId: record.userId,
    sellerId: sellerProfileId,
  });

  revalidatePath('/my/selling/staff');
  return { success: true };
}

// ─── Action 4: acceptInvitation ───────────────────────────────────────────────

export async function acceptInvitation(input: unknown): Promise<ActionResult> {
  const { session, ability } = await authorize();
  if (!session) return { success: false, error: 'Unauthorized' };

  const parsed = acceptSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }
  const data = parsed.data;

  const record = await getDelegationById(data.delegationId);
  if (!record) return { success: false, error: 'Invitation not found or already processed' };

  if (!ability.can('update', sub('DelegatedAccess', { userId: session.userId }))) {
    return { success: false, error: 'Access denied' };
  }

  if (record.userId !== session.userId || record.status !== 'PENDING') {
    return { success: false, error: 'Invitation not found or already processed' };
  }

  const now = new Date();
  if (record.expiresAt && record.expiresAt < now) {
    await db
      .update(delegatedAccess)
      .set({ status: 'EXPIRED', updatedAt: now })
      .where(eq(delegatedAccess.id, data.delegationId));
    return { success: false, error: 'This invitation has expired' };
  }

  await db
    .update(delegatedAccess)
    .set({ status: 'ACTIVE', acceptedAt: now, updatedAt: now })
    .where(eq(delegatedAccess.id, data.delegationId));

  await emitAuditEvent(session.userId, 'delegation.accepted', data.delegationId, {
    sellerId: record.sellerId,
  });

  return { success: true };
}
