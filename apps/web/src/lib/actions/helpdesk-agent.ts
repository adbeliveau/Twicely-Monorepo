'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@twicely/db';
import {
  helpdeskTeam,
  helpdeskTeamMember,
  helpdeskMacro,
  helpdeskSavedView,
  helpdeskSlaPolicy,
  helpdeskAutomationRule,
  helpdeskRoutingRule,
} from '@twicely/db/schema';
import { eq, and } from 'drizzle-orm';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import {
  createMacroSchema,
  createSavedViewSchema,
} from '@/lib/validations/helpdesk';
import { toggleAgentOnlineStatusSchema } from '@/lib/validations/helpdesk-agent-status';


interface ActionResult<T = undefined> {
  success: boolean;
  error?: string;
  data?: T;
}

// ─── Team management ──────────────────────────────────────────────────────────

export async function addTeamMember(
  teamId: string,
  staffUserId: string
): Promise<ActionResult> {
  const { ability } = await staffAuthorize();
  if (!ability.can('manage', 'HelpdeskTeam')) {
    return { success: false, error: 'Access denied' };
  }

  const teamExists = await db
    .select({ id: helpdeskTeam.id })
    .from(helpdeskTeam)
    .where(eq(helpdeskTeam.id, teamId))
    .limit(1);
  if (teamExists.length === 0) return { success: false, error: 'Not found' };

  await db.insert(helpdeskTeamMember).values({ teamId, staffUserId });
  revalidatePath('/hd/teams');
  return { success: true };
}

export async function removeTeamMember(
  teamId: string,
  staffUserId: string
): Promise<ActionResult> {
  const { ability } = await staffAuthorize();
  if (!ability.can('manage', 'HelpdeskTeam')) {
    return { success: false, error: 'Access denied' };
  }

  await db
    .delete(helpdeskTeamMember)
    .where(
      and(
        eq(helpdeskTeamMember.teamId, teamId),
        eq(helpdeskTeamMember.staffUserId, staffUserId)
      )
    );
  revalidatePath('/hd/teams');
  return { success: true };
}

export async function toggleTeamMemberAvailability(
  teamId: string,
  staffUserId: string,
  isAvailable: boolean
): Promise<ActionResult> {
  const { ability } = await staffAuthorize();
  if (!ability.can('manage', 'HelpdeskTeam')) {
    return { success: false, error: 'Access denied' };
  }

  await db
    .update(helpdeskTeamMember)
    .set({ isAvailable })
    .where(
      and(
        eq(helpdeskTeamMember.teamId, teamId),
        eq(helpdeskTeamMember.staffUserId, staffUserId)
      )
    );
  revalidatePath('/hd/teams');
  return { success: true };
}

// ─── Routing rules ────────────────────────────────────────────────────────────

export async function toggleRoutingRule(
  ruleId: string,
  isActive: boolean
): Promise<ActionResult> {
  const { ability } = await staffAuthorize();
  if (!ability.can('manage', 'HelpdeskRoutingRule')) {
    return { success: false, error: 'Access denied' };
  }

  const now = new Date();
  await db
    .update(helpdeskRoutingRule)
    .set({ isActive, updatedAt: now })
    .where(eq(helpdeskRoutingRule.id, ruleId));
  revalidatePath('/hd/routing');
  return { success: true };
}

export async function reorderRoutingRules(
  orderedIds: string[]
): Promise<ActionResult> {
  const { ability } = await staffAuthorize();
  if (!ability.can('manage', 'HelpdeskRoutingRule')) {
    return { success: false, error: 'Access denied' };
  }

  await Promise.all(
    orderedIds.map((id, index) =>
      db
        .update(helpdeskRoutingRule)
        .set({ sortOrder: index })
        .where(eq(helpdeskRoutingRule.id, id))
    )
  );
  revalidatePath('/hd/routing');
  return { success: true };
}

// ─── Macros ───────────────────────────────────────────────────────────────────

export async function createMacro(formData: unknown): Promise<ActionResult<{ id: string }>> {
  const { session, ability } = await staffAuthorize();
  if (!ability.can('manage', 'HelpdeskMacro')) {
    return { success: false, error: 'Access denied' };
  }

  const parsed = createMacroSchema.safeParse(formData);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message };

  const rows = await db.insert(helpdeskMacro).values({
    name: parsed.data.name,
    description: parsed.data.description ?? null,
    bodyTemplate: parsed.data.bodyTemplate,
    actionsJson: parsed.data.actionsJson ?? [],
    isShared: parsed.data.isShared,
    createdByStaffId: session.staffUserId,
  }).returning({ id: helpdeskMacro.id });

  const macroRow = rows[0];
  if (!macroRow) return { success: false, error: 'Insert failed' };
  revalidatePath('/hd/macros');
  return { success: true, data: { id: macroRow.id } };
}

