// Vesting engine — pure functions (GRANT-05/06).
// A schedule resolves to concrete "tranches" (date + % of the grant that vests then).
// Percentages must total 100. "Vested as of a date" = Σ tranche % with date ≤ that date.

export type Freq = "yearly" | "quarterly" | "monthly" | "weekly" | "daily";

export interface Cliff {
  years: number;
  months: number;
}

export interface NormalVesting {
  mode: "normal";
  cliff: Cliff;
  annualPercents: number[]; // one % per vesting year; must sum to 100
  freq: Freq; // how each year's % is subdivided
}

export interface AdvancedVesting {
  mode: "advanced";
  tranches: { date: string; percent: number }[]; // explicit ISO date + %
}

export type Vesting = NormalVesting | AdvancedVesting;

export interface Tranche {
  date: string; // yyyy-mm-dd
  percent: number;
}

export const FREQS: { value: Freq; label: string; perYear: number }[] = [
  { value: "yearly", label: "Yearly", perYear: 1 },
  { value: "quarterly", label: "Quarterly", perYear: 4 },
  { value: "monthly", label: "Monthly", perYear: 12 },
  { value: "weekly", label: "Weekly", perYear: 52 },
  { value: "daily", label: "Daily", perYear: 365 },
];
const perYear = (f: Freq) => FREQS.find((x) => x.value === f)?.perYear ?? 12;

// ---- date helpers (operate on yyyy-mm-dd strings) ----
function toDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}
function iso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function addMonths(s: string, months: number): string {
  const d = toDate(s);
  d.setMonth(d.getMonth() + months);
  return iso(d);
}
function addDays(s: string, days: number): string {
  const d = toDate(s);
  d.setDate(d.getDate() + days);
  return iso(d);
}

export function todayISO(): string {
  return iso(new Date());
}

export function sumPercents(v: Vesting): number {
  const arr =
    v.mode === "normal" ? v.annualPercents : v.tranches.map((t) => t.percent);
  const total = arr.reduce((a, b) => a + (Number(b) || 0), 0);
  return Math.round(total * 1000) / 1000;
}

export function isComplete(v: Vesting): boolean {
  return Math.abs(sumPercents(v) - 100) < 0.01;
}

// The cliff date = grant date + cliff (vesting begins after this).
export function cliffDate(v: NormalVesting, grantDate: string): string {
  return addMonths(grantDate, v.cliff.years * 12 + v.cliff.months);
}

export function generateTranches(v: Vesting, grantDate: string): Tranche[] {
  if (v.mode === "advanced") {
    return v.tranches
      .filter((t) => t.date)
      .map((t) => ({ date: t.date, percent: Number(t.percent) || 0 }))
      .sort((a, b) => (a.date < b.date ? -1 : 1));
  }
  const start = cliffDate(v, grantDate);
  const n = perYear(v.freq);
  const out: Tranche[] = [];
  v.annualPercents.forEach((yearPct, i) => {
    const yearStart = addMonths(start, i * 12);
    for (let j = 1; j <= n; j++) {
      let date: string;
      if (v.freq === "yearly") date = addMonths(yearStart, 12);
      else if (v.freq === "quarterly") date = addMonths(yearStart, 3 * j);
      else if (v.freq === "monthly") date = addMonths(yearStart, j);
      else if (v.freq === "weekly") date = addDays(yearStart, 7 * j);
      else date = addDays(yearStart, j); // daily
      out.push({ date, percent: (Number(yearPct) || 0) / n });
    }
  });
  return out;
}

export function vestedFraction(
  v: Vesting,
  grantDate: string,
  asOf: string,
): number {
  const pct = generateTranches(v, grantDate)
    .filter((t) => t.date <= asOf)
    .reduce((a, t) => a + t.percent, 0);
  return Math.max(0, Math.min(1, pct / 100));
}

export function vestedUnits(
  quantity: number,
  v: Vesting,
  grantDate: string,
  asOf: string,
): number {
  return Math.floor(quantity * vestedFraction(v, grantDate, asOf));
}

export function fullyVestedDate(v: Vesting, grantDate: string): string | null {
  const tr = generateTranches(v, grantDate);
  return tr.length ? tr[tr.length - 1].date : null;
}

// Sensible default when creating a grant: 1-year cliff, 4 × 25% yearly, monthly.
export function defaultVesting(): NormalVesting {
  return {
    mode: "normal",
    cliff: { years: 1, months: 0 },
    annualPercents: [25, 25, 25, 25],
    freq: "monthly",
  };
}

// Seed the Advanced editor from a Normal schedule: one tranche per vesting year.
export function annualSeed(
  v: NormalVesting,
  grantDate: string,
): { date: string; percent: number }[] {
  const start = cliffDate(v, grantDate);
  return v.annualPercents.map((pct, i) => ({
    date: addMonths(start, (i + 1) * 12),
    percent: pct,
  }));
}

// Fill a per-year list evenly with `pct` until it reaches 100 (last row = remainder).
export function evenSplit(pct: number): number[] {
  const p = Math.max(0.01, Math.min(100, Number(pct) || 0));
  const out: number[] = [];
  let remaining = 100;
  while (remaining > 0.001 && out.length < 100) {
    const step = Math.min(p, remaining);
    out.push(Math.round(step * 100) / 100);
    remaining = Math.round((remaining - step) * 100) / 100;
  }
  return out;
}
