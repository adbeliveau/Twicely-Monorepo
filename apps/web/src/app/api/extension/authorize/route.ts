import { NextResponse } from 'next/server';
import { getPlatformSetting } from '@/lib/queries/platform-settings';
import {
  ExtensionAuthError,
  getCurrentExtensionRegistrationContext,
  issueExtensionToken,
} from '@/lib/auth/extension-auth';

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

    const callbackUrl = new URL('/api/extension/callback', request.url);
    callbackUrl.searchParams.set('token', token);
    return NextResponse.redirect(callbackUrl);
  } catch (err) {
    if (err instanceof ExtensionAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }

    throw err;
  }
}
