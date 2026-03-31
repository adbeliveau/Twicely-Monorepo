/**
 * Shared Vitest config for all @twicely/* packages.
 *
 * All imports use `@twicely/*` package paths which resolve naturally
 * via pnpm workspace node_modules links — no aliases needed.
 */
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    env: {
      DATABASE_URL: 'postgresql://localhost:5432/twicely_test_placeholder',
    },
  },
});
