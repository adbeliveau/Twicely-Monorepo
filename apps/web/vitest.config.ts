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
    env: {
      DATABASE_URL: 'postgresql://localhost:5432/twicely_test_placeholder',
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // Map all @twicely/* packages to local app files during tests
      // so vi.mock() on @twicely/* paths intercepts the same modules
      // that source code imports via relative or @/ paths.
      '@twicely/db/schema': path.resolve(__dirname, './src/lib/db/schema'),
      '@twicely/db/queries': path.resolve(__dirname, './src/lib/queries'),
      '@twicely/db/cache': path.resolve(__dirname, './src/lib/cache/valkey'),
      '@twicely/db/encryption': path.resolve(__dirname, './src/lib/encryption'),
      '@twicely/db': path.resolve(__dirname, './src/lib/db'),
      '@twicely/commerce': path.resolve(__dirname, './src/lib/commerce'),
      '@twicely/jobs': path.resolve(__dirname, './src/lib/jobs'),
      '@twicely/stripe': path.resolve(__dirname, './src/lib/stripe'),
      '@twicely/notifications': path.resolve(__dirname, './src/lib/notifications'),
      '@twicely/crosslister': path.resolve(__dirname, './src/lib/crosslister'),
      '@twicely/subscriptions': path.resolve(__dirname, './src/lib/subscriptions'),
      '@twicely/finance': path.resolve(__dirname, './src/lib/finance'),
      '@twicely/scoring': path.resolve(__dirname, './src/lib/scoring'),
      '@twicely/auth': path.resolve(__dirname, './src/lib/auth'),
      '@twicely/casl': path.resolve(__dirname, './src/lib/casl'),
      '@twicely/logger': path.resolve(__dirname, './src/lib/logger'),
      '@twicely/email': path.resolve(__dirname, './src/lib/email'),
      '@twicely/utils': path.resolve(__dirname, './src/lib/utils'),
      '@twicely/config': path.resolve(__dirname, './src/lib/config'),
      '@twicely/realtime': path.resolve(__dirname, './src/lib/realtime'),
      '@twicely/storage': path.resolve(__dirname, './src/lib/storage'),
      '@twicely/search': path.resolve(__dirname, './src/lib/search'),
      '@twicely/shipping': path.resolve(__dirname, './src/lib/shipping'),
      '@twicely/ui': path.resolve(__dirname, './src/components/ui'),
    },
  },
});
