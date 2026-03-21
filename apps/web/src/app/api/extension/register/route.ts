import { NextResponse } from 'next/server';
import { jwtVerify, SignJWT } from 'jose';
import { db } from '@twicely/db';
import { user } from '@twicely/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { logger } from '@twicely/logger';
import { getPlatformSetting } from '@/lib/queries/platform-settings';

const registerSchema = z.object({
  registrationToken: z.string().min(1),
  extensionVersion: z.string().min(1),
}).strict();

export async function POST(request: Request): Promise<NextResponse> {
  const rawSecret = process.env['EXTENSION_JWT_SECRET'];
  if (!rawSecret) {
    return NextResponse.json({ success: false, error: 'Extension authentication unavailable' }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: 'Invalid input' }, { status: 400 });
  }

  const secret = new TextEncoder().encode(rawSecret);

  try {
    const { payload } = await jwtVerify(parsed.data.registrationToken, secret);

    if (payload['purpose'] !== 'extension-registration') {
      return NextResponse.json({ success: false, error: 'Invalid token purpose' }, { status: 403 });
    }

    const userId = payload['userId'];
    if (typeof userId !== 'string' || !userId) {
      return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 403 });
    }

    const [dbUser] = await db
      .select({ displayName: user.displayName, name: user.name, image: user.image, avatarUrl: user.avatarUrl })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);

    if (!dbUser) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    // Read token expiry from platform_settings (W-H03 fix)
    const expiryDays = await getPlatformSetting<number>(
      'extension.sessionTokenExpiryDays',
      30,
    );
    const expiresAt = Math.floor(Date.now() / 1000) + expiryDays * 24 * 60 * 60;
    const extensionToken = await new SignJWT({
      userId,
      purpose: 'extension-session',
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime(`${expiryDays}d`)
      .sign(secret);

    logger.info('[extension/register] Extension registered', {
      userId,
      extensionVersion: parsed.data.extensionVersion,
    });

    return NextResponse.json({
      success: true,
      token: extensionToken,
      userId,
      displayName: dbUser.displayName ?? dbUser.name ?? 'Seller',
      avatarUrl: dbUser.avatarUrl ?? dbUser.image ?? null,
      expiresAt: expiresAt * 1000,
    });
  } catch (err) {
    logger.error('[extension/register] Token validation failed', { error: String(err) });
    return NextResponse.json({ success: false, error: 'Invalid or expired token' }, { status: 403 });
  }
}
