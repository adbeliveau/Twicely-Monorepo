import { NextResponse, type NextRequest } from 'next/server';

/**
 * Middleware combining:
 * - SEC-008: Nonce-based Content Security Policy (replaces unsafe-inline/unsafe-eval)
 * - SEC-012: Centralized auth guard for /my/* and hub routes
 */

// Session cookie set by Better Auth (prefix "twicely")
const SESSION_COOKIE = 'twicely.session_token';
const STAFF_COOKIE = 'twicely_staff_token';

// Paths that require user authentication (check session cookie exists)
const AUTH_REQUIRED_PATHS = [
  '/my/',
  '/checkout/',
  '/api/user/',
  '/api/accounting/',
  '/api/crosslister/',
];

// Paths that require staff authentication
const STAFF_REQUIRED_PATHS = [
  '/api/hub/',
  '/api/platform/',
];

function requiresUserAuth(pathname: string): boolean {
  return AUTH_REQUIRED_PATHS.some((p) => pathname.startsWith(p));
}

function requiresStaffAuth(pathname: string): boolean {
  return STAFF_REQUIRED_PATHS.some((p) => pathname.startsWith(p));
}

export function middleware(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;

  // ── SEC-012: Auth guard ──────────────────────────────────────────────
  if (requiresUserAuth(pathname)) {
    const hasSession = request.cookies.has(SESSION_COOKIE);
    if (!hasSession) {
      const loginUrl = new URL('/auth/login', request.url);
      loginUrl.searchParams.set('callbackUrl', pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  if (requiresStaffAuth(pathname)) {
    const hasStaffToken = request.cookies.has(STAFF_COOKIE);
    if (!hasStaffToken) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
  }

  // ── SEC-008: CSP nonce generation ────────────────────────────────────
  const nonce = generateNonce();
  const cspHeader = buildCsp(nonce);

  const response = NextResponse.next({
    request: {
      headers: new Headers(request.headers),
    },
  });

  // Set nonce header for server components to read
  response.headers.set('x-nonce', nonce);
  response.headers.set('Content-Security-Policy', cspHeader);

  return response;
}

function generateNonce(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array));
}

function buildCsp(nonce: string): string {
  return [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}' js.stripe.com`,
    `style-src 'self' 'unsafe-inline'`, // CSS-in-JS still needs unsafe-inline
    `img-src 'self' data: blob: *.twicely.com cdn.twicely.com *.stripe.com`,
    `font-src 'self' data:`,
    `connect-src 'self' api.stripe.com *.twicely.com wss://*.twicely.com`,
    `frame-src 'self' js.stripe.com hooks.stripe.com`,
    `object-src 'none'`,
    `base-uri 'self'`,
  ].join('; ');
}

export const config = {
  matcher: [
    // Match all request paths except static files and images
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff2?)$).*)',
  ],
};
