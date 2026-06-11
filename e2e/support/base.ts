import { test as base, expect } from '@playwright/test';
import { setupMockApi } from './mock-api';

// Overrides the `page` fixture to always set up auth + mocked Supabase API
export const test = base.extend({
  page: async ({ page }, use) => {
    await setupMockApi(page);
    await use(page);
  },
});

export { expect };
