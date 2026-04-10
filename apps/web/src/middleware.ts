import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';

export const runtime = 'nodejs';

/**
 * Next.js middleware — G10.1
 * 1. CSP nonce injection for scripts/styles
 * 2. Sliding-window rate limiting via Valkey (fail OPEN on error)
 */

// ─── Rate Limit Config (mirrors platform_settings seed defaults) ─────────────
// Middleware runs before DB, so we use hardcoded defaults matching seed values.
// The platform_settings values are consumed by the API layer for dynamic overrides.

interface RateLimitTier {
  maxRequests: number;
  windowSec: number;
}

const RATE_LIMITS: Record<string, RateLimitTier> = {
  guest: { maxRequests: 60, windowSec: 60 },
  buyer: { maxRequests: 120, windowSec: 60 },
  seller: { maxRequests: 300, windowSec: 60 },
  admin: { maxRequests: 0, windowSec: 0 }, // exempt
};

// ─── Valkey (lazy init) ──────────────────────────────────────────────────────

let valkeyClient: import('ioredis').Redis | null = null;
let valkeyFailed = false;

async function getValkey(): Promise<import('ioredis').Redis | null> {
  if (valkeyFailed) return null;
  if (valkeyClient) return valkeyClient;

  try {
    const { default: Redis } = await import('ioredis');
    const url = process.env['VALKEY_URL'] ?? process.env['REDIS_URL'];
    if (!url) {
      valkeyFailed = true;
      return null;
    }
    valkeyClient = new Redis(url, { maxRetriesPerRequest: 1, lazyConnect: true });
    await valkeyClient.connect();
    return valkeyClient;
  } catch {
    valkeyFailed = true;
    return null;
  }
}

// ─── Actor Detection ─────────────────────────────────────────────────────────

function detectActorType(request: NextRequest): string {
  // Check for staff/admin session cookie
  const sessionCookie = request.cookies.get('better-auth.session_token')?.value;
  if (!sessionCookie) return 'guest';

  // Check for impersonation cookie (staff acting as seller)
  const impersonation = request.cookies.get('tw-impersonate')?.value;
  if (impersonation) return 'admin';

  // For now, authenticated users default to 'buyer' tier.
  // True role detection would require DB lookup (too expensive for middleware).
  return 'buyer';
}

// ─── Rate Limit Check ────────────────────────────────────────────────────────

async function checkRateLimit(
  request: NextRequest,
  actorType: string,
): Promise<{ allowed: boolean; remaining: number; retryAfter: number }> {
  const tier = RATE_LIMITS[actorType] ?? RATE_LIMITS['guest']!;
  if (tier.maxRequests === 0) {
    return { allowed: true, remaining: 999, retryAfter: 0 };
  }

  const valkey = await getValkey();
  if (!valkey) {
    // Fail OPEN — allow request when Valkey is unreachable
    return { allowed: true, remaining: tier.maxRequests, retryAfter: 0 };
  }

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const key = `rl:${actorType}:${ip}`;

  try {
    const current = await valkey.incr(key);
    if (current === 1) {
      await valkey.expire(key, tier.windowSec);
    }

    const remaining = Math.max(0, tier.maxRequests - current);

    if (current > tier.maxRequests) {
      const ttl = await valkey.ttl(key);
      return { allowed: false, remaining: 0, retryAfter: ttl > 0 ? ttl : tier.windowSec };
    }

    return { allowed: true, remaining, retryAfter: 0 };
  } catch {
    // Fail OPEN
    return { allowed: true, remaining: tier.maxRequests, retryAfter: 0 };
  }
}

// ─── CSP Nonce ───────────────────────────────────────────────────────────────

function buildCsp(nonce: string): string {
  const isDev = process.env.NODE_ENV === 'development';
  const evalDirective = isDev ? " 'unsafe-eval'" : '';

  return [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}'${evalDirective}`,
    `style-src 'self' 'nonce-${nonce}' 'unsafe-inline'`,
    `img-src 'self' https://cdn.twicely.com https://placehold.co https://images.unsplash.com data: blob:`,
    `font-src 'self'`,
    `connect-src 'self' https://api.stripe.com https://*.sentry.io`,
    `frame-src 'self' https://js.stripe.com https://hooks.stripe.com`,
    `frame-ancestors 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `upgrade-insecure-requests`,
  ].join('; ');
}

// ─── Middleware ───────────────────────────────────────────────────────────────

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip rate limiting for webhooks and health
  const skipRateLimit =
    pathname.startsWith('/api/webhooks') ||
    pathname.startsWith('/api/health') ||
    pathname === '/_next' ||
    pathname.startsWith('/_next/');

  // Rate limiting
  if (!skipRateLimit) {
    const actorType = detectActorType(request);
    const { allowed, remaining, retryAfter } = await checkRateLimit(request, actorType);

    if (!allowed) {
      return new NextResponse('Too Many Requests', {
        status: 429,
        headers: {
          'Retry-After': String(retryAfter),
          'X-RateLimit-Remaining': '0',
        },
      });
    }

    // Inject rate limit headers into response
    const nonce = randomUUID();
    const csp = buildCsp(nonce);

    const response = NextResponse.next({
      request: {
        headers: new Headers(request.headers),
      },
    });

    response.headers.set('X-Nonce', nonce);
    response.headers.set('Content-Security-Policy', csp);
    response.headers.set('X-RateLimit-Remaining', String(remaining));

    return response;
  }

  // Non-rate-limited paths still get CSP nonce
  const nonce = randomUUID();
  const csp = buildCsp(nonce);
  const response = NextResponse.next();
  response.headers.set('X-Nonce', nonce);
  response.headers.set('Content-Security-Policy', csp);
  return response;
}

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico, sitemap.xml, robots.txt
     */
    '/((?!_next/static|_next/image|favicon\\.ico|sitemap\\.xml|robots\\.txt).*)',
  ],
};
