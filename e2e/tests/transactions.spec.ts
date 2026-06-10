import { test, expect } from '../support/base';

test.describe('Transaktioner', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/transactions');
    await expect(page.getByText('ICA Maxi')).toBeVisible({ timeout: 10_000 });
  });

  test('visar alla inlästa transaktioner', async ({ page }) => {
    await expect(page.getByText('ICA Maxi')).toBeVisible();
    await expect(page.getByText('SL-kort')).toBeVisible();
    await expect(page.getByText('Willys')).toBeVisible();
    await expect(page.getByText('Restaurang')).toBeVisible();
  });

  test('öppnar dialog för ny transaktion', async ({ page }) => {
    // Two "Ny" buttons exist (desktop header + mobile fab) — target the exact one
    await page.getByRole('button', { name: 'Ny', exact: true }).first().click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });
  });

  test('kan stänga ny-transaktion-dialogen', async ({ page }) => {
    await page.getByRole('button', { name: 'Ny', exact: true }).first().click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 5_000 });
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible({ timeout: 5_000 });
  });
});
