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

// Lifecycle events (GRANT-16/17) — layered ON TOP of the schedule as a
// transform of the generated tranches; the base engine stays untouched.
// Rules (locked in the tracker):
// - Terminate: tranches strictly BEFORE the date keep; a tranche exactly ON
//   the termination date does NOT vest (exclusive). Reversible.
// - Pause with an end: every tranche on/after pauseStart is delayed by the
//   pause length ("shift the tail") — still reaches 100%, just later.
// - Pause without an end: suspended — flat from pauseStart, resumable.
// - Pause and Terminate may coexist (decision 3 Jul 2026): pause shifts
//   first, then the termination cut applies to the shifted dates.
export interface Lifecycle {
  terminationDate?: string | null;
  pauseStart?: string | null;
  pauseEnd?: string | null;
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

function daysBetween(a: string, b: string): number {
  return Math.round((toDate(b).getTime() - toDate(a).getTime()) / 86400000);
}

// Apply pause (shift/suspend) then termination (cut) to generated tranches.
export function applyLifecycle(
  tranches: Tranche[],
  lc?: Lifecycle | null,
): Tranche[] {
  if (!lc) return tranches;
  let out = tranches;
  const ps = lc.pauseStart || null;
  const pe = lc.pauseEnd || null;
  if (ps) {
    if (pe && pe >= ps) {
      const shift = daysBetween(ps, pe);
      if (shift > 0)
        out = out.map((t) =>
          t.date >= ps ? { ...t, date: addDays(t.date, shift) } : t,
        );
    } else if (!pe) {
      // open-ended pause: everything from the start is suspended (resumable)
      out = out.filter((t) => t.date < ps);
    }
    // pe < ps is invalid — the UI blocks it; the engine ignores the pause
  }
  const td = lc.terminationDate || null;
  if (td) out = out.filter((t) => t.date < td); // exclusive termination day
  return out;
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

// Cliff date after the pause shift (GRANT-17): a pause starting on/before the
// cliff delays it by the pause length (the boom tranche shifts identically in
// applyLifecycle, so marker and step stay glued). Open-ended pause before the
// cliff → null (no date until resumed). Termination doesn't move the cliff.
export function effectiveCliffDate(
  v: NormalVesting,
  grantDate: string,
  lc?: Lifecycle | null,
): string | null {
  const base = cliffDate(v, grantDate);
  const ps = lc?.pauseStart || null;
  if (!ps || base < ps) return base;
  const pe = lc?.pauseEnd || null;
  if (!pe) return null;
  if (pe < ps) return base; // invalid pause — engine ignores it too
  return addDays(base, daysBetween(ps, pe));
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
// Pass `lc` to get the EFFECTIVE tranches after terminate/pause (GRANT-16/17).
export function generateTranches(
  v: Vesting,
  grantDate: string,
  lc?: Lifecycle | null,
): Tranche[] {
  if (v.mode === "advanced") {
    return applyLifecycle(
      v.tranches
        .filter((t) => t.date)
        .map((t) => ({ date: t.date, percent: Number(t.percent) || 0 }))
        .sort((a, b) => (a.date < b.date ? -1 : 1)),
      lc,
    );
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
  return applyLifecycle(out, lc);
}

// Cumulative fraction (0..1) vested by `asOf` — the STEP model: Σ tranche % ≤ asOf.
export function vestedFraction(
  v: Vesting,
  grantDate: string,
  asOf: string,
  lc?: Lifecycle | null,
): number {
  const tr = generateTranches(v, grantDate, lc);
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
  lc?: Lifecycle | null,
): number {
  return Math.floor(quantity * vestedFraction(v, grantDate, asOf, lc));
}

// Fraction (0..1) that will EVER vest given the lifecycle — <1 when terminated
// early (the rest is forfeited); 0 for an open-ended pause that started
// pre-cliff... i.e. Σ of all effective tranches.
export function lifetimeVestedFraction(
  v: Vesting,
  grantDate: string,
  lc?: Lifecycle | null,
): number {
  const pct = generateTranches(v, grantDate, lc).reduce(
    (a, t) => a + (Number(t.percent) || 0),
    0,
  );
  return Math.max(0, Math.min(1, pct / 100));
}

// Units a grant still RESERVES in its pool (GRANT-16 pool side-effects):
// terminated → only what actually vests (the forfeited rest returns to the
// pool); paused or active → the full quantity stays reserved.
export function reservedUnits(
  quantity: number,
  v: Vesting,
  grantDate: string,
  lc?: Lifecycle | null,
): number {
  if (!lc?.terminationDate) return quantity || 0;
  return Math.floor((quantity || 0) * lifetimeVestedFraction(v, grantDate, lc));
}

// Scheduled full-vest date. Applies the PAUSE delay (a shifted tail pushes
// this out; an open-ended pause → null "suspended") but NOT termination —
// a terminated grant never completes, which the UI states explicitly.
export function fullyVestedDate(
  v: Vesting,
  grantDate: string,
  lc?: Lifecycle | null,
): string | null {
  const pauseOnly: Lifecycle | undefined = lc?.pauseStart
    ? { pauseStart: lc.pauseStart, pauseEnd: lc.pauseEnd }
    : undefined;
  if (pauseOnly?.pauseStart && !pauseOnly.pauseEnd) {
    // open-ended pause: if the pause began before the schedule finished,
    // there is no completion date until it's resumed
    const base = fullyVestedDate(v, grantDate);
    if (base != null && pauseOnly.pauseStart <= base) return null;
  }
  const tr = generateTranches(v, grantDate, pauseOnly);
  return tr.length ? tr[tr.length - 1].date : null;
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
