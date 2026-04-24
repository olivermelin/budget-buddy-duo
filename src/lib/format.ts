export const sek = (n: number, opts?: { signed?: boolean; decimals?: number }) => {
  const value = Math.round(n);
  const formatted = new Intl.NumberFormat("sv-SE", {
    style: "currency",
    currency: "SEK",
    maximumFractionDigits: opts?.decimals ?? 0,
    minimumFractionDigits: 0,
  }).format(Math.abs(value));
  if (opts?.signed) return (value >= 0 ? "+" : "−") + formatted;
  return value < 0 ? "−" + formatted : formatted;
};

export const pct = (n: number, decimals = 0) =>
  new Intl.NumberFormat("sv-SE", {
    style: "percent",
    maximumFractionDigits: decimals,
  }).format(n);

export const monthLabel = (d: Date) =>
  new Intl.DateTimeFormat("sv-SE", { month: "long", year: "numeric" }).format(d);

export const monthShort = (d: Date) =>
  new Intl.DateTimeFormat("sv-SE", { month: "short" }).format(d).replace(".", "");

export const dateLabel = (iso: string) =>
  new Intl.DateTimeFormat("sv-SE", { day: "numeric", month: "short" }).format(new Date(iso));

export const monthKey = (d: Date | string) => {
  const date = typeof d === "string" ? new Date(d) : d;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
};
