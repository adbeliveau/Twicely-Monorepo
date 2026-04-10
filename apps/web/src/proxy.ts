import { NextResponse, type NextRequest } from 'next/server';
import {
  checkRateLimit,
  isSearchEndpoint,
  isRateLimitExempt,
  RATE_LIMITS,
  type ActorType,
} from './lib/rate-limit/sliding-window';

// SEC-008: nodejs runtime required for Valkey rate limiting (not Edge)
export const runtime = 'nodejs';

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a[i]! ^ b[i]!;
  }
  return result === 0;
}

function isMaintenanceModeActive(): boolean {
  return process.env.MAINTENANCE_MODE === '1' || process.env.MAINTENANCE_MODE === 'true';
}

const MAINTENANCE_EXEMPT_PREFIXES = [
  '/auth/',
  '/api/auth/',
  '/api/webhooks/',
  '/api/cron/',
  '/_next/',
];

function isMaintenanceExempt(pathname: string): boolean {
  return MAINTENANCE_EXEMPT_PREFIXES.some((p) => pathname.startsWith(p))
    || pathname === '/favicon.ico';
}

const PUBLIC_PATHS = ['/', '/pricing', '/s', '/explore'];

const PUBLIC_PREFIXES = [
  '/i/',
  '/c/',
  '/st/',
  '/auth/',
  '/api/auth/',
  '/api/webhooks/',
  '/api/categories/',
  '/p/',
  '/h/',
  '/ref/',
  '/_next/',
];

const AUTH_REQUIRED_PREFIXES = [
  '/my/',
  '/cart',
  '/checkout/',
  '/api/upload',
  '/api/returns/',
  '/api/protection/',
  '/api/user/',
  '/api/accounting/',
  '/api/crosslister/',
];

const CRON_PREFIXES = ['/api/cron/'];

const AUTH_PATHS = ['/auth/login', '/auth/signup', '/auth/forgot-password'];

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS.includes(pathname)) return true;
  if (pathname === '/favicon.ico') return true;
  return PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function isAuthRequired(pathname: string): boolean {
  return AUTH_REQUIRED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function isCronPath(pathname: string): boolean {
  return CRON_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function hasSession(request: NextRequest): boolean {
  const sessionCookie = request.cookies.get('twicely.session_token');
  return !!sessionCookie?.value;
}

function isHubSubdomain(request: NextRequest): boolean {
  const host = request.headers.get('host') ?? '';
  const hostname = host.split(':')[0];
  return hostname === 'hub.twicely.co' || hostname === 'hub.twicely.local';
}

// -- G10.1.3: Actor-type detection from cookies --------------------------------
function detectActor(request: NextRequest): ActorType {
  if (request.cookies.get('twicely.staff_token')?.value) return 'staff';
  if (request.cookies.get('twicely.session_token')?.value) return 'buyer';
  return 'guest';
}

function getRateLimitKey(request: NextRequest, actor: ActorType): string {
  if (actor === 'buyer' || actor === 'seller') {
    const token = request.cookies.get('twicely.session_token')?.value ?? '';
    return actor + ':' + token.slice(0, 32);
  }
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    'unknown';
  return 'guest:' + ip;
}

// -- SEC-008: CSP nonce generation ---------------------------------------------
function generateNonce(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array));
}

function buildCsp(nonce: string): string {
  return [
    "default-src 'self'",
    "script-src 'self' 'nonce-" + nonce + "' js.stripe.com",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: *.twicely.com cdn.twicely.com *.stripe.com",
    "font-src 'self' data:",
    "connect-src 'self' api.stripe.com *.twicely.com wss://*.twicely.com",
    "frame-src 'self' js.stripe.com hooks.stripe.com",
    "object-src 'none'",
    "base-uri 'self'",
  ].join('; ');
}

function nextWithCsp(nonce: string): NextResponse {
  const response = NextResponse.next();
  response.headers.set('x-nonce', nonce);
  response.headers.set('Content-Security-Policy', buildCsp(nonce));
  return response;
}