export async function deleteMacro(macroId: string): Promise<ActionResult> {
  const { ability } = await staffAuthorize();
  if (!ability.can('manage', 'HelpdeskMacro')) {
    return { success: false, error: 'Access denied' };
  }

  await db.delete(helpdeskMacro).where(eq(helpdeskMacro.id, macroId));
  revalidatePath('/hd/macros');
  return { success: true };
}

// ─── Saved Views ──────────────────────────────────────────────────────────────

export async function createSavedView(
  formData: unknown
): Promise<ActionResult<{ id: string }>> {
  const { session, ability } = await staffAuthorize();
  if (!ability.can('create', 'HelpdeskSavedView')) {
    return { success: false, error: 'Access denied' };
  }

  const parsed = createSavedViewSchema.safeParse(formData);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message };

  const viewRows = await db.insert(helpdeskSavedView).values({
    name: parsed.data.name,
    staffUserId: session.staffUserId,
    filtersJson: parsed.data.filtersJson,
    sortJson: parsed.data.sortJson ?? {},
    isDefault: parsed.data.isDefault,
  }).returning({ id: helpdeskSavedView.id });

  const viewRow = viewRows[0];
  if (!viewRow) return { success: false, error: 'Insert failed' };
  revalidatePath('/hd/views');
  return { success: true, data: { id: viewRow.id } };
}

export async function deleteSavedView(viewId: string): Promise<ActionResult> {
  const { session, ability } = await staffAuthorize();
  if (!ability.can('delete', 'HelpdeskSavedView')) {
    return { success: false, error: 'Access denied' };
  }

  const existing = await db
    .select({ staffUserId: helpdeskSavedView.staffUserId })
    .from(helpdeskSavedView)
    .where(eq(helpdeskSavedView.id, viewId))
    .limit(1);

  const existingView = existing[0];
  if (!existingView) return { success: false, error: 'Not found' };
  if (existingView.staffUserId !== session.staffUserId) {
    return { success: false, error: 'Access denied' };
  }

  await db.delete(helpdeskSavedView).where(eq(helpdeskSavedView.id, viewId));
  revalidatePath('/hd/views');
  return { success: true };
}

// ─── SLA ──────────────────────────────────────────────────────────────────────

export async function updateSlaPolicyTargets(
  policyId: string,
  firstResponseMinutes: number,
  resolutionMinutes: number
): Promise<ActionResult> {
  const { ability } = await staffAuthorize();
  if (!ability.can('manage', 'HelpdeskSlaPolicy')) {
    return { success: false, error: 'Access denied' };
  }

  const now = new Date();
  await db
    .update(helpdeskSlaPolicy)
    .set({ firstResponseMinutes, resolutionMinutes, updatedAt: now })
    .where(eq(helpdeskSlaPolicy.id, policyId));

  revalidatePath('/hd/sla');
  return { success: true };
}

// ─── Automation ───────────────────────────────────────────────────────────────

export async function toggleAutomationRule(
  ruleId: string,
  isActive: boolean
): Promise<ActionResult> {
  const { ability } = await staffAuthorize();
  if (!ability.can('manage', 'HelpdeskAutomationRule')) {
    return { success: false, error: 'Access denied' };
  }

  const now = new Date();
  await db
    .update(helpdeskAutomationRule)
    .set({ isActive, updatedAt: now })
    .where(eq(helpdeskAutomationRule.id, ruleId));
  revalidatePath('/hd/automation');
  return { success: true };
}

// ─── Agent Online Status ──────────────────────────────────────────────────────

export async function toggleAgentOnlineStatus(formData: unknown): Promise<ActionResult> {
  const { session, ability } = await staffAuthorize();
  if (!ability.can('update', 'HelpdeskTeamMember')) {
    return { success: false, error: 'Access denied' };
  }

  const parsed = toggleAgentOnlineStatusSchema.safeParse(formData);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message };

  await db
    .update(helpdeskTeamMember)
    .set({ isAvailable: parsed.data.isOnline })
    .where(eq(helpdeskTeamMember.staffUserId, session.staffUserId));

  revalidatePath('/hd');
  return { success: true };
}

