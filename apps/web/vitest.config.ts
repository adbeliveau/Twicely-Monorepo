import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/*.integration.test.ts',
    ],
    setupFiles: ['./vitest.setup.ts'],
    env: {
      DATABASE_URL: 'postgresql://localhost:5432/twicely_test_placeholder',
    },
  },
  resolve: {
    alias: {
      // ── @/lib/* → package redirects (infrastructure only) ─────────
      // These infrastructure packages are always MOCKED in tests, never
      // the code-under-test.  Redirecting @/lib/* to packages ensures
      // vi.mock('@twicely/X') also covers `await import('@/lib/X')`.
      // MUST come before the general '@' alias (first match wins).
      '@/lib/db/schema': path.resolve(__dirname, '../../packages/db/src/schema'),
      '@/lib/db/channel-types': path.resolve(__dirname, '../../packages/db/src/channel-types'),
      '@/lib/db': path.resolve(__dirname, '../../packages/db/src'),
      '@/lib/cache/valkey': path.resolve(__dirname, '../../packages/db/src/cache'),
      '@/lib/encryption': path.resolve(__dirname, '../../packages/db/src/encryption'),
      '@/lib/casl': path.resolve(__dirname, '../../packages/casl/src'),
      '@/lib/auth/extension-auth': path.resolve(__dirname, './src/lib/auth/extension-auth'),
      '@/lib/auth': path.resolve(__dirname, '../../packages/auth/src'),
      '@/lib/logger': path.resolve(__dirname, '../../packages/logger/src'),

      // ── General app alias ─────────────────────────────────────────────
      // All other @/* paths (actions, mutations, hooks, queries, commerce,
      // crosslister, jobs, etc.) resolve to apps/web/src/*.
      '@': path.resolve(__dirname, './src'),

      // ── @twicely/* aliases ────────────────────────────────────────────
      // Infrastructure packages → canonical package sources.
      // Code-under-test packages → app-local copies (matching @/lib/* mock
      // paths used by tests).  Subpath aliases BEFORE parent aliases.
      //
      // INFRASTRUCTURE (packages — tests mock these, never import as CUT)
      '@twicely/db/schema': path.resolve(__dirname, '../../packages/db/src/schema'),
      // @twicely/db/queries intentionally points at apps/web/src/lib/queries (not
      // packages/db/src/queries). 182 existing tests mock '@/lib/queries/platform-settings'
      // and this alias makes @twicely/db/queries/platform-settings resolve to the same
      // file so the mocks apply to both import paths. The two files are kept in sync.
      '@twicely/db/queries': path.resolve(__dirname, './src/lib/queries'),
      '@twicely/db/cache': path.resolve(__dirname, '../../packages/db/src/cache'),
      '@twicely/db/encryption': path.resolve(__dirname, '../../packages/db/src/encryption'),
      '@twicely/db/channel-types': path.resolve(__dirname, '../../packages/db/src/channel-types'),
      '@twicely/db': path.resolve(__dirname, '../../packages/db/src'),
      '@twicely/casl': path.resolve(__dirname, '../../packages/casl/src'),
      '@twicely/auth': path.resolve(__dirname, '../../packages/auth/src'),
      // auth mirror trimmed to only contain Next.js-specific files (actions.ts,
      // extension-auth.ts) that can't live in the pure package. Those stay
      // importable via @/lib/auth/... (no alias needed).
      '@twicely/logger': path.resolve(__dirname, '../../packages/logger/src'),

      // CODE-UNDER-TEST (app-local — internal imports use @/lib/* paths
      // matching test vi.mock() declarations)
      '@twicely/search/typesense-client': path.resolve(__dirname, '../../packages/search/src/typesense-client'),
      '@twicely/search/typesense-index': path.resolve(__dirname, '../../packages/search/src/typesense-index'),
      '@twicely/search/typesense-schema': path.resolve(__dirname, '../../packages/search/src/typesense-schema'),
      '@twicely/search': path.resolve(__dirname, '../../packages/search/src'),
      '@twicely/jobs': path.resolve(__dirname, '../../packages/jobs/src'),
      '@twicely/finance/expense-categories': path.resolve(__dirname, '../../packages/finance/src/expense-categories'),
      '@twicely/finance': path.resolve(__dirname, '../../packages/finance/src'),
      '@twicely/commerce': path.resolve(__dirname, '../../packages/commerce/src'),
      '@twicely/stripe': path.resolve(__dirname, '../../packages/stripe/src'),
      '@twicely/notifications': path.resolve(__dirname, '../../packages/notifications/src'),
      '@twicely/crosslister': path.resolve(__dirname, '../../packages/crosslister/src'),
      '@twicely/subscriptions': path.resolve(__dirname, '../../packages/subscriptions/src'),
      '@twicely/scoring': path.resolve(__dirname, '../../packages/scoring/src'),
      '@twicely/email': path.resolve(__dirname, '../../packages/email/src'),
      '@twicely/utils': path.resolve(__dirname, '../../packages/utils/src'),
      '@twicely/config': path.resolve(__dirname, '../../packages/config/src'),
      '@twicely/realtime': path.resolve(__dirname, '../../packages/realtime/src'),
      '@twicely/storage': path.resolve(__dirname, '../../packages/storage/src'),
      '@twicely/ui': path.resolve(__dirname, './src/components/ui'),
    },
  },
});