function handleHub(request: NextRequest, nonce: string): NextResponse {
  const { pathname } = request.nextUrl;

  if (pathname === '/') {
    const url = request.nextUrl.clone();
    url.pathname = '/d';
    return NextResponse.redirect(url);
  }

  if (pathname === '/login') {
    const response = nextWithCsp(nonce);
    response.headers.set('x-pathname', pathname);
    response.headers.set('x-subdomain', 'hub');
    return response;
  }

  const staffToken = request.cookies.get('twicely.staff_token');
  if (!staffToken?.value) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  const response = nextWithCsp(nonce);
  response.headers.set('x-pathname', pathname);
  response.headers.set('x-subdomain', 'hub');
  return response;
}

export default async function proxy(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;
  const nonce = generateNonce();

  // 0. Hub subdomain -- no rate limiting on hub subdomain
  if (isHubSubdomain(request)) {
    return handleHub(request, nonce);
  }

  // G10.1.3: Rate limiting (skip static/health/webhook paths)
  if (!isRateLimitExempt(pathname)) {
    const actor = detectActor(request);

    // Staff/Admin are exempt from rate limiting
    if (actor !== 'staff') {
      const isSearch = isSearchEndpoint(pathname);
      let limit: number;
      if (actor === 'guest') {
        limit = isSearch ? RATE_LIMITS.guestSearch : RATE_LIMITS.guestOther;
      } else if (actor === 'seller') {
        limit = RATE_LIMITS.seller;
      } else {
        limit = RATE_LIMITS.buyer;
      }

      const key = getRateLimitKey(request, actor);
      const result = await checkRateLimit(key, limit);

      if (!result.allowed) {
        return new NextResponse('Too Many Requests', {
          status: 429,
          headers: {
            'Retry-After': String(result.retryAfter),
            'X-RateLimit-Limit': String(limit),
            'X-RateLimit-Remaining': '0',
          },
        });
      }
    }
  }

  // 0.5. Maintenance mode
  if (isMaintenanceModeActive() && !isMaintenanceExempt(pathname)) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { error: 'Platform is temporarily unavailable for maintenance. Please try again shortly.' },
        { status: 503 }
      );
    }
    const url = request.nextUrl.clone();
    url.pathname = '/maintenance';
    return NextResponse.rewrite(url);
  }

  // 1. CRON routes - require CRON_SECRET
  if (isCronPath(pathname)) {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    const encoder = new TextEncoder();
    const expected = encoder.encode('Bearer ' + (cronSecret ?? ''));
    const actual = encoder.encode(authHeader ?? '');
    if (!cronSecret || !timingSafeEqual(expected, actual)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.next();
  }

  // 1.5. Hub & Platform API routes - require staff token (SEC-012)
  if (pathname.startsWith('/api/hub/') || pathname.startsWith('/api/platform/')) {
    const staffToken = request.cookies.get('twicely.staff_token');
    if (!staffToken?.value) {
      return NextResponse.json({ error: 'Staff authentication required' }, { status: 401 });
    }
    return nextWithCsp(nonce);
  }

  // 2. Public routes - pass through with CSP
  if (isPublicPath(pathname)) {
    const response = nextWithCsp(nonce);
    response.headers.set('x-pathname', pathname);
    return response;
  }

  // 3. Auth-required routes - redirect to login if no session
  if (isAuthRequired(pathname)) {
    if (!hasSession(request)) {
      const isApiRoute = pathname.startsWith('/api/');
      if (isApiRoute) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      const loginUrl = new URL('/auth/login', request.url);
      loginUrl.searchParams.set('callbackUrl', pathname);
      return NextResponse.redirect(loginUrl);
    }
    const response = nextWithCsp(nonce);
    response.headers.set('x-pathname', pathname);
    return response;
  }

  // 4. Redirect authenticated users away from auth pages
  const isAuthPath = AUTH_PATHS.some((p) => pathname.startsWith(p));
  if (isAuthPath && hasSession(request)) {
    return NextResponse.redirect(new URL('/my', request.url));
  }

  // 5. Default - pass through with CSP + x-pathname header
  const response = nextWithCsp(nonce);
  response.headers.set('x-pathname', pathname);
  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
