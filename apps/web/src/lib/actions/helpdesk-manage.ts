'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@twicely/db';
import {
  helpdeskMacro,
  helpdeskTeam,
  helpdeskRoutingRule,
  helpdeskAutomationRule,
  helpdeskSlaPolicy,
  platformSetting,
  platformSettingHistory,
  auditEvent,
} from '@twicely/db/schema';
import { eq } from 'drizzle-orm';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { getTeamMembers } from '@/lib/queries/helpdesk-teams';
import {
  updateMacroSchema,
  createTeamSchema,
  updateTeamSchema,
  createRoutingRuleSchema,
  updateRoutingRuleSchema,
  createAutomationRuleSchema,
  updateAutomationRuleSchema,
  updateSlaPolicySchema,
} from '@/lib/validations/helpdesk';
import { z } from 'zod';

interface ActionResult<T = undefined> {
  success: boolean;
  error?: string;
  data?: T;
}

// ─── Macros ───────────────────────────────────────────────────────────────────

export async function updateMacro(formData: unknown): Promise<ActionResult> {
  const { ability } = await staffAuthorize();
  if (!ability.can('manage', 'HelpdeskMacro')) return { success: false, error: 'Access denied' };

  const parsed = updateMacroSchema.safeParse(formData);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message };

  const { macroId, ...fields } = parsed.data;
  const exists = await db.select({ id: helpdeskMacro.id }).from(helpdeskMacro).where(eq(helpdeskMacro.id, macroId)).limit(1);
  if (exists.length === 0) return { success: false, error: 'Not found' };

  await db.update(helpdeskMacro).set({
    ...(fields.name !== undefined ? { name: fields.name } : {}),
    ...(fields.description !== undefined ? { description: fields.description } : {}),
    ...(fields.bodyTemplate !== undefined ? { bodyTemplate: fields.bodyTemplate } : {}),
    ...(fields.actionsJson !== undefined ? { actionsJson: fields.actionsJson } : {}),
    ...(fields.isShared !== undefined ? { isShared: fields.isShared } : {}),
    updatedAt: new Date(),
  }).where(eq(helpdeskMacro.id, macroId));

  revalidatePath('/hd/macros');
  return { success: true };
}

// ─── Teams ────────────────────────────────────────────────────────────────────

export async function createTeam(formData: unknown): Promise<ActionResult<{ id: string }>> {
  const { ability } = await staffAuthorize();
  if (!ability.can('manage', 'HelpdeskTeam')) return { success: false, error: 'Access denied' };

  const parsed = createTeamSchema.safeParse(formData);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message };

  const rows = await db.insert(helpdeskTeam).values({
    name: parsed.data.name,
    description: parsed.data.description ?? null,
    maxConcurrentCases: parsed.data.maxConcurrentCases,
    roundRobinEnabled: parsed.data.roundRobinEnabled,
  }).returning({ id: helpdeskTeam.id });

  const row = rows[0];
  if (!row) return { success: false, error: 'Insert failed' };
  revalidatePath('/hd/teams');
  return { success: true, data: { id: row.id } };
}

export async function updateTeam(formData: unknown): Promise<ActionResult> {
  const { ability } = await staffAuthorize();
  if (!ability.can('manage', 'HelpdeskTeam')) return { success: false, error: 'Access denied' };

  const parsed = updateTeamSchema.safeParse(formData);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message };

  const { teamId, ...fields } = parsed.data;
  const exists = await db.select({ id: helpdeskTeam.id }).from(helpdeskTeam).where(eq(helpdeskTeam.id, teamId)).limit(1);
  if (exists.length === 0) return { success: false, error: 'Not found' };

  await db.update(helpdeskTeam).set({
    ...(fields.name !== undefined ? { name: fields.name } : {}),
    ...(fields.description !== undefined ? { description: fields.description } : {}),
    ...(fields.maxConcurrentCases !== undefined ? { maxConcurrentCases: fields.maxConcurrentCases } : {}),
    ...(fields.roundRobinEnabled !== undefined ? { roundRobinEnabled: fields.roundRobinEnabled } : {}),
    updatedAt: new Date(),
  }).where(eq(helpdeskTeam.id, teamId));

  revalidatePath('/hd/teams');
  return { success: true };
}

