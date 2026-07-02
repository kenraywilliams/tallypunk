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

// Cumulative % vested by `asOf` for a normal schedule. The vesting spans
// [cliffDate, grantDate + period], where period = cliff.years + rows; the per-year
// percentages are laid across that span (so cliff months shorten the vesting, not
// extend it). Piecewise-linear between row boundaries.
function cumNormal(v: NormalVesting, grantDate: string, asOf: string): number {
  const N = v.annualPercents.length;
  if (N === 0) return 0;
  const total = v.annualPercents.reduce((a, b) => a + (Number(b) || 0), 0);
  const cliffMonths = v.cliff.years * 12 + v.cliff.months;
  const startMs = toDate(addMonths(grantDate, cliffMonths)).getTime();
  const endMs = toDate(addMonths(grantDate, (v.cliff.years + N) * 12)).getTime();
  const asOfMs = toDate(asOf).getTime();
  if (endMs <= startMs || asOfMs <= startMs) return 0;
  if (asOfMs >= endMs) return total;
  const rowFloat = ((asOfMs - startMs) / (endMs - startMs)) * N;
  const i = Math.min(N - 1, Math.floor(rowFloat));
  const within = rowFloat - i;
  let before = 0;
  for (let k = 0; k < i; k++) before += Number(v.annualPercents[k]) || 0;
  return before + within * (Number(v.annualPercents[i]) || 0);
}

// Concrete tranches at the chosen frequency across [cliffDate, grantDate + period].
export function generateTranches(v: Vesting, grantDate: string): Tranche[] {
  if (v.mode === "advanced") {
    return v.tranches
      .filter((t) => t.date)
      .map((t) => ({ date: t.date, percent: Number(t.percent) || 0 }))
      .sort((a, b) => (a.date < b.date ? -1 : 1));
  }
  const N = v.annualPercents.length;
  if (N === 0) return [];
  const cliffMonths = v.cliff.years * 12 + v.cliff.months;
  const startIso = addMonths(grantDate, cliffMonths);
  const endIso = addMonths(grantDate, (v.cliff.years + N) * 12);
  const endMs = toDate(endIso).getTime();
  const out: Tranche[] = [];
  let cur = startIso;
  let prev = 0;
  let guard = 0;
  while (guard++ < 20000) {
    if (v.freq === "yearly") cur = addMonths(cur, 12);
    else if (v.freq === "quarterly") cur = addMonths(cur, 3);
    else if (v.freq === "monthly") cur = addMonths(cur, 1);
    else if (v.freq === "weekly") cur = addDays(cur, 7);
    else cur = addDays(cur, 1);
    const stop = toDate(cur).getTime() >= endMs;
    const d = stop ? endIso : cur;
    const c = cumNormal(v, grantDate, d);
    out.push({ date: d, percent: c - prev });
    prev = c;
    if (stop) break;
  }
  return out;
}

export function vestedFraction(
  v: Vesting,
  grantDate: string,
  asOf: string,
): number {
  if (v.mode === "advanced") {
    const pct = v.tranches
      .filter((t) => t.date && t.date <= asOf)
      .reduce((a, t) => a + (Number(t.percent) || 0), 0);
    return Math.max(0, Math.min(1, pct / 100));
  }
  return Math.max(0, Math.min(1, cumNormal(v, grantDate, asOf) / 100));
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
  if (v.mode === "advanced") {
    const ds = v.tranches
      .filter((t) => t.date)
      .map((t) => t.date)
      .sort();
    return ds.length ? ds[ds.length - 1] : null;
  }
  if (v.annualPercents.length === 0) return null;
  return addMonths(grantDate, (v.cliff.years + v.annualPercents.length) * 12);
}

// Default when creating a grant: 4-year period, 1-year cliff (year 1 = 0%),
// then 20 / 30 / 50 across years 2–4. Total 100%.
export function defaultVesting(): NormalVesting {
  return {
    mode: "normal",
    cliff: { years: 1, months: 0 },
    annualPercents: [20, 30, 50],
    freq: "monthly",
  };
}

// `count` per-year percentages that sum to exactly 100 (last row absorbs rounding).
export function evenPercents(count: number): number[] {
  const n = Math.max(1, Math.floor(count));
  const base = Math.floor(10000 / n) / 100; // 2-dp floor of 100/n
  const out = new Array(n).fill(base);
  const used = Math.round(base * n * 100) / 100;
  out[n - 1] = Math.round((out[n - 1] + (100 - used)) * 100) / 100;
  return out;
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
