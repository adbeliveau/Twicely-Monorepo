/**
 * E2E: Cancel Pending Downgrade
 *
 * Prerequisites:
 *   - E2E_USER_EMAIL / E2E_USER_PASSWORD env vars set
 *   - Test user is a BUSINESS seller with active Store subscription (PRO+)
 *   - Dev server running on localhost:3000 with test DB
 *
 * Flow:
 *   1. Login → subscription page
 *   2. Open Change Plan dialog → schedule downgrade
 *   3. Verify pending downgrade banner appears
 *   4. Click "Cancel Change" on the banner
 *   5. Verify banner disappears + success toast
 */

import { test, expect } from './fixtures/auth';

const SUB_PAGE = '/my/selling/subscription';

test.describe('Cancel pending downgrade', () => {
  test.skip(
    !process.env.E2E_USER_EMAIL || !process.env.E2E_USER_PASSWORD,
    'Requires E2E_USER_EMAIL and E2E_USER_PASSWORD env vars',
  );

  test('schedule a downgrade then cancel it', async ({ authedPage: page }) => {
    // ── 1. Navigate to subscription page ──────────────────────────────
    await page.goto(SUB_PAGE);
    await expect(page.getByRole('heading', { name: 'Subscription' })).toBeVisible();

    // ── 2. Find the Store card and open Change Plan ───────────────────
    const storeCard = page.locator('[class*="border-l-4"]').filter({
      has: page.getByText('Store', { exact: true }),
    }).first();
    await expect(storeCard).toBeVisible();

    // If a pending change banner already exists, cancel it first
    const existingBanner = storeCard.locator('text=Cancel Change');
    if (await existingBanner.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await existingBanner.click();
      await expect(page.locator('text=Pending change canceled')).toBeVisible({ timeout: 5_000 });
      // Wait for page refresh
      await page.waitForLoadState('networkidle');
    }

    // Click "Change Plan" button
    const changePlanBtn = storeCard.getByRole('button', { name: 'Change Plan' });
    await expect(changePlanBtn).toBeVisible({ timeout: 5_000 });
    await changePlanBtn.click();

    // ── 3. Dialog: select a lower tier to trigger DOWNGRADE ───────────
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('Change Store Plan')).toBeVisible();

    // Find a tier marked as "Downgrade" and click it
    const downgradeTier = dialog.locator('button[type="button"]').filter({
      has: page.locator('text=Downgrade'),
    }).first();

    // If no downgrade option visible, test user might be on STARTER already
    const hasDowngrade = await downgradeTier.isVisible({ timeout: 3_000 }).catch(() => false);
    if (!hasDowngrade) {
      test.skip(true, 'Test user is on lowest tier — no downgrade available');
      return;
    }

    await downgradeTier.click();

    // Verify downgrade preview badge appears
    await expect(dialog.locator('text=Downgrade — effective')).toBeVisible();

    // Click "Schedule Downgrade" button
    const scheduleBtn = dialog.getByRole('button', { name: 'Schedule Downgrade' });
    await expect(scheduleBtn).toBeEnabled();
    await scheduleBtn.click();

    // Wait for success toast
    await expect(page.locator('text=/scheduled/i')).toBeVisible({ timeout: 5_000 });

    // Dialog should close
    await expect(dialog).not.toBeVisible({ timeout: 3_000 });

    // ── 4. Verify pending downgrade banner appears ────────────────────
    await page.waitForLoadState('networkidle');

    // Re-locate the Store card after page refresh
    const refreshedCard = page.locator('[class*="border-l-4"]').filter({
      has: page.getByText('Store', { exact: true }),
    }).first();

    const pendingBanner = refreshedCard.locator('.bg-amber-50').filter({
      has: page.getByText('Changing to'),
    });
    await expect(pendingBanner).toBeVisible({ timeout: 5_000 });

    const cancelBtn = pendingBanner.getByRole('button', { name: 'Cancel Change' });
    await expect(cancelBtn).toBeVisible();

    // ── 5. Click "Cancel Change" ──────────────────────────────────────
    await cancelBtn.click();

    // ── 6. Verify banner disappears + success toast ───────────────────
    await expect(page.locator('text=Pending change canceled')).toBeVisible({ timeout: 5_000 });

    // Banner should disappear after refresh
    await page.waitForLoadState('networkidle');
    await expect(pendingBanner).not.toBeVisible({ timeout: 5_000 });
  });
});
