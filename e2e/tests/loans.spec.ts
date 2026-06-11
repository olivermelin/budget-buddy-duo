import { test, expect } from '../support/base';

test.describe('Lån', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/loans');
    await expect(page.getByRole('heading', { name: 'Lån & skulder' })).toBeVisible({ timeout: 10_000 });
  });

  test('visar Bostadslån från fixturdata', async ({ page }) => {
    await expect(page.getByText('Bostadslån')).toBeVisible();
    await expect(page.getByText('Swedbank')).toBeVisible();
  });

  test('visar räntesats och låntyp', async ({ page }) => {
    // Fixture: interest_rate=4.5 → shown as "4.5% ränta" chip
    await expect(page.getByText(/4[.,]5%\s*ränta/)).toBeVisible();
    // Lender shown as "Bolån · Swedbank"
    await expect(page.getByText(/Swedbank/)).toBeVisible();
  });

  test('öppnar simulera-fliken', async ({ page }) => {
    await page.getByRole('tab', { name: /Simulera/i }).click();
    await expect(page.getByText(/amorteringssimulator/i).first()).toBeVisible({ timeout: 5_000 });
  });
});
