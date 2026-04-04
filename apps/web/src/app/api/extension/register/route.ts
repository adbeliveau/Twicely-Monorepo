import { NextResponse } from 'next/server';
import { z } from 'zod';
import { logger } from '@twicely/logger';
import { getPlatformSetting } from '@/lib/queries/platform-settings';
import {
  ExtensionAuthError,
  issueExtensionToken,
  verifyExtensionToken,
} from '@/lib/auth/extension-auth';

const registerSchema = z.object({
  registrationToken: z.string().min(1),
  extensionVersion: z.string().min(1),
}).strict();

export async function POST(request: Request): Promise<NextResponse> {
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

  try {
    const { claims, principal } = await verifyExtensionToken(
      parsed.data.registrationToken,
      'extension-registration',
    );

    const expiryDays = await getPlatformSetting<number>(
      'extension.sessionTokenExpiryDays',
      30,
    );
    const expiresAt = Math.floor(Date.now() / 1000) + expiryDays * 24 * 60 * 60;
    const extensionToken = await issueExtensionToken(
      claims,
      'extension-session',
      `${expiryDays}d`,
    );

    logger.info('[extension/register] Extension registered', {
      userId: principal.userId,
      extensionVersion: parsed.data.extensionVersion,
    });

    return NextResponse.json({
      success: true,
      token: extensionToken,
      userId: principal.userId,
      displayName: principal.displayName ?? principal.name ?? 'Seller',
      avatarUrl: principal.avatarUrl ?? principal.image ?? null,
      expiresAt: expiresAt * 1000,
    });
  } catch (err) {
    if (err instanceof ExtensionAuthError) {
      const error = err.status === 401 ? 'Invalid or expired token' : err.message;
      return NextResponse.json({ success: false, error }, { status: err.status });
    }

    logger.error('[extension/register] Token validation failed', { error: String(err) });
    return NextResponse.json(
      { success: false, error: 'Extension authentication unavailable' },
      { status: 500 },
    );
  }
}
