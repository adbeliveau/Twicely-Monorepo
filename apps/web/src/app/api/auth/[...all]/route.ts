import { auth } from '@twicely/auth';
import { toNextJsHandler } from 'better-auth/next-js';

const { GET: rawGET, POST: rawPOST } = toNextJsHandler(auth);

/**
 * SEC-047: Timing normalization for auth endpoints.
 * Ensures all responses take at minimum MIN_RESPONSE_MS to prevent
 * timing-based email enumeration (bcrypt ~100ms vs fast rejection ~5ms).
 */
const MIN_RESPONSE_MS = 200;

async function withTimingNormalization(
  handler: (req: Request) => Promise<Response>,
  req: Request,
): Promise<Response> {
  const start = Date.now();
  const response = await handler(req);
  const elapsed = Date.now() - start;
  const remaining = MIN_RESPONSE_MS - elapsed;
  if (remaining > 0) {
    await new Promise((resolve) => setTimeout(resolve, remaining));
  }
  return response;
}

export async function GET(req: Request): Promise<Response> {
  return withTimingNormalization(rawGET, req);
}

export async function POST(req: Request): Promise<Response> {
  return withTimingNormalization(rawPOST, req);
}
