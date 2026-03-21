import { NextRequest, NextResponse } from 'next/server';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { db } from '@twicely/db';
import { platformSetting } from '@twicely/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { createId } from '@paralleldrive/cuid2';

const KEYWORD_SETTING_KEY = 'comms.messaging.bannedKeywords';

interface StoredKeyword {
  id: string;
  keyword: string;
  category: string;
  action: string;
  isActive: boolean;
  createdAt: string;
}

async function getKeywordsSetting(): Promise<StoredKeyword[]> {
  const [row] = await db
    .select({ value: platformSetting.value })
    .from(platformSetting)
    .where(eq(platformSetting.key, KEYWORD_SETTING_KEY))
    .limit(1);

  if (!row) return [];
  return (row.value as StoredKeyword[]) ?? [];
}

const addKeywordSchema = z.object({
  keyword: z.string().min(1).max(200).toLowerCase(),
  category: z.enum(['contact_info', 'profanity', 'spam', 'scam']),
  action: z.enum(['block', 'flag', 'warn']),
}).strict();

export async function GET(): Promise<NextResponse> {
  let ability;
  try {
    ({ ability } = await staffAuthorize());
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!ability.can('read', 'Setting')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const keywords = await getKeywordsSetting();
  return NextResponse.json({ keywords });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  let ability;
  try {
    ({ ability } = await staffAuthorize());
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!ability.can('update', 'Setting')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = addKeywordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  }

  const keywords = await getKeywordsSetting();

  const newEntry: StoredKeyword = {
    id: createId(),
    keyword: parsed.data.keyword,
    category: parsed.data.category,
    action: parsed.data.action,
    isActive: true,
    createdAt: new Date().toISOString(),
  };

  const updated = [...keywords, newEntry];

  const [existing] = await db
    .select({ id: platformSetting.id })
    .from(platformSetting)
    .where(eq(platformSetting.key, KEYWORD_SETTING_KEY))
    .limit(1);

  if (existing) {
    await db.update(platformSetting)
      .set({ value: updated, updatedAt: new Date() })
      .where(eq(platformSetting.id, existing.id));
  } else {
    await db.insert(platformSetting).values({
      key: KEYWORD_SETTING_KEY,
      value: updated,
      type: 'json',
      category: 'comms',
      description: 'Banned messaging keywords list',
    });
  }

  return NextResponse.json({ keyword: newEntry });
}
