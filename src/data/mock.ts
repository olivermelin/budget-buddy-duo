import { AppState, Category, Person, Transaction, SavingsGoal } from "@/types/budget";

const uid = () => Math.random().toString(36).slice(2, 10);

export const defaultCategories: Category[] = [
  { id: "mat", name: "Mat", icon: "🛒", color: "158 64% 42%", budget: 6500 },
  { id: "boende", name: "Boende", icon: "🏠", color: "222 60% 35%", budget: 14500, isFixed: true },
  { id: "transport", name: "Transport", icon: "🚗", color: "38 92% 50%", budget: 3500 },
  { id: "noje", name: "Nöje", icon: "🎬", color: "280 65% 55%", budget: 2500 },
  { id: "shopping", name: "Shopping", icon: "🛍️", color: "330 75% 55%", budget: 2500 },
  { id: "abonnemang", name: "Abonnemang", icon: "📱", color: "200 80% 45%", budget: 1200, isFixed: true },
  { id: "resor", name: "Resor", icon: "✈️", color: "190 75% 45%", budget: 2000 },
  { id: "ovrigt", name: "Övrigt", icon: "✨", color: "215 16% 47%", budget: 1500 },
];

export const defaultPersons: Person[] = [
  { id: "p1", name: "Alex", color: "222 60% 45%", income: 38000 },
  { id: "p2", name: "Sara", color: "330 70% 55%", income: 34000 },
];

const between = (min: number, max: number) => Math.round(min + Math.random() * (max - min));

const recurring = [
  { desc: "Spotify Family", amount: 199, cat: "abonnemang", payer: "p1", day: 5 },
  { desc: "Netflix", amount: 149, cat: "abonnemang", payer: "p2", day: 12 },
  { desc: "SATS Gym", amount: 549, cat: "abonnemang", payer: "p1", day: 1 },
  { desc: "Mobil – Telia", amount: 299, cat: "abonnemang", payer: "p2", day: 20 },
  { desc: "Hyra", amount: 12500, cat: "boende", payer: "p1", day: 28 },
  { desc: "El & värme", amount: 1200, cat: "boende", payer: "p2", day: 25 },
  { desc: "Hemförsäkring", amount: 295, cat: "boende", payer: "p1", day: 15 },
];

const variableTemplates: Array<{ desc: string; cat: string; min: number; max: number }> = [
  { desc: "ICA Maxi", cat: "mat", min: 380, max: 1450 },
  { desc: "Coop", cat: "mat", min: 220, max: 850 },
  { desc: "Lidl", cat: "mat", min: 180, max: 600 },
  { desc: "Foodora", cat: "mat", min: 220, max: 480 },
  { desc: "SL Reskassa", cat: "transport", min: 320, max: 940 },
  { desc: "Bensin Circle K", cat: "transport", min: 450, max: 880 },
  { desc: "Taxi", cat: "transport", min: 180, max: 420 },
  { desc: "Bio", cat: "noje", min: 140, max: 320 },
  { desc: "Restaurang", cat: "noje", min: 320, max: 1200 },
  { desc: "Bar", cat: "noje", min: 280, max: 850 },
  { desc: "H&M", cat: "shopping", min: 250, max: 1400 },
  { desc: "Zalando", cat: "shopping", min: 380, max: 1800 },
  { desc: "Apoteket", cat: "ovrigt", min: 95, max: 480 },
  { desc: "Klippning", cat: "ovrigt", min: 350, max: 750 },
  { desc: "Hotell weekend", cat: "resor", min: 1800, max: 3600 },
  { desc: "Flygbiljett", cat: "resor", min: 1200, max: 2800 },
];

export const generateMockTransactions = (): Transaction[] => {
  const tx: Transaction[] = [];
  const today = new Date();

  for (let monthOffset = 3; monthOffset >= 0; monthOffset--) {
    const base = new Date(today.getFullYear(), today.getMonth() - monthOffset, 1);
    const year = base.getFullYear();
    const month = base.getMonth();
    const isCurrent = monthOffset === 0;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const lastDay = isCurrent ? today.getDate() : daysInMonth;

    // Income for both
    tx.push({
      id: uid(), date: new Date(year, month, 25).toISOString(),
      amount: 38000, type: "income", categoryId: "ovrigt", payerId: "p1",
      description: "Lön Alex",
    });
    tx.push({
      id: uid(), date: new Date(year, month, 25).toISOString(),
      amount: 34000, type: "income", categoryId: "ovrigt", payerId: "p2",
      description: "Lön Sara",
    });

    // Recurring
    for (const r of recurring) {
      if (r.day > lastDay) continue;
      tx.push({
        id: uid(), date: new Date(year, month, r.day).toISOString(),
        amount: r.amount, type: "expense", categoryId: r.cat, payerId: r.payer,
        description: r.desc,
      });
    }

    // Variable
    const variableCount = isCurrent ? Math.max(8, Math.floor(lastDay * 0.7)) : between(28, 38);
    for (let i = 0; i < variableCount; i++) {
      const t = variableTemplates[Math.floor(Math.random() * variableTemplates.length)];
      const day = between(1, lastDay);
      tx.push({
        id: uid(), date: new Date(year, month, day).toISOString(),
        amount: between(t.min, t.max), type: "expense",
        categoryId: t.cat, payerId: Math.random() > 0.5 ? "p1" : "p2",
        description: t.desc,
      });
    }
  }
  return tx.sort((a, b) => b.date.localeCompare(a.date));
};

export const defaultGoals: SavingsGoal[] = [
  {
    id: uid(), name: "Resa till Japan", icon: "🗾",
    target: 60000, saved: 43200,
    targetDate: new Date(new Date().getFullYear() + 1, 5, 1).toISOString(),
    contributions: [
      { id: uid(), date: new Date(Date.now() - 90 * 86400000).toISOString(), amount: 12000, personId: "p1" },
      { id: uid(), date: new Date(Date.now() - 60 * 86400000).toISOString(), amount: 10000, personId: "p2" },
      { id: uid(), date: new Date(Date.now() - 30 * 86400000).toISOString(), amount: 11200, personId: "p1" },
      { id: uid(), date: new Date(Date.now() - 5 * 86400000).toISOString(), amount: 10000, personId: "p2" },
    ],
    snapshots: [],
  },
  {
    id: uid(), name: "Buffert", icon: "🛡️",
    target: 100000, saved: 64500,
    contributions: [
      { id: uid(), date: new Date(Date.now() - 120 * 86400000).toISOString(), amount: 20000, personId: "p1" },
      { id: uid(), date: new Date(Date.now() - 60 * 86400000).toISOString(), amount: 22000, personId: "p2" },
      { id: uid(), date: new Date(Date.now() - 20 * 86400000).toISOString(), amount: 22500, personId: "p1" },
    ],
    snapshots: [],
  },
  {
    id: uid(), name: "Renovering kök", icon: "🔨",
    target: 80000, saved: 18000,
    targetDate: new Date(new Date().getFullYear() + 2, 0, 1).toISOString(),
    contributions: [
      { id: uid(), date: new Date(Date.now() - 45 * 86400000).toISOString(), amount: 8000, personId: "p2" },
      { id: uid(), date: new Date(Date.now() - 10 * 86400000).toISOString(), amount: 10000, personId: "p1" },
    ],
    snapshots: [],
  },
];

export const initialState: AppState = {
  settings: { householdName: "Hushållet", splitMode: "50/50", theme: "system" },
  persons: defaultPersons,
  categories: defaultCategories,
  transactions: generateMockTransactions(),
  goals: defaultGoals,
  subscriptionOverrides: {},
};
