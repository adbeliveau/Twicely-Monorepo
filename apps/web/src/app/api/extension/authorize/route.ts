import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { getPlatformSetting } from '@/lib/queries/platform-settings';
import {
  ExtensionAuthError,
  getCurrentExtensionRegistrationContext,
  issueExtensionToken,
} from '@/lib/auth/extension-auth';
import { getValkeyClient } from '@twicely/db/cache';
import { logger } from '@twicely/logger';

export async function GET(request: Request): Promise<NextResponse> {
  const registrationContext = await getCurrentExtensionRegistrationContext();
  if (registrationContext.kind === 'anonymous') {
    const loginUrl = new URL('/auth/login', request.url);
    loginUrl.searchParams.set('redirect', '/api/extension/authorize');
    return NextResponse.redirect(loginUrl);
  }

  if (registrationContext.kind === 'forbidden') {
    return NextResponse.json({ error: 'Extension access denied' }, { status: 403 });
  }

  try {
    const regExpiryMinutes = await getPlatformSetting<number>(
      'extension.registrationTokenExpiryMinutes',
      5,
    );
    const token = await issueExtensionToken(
      registrationContext.context.claims,
      'extension-registration',
      `${regExpiryMinutes}m`,
    );

    // SEC-018: Store token in Valkey with a one-time code instead of passing JWT in URL.
    // The callback exchanges the short-lived code for the actual token server-side.
    const code = randomBytes(32).toString('hex');
    const codeKey = `ext-auth-code:${code}`;
    try {
      const valkey = getValkeyClient();
      await valkey.set(codeKey, token, 'EX', 120); // 2-minute expiry
    } catch (err) {
      logger.error('[extension/authorize] Failed to store auth code in Valkey', { error: String(err) });
      return NextResponse.json({ error: 'Authorization service temporarily unavailable' }, { status: 503 });
    }

    const callbackUrl = new URL('/api/extension/callback', request.url);
    callbackUrl.searchParams.set('code', code);
    return NextResponse.redirect(callbackUrl);
  } catch (err) {
    if (err instanceof ExtensionAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }

    throw err;
  }
}
