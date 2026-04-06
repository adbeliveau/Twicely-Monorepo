import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '@twicely/db';
import { user, auditEvent, staffUser } from '@twicely/db/schema';
import { getStaffSession } from '@twicely/auth/staff-auth';
import { STAFF_TOKEN_COOKIE } from '@twicely/casl/staff-authorize';
import { defineAbilitiesFor } from '@twicely/casl/ability';
import { staffUserCustomRole, customRole } from '@twicely/db/schema';
import { and, isNull } from 'drizzle-orm';
import {
  createImpersonationToken,
  type ImpersonationTokenPayload,
} from '@twicely/auth/impersonation';

const HUB_BASE_URL =
  process.env.NODE_ENV === 'production'
    ? 'https://hub.twicely.co'
    : 'http://hub.twicely.local';

const COOKIE_DOMAIN =
  process.env.NODE_ENV === 'production' ? '.twicely.co' : '.twicely.local';

const bodySchema = z
  .object({ targetUserId: z.string().min(1) })
  .strict();

async function loadCustomRolePermissions(
  staffUserId: string
): Promise<Array<{ subject: string; action: string }>> {
  const rows = await db
    .select({ permissionsJson: customRole.permissionsJson })
    .from(staffUserCustomRole)
    .innerJoin(customRole, eq(staffUserCustomRole.customRoleId, customRole.id))
    .where(
      and(
        eq(staffUserCustomRole.staffUserId, staffUserId),
        isNull(staffUserCustomRole.revokedAt),
        eq(customRole.isActive, true)
      )
    );

  const allPermissions: Array<{ subject: string; action: string }> = [];
  for (const row of rows) {
    const perms = row.permissionsJson as Array<{ subject: string; action: string }>;
    if (Array.isArray(perms)) {
      allPermissions.push(...perms);
    }
  }
  return allPermissions;
}

const ALLOWED_ORIGINS = new Set([
  'https://hub.twicely.co',
  'http://hub.twicely.local',
  ...(process.env.NODE_ENV !== 'production' ? ['http://localhost:3000'] : []),
]);

export async function POST(request: NextRequest): Promise<NextResponse> {
  // H4 Security: CSRF protection via Origin check
  const origin = request.headers.get('origin') ?? '';
  if (!ALLOWED_ORIGINS.has(origin)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Step 1: Read staff token from cookies
  const cookieStore = await cookies();
  const token = cookieStore.get(STAFF_TOKEN_COOKIE)?.value;
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Step 2: Validate staff session
  const staffSession = await getStaffSession(token);
  if (!staffSession) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Step 3: Load custom role permissions
  const customRolePermissions = await loadCustomRolePermissions(
    staffSession.staffUserId
  );

  // Step 4: Build CASL ability
  const ability = defineAbilitiesFor({
    userId: staffSession.staffUserId,
    email: staffSession.email,
    isSeller: false,
    sellerId: null,
    sellerStatus: null,
    delegationId: null,
    onBehalfOfSellerId: null,
    onBehalfOfSellerProfileId: null,
    delegatedScopes: [],
    isPlatformStaff: true,
    platformRoles: staffSession.roles,
    customRolePermissions,
  });

  // Step 5: Check impersonate permission
  if (!ability.can('impersonate', 'User')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Step 6: Parse and validate body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { targetUserId } = parsed.data;

  // Step 7: Look up the target user
  const [targetUser] = await db
    .select({ id: user.id, name: user.name, email: user.email })
    .from(user)
    .where(eq(user.id, targetUserId))
    .limit(1);

  if (!targetUser) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  // H4 Security: Block impersonation of staff accounts
  const [isTargetStaff] = await db
    .select({ id: staffUser.id })
    .from(staffUser)
    .where(eq(staffUser.email, targetUser.email))
    .limit(1);

  if (isTargetStaff) {
    return NextResponse.json(
      { error: 'Cannot impersonate staff accounts' },
      { status: 403 },
    );
  }

  // Step 8: Verify IMPERSONATION_SECRET is set
  if (!process.env.IMPERSONATION_SECRET) {
    return NextResponse.json(
      { error: 'Impersonation is not configured' },
      { status: 500 }
    );
  }

  // Step 9: Build token payload
  const payload: ImpersonationTokenPayload = {
    targetUserId,
    staffUserId: staffSession.staffUserId,
    staffDisplayName: staffSession.displayName,
    expiresAt: Date.now() + 15 * 60 * 1000,
  };

  // Step 10: Sign token
  const impersonationToken = createImpersonationToken(payload);

  // Step 11: Insert audit event
  await db.insert(auditEvent).values({
    actorType: 'STAFF',
    actorId: staffSession.staffUserId,
    action: 'IMPERSONATE_USER_START',
    subject: 'User',
    subjectId: targetUserId,
    severity: 'HIGH',
    detailsJson: {
      targetUserName: targetUser.name,
    },
  });

  // Step 12-14: Build redirect response with cookie
  const redirectUrl = `${HUB_BASE_URL}/usr/${targetUserId}`;
  const response = NextResponse.redirect(redirectUrl, 302);

  response.cookies.set('twicely.impersonation_token', impersonationToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 900,
    path: '/',
    domain: COOKIE_DOMAIN,
  });

  return response;
}
