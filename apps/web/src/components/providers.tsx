'use client';

/**
 * Providers — root client providers wrapper (G10.5)
 *
 * Wraps FeatureFlagProvider (and future client providers) so the root layout
 * (a server component) can add client context to the entire app without
 * needing to become a client component itself.
 */

import type { ReactNode } from 'react';
import { FeatureFlagProvider } from '@/hooks/use-feature-flag';

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return <FeatureFlagProvider>{children}</FeatureFlagProvider>;
}
