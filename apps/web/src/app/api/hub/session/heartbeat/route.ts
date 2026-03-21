import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getStaffSession } from '@twicely/auth/staff-auth';
import { getPlatformSetting } from '@/lib/queries/platform-settings';
import { STAFF_TOKEN_COOKIE } from '@twicely/casl/staff-authorize';

const DEFAULT_INACTIVITY_MINUTES = 5;
const DEFAULT_WARNING_SECONDS = 60;

/**
 * POST /api/hub/session/heartbeat
 *
 * Validates the current staff session and returns session timing data.
 * Calling this route also resets the server-side lastActivityAt (via getStaffSession).
 * Does NOT require staffAuthorize() — it only validates the session itself.
 */
export async function POST(): Promise<NextResponse> {
  const cookieStore = await cookies();
  const token = cookieStore.get(STAFF_TOKEN_COOKIE)?.value;

  if (!token) {
    return NextResponse.json(
      { success: false, sessionValid: false, reason: 'not_found' },
      { status: 401 }
    );
  }

  const staffSession = await getStaffSession(token);

  if (!staffSession) {
    return NextResponse.json(
      { success: false, sessionValid: false, reason: 'expired' },
      { status: 401 }
    );
  }

  const [inactivityMinutes, warningSeconds] = await Promise.all([
    getPlatformSetting<number>(
      'general.staffInactivityTimeoutMinutes',
      DEFAULT_INACTIVITY_MINUTES
    ),
    getPlatformSetting<number>(
      'general.staffSessionWarningSeconds',
      DEFAULT_WARNING_SECONDS
    ),
  ]);

  return NextResponse.json({
    success: true,
    sessionValid: true,
    absoluteExpiresAt: staffSession.expiresAt.toISOString(),
    inactivityTimeoutMs: inactivityMinutes * 60 * 1000,
    warningSeconds,
  });
}
