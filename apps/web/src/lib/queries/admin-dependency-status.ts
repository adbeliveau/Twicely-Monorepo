/**
 * Admin Dependency Status Queries (G10.13)
 * Reads package.json versions for the integrations status dashboard.
 */

import { readFile } from 'fs/promises';
import { join } from 'path';

export interface DependencyInfo {
  name: string;
  currentVersion: string;
  category: 'framework' | 'database' | 'payments' | 'shipping' | 'search' | 'auth' | 'email' | 'ui' | 'testing' | 'crosslister';
}

/** Key dependencies we track on the integrations dashboard. */
const TRACKED_DEPENDENCIES: { pkg: string; category: DependencyInfo['category'] }[] = [
  { pkg: 'next', category: 'framework' },
  { pkg: 'react', category: 'framework' },
  { pkg: 'typescript', category: 'framework' },
  { pkg: 'drizzle-orm', category: 'database' },
  { pkg: 'postgres', category: 'database' },
  { pkg: 'stripe', category: 'payments' },
  { pkg: 'shippo', category: 'shipping' },
  { pkg: 'typesense', category: 'search' },
  { pkg: 'better-auth', category: 'auth' },
  { pkg: '@casl/ability', category: 'auth' },
  { pkg: 'resend', category: 'email' },
  { pkg: '@react-email/components', category: 'email' },
  { pkg: 'tailwindcss', category: 'ui' },
  { pkg: 'vitest', category: 'testing' },
  { pkg: '@playwright/test', category: 'testing' },
  { pkg: '@anthropic-ai/sdk', category: 'crosslister' },
  { pkg: 'bullmq', category: 'framework' },
  { pkg: 'zod', category: 'framework' },
];

/**
 * Read installed dependency versions from package.json.
 */
export async function getInstalledDependencies(): Promise<DependencyInfo[]> {
  try {
    const pkgPath = join(process.cwd(), 'package.json');
    const raw = await readFile(pkgPath, 'utf-8');
    const pkg = JSON.parse(raw) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };

    const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };

    return TRACKED_DEPENDENCIES.map(({ pkg: name, category }) => ({
      name,
      currentVersion: cleanVersion(allDeps[name] ?? 'not installed'),
      category,
    }));
  } catch {
    return [];
  }
}

function cleanVersion(version: string): string {
  return version.replace(/^[\^~>=<]+/, '');
}
