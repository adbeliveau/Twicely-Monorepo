import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { db } from '@twicely/db';
import { auditEvent } from '@twicely/db/schema';
import { getImpersonationSession } from '@twicely/auth/impersonation';
import { getStaffSession } from '@twicely/auth/staff-auth';
import { STAFF_TOKEN_COOKIE } from '@twicely/casl/staff-authorize';

const HUB_BASE_URL =
  process.env.NODE_ENV === 'production'
    ? 'https://hub.twicely.co'
    : 'http://hub.twicely.local';

const COOKIE_DOMAIN =
  process.env.NODE_ENV === 'production' ? '.twicely.co' : '.twicely.local';

const ALLOWED_ORIGINS = new Set([
  'https://hub.twicely.co',
  'http://hub.twicely.local',
]);

export async function POST(request: NextRequest): Promise<NextResponse> {
  // Verify Origin to prevent CSRF
  const origin = request.headers.get('origin') ?? '';
  if (!ALLOWED_ORIGINS.has(origin)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Step 1: Validate impersonation session
  const impersonationSession = await getImpersonationSession();
  if (!impersonationSession) {
    return NextResponse.json(
      { error: 'No active impersonation session' },
      { status: 400 }
    );
  }

  // Step 2: Re-validate the staff session is still active (Actors Canonical §3.6)
  const cookieStore = await cookies();
  const staffToken = cookieStore.get(STAFF_TOKEN_COOKIE)?.value;
  if (!staffToken) {
    return NextResponse.json({ error: 'Staff session not found' }, { status: 401 });
  }
  const staffSession = await getStaffSession(staffToken);
  if (!staffSession) {
    return NextResponse.json({ error: 'Staff session expired or invalid' }, { status: 401 });
  }
  if (staffSession.staffUserId !== impersonationSession.staffUserId) {
    return NextResponse.json({ error: 'Session mismatch' }, { status: 403 });
  }

  // Step 3: Extract identifiers
  const { targetUserId, staffUserId } = impersonationSession;

  // Step 3: Insert audit event
  await db.insert(auditEvent).values({
    actorType: 'STAFF',
    actorId: staffUserId,
    action: 'IMPERSONATE_USER_END',
    subject: 'User',
    subjectId: targetUserId,
    severity: 'HIGH',
    detailsJson: {},
  });

  // Step 4-6: Redirect and clear cookie
  const redirectUrl = `${HUB_BASE_URL}/usr/${targetUserId}`;
  const response = NextResponse.redirect(redirectUrl, 302);

  response.cookies.set('twicely.impersonation_token', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 0,
    path: '/',
    domain: COOKIE_DOMAIN,
  });

  return response;
}
