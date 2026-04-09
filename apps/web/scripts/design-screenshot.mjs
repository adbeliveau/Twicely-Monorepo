/**
 * Design audit screenshot script.
 * Captures key Mono pages in light + dark mode for visual review.
 * Output: scripts/design-screenshots/<page>-<theme>.png
 *
 * Run: node scripts/design-screenshot.mjs
 */

import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, 'design-screenshots');
const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000';

// Pages to capture. Order matters for report readability.
const PAGES = [
  { name: '01-landing', url: '/' },
  { name: '02-listings', url: '/listings' },
  { name: '03-my-hub', url: '/my' },
  { name: '04-login', url: '/login' },
  { name: '05-hd-dashboard', url: '/hd' },
  { name: '06-hd-cases', url: '/hd/cases' },
  { name: '07-cart', url: '/cart' },
  { name: '08-become-seller', url: '/become-seller' },
];

const VIEWPORT = { width: 1440, height: 900 };

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  console.log(`Output dir: ${OUT_DIR}`);

  const browser = await chromium.launch();
  const results = [];

  for (const theme of ['light', 'dark']) {
    const context = await browser.newContext({
      viewport: VIEWPORT,
      colorScheme: theme,
    });
    const page = await context.newPage();

    for (const { name, url } of PAGES) {
      const fullUrl = `${BASE_URL}${url}`;
      const outPath = join(OUT_DIR, `${name}-${theme}.png`);
      try {
        await page.goto(fullUrl, { waitUntil: 'networkidle', timeout: 15000 });
        // Give any client-side hydration a beat to settle
        await page.waitForTimeout(500);
        await page.screenshot({ path: outPath, fullPage: false });
        console.log(`  ✓ ${theme}/${name} -> ${outPath}`);
        results.push({ theme, name, url, status: 'ok', path: outPath });
      } catch (err) {
        console.log(`  ✗ ${theme}/${name} -> ${err.message}`);
        results.push({ theme, name, url, status: 'fail', error: err.message });
      }
    }

    await context.close();
  }

  await browser.close();
  console.log(`\nDone. ${results.filter((r) => r.status === 'ok').length} / ${results.length} screenshots captured.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
