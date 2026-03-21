import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { logger } from '@twicely/logger';

export async function POST(request: Request): Promise<NextResponse> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ success: false }, { status: 401 });
  }

  const rawSecret = process.env['EXTENSION_JWT_SECRET'];
  if (!rawSecret) {
    return NextResponse.json({ success: false }, { status: 503 });
  }

  const token = authHeader.slice(7);
  const secret = new TextEncoder().encode(rawSecret);

  try {
    const { payload } = await jwtVerify(token, secret);
    if (payload['purpose'] !== 'extension-session') {
      return NextResponse.json({ success: false }, { status: 403 });
    }

    // For now, just log. H1.4 will add real tracking.
    logger.debug('[extension/detect] Platform detected', {
      userId: payload['userId'],
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: false }, { status: 401 });
  }
}