// ─── Routing Rules ────────────────────────────────────────────────────────────

export async function createRoutingRule(formData: unknown): Promise<ActionResult<{ id: string }>> {
  const { ability } = await staffAuthorize();
  if (!ability.can('manage', 'HelpdeskRoutingRule')) return { success: false, error: 'Access denied' };

  const parsed = createRoutingRuleSchema.safeParse(formData);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message };

  const rows = await db.insert(helpdeskRoutingRule).values({
    name: parsed.data.name,
    conditionsJson: parsed.data.conditionsJson,
    actionsJson: parsed.data.actionsJson,
    sortOrder: parsed.data.sortOrder ?? 0,
    isActive: parsed.data.isActive,
  }).returning({ id: helpdeskRoutingRule.id });

  const row = rows[0];
  if (!row) return { success: false, error: 'Insert failed' };
  revalidatePath('/hd/routing');
  return { success: true, data: { id: row.id } };
}

export async function updateRoutingRule(formData: unknown): Promise<ActionResult> {
  const { ability } = await staffAuthorize();
  if (!ability.can('manage', 'HelpdeskRoutingRule')) return { success: false, error: 'Access denied' };

  const parsed = updateRoutingRuleSchema.safeParse(formData);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message };

  const { ruleId, ...fields } = parsed.data;
  const exists = await db.select({ id: helpdeskRoutingRule.id }).from(helpdeskRoutingRule).where(eq(helpdeskRoutingRule.id, ruleId)).limit(1);
  if (exists.length === 0) return { success: false, error: 'Not found' };

  await db.update(helpdeskRoutingRule).set({
    ...(fields.name !== undefined ? { name: fields.name } : {}),
    ...(fields.conditionsJson !== undefined ? { conditionsJson: fields.conditionsJson } : {}),
    ...(fields.actionsJson !== undefined ? { actionsJson: fields.actionsJson } : {}),
    ...(fields.isActive !== undefined ? { isActive: fields.isActive } : {}),
    updatedAt: new Date(),
  }).where(eq(helpdeskRoutingRule.id, ruleId));

  revalidatePath('/hd/routing');
  return { success: true };
}

export async function deleteRoutingRule(ruleId: string): Promise<ActionResult> {
  const { ability } = await staffAuthorize();
  if (!ability.can('manage', 'HelpdeskRoutingRule')) return { success: false, error: 'Access denied' };
  await db.delete(helpdeskRoutingRule).where(eq(helpdeskRoutingRule.id, ruleId));
  revalidatePath('/hd/routing');
  return { success: true };
}

// ─── SLA ──────────────────────────────────────────────────────────────────────

export async function updateSlaPolicyFields(formData: unknown): Promise<ActionResult> {
  const { ability } = await staffAuthorize();
  if (!ability.can('manage', 'HelpdeskSlaPolicy')) return { success: false, error: 'Access denied' };

  const parsed = updateSlaPolicySchema.safeParse(formData);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message };

  const { policyId, ...fields } = parsed.data;
  await db.update(helpdeskSlaPolicy).set({
    ...(fields.firstResponseMinutes !== undefined ? { firstResponseMinutes: fields.firstResponseMinutes } : {}),
    ...(fields.resolutionMinutes !== undefined ? { resolutionMinutes: fields.resolutionMinutes } : {}),
    ...(fields.businessHoursOnly !== undefined ? { businessHoursOnly: fields.businessHoursOnly } : {}),
    ...(fields.escalateOnBreach !== undefined ? { escalateOnBreach: fields.escalateOnBreach } : {}),
    updatedAt: new Date(),
  }).where(eq(helpdeskSlaPolicy.id, policyId));

  revalidatePath('/hd/sla');
  return { success: true };
}

// ─── Automation Rules ─────────────────────────────────────────────────────────

