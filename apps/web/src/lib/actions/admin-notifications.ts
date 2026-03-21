'use server';

/**
 * Admin Notification Template Actions (I8)
 * Create, update, delete, and toggle notification templates — all audited.
 */

import { db } from '@twicely/db';
import { notificationTemplate, auditEvent } from '@twicely/db/schema';
import { eq } from 'drizzle-orm';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { revalidatePath } from 'next/cache';
import { createId } from '@paralleldrive/cuid2';
import {
  createNotificationTemplateSchema,
  updateNotificationTemplateSchema,
  deleteNotificationTemplateSchema,
  toggleNotificationTemplateSchema,
} from '@/lib/validations/notification-templates';

export async function createNotificationTemplateAction(input: unknown) {
  const { ability, session } = await staffAuthorize();
  if (!ability.can('create', 'Notification')) {
    return { error: 'Forbidden' };
  }

  const parsed = createNotificationTemplateSchema.safeParse(input);
  if (!parsed.success) return { error: 'Invalid input' };

  const {
    key,
    name,
    description,
    category,
    subjectTemplate,
    bodyTemplate,
    htmlTemplate,
    channels,
    isSystemOnly,
    isActive,
  } = parsed.data;

  const existing = await db
    .select({ id: notificationTemplate.id })
    .from(notificationTemplate)
    .where(eq(notificationTemplate.key, key));

  if (existing.length > 0) {
    return { error: 'A template with this key already exists' };
  }

  const id = createId();
  await db.insert(notificationTemplate).values({
    id,
    key,
    name,
    description: description ?? null,
    category,
    subjectTemplate: subjectTemplate ?? null,
    bodyTemplate,
    htmlTemplate: htmlTemplate ?? null,
    channels,
    isSystemOnly,
    isActive,
  });

  await db.insert(auditEvent).values({
    actorType: 'STAFF',
    actorId: session.staffUserId,
    action: 'CREATE_NOTIFICATION_TEMPLATE',
    subject: 'Notification',
    subjectId: id,
    severity: 'MEDIUM',
    detailsJson: { key, name },
  });

  revalidatePath('/notifications');
  return { success: true, templateId: id };
}

export async function updateNotificationTemplateAction(input: unknown) {
  const { ability, session } = await staffAuthorize();
  if (!ability.can('update', 'Notification')) {
    return { error: 'Forbidden' };
  }

  const parsed = updateNotificationTemplateSchema.safeParse(input);
  if (!parsed.success) return { error: 'Invalid input' };

  const {
    templateId,
    name,
    description,
    category,
    subjectTemplate,
    bodyTemplate,
    htmlTemplate,
    channels,
    isSystemOnly,
    isActive,
  } = parsed.data;

  const existing = await db
    .select({ id: notificationTemplate.id })
    .from(notificationTemplate)
    .where(eq(notificationTemplate.id, templateId));

  if (existing.length === 0) return { error: 'Not found' };

  const updateFields: Record<string, unknown> = { updatedAt: new Date() };
  if (name !== undefined) updateFields.name = name;
  if (description !== undefined) updateFields.description = description;
  if (category !== undefined) updateFields.category = category;
  if (subjectTemplate !== undefined) updateFields.subjectTemplate = subjectTemplate;
  if (bodyTemplate !== undefined) updateFields.bodyTemplate = bodyTemplate;
  if (htmlTemplate !== undefined) updateFields.htmlTemplate = htmlTemplate;
  if (channels !== undefined) updateFields.channels = channels;
  if (isSystemOnly !== undefined) updateFields.isSystemOnly = isSystemOnly;
  if (isActive !== undefined) updateFields.isActive = isActive;

  await db
    .update(notificationTemplate)
    .set(updateFields)
    .where(eq(notificationTemplate.id, templateId));

  await db.insert(auditEvent).values({
    actorType: 'STAFF',
    actorId: session.staffUserId,
    action: 'UPDATE_NOTIFICATION_TEMPLATE',
    subject: 'Notification',
    subjectId: templateId,
    severity: 'MEDIUM',
    detailsJson: {},
  });

  revalidatePath('/notifications');
  revalidatePath('/notifications/' + templateId);
  return { success: true };
}

export async function deleteNotificationTemplateAction(input: unknown) {
  const { ability, session } = await staffAuthorize();
  if (!ability.can('delete', 'Notification')) {
    return { error: 'Forbidden' };
  }

  const parsed = deleteNotificationTemplateSchema.safeParse(input);
  if (!parsed.success) return { error: 'Invalid input' };

  const { templateId } = parsed.data;

  const existing = await db
    .select({ id: notificationTemplate.id, isSystemOnly: notificationTemplate.isSystemOnly })
    .from(notificationTemplate)
    .where(eq(notificationTemplate.id, templateId));

  if (existing.length === 0) return { error: 'Not found' };
  if (existing[0]!.isSystemOnly) return { error: 'Cannot delete system-only template' };

  await db.delete(notificationTemplate).where(eq(notificationTemplate.id, templateId));

  await db.insert(auditEvent).values({
    actorType: 'STAFF',
    actorId: session.staffUserId,
    action: 'DELETE_NOTIFICATION_TEMPLATE',
    subject: 'Notification',
    subjectId: templateId,
    severity: 'HIGH',
    detailsJson: {},
  });

  revalidatePath('/notifications');
  return { success: true };
}

export async function toggleNotificationTemplateAction(input: unknown) {
  const { ability, session } = await staffAuthorize();
  if (!ability.can('update', 'Notification')) {
    return { error: 'Forbidden' };
  }

  const parsed = toggleNotificationTemplateSchema.safeParse(input);
  if (!parsed.success) return { error: 'Invalid input' };

  const { templateId, isActive } = parsed.data;

  await db
    .update(notificationTemplate)
    .set({ isActive, updatedAt: new Date() })
    .where(eq(notificationTemplate.id, templateId));

  await db.insert(auditEvent).values({
    actorType: 'STAFF',
    actorId: session.staffUserId,
    action: 'TOGGLE_NOTIFICATION_TEMPLATE',
    subject: 'Notification',
    subjectId: templateId,
    severity: 'MEDIUM',
    detailsJson: { isActive },
  });

  revalidatePath('/notifications');
  return { success: true };
}
