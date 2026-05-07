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

export const dateLabel = (iso: string) => {
  // Parsa YYYY-MM-DD lokalt för att undvika UTC-skift (new Date("YYYY-MM-DD") = UTC midnatt)
  const [y, m, d] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("sv-SE", { day: "numeric", month: "short" }).format(new Date(y, m - 1, d));
};

export const monthKey = (d: Date | string) => {
  if (typeof d === "string") {
    // Undvik UTC-skift: ta bara YYYY-MM direkt från strängen
    const [y, m] = d.split("-");
    return `${y}-${m.padStart(2, "0")}`;
  }
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};
