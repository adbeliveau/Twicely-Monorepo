import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { auth } from '@twicely/auth/server';
import { SignJWT } from 'jose';
import { getPlatformSetting } from '@/lib/queries/platform-settings';

export async function GET(request: Request): Promise<NextResponse> {
  let userId: string | undefined;
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    userId = session?.user?.id ?? undefined;
  } catch {
    // Session read failure treated as unauthenticated
  }

  if (!userId) {
    const loginUrl = new URL('/auth/login', request.url);
    loginUrl.searchParams.set('redirect', '/api/extension/authorize');
    return NextResponse.redirect(loginUrl);
  }

  const rawSecret = process.env['EXTENSION_JWT_SECRET'];
  if (!rawSecret) {
    return NextResponse.json({ error: 'Extension authentication unavailable' }, { status: 503 });
  }

  const secret = new TextEncoder().encode(rawSecret);
  // Read registration token expiry from platform_settings (W-H05 fix)
  const regExpiryMinutes = await getPlatformSetting<number>(
    'extension.registrationTokenExpiryMinutes',
    5,
  );
  const token = await new SignJWT({
    userId,
    purpose: 'extension-registration',
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${regExpiryMinutes}m`)
    .sign(secret);

  const callbackUrl = new URL('/api/extension/callback', request.url);
  callbackUrl.searchParams.set('token', token);
  return NextResponse.redirect(callbackUrl);
}
