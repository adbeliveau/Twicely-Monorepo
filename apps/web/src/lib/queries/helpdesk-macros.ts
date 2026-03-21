import { db } from '@twicely/db';
import { helpdeskMacro } from '@twicely/db/schema';
import { eq, asc } from 'drizzle-orm';

export interface MacroItem {
  id: string;
  title: string;
  body: string;
  category: string;
  shortcut?: string;
}

/** Fetch all shared macros for the agent reply composer dropdown */
export async function getAgentMacros(): Promise<MacroItem[]> {
  const rows = await db
    .select({
      id: helpdeskMacro.id,
      name: helpdeskMacro.name,
      description: helpdeskMacro.description,
      bodyTemplate: helpdeskMacro.bodyTemplate,
    })
    .from(helpdeskMacro)
    .where(eq(helpdeskMacro.isShared, true))
    .orderBy(asc(helpdeskMacro.name))
    .limit(100);

  return rows.map((r) => ({
    id: r.id,
    title: r.name,
    body: r.bodyTemplate,
    category: 'General',
  }));
}

/** Fetch all macros (shared + personal) for the macros management page */
export async function getAllMacros(): Promise<{
  id: string;
  name: string;
  description: string | null;
  bodyTemplate: string;
  isShared: boolean;
  usageCount: number;
  createdByStaffId: string;
  createdAt: Date;
}[]> {
  return db
    .select({
      id: helpdeskMacro.id,
      name: helpdeskMacro.name,
      description: helpdeskMacro.description,
      bodyTemplate: helpdeskMacro.bodyTemplate,
      isShared: helpdeskMacro.isShared,
      usageCount: helpdeskMacro.usageCount,
      createdByStaffId: helpdeskMacro.createdByStaffId,
      createdAt: helpdeskMacro.createdAt,
    })
    .from(helpdeskMacro)
    .orderBy(asc(helpdeskMacro.name))
    .limit(200);
}
