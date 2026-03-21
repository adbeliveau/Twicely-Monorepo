import { test, expect } from '@playwright/test';

test.describe('Public routes smoke test', () => {
  test('homepage loads with listings', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Twicely/i);
    // Verify at least one listing link renders
    const listingLinks = page.locator('a[href^="/i/"]');
    const count = await listingLinks.count();
    expect(count).toBeGreaterThan(0);
  });

  test('search page loads', async ({ page }) => {
    await page.goto('/s?q=test');
    await expect(page).toHaveTitle(/Twicely/i);
    // Page should render without 500
    await expect(page.locator('body')).not.toContainText('Internal Server Error');
  });

  test('category page loads', async ({ page }) => {
    await page.goto('/c/electronics');
    await expect(page).toHaveTitle(/Twicely/i);
    await expect(page.locator('body')).not.toContainText('Internal Server Error');
  });

  test('listing detail loads with real data', async ({ page }) => {
    await page.goto('/');
    const firstListing = page.locator('a[href^="/i/"]').first();
    await expect(firstListing).toBeVisible({ timeout: 10_000 });

    // Get the href before clicking
    const href = await firstListing.getAttribute('href');
    expect(href).toBeTruthy();

    // Navigate directly instead of clicking (avoids hydration race)
    await page.goto(href!);
    await expect(page).toHaveURL(/\/i\//);
    // Should have a price visible (use .first() to avoid strict mode with multiple matches)
    await expect(page.locator('text=/\\$\\d/').first()).toBeVisible();
  });

  test('auth pages load', async ({ page }) => {
    await page.goto('/auth/login');
    await expect(page.locator('body')).not.toContainText('Internal Server Error');
    await page.goto('/auth/signup');
    await expect(page.locator('body')).not.toContainText('Internal Server Error');
  });

  test('protected routes redirect to login', async ({ page }) => {
    await page.goto('/cart');
    await expect(page).toHaveURL(/\/auth\/login/);
  });
});
