import { db } from '@twicely/db';
import { notificationTemplate } from '@twicely/db/schema';
import { eq, asc, and, sql } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';

export type AdminNotificationTemplateRow = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  category: string;
  channels: string[];
  isSystemOnly: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type AdminNotificationTemplateDetail = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  category: string;
  subjectTemplate: string | null;
  bodyTemplate: string;
  htmlTemplate: string | null;
  channels: string[];
  isSystemOnly: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export async function getAdminNotificationTemplates(filter?: {
  category?: string;
  isActive?: boolean;
}): Promise<AdminNotificationTemplateRow[]> {
  const conditions: SQL[] = [];

  if (filter?.category !== undefined) {
    conditions.push(eq(notificationTemplate.category, filter.category));
  }
  if (filter?.isActive !== undefined) {
    conditions.push(eq(notificationTemplate.isActive, filter.isActive));
  }

  const baseQuery = db
    .select({
      id: notificationTemplate.id,
      key: notificationTemplate.key,
      name: notificationTemplate.name,
      description: notificationTemplate.description,
      category: notificationTemplate.category,
      channels: notificationTemplate.channels,
      isSystemOnly: notificationTemplate.isSystemOnly,
      isActive: notificationTemplate.isActive,
      createdAt: notificationTemplate.createdAt,
      updatedAt: notificationTemplate.updatedAt,
    })
    .from(notificationTemplate);

  if (conditions.length === 0) {
    return baseQuery.orderBy(asc(notificationTemplate.category), asc(notificationTemplate.name));
  }
  if (conditions.length === 1) {
    return baseQuery
      .where(conditions[0]!)
      .orderBy(asc(notificationTemplate.category), asc(notificationTemplate.name));
  }
  return baseQuery
    .where(and(...conditions))
    .orderBy(asc(notificationTemplate.category), asc(notificationTemplate.name));
}

export async function getAdminNotificationTemplateById(
  id: string,
): Promise<AdminNotificationTemplateDetail | null> {
  const rows = await db
    .select({
      id: notificationTemplate.id,
      key: notificationTemplate.key,
      name: notificationTemplate.name,
      description: notificationTemplate.description,
      category: notificationTemplate.category,
      subjectTemplate: notificationTemplate.subjectTemplate,
      bodyTemplate: notificationTemplate.bodyTemplate,
      htmlTemplate: notificationTemplate.htmlTemplate,
      channels: notificationTemplate.channels,
      isSystemOnly: notificationTemplate.isSystemOnly,
      isActive: notificationTemplate.isActive,
      createdAt: notificationTemplate.createdAt,
      updatedAt: notificationTemplate.updatedAt,
    })
    .from(notificationTemplate)
    .where(eq(notificationTemplate.id, id))
    .limit(1);

  return rows[0] ?? null;
}

export async function getNotificationCategories(): Promise<string[]> {
  const rows = await db
    .selectDistinct({ category: notificationTemplate.category })
    .from(notificationTemplate)
    .orderBy(sql`${notificationTemplate.category} asc`);

  return rows.map((r) => r.category);
}
