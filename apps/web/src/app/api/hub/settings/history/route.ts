import { NextRequest, NextResponse } from 'next/server';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { getSettingHistoryAction } from '@/lib/queries/admin-settings';

export async function GET(request: NextRequest): Promise<NextResponse> {
  let ability;
  try {
    ({ ability } = await staffAuthorize());
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!ability.can('read', 'Setting')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const settingId = request.nextUrl.searchParams.get('settingId');
  if (!settingId || typeof settingId !== 'string' || settingId.trim().length === 0) {
    return NextResponse.json({ error: 'Missing settingId' }, { status: 400 });
  }

  const history = await getSettingHistoryAction(settingId.trim());
  return NextResponse.json({ history });
}
