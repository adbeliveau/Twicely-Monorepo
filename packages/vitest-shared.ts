/**
 * Shared Vitest config for all @twicely/* packages.
 *
 * Provides the `@` alias so stale `@/lib/X` imports (not yet converted to
 * `@twicely/X`) resolve to `apps/web/src/lib/X` at runtime.
 *
 * `@twicely/*` imports resolve naturally via pnpm workspace node_modules
 * links — no alias needed. This ensures mocks on `@twicely/X` intercept
 * the correct module (the actual package source).
 */
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    env: {
      DATABASE_URL: 'postgresql://localhost:5432/twicely_test_placeholder',
    },
  },
  resolve: {
    alias: {
      // Legacy web-app alias — resolves @/lib/X → apps/web/src/lib/X
      '@': path.resolve(__dirname, '../apps/web/src'),
    },
  },
});
