import { NextResponse, type NextRequest } from 'next/server';

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a[i]! ^ b[i]!;
  }
  return result === 0;
}

/**
 * Next.js Middleware — Route protection, auth checks, subdomain routing
 *
 * Route types:
 * - HUB: hub.twicely.co subdomain → staff dashboard
 * - CRON: Require Authorization: Bearer <CRON_SECRET>
 * - PUBLIC: Pass through, no auth check
 * - AUTHENTICATED: Redirect to /auth/login if no session
 */

/**
 * Maintenance mode check — reads process.env.MAINTENANCE_MODE.
 * Set by: admin action (process.env write) or Railway env var panel.
 * The admin saveGeneralSettings action writes to both DB (source of truth)
 * and process.env (for same-instance middleware) and Valkey (for cross-instance sync).
 */
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

const PUBLIC_PATHS = [
  '/',
  '/pricing',
  '/s',
  '/explore',
];

const PUBLIC_PREFIXES = [
  '/i/',       // Listing detail
  '/c/',       // Categories
  '/st/',      // Storefronts
  '/auth/',    // Auth pages
  '/api/auth/', // Better Auth catch-all
  '/api/webhooks/', // Stripe webhooks (signature verified internally)
  '/api/categories/', // Public category search
  '/p/',       // Policies
  '/h/',       // Help center
  '/ref/',     // Referral link handler
  '/_next/',   // Static assets
];

const AUTH_REQUIRED_PREFIXES = [
  '/my/',      // User hub
  '/checkout/', // Checkout flow
  '/api/upload', // Upload API
  '/api/returns/', // Returns API
  '/api/protection/', // Buyer protection API
];

const CRON_PREFIXES = [
  '/api/cron/',
];

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

function handleHub(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;

  // Redirect hub root to /d (dashboard)
  if (pathname === '/') {
    const url = request.nextUrl.clone();
    url.pathname = '/d';
    return NextResponse.redirect(url);
  }

  // /login is public on hub subdomain
  if (pathname === '/login') {
    const response = NextResponse.next();
    response.headers.set('x-pathname', pathname);
    response.headers.set('x-subdomain', 'hub');
    return response;
  }

  // All other hub routes require staff session
  const staffToken = request.cookies.get('twicely.staff_token');
  if (!staffToken?.value) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  const response = NextResponse.next();
  response.headers.set('x-pathname', pathname);
  response.headers.set('x-subdomain', 'hub');
  return response;
}

export default function middleware(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;

  // 0. Hub subdomain — separate routing
  if (isHubSubdomain(request)) {
    return handleHub(request);
  }

  // 0.5. Maintenance mode — block all public traffic except auth + webhooks + cron
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
    const expected = encoder.encode(`Bearer ${cronSecret}`);
    const actual = encoder.encode(authHeader ?? '');
    if (!cronSecret || !timingSafeEqual(expected, actual)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.next();
  }

  // 1.5. Hub API routes - require staff token
  if (pathname.startsWith('/api/hub/')) {
    const staffToken = request.cookies.get('twicely.staff_token');
    if (!staffToken?.value) {
      return NextResponse.json({ error: 'Staff authentication required' }, { status: 401 });
    }
    return NextResponse.next();
  }

  // 2. Public routes - pass through
  if (isPublicPath(pathname)) {
    const response = NextResponse.next();
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
    const response = NextResponse.next();
    response.headers.set('x-pathname', pathname);
    return response;
  }

  // 4. Redirect authenticated users away from auth pages
  const isAuthPath = AUTH_PATHS.some((p) => pathname.startsWith(p));
  if (isAuthPath && hasSession(request)) {
    return NextResponse.redirect(new URL('/my', request.url));
  }

  // 5. Default - pass through with x-pathname header
  const response = NextResponse.next();
  response.headers.set('x-pathname', pathname);
  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
