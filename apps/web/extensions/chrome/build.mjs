import * as esbuild from 'esbuild';
import { cpSync, mkdirSync } from 'fs';

const isWatch = process.argv.includes('--watch');

const sharedConfig = {
  bundle: true,
  sourcemap: true,
  target: 'chrome120',
  format: 'esm',
  logLevel: 'info',
};

const builds = [
  {
    ...sharedConfig,
    entryPoints: ['src/background/service-worker.ts'],
    outfile: 'dist/background/service-worker.js',
  },
  {
    ...sharedConfig,
    entryPoints: ['src/popup/popup.ts'],
    outfile: 'dist/popup/popup.js',
    format: 'iife',
  },
  {
    ...sharedConfig,
    entryPoints: ['src/content/bridge.ts'],
    outfile: 'dist/content/bridge.js',
    format: 'iife',
  },
];

if (isWatch) {
  for (const config of builds) {
    const ctx = await esbuild.context(config);
    await ctx.watch();
  }
  console.log('Watching for changes...');
} else {
  for (const config of builds) {
    await esbuild.build(config);
  }

  mkdirSync('dist/popup', { recursive: true });
  mkdirSync('dist/icons', { recursive: true });
  cpSync('manifest.json', 'dist/manifest.json');
  cpSync('src/popup/popup.html', 'dist/popup/popup.html');
  cpSync('src/popup/popup.css', 'dist/popup/popup.css');
  cpSync('icons', 'dist/icons', { recursive: true });

  console.log('Build complete.');
}
