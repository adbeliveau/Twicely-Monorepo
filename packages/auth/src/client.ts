'use client';

import { createAuthClient } from 'better-auth/react';

// Explicit baseURL prevents auth failures when deployed behind a reverse proxy.
// NEXT_PUBLIC_APP_URL is the canonical public origin; fallback is dev-mode only.
export const authClient: ReturnType<typeof createAuthClient> = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
});

export const {
  signIn,
  signUp,
  signOut,
  useSession,
  getSession,
} = authClient;
