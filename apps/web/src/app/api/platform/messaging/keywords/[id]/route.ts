import { NextRequest, NextResponse } from 'next/server';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { db } from '@twicely/db';
import { platformSetting } from '@twicely/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

const KEYWORD_SETTING_KEY = 'comms.messaging.bannedKeywords';

interface StoredKeyword {
  id: string;
  keyword: string;
  category: string;
  action: string;
  isActive: boolean;
  createdAt: string;
}

const toggleSchema = z.object({
  isActive: z.boolean(),
}).strict();

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  let ability;
  try {
    ({ ability } = await staffAuthorize());
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!ability.can('update', 'Setting')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = toggleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  }

  const [row] = await db
    .select({ id: platformSetting.id, value: platformSetting.value })
    .from(platformSetting)
    .where(eq(platformSetting.key, KEYWORD_SETTING_KEY))
    .limit(1);

  if (!row) {
    return NextResponse.json({ error: 'Keyword list not found' }, { status: 404 });
  }

  const keywords = (row.value as StoredKeyword[]) ?? [];
  const idx = keywords.findIndex((k) => k.id === id);
  if (idx === -1) {
    return NextResponse.json({ error: 'Keyword not found' }, { status: 404 });
  }

  const updated = keywords.map((k) =>
    k.id === id ? { ...k, isActive: parsed.data.isActive } : k,
  );

  await db.update(platformSetting)
    .set({ value: updated, updatedAt: new Date() })
    .where(eq(platformSetting.id, row.id));

  return NextResponse.json({ success: true });
}
