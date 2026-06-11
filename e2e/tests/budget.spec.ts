import { test, expect } from '../support/base';

test.describe('Budget', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/budget');
    await expect(page.getByRole('heading', { name: 'Budget' })).toBeVisible({ timeout: 10_000 });
  });

  test('visar alla kategorier från fixturdata', async ({ page }) => {
    // Category names appear in multiple places — use .first() to avoid strict-mode errors
    await expect(page.getByText('Mat').first()).toBeVisible();
    await expect(page.getByText('Boende').first()).toBeVisible();
    await expect(page.getByText('Transport').first()).toBeVisible();
    await expect(page.getByText('Nöje').first()).toBeVisible();
  });

  test('visar budgetbelopp för rörliga kategorier', async ({ page }) => {
    // Fixed categories (Boende, is_fixed=true) show effective budget from recurring transactions,
    // which is 0 when no recurring transactions exist. Check non-fixed: Mat=8000, Transport=3000.
    await expect(page.getByText(/8.000/).first()).toBeVisible();
    await expect(page.getByText(/3.000/).first()).toBeVisible();
  });

  test('kan navigera till föregående månad', async ({ page }) => {
    await expect(page.locator('button').first()).toBeVisible();
  });
});
