import type { Page } from '@playwright/test';
import {
  FAKE_SESSION, FAKE_USER,
  HOUSEHOLD, HOUSEHOLD_MEMBERS_LIST, MEMBERS,
  CATEGORIES, TRANSACTIONS, LOANS,
} from './fixtures';

export async function setupMockApi(page: Page): Promise<void> {
  const ref = process.env.SUPABASE_PROJECT_REF ?? 'local';

  // Inject a valid-looking session into localStorage before app scripts run.
  // The Supabase SDK reads this on startup — no network call needed for auth.
  await page.addInitScript(
    ({ key, session }) => { window.localStorage.setItem(key, JSON.stringify(session)); },
    { key: `sb-${ref}-auth-token`, session: FAKE_SESSION },
  );

  // Intercept auth endpoints (token refresh, user lookup)
  await page.route('**/auth/v1/**', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({ json: FAKE_USER });
    } else {
      await route.fulfill({ status: 200, json: FAKE_SESSION });
    }
  });

  // Intercept all PostgREST REST calls
  await page.route('**/rest/v1/**', async (route) => {
    const req   = route.request();
    const method = req.method();
    const url   = new URL(req.url());
    const table = url.pathname.split('/rest/v1/')[1] ?? '';
    const isSingle = (req.headers()['accept'] ?? '').includes('pgrst.object');

    // Write operations: return success so optimistic updates aren't rolled back
    if (['POST', 'PATCH', 'DELETE'].includes(method)) {
      const echo = method === 'POST' ? (req.postDataJSON() ?? {}) : {};
      await route.fulfill({ status: method === 'POST' ? 201 : 200, json: echo });
      return;
    }

    let data: unknown;
    switch (table) {
      case 'household_members':
        // fetchHouseholds (AuthContext) filters by user_id
        // loadHouseholdData filters by household_id
        data = url.searchParams.has('user_id') ? HOUSEHOLD_MEMBERS_LIST : MEMBERS;
        break;
      case 'households':
        data = isSingle ? HOUSEHOLD : [HOUSEHOLD];
        break;
      case 'categories':
        data = CATEGORIES;
        break;
      case 'transactions':
        data = TRANSACTIONS;
        break;
      case 'loans':
        data = LOANS;
        break;
      case 'savings_goals':
      case 'subscription_overrides':
      case 'recurring_transactions':
      case 'import_rules':
      case 'savings_contributions':
      case 'savings_snapshots':
      case 'loan_payments':
        data = [];
        break;
      default:
        data = [];
    }

    await route.fulfill({ json: data });
  });
}
