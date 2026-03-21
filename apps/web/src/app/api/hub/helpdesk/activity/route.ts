import { NextResponse } from 'next/server';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { getHelpdeskRecentActivity } from '@/lib/queries/helpdesk-activity';

export async function GET(): Promise<NextResponse> {
  let ability;
  try {
    const result = await staffAuthorize();
    ability = result.ability;
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!ability.can('read', 'HelpdeskCase')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const activity = await getHelpdeskRecentActivity();

  return NextResponse.json({ success: true, activity });
}
