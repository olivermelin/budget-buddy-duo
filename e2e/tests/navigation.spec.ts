import { test, expect } from '../support/base';

test.describe('Navigering', () => {
  test('Dashboard laddar och visar hälsning', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /Hej Alice/i })).toBeVisible({ timeout: 10_000 });
  });

  test('Budget-sidan laddar', async ({ page }) => {
    await page.goto('/budget');
    await expect(page.getByRole('heading', { name: 'Budget' })).toBeVisible({ timeout: 10_000 });
  });

  test('Lån-sidan laddar', async ({ page }) => {
    await page.goto('/loans');
    await expect(page.getByRole('heading', { name: 'Lån & skulder' })).toBeVisible({ timeout: 10_000 });
  });

  test('Transaktioner-sidan laddar och visar fixturdata', async ({ page }) => {
    await page.goto('/transactions');
    await expect(page.getByText('ICA Maxi')).toBeVisible({ timeout: 10_000 });
  });
});
