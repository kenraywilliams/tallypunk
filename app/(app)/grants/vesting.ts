// Vesting engine — pure functions (GRANT-05/06/08).
// Model: a grant vests over N years (N = number of schedule rows), one % per year
// summing to 100. Vesting is a STEP function resolved to concrete "tranches"
// (date + % that vests then). A cliff GATES payout: nothing vests until the cliff
// date, and on that date everything earned up to then vests at once (the "boom"),
// after which it steps at the chosen frequency. "Vested as of a date" = Σ tranche %
// with date ≤ that date.

export type Freq = "yearly" | "quarterly" | "monthly" | "weekly" | "daily";

export interface Cliff {
  years: number;
  months: number;
}

export interface NormalVesting {
  mode: "normal";
  cliff: Cliff; // payout gate + catch-up boom; must be ≤ the vesting period
  annualPercents: number[]; // one % per vesting year (Year 1..N); must sum to 100
  freq: Freq; // how each year's % is subdivided into steps
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
function stepDate(s: string, freq: Freq): string {
  if (freq === "yearly") return addMonths(s, 12);
  if (freq === "quarterly") return addMonths(s, 3);
  if (freq === "monthly") return addMonths(s, 1);
  if (freq === "weekly") return addDays(s, 7);
  return addDays(s, 1);
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

// The cliff date = grant date + cliff. Payout is gated until this date.
export function cliffDate(v: NormalVesting, grantDate: string): string {
  return addMonths(grantDate, v.cliff.years * 12 + v.cliff.months);
}

// Continuous "earned" % by `asOf` (ignores the cliff gate): the schedule laid
// linearly across [grantDate, grantDate + N years], each year contributing its
// annual %. Used only to size the discrete tranches below.
function accruedPct(
  annualPercents: number[],
  grantDate: string,
  asOf: string,
): number {
  const N = annualPercents.length;
  if (N === 0) return 0;
  const total = annualPercents.reduce((a, b) => a + (Number(b) || 0), 0);
  const g = toDate(grantDate).getTime();
  const end = toDate(addMonths(grantDate, N * 12)).getTime();
  const t = toDate(asOf).getTime();
  if (t <= g || end <= g) return 0;
  if (t >= end) return total;
  const ye = ((t - g) / (end - g)) * N;
  const f = Math.min(N - 1, Math.floor(ye));
  const frac = ye - f;
  let before = 0;
  for (let k = 0; k < f; k++) before += Number(annualPercents[k]) || 0;
  return before + frac * (Number(annualPercents[f]) || 0);
}

// Concrete step tranches: a catch-up "boom" at the cliff date (everything earned
// up to then), then one tranche per frequency step until the period end.
export function generateTranches(v: Vesting, grantDate: string): Tranche[] {
  if (v.mode === "advanced") {
    return v.tranches
      .filter((t) => t.date)
      .map((t) => ({ date: t.date, percent: Number(t.percent) || 0 }))
      .sort((a, b) => (a.date < b.date ? -1 : 1));
  }
  const N = v.annualPercents.length;
  if (N === 0) return [];
  const cliffIso = cliffDate(v, grantDate);
  const endIso = addMonths(grantDate, N * 12);
  const endMs = toDate(endIso).getTime();
  const out: Tranche[] = [];

  const boom = accruedPct(v.annualPercents, grantDate, cliffIso);
  if (boom > 1e-7) out.push({ date: cliffIso, percent: boom });

  let prevAcc = boom;
  let cur = cliffIso;
  let guard = 0;
  while (guard++ < 20000) {
    cur = stepDate(cur, v.freq);
    const stop = toDate(cur).getTime() >= endMs;
    const d = stop ? endIso : cur;
    const acc = accruedPct(v.annualPercents, grantDate, d);
    const inc = acc - prevAcc;
    if (inc > 1e-7) out.push({ date: d, percent: inc });
    prevAcc = acc;
    if (stop) break;
  }
  return out;
}

// Cumulative fraction (0..1) vested by `asOf` — the STEP model: Σ tranche % ≤ asOf.
export function vestedFraction(
  v: Vesting,
  grantDate: string,
  asOf: string,
): number {
  const tr = generateTranches(v, grantDate);
  const pct = tr
    .filter((t) => t.date <= asOf)
    .reduce((a, t) => a + (Number(t.percent) || 0), 0);
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
  if (v.mode === "advanced") {
    const ds = v.tranches
      .filter((t) => t.date)
      .map((t) => t.date)
      .sort();
    return ds.length ? ds[ds.length - 1] : null;
  }
  if (v.annualPercents.length === 0) return null;
  return addMonths(grantDate, v.annualPercents.length * 12);
}

// Default when creating a grant: 4-year period, 1-year cliff, even 25% per year,
// monthly steps. At the 1-year cliff, 25% booms; then monthly to 100%.
export function defaultVesting(): NormalVesting {
  return {
    mode: "normal",
    cliff: { years: 1, months: 0 },
    annualPercents: [25, 25, 25, 25],
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

// Seed the Advanced editor from a Normal schedule: one tranche per vesting year
// (end of each year from the grant date), carrying that year's %.
export function annualSeed(
  v: NormalVesting,
  grantDate: string,
): { date: string; percent: number }[] {
  return v.annualPercents.map((pct, i) => ({
    date: addMonths(grantDate, (i + 1) * 12),
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
