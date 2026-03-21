import { NextResponse } from 'next/server';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { getAllCircuitStatuses } from '@twicely/crosslister/queue/circuit-breaker';

export async function GET(): Promise<NextResponse> {
  let ability;
  try {
    ({ ability } = await staffAuthorize());
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!ability.can('read', 'HealthCheck')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  return NextResponse.json(getAllCircuitStatuses());
}
