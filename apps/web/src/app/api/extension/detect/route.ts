import { NextResponse } from 'next/server';
import { logger } from '@twicely/logger';
import {
  authenticateExtensionRequest,
  ExtensionAuthError,
} from '@/lib/auth/extension-auth';

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const { principal } = await authenticateExtensionRequest(request);

    logger.debug('[extension/detect] Platform detected', {
      userId: principal.userId,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof ExtensionAuthError) {
      return NextResponse.json({ success: false }, { status: err.status });
    }

    throw err;
  }
}
