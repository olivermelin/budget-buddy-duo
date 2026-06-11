// Supabase snake_case API response format

export const FAKE_ACCESS_TOKEN =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' +
  'eyJzdWIiOiJlMmUtdXNlci1pZCIsImVtYWlsIjoidGVzdEBidWRnZXRidWRkeS50ZXN0IiwiZXhwIjo5OTk5OTk5OTk5LCJpYXQiOjEwMDAwMDAwMDAsImF1ZCI6ImF1dGhlbnRpY2F0ZWQiLCJyb2xlIjoiYXV0aGVudGljYXRlZCIsImlzcyI6InN1cGFiYXNlIn0.' +
  'fake-sig-for-e2e-tests';

export const FAKE_USER = {
  id: 'e2e-user-id',
  aud: 'authenticated',
  role: 'authenticated',
  email: 'test@budgetbuddy.test',
  email_confirmed_at: '2024-01-01T00:00:00Z',
  app_metadata: { provider: 'google', providers: ['google'] },
  user_metadata: { full_name: 'Alice', name: 'Alice' },
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
};

export const FAKE_SESSION = {
  access_token: FAKE_ACCESS_TOKEN,
  token_type: 'bearer' as const,
  expires_in: 3600,
  expires_at: 9999999999,
  refresh_token: 'fake-e2e-refresh-token',
  user: FAKE_USER,
};

export const HOUSEHOLD = {
  id: 'hh-e2e-test',
  name: 'Teststugan',
  pay_day: 25,
};

// Used by AuthContext.fetchHouseholds (user_id filter + join)
export const HOUSEHOLD_MEMBERS_LIST = [
  { household_id: 'hh-e2e-test', households: { name: 'Teststugan' } },
];

// Used by loadHouseholdData (household_id filter)
export const MEMBERS = [
  { user_id: 'e2e-user-id',  display_name: 'Alice', person_color: '#4f46e5', income_monthly: 45000 },
  { user_id: 'e2e-user-bob', display_name: 'Bob',   person_color: '#ec4899', income_monthly: 55000 },
];

export const CATEGORIES = [
  { id: 'cat-mat',      name: 'Mat',      icon: '🛒', color: '142 76% 36%', budget_monthly: 8000,  is_fixed: false, is_income: false, sort_order: 1, household_id: 'hh-e2e-test' },
  { id: 'cat-boende',   name: 'Boende',   icon: '🏠', color: '199 89% 48%', budget_monthly: 15000, is_fixed: true,  is_income: false, sort_order: 2, household_id: 'hh-e2e-test' },
  { id: 'cat-transport',name: 'Transport',icon: '🚗', color: '30 95% 53%',  budget_monthly: 3000,  is_fixed: false, is_income: false, sort_order: 3, household_id: 'hh-e2e-test' },
  { id: 'cat-noje',     name: 'Nöje',     icon: '🎉', color: '280 87% 65%', budget_monthly: 2000,  is_fixed: false, is_income: false, sort_order: 4, household_id: 'hh-e2e-test' },
];

export const TRANSACTIONS = [
  { id: 'tx-1', date: '2026-06-08', amount: 600,  type: 'expense', category_id: 'cat-noje',      payer_user_id: 'e2e-user-bob', description: 'Restaurang', is_recurring: false, is_private: false, owner_user_id: null, settlement_receiver_user_id: null, household_id: 'hh-e2e-test' },
  { id: 'tx-2', date: '2026-06-05', amount: 1200, type: 'expense', category_id: 'cat-transport', payer_user_id: 'e2e-user-id',  description: 'SL-kort',   is_recurring: false, is_private: false, owner_user_id: null, settlement_receiver_user_id: null, household_id: 'hh-e2e-test' },
  { id: 'tx-3', date: '2026-06-03', amount: 240,  type: 'expense', category_id: 'cat-mat',       payer_user_id: 'e2e-user-bob', description: 'Willys',    is_recurring: false, is_private: false, owner_user_id: null, settlement_receiver_user_id: null, household_id: 'hh-e2e-test' },
  { id: 'tx-4', date: '2026-06-01', amount: 850,  type: 'expense', category_id: 'cat-mat',       payer_user_id: 'e2e-user-id',  description: 'ICA Maxi',  is_recurring: false, is_private: false, owner_user_id: null, settlement_receiver_user_id: null, household_id: 'hh-e2e-test' },
];

export const LOANS = [
  {
    id: 'loan-1',
    name: 'Bostadslån',
    type: 'mortgage',
    lender: 'Swedbank',
    original_amount: 3000000,
    current_balance: 2750000,
    interest_rate: 4.5,
    monthly_payment: 15000,
    monthly_amortization: 5000,
    monthly_fee: 0,
    down_payment: 750000,
    start_date: '2020-01-01',
    end_date: null,
    rate_fixed_until: '2027-01-01',
    owner_user_id: null,
    owner_share: 100,
    icon: '🏠',
    last_generated_month: null,
    household_id: 'hh-e2e-test',
    loan_payments: [],
  },
];