export async function createAutomationRule(formData: unknown): Promise<ActionResult<{ id: string }>> {
  const { ability } = await staffAuthorize();
  if (!ability.can('manage', 'HelpdeskAutomationRule')) return { success: false, error: 'Access denied' };

  const parsed = createAutomationRuleSchema.safeParse(formData);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message };

  const rows = await db.insert(helpdeskAutomationRule).values({
    name: parsed.data.name,
    triggerEvent: parsed.data.triggerEvent,
    conditionsJson: parsed.data.conditionsJson,
    actionsJson: parsed.data.actionsJson,
    sortOrder: parsed.data.sortOrder ?? 0,
    isActive: parsed.data.isActive,
  }).returning({ id: helpdeskAutomationRule.id });

  const row = rows[0];
  if (!row) return { success: false, error: 'Insert failed' };
  revalidatePath('/hd/automation');
  return { success: true, data: { id: row.id } };
}

export async function updateAutomationRule(formData: unknown): Promise<ActionResult> {
  const { ability } = await staffAuthorize();
  if (!ability.can('manage', 'HelpdeskAutomationRule')) return { success: false, error: 'Access denied' };

  const parsed = updateAutomationRuleSchema.safeParse(formData);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message };

  const { ruleId, ...fields } = parsed.data;
  const exists = await db.select({ id: helpdeskAutomationRule.id }).from(helpdeskAutomationRule).where(eq(helpdeskAutomationRule.id, ruleId)).limit(1);
  if (exists.length === 0) return { success: false, error: 'Not found' };

  await db.update(helpdeskAutomationRule).set({
    ...(fields.name !== undefined ? { name: fields.name } : {}),
    ...(fields.triggerEvent !== undefined ? { triggerEvent: fields.triggerEvent } : {}),
    ...(fields.conditionsJson !== undefined ? { conditionsJson: fields.conditionsJson } : {}),
    ...(fields.actionsJson !== undefined ? { actionsJson: fields.actionsJson } : {}),
    ...(fields.isActive !== undefined ? { isActive: fields.isActive } : {}),
    updatedAt: new Date(),
  }).where(eq(helpdeskAutomationRule.id, ruleId));

  revalidatePath('/hd/automation');
  return { success: true };
}

export async function deleteAutomationRule(ruleId: string): Promise<ActionResult> {
  const { ability } = await staffAuthorize();
  if (!ability.can('manage', 'HelpdeskAutomationRule')) return { success: false, error: 'Access denied' };
  await db.delete(helpdeskAutomationRule).where(eq(helpdeskAutomationRule.id, ruleId));
  revalidatePath('/hd/automation');
  return { success: true };
}

// ─── Helpdesk Settings ────────────────────────────────────────────────────────

const updateHelpdeskSettingSchema = z.object({
  key: z.string().min(1).refine((k) => k.startsWith('helpdesk.'), { message: 'Key must start with helpdesk.' }),
  value: z.unknown(),
}).strict();

export async function updateHelpdeskSetting(input: unknown): Promise<ActionResult> {
  const { ability, session } = await staffAuthorize();
  if (!ability.can('manage', 'HelpdeskEmailConfig')) return { success: false, error: 'Access denied' };

  const parsed = updateHelpdeskSettingSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message };

  const { key, value } = parsed.data;
  const rows = await db.select({ id: platformSetting.id, value: platformSetting.value }).from(platformSetting).where(eq(platformSetting.key, key)).limit(1);
  const row = rows[0];
  if (!row) return { success: false, error: 'Setting not found' };

  await db.insert(platformSettingHistory).values({
    settingId: row.id,
    previousValue: row.value,
    newValue: value,
    changedByStaffId: session.staffUserId,
    reason: 'Helpdesk settings update',
  });

  await db.update(platformSetting).set({ value, updatedByStaffId: session.staffUserId, updatedAt: new Date() }).where(eq(platformSetting.id, row.id));

  await db.insert(auditEvent).values({
    actorType: 'STAFF',
    actorId: session.staffUserId,
    action: 'UPDATE_SETTING',
    subject: 'Setting',
    subjectId: row.id,
    severity: 'MEDIUM',
    detailsJson: { key },
  });

  revalidatePath('/hd/settings');
  return { success: true };
}

export async function getTeamMembersAction(teamId: string) {
  const { ability } = await staffAuthorize();
  if (!ability.can('manage', 'HelpdeskTeam')) return [];
  return getTeamMembers(teamId);
}
