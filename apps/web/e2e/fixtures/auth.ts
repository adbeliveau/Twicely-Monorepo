/**
 * E2E Auth Fixture — reusable login helper for authenticated tests.
 *
 * Usage:
 *   import { test } from '../fixtures/auth';
 *   test('my test', async ({ authedPage }) => { ... });
 *
 * Requires env vars: E2E_USER_EMAIL, E2E_USER_PASSWORD
 */

import { test as base, expect, type Page } from '@playwright/test';

async function login(page: Page): Promise<void> {
  const email = process.env.E2E_USER_EMAIL;
  const password = process.env.E2E_USER_PASSWORD;
  if (!email || !password) {
    throw new Error('E2E_USER_EMAIL and E2E_USER_PASSWORD env vars required');
  }

  await page.goto('/auth/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign In' }).click();

  // Wait for redirect away from login page
  await expect(page).not.toHaveURL(/\/auth\/login/, { timeout: 10_000 });
}

export const test = base.extend<{ authedPage: Page }>({
  authedPage: async ({ page }, use) => {
    await login(page);
    await use(page);
  },
});

export { expect };
