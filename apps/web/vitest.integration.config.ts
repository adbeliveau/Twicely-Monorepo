import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';
import { config } from 'dotenv';

// Load .env.local for DATABASE_URL
config({ path: '.env.local' });

export default defineConfig({
  plugins: [react()],
  test: {
    include: ['src/**/*.integration.test.ts'],
    testTimeout: 15_000,
    hookTimeout: 30_000,
    // No mocking — real DB connections
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
