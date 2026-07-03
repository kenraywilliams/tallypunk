"use client";

import { useParams } from "next/navigation";
import { useSandbox } from "../../../SandboxProvider";
import VestingChart, { type GrantSeries } from "../../../grants/VestingChart";
import {
  cliffDate,
  fullyVestedDate,
  generateTranches,
  todayISO,
  vestedUnits,
} from "../../../grants/vesting";

const DAY = 86400000;
const MONTH = 30 * DAY;
const toMs = (iso: string) => new Date(iso + "T00:00:00").getTime();

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div
        style={{
          fontSize: 11,
          textTransform: "uppercase",
          letterSpacing: ".05em",
          color: "var(--muted)",
          fontWeight: 700,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 20,
          fontWeight: 700,
          fontFamily: "var(--fh)",
          marginTop: 2,
        }}
      >
        {value}
      </div>
    </div>
  );
}

export default function StakeholderVestingPage() {
  const { id } = useParams<{ id: string }>();
  const { grantsForStakeholder } = useSandbox();
  const grants = grantsForStakeholder(id);

  if (grants.length === 0) {
    return (
      <div className="panel">
        <p className="muted-note">
          No grants yet — add one under the <strong>Grants</strong> tab and its
          vesting will chart here.
        </p>
      </div>
    );
  }

  const today = todayISO();
  const todayMs = toMs(today);
  const totalGranted = grants.reduce((s, g) => s + g.quantity, 0);
  const vestedToday = grants.reduce(
    (s, g) => s + vestedUnits(g.quantity, g.vesting, g.grantDate, today),
    0,
  );
  const unvested = Math.max(0, totalGranted - vestedToday);
  const pctToday =
    totalGranted > 0 ? Math.round((vestedToday / totalGranted) * 100) : 0;

  const meta = grants.map((g, i) => {
    const fv = fullyVestedDate(g.vesting, g.grantDate);
    return {
      grant: g,
      label: `Grant ${i + 1}`,
      grantMs: toMs(g.grantDate),
      cliffMs:
        g.vesting.mode === "normal"
          ? toMs(cliffDate(g.vesting, g.grantDate))
          : null,
      fullyMs: fv ? toMs(fv) : toMs(g.grantDate),
    };
  });

  const dataStart = Math.min(...meta.map((m) => m.grantMs));
  const dataEnd = Math.max(...meta.map((m) => m.fullyMs));
  const span = Math.max(dataEnd - dataStart, MONTH);
  const padX = Math.max(span * 0.1, MONTH);
  const xMin = dataStart - padX; // default (tight) view
  const xMax = dataEnd + padX;

  // Outer zoom-out limits: the flat 0 in the deep past / flat total in the far
  // future. Vesting is flat out here, so a sparse sample is enough.
  const outerPad = Math.max(span, 730 * DAY);
  const xLimMin = dataStart - outerPad;
  const xLimMax = dataEnd + outerPad;

  // Sample at the real vesting dates (steps) + grant/cliff/today + flat outer
  // tails. No uniform grid, so steps stay crisp at any zoom.
  const trancheData = grants.map((g) => {
    const tr = generateTranches(g.vesting, g.grantDate);
    let acc = 0;
    const pts = tr.map((t) => {
      acc += Number(t.percent) || 0;
      return { ms: toMs(t.date), cumPct: Math.min(100, Math.round(acc * 1e4) / 1e4) };
    });
    return { pts };
  });

  const set = new Set<number>([xLimMin, xMin, xMax, xLimMax, todayMs]);
  meta.forEach((m) => {
    set.add(m.grantMs);
    if (m.cliffMs != null) set.add(m.cliffMs);
    set.add(m.fullyMs);
  });
  trancheData.forEach((td) =>
    td.pts.forEach((p) => {
      if (p.ms >= xLimMin && p.ms <= xLimMax) set.add(p.ms);
    }),
  );
  const rawTimes = [...set]
    .filter((t) => t >= xLimMin && t <= xLimMax)
    .sort((a, b) => a - b);
  // Fill wide gaps with ~monthly hover points so the cursor always catches
  // something. These land on flat treads (value unchanged), so the steps are
  // untouched — they're purely extra tag targets.
  const MAX_GAP = 34 * DAY; // ≈ one month
  const NEAR_EVENT = 8 * DAY; // don't drop a catch-point right next to a real event
  const events: number[] = [];
  meta.forEach((m) => {
    events.push(m.grantMs);
    if (m.cliffMs != null) events.push(m.cliffMs);
  });
  const nearEvent = (t: number) => events.some((e) => Math.abs(e - t) < NEAR_EVENT);
  const times: number[] = [];
  for (let i = 0; i < rawTimes.length; i++) {
    times.push(rawTimes[i]);
    if (i < rawTimes.length - 1) {
      const a = rawTimes[i];
      const L = rawTimes[i + 1] - a;
      const n = Math.max(0, Math.ceil(L / MAX_GAP) - 1);
      for (let k = 1; k <= n; k++) {
        const t = Math.round(a + (L * k) / (n + 1));
        if (!nearEvent(t)) times.push(t); // never crowd a grant/cliff date
      }
    }
  }

  const series: GrantSeries[] = meta.map((m, i) => {
    const pts = trancheData[i].pts;
    const q = m.grant.quantity;
    const values: number[] = [];
    let j = 0;
    let cum = 0;
    for (const t of times) {
      while (j < pts.length && pts[j].ms <= t) {
        cum = pts[j].cumPct;
        j++;
      }
      values.push(Math.floor((q * cum) / 100 + 1e-6));
    }
    return {
      id: m.grant.id,
      label: m.label,
      quantity: q,
      grantMs: m.grantMs,
      cliffMs: m.cliffMs,
      fullyMs: m.fullyMs,
      values,
    };
  });

  return (
    <div className="panel">
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
          gap: 14,
          marginBottom: 18,
        }}
      >
        <Stat label="Total granted" value={totalGranted.toLocaleString()} />
        <Stat
          label="Vested today"
          value={`${vestedToday.toLocaleString()} · ${pctToday}%`}
        />
        <Stat label="Unvested" value={unvested.toLocaleString()} />
      </div>
      <VestingChart
        times={times}
        series={series}
        totalGranted={totalGranted}
        yMax={(totalGranted || 1) * 1.2}
        xMin={xMin}
        xMax={xMax}
        xLimMin={xLimMin}
        xLimMax={xLimMax}
        todayMs={todayMs}
      />
    </div>
  );
}
