import { defineConfig } from 'vitest/config';
import sharedConfig from '../../packages/vitest-shared';

export default defineConfig({
  ...sharedConfig,
  test: {
    ...sharedConfig.test,
    root: '.',
  },
});
