"use client";

import { type MouseEvent as RMouse, useEffect, useRef, useState } from "react";

export interface GrantSeries {
  id: string;
  label: string; // "Grant 1"
  quantity: number;
  grantMs: number;
  cliffMs: number | null;
  fullyMs: number;
  values: number[]; // vested units, aligned to `times`
}

const W = 760;
const H = 360;
const padL = 60;
const padR = 18;
const padT = 20;
const padB = 60; // roomy gutter: markers live below the axis, then the year labels
const plotW = W - padL - padR;
const plotH = H - padT - padB;
const DAY = 86400000;
const MIN_XW = 14 * DAY; // tightest time window: two weeks
// marker gutter (below the plot): cliff/grant icons + their letters, above the x labels
const GUT = padT + plotH; // plot bottom — marker tips touch here
const M_APEX = GUT; // cliff snow tip / pen tip sit on the axis
const M_BASE = GUT + 12; // cliff base
const M_CLETTER = GUT + 21; // cliff letter (below the cliff icon)
const PEN_LEN = 18; // pen — longer than the cliff icon
const M_GLETTER = GUT + 31; // grant letter (below the pen, so it clears CX)

const COLORS = [
  "#8a4b6b",
  "#b3894e",
  "#3f7d7a",
  "#9a5a3c",
  "#5a5a9a",
  "#4e8a5f",
  "#a8506a",
  "#7a6b3f",
];

const PREF_KEY = "tallypunk-vchart-v1";
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
const fmtDay = (ms: number) => {
  const d = new Date(ms);
  return `${String(d.getDate()).padStart(2, "0")} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
};
const fmtNum = (n: number) => Math.round(n).toLocaleString();

// "nice" axis ticks across [min,max]
function niceNum(range: number, round: boolean): number {
  if (range <= 0) return 1;
  const exp = Math.floor(Math.log10(range));
  const frac = range / Math.pow(10, exp);
  let nf: number;
  if (round) nf = frac < 1.5 ? 1 : frac < 3 ? 2 : frac < 7 ? 5 : 10;
  else nf = frac <= 1 ? 1 : frac <= 2 ? 2 : frac <= 5 ? 5 : 10;
  return nf * Math.pow(10, exp);
}
function niceTicks(min: number, max: number, count: number) {
  const step = niceNum((max - min) / Math.max(1, count - 1), true);
  const start = Math.ceil(min / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= max + step * 0.5; v += step) ticks.push(v);
  return { ticks, step };
}
function fmtXTick(ms: number, spanDays: number): string {
  const d = new Date(ms);
  const dd = String(d.getDate()).padStart(2, "0");
  const mon = MONTHS[d.getMonth()];
  const y = d.getFullYear();
  if (spanDays < 70) return `${dd} ${mon}`;
  if (spanDays < 3 * 365) return `${mon} ${y}`;
  return String(y);
}

interface Prefs {
  sand: boolean;
  total: boolean;
  cliffs: boolean;
  dates: boolean;
  allSeries: boolean;
}
const DEFAULT_PREFS: Prefs = {
  sand: false,
  total: true,
  cliffs: true,
  dates: false,
  allSeries: true,
};

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        fontSize: 13,
        cursor: "pointer",
        color: "var(--ink)",
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      {label}
    </label>
  );
}

export default function VestingChart({
  times,
  series,
  totalGranted,
  yMax,
  xMin,
  xMax,
  xLimMin,
  xLimMax,
  todayMs,
}: {
  times: number[];
  series: GrantSeries[];
  totalGranted: number;
  yMax: number;
  xMin: number;
  xMax: number;
  xLimMin: number;
  xLimMax: number;
  todayMs: number;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const yCap = (totalGranted || 1) * 3;
  const minYW = Math.max(1, (totalGranted || 1) * 0.005);

  // Display prefs persist across navigation (Prev/Next) via localStorage.
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(PREF_KEY);
      if (raw) setPrefs({ ...DEFAULT_PREFS, ...JSON.parse(raw) });
    } catch {}
  }, []);
  const setPref = (patch: Partial<Prefs>) =>
    setPrefs((p) => {
      const n = { ...p, ...patch };
      try {
        localStorage.setItem(PREF_KEY, JSON.stringify(n));
      } catch {}
      return n;
    });

  // Per-grant visibility (resets per stakeholder; driven by "All series").
  const [hidden, setHidden] = useState<Set<string>>(() => new Set());
  const idsKey = series.map((s) => s.id).join("|");
  useEffect(() => {
    setHidden(prefs.allSeries ? new Set() : new Set(series.map((s) => s.id)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey]);

  // Zoom/pan view (resets per stakeholder).
  const [view, setView] = useState({ xMin, xMax, yMin: 0, yMax });
  useEffect(() => {
    setView({ xMin, xMax, yMin: 0, yMax });
  }, [xMin, xMax, yMax]);

  const [hi, setHi] = useState<number | null>(null);
  const [hy, setHy] = useState(0);
  const [gutter, setGutter] = useState(false); // hovering a marker below the axis
  const [region, setRegion] = useState<"plot" | "x" | "y" | null>(null);
  const [boxMode, setBoxMode] = useState(false); // marquee-zoom armed
  const [boxRect, setBoxRect] = useState<
    { x: number; y: number; w: number; h: number } | null
  >(null);
  const boxRef = useRef<{ x: number; y: number; w: number; h: number } | null>(
    null,
  );
  const [drag, setDrag] = useState<null | {
    kind: "pan" | "x" | "y" | "box";
    cx: number;
    cy: number;
    rl: number;
    rt: number;
    rw: number;
    rh: number;
    afx: number;
    afy: number;
    anchorTime: number;
    anchorVal: number;
    v0: { xMin: number; xMax: number; yMin: number; yMax: number };
  }>(null);

  // Drag → mutate the view. Window listeners so the drag survives leaving the SVG.
  useEffect(() => {
    if (!drag) return;
    const onMoveWin = (e: MouseEvent) => {
      if (drag.kind === "box") {
        const cxs = clamp(((e.clientX - drag.rl) / drag.rw) * W, padL, W - padR);
        const cys = clamp(((e.clientY - drag.rt) / drag.rh) * H, padT, padT + plotH);
        const sx0 = clamp(((drag.cx - drag.rl) / drag.rw) * W, padL, W - padR);
        const sy0 = clamp(((drag.cy - drag.rt) / drag.rh) * H, padT, padT + plotH);
        const r = {
          x: Math.min(sx0, cxs),
          y: Math.min(sy0, cys),
          w: Math.abs(cxs - sx0),
          h: Math.abs(cys - sy0),
        };
        boxRef.current = r;
        setBoxRect(r);
        return;
      }
      const dxSvg = ((e.clientX - drag.cx) / drag.rw) * W;
      const dySvg = ((e.clientY - drag.cy) / drag.rh) * H;
      const w0 = drag.v0.xMax - drag.v0.xMin;
      const h0 = drag.v0.yMax - drag.v0.yMin;
      if (drag.kind === "pan") {
        const shiftX = -(dxSvg / plotW) * w0;
        let nxMin = drag.v0.xMin + shiftX;
        let nxMax = drag.v0.xMax + shiftX;
        if (nxMin < xLimMin) {
          nxMax += xLimMin - nxMin;
          nxMin = xLimMin;
        }
        if (nxMax > xLimMax) {
          nxMin -= nxMax - xLimMax;
          nxMax = xLimMax;
        }
        const shiftY = (dySvg / plotH) * h0;
        let nyMin = drag.v0.yMin + shiftY;
        let nyMax = drag.v0.yMax + shiftY;
        if (nyMin < 0) {
          nyMax -= nyMin;
          nyMin = 0;
        }
        if (nyMax > yCap) {
          nyMin -= nyMax - yCap;
          nyMax = yCap;
        }
        setView({ xMin: nxMin, xMax: nxMax, yMin: Math.max(0, nyMin), yMax: nyMax });
      } else if (drag.kind === "x") {
        // zoom around the time under the cursor
        const f = Math.pow(2, -dxSvg / (plotW * 0.6));
        const nw = clamp(w0 * f, MIN_XW, xLimMax - xLimMin);
        let nxMin = drag.anchorTime - drag.afx * nw;
        let nxMax = nxMin + nw;
        if (nxMin < xLimMin) {
          nxMax += xLimMin - nxMin;
          nxMin = xLimMin;
        }
        if (nxMax > xLimMax) {
          nxMin -= nxMax - xLimMax;
          nxMax = xLimMax;
        }
        setView({ ...drag.v0, xMin: nxMin, xMax: nxMax });
      } else {
        // zoom around the value under the cursor
        const f = Math.pow(2, dySvg / (plotH * 0.6));
        const nh = clamp(h0 * f, minYW, yCap);
        let nyMax = drag.anchorVal + drag.afy * nh;
        let nyMin = nyMax - nh;
        if (nyMin < 0) {
          nyMax -= nyMin;
          nyMin = 0;
        }
        if (nyMax > yCap) {
          nyMin -= nyMax - yCap;
          nyMax = yCap;
        }
        setView({ ...drag.v0, yMin: Math.max(0, nyMin), yMax: nyMax });
      }
    };
    const onUp = () => {
      if (drag.kind === "box") {
        const b = boxRef.current;
        if (b && b.w > 4 && b.h > 4) {
          const v0 = drag.v0;
          const tAt = (sx: number) =>
            v0.xMin + ((sx - padL) / plotW) * (v0.xMax - v0.xMin);
          const vAt = (sy: number) =>
            v0.yMax - ((sy - padT) / plotH) * (v0.yMax - v0.yMin);
          let nxMin = tAt(b.x);
          let nxMax = tAt(b.x + b.w);
          let nyMax = vAt(b.y);
          let nyMin = vAt(b.y + b.h);
          if (nxMax - nxMin < MIN_XW) {
            const c = (nxMin + nxMax) / 2;
            nxMin = c - MIN_XW / 2;
            nxMax = c + MIN_XW / 2;
          }
          if (nyMax - nyMin < minYW) {
            const c = (nyMin + nyMax) / 2;
            nyMin = c - minYW / 2;
            nyMax = c + minYW / 2;
          }
          setView({
            xMin: clamp(nxMin, xLimMin, xLimMax),
            xMax: clamp(nxMax, xLimMin, xLimMax),
            yMin: Math.max(0, nyMin),
            yMax: Math.min(yCap, nyMax),
          });
        }
        boxRef.current = null;
        setBoxRect(null);
        setBoxMode(false);
      }
      setDrag(null);
    };
    window.addEventListener("mousemove", onMoveWin);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMoveWin);
      window.removeEventListener("mouseup", onUp);
    };
  }, [drag, xLimMin, xLimMax, yCap, minYW]);

  if (times.length < 2 || yMax <= 0) return null;

  const xr = view.xMax - view.xMin || 1;
  const yr = view.yMax - view.yMin || 1;
  const xOf = (t: number) => padL + ((t - view.xMin) / xr) * plotW;
  const yOf = (v: number) => padT + plotH - ((v - view.yMin) / yr) * plotH;
  const colorOf = (i: number) => COLORS[i % COLORS.length];

  const vis = series.filter((s) => !hidden.has(s.id));
  const totalValues = times.map((_, i) =>
    series.reduce((a, s) => a + s.values[i], 0),
  );

  // step-after corners: hold the previous value until the next x, then jump
  const stepXY = (vals: number[]): string[] => {
    const out: string[] = [];
    for (let i = 0; i < times.length; i++) {
      const x = xOf(times[i]).toFixed(1);
      if (i > 0) out.push(`${x} ${yOf(vals[i - 1]).toFixed(1)}`);
      out.push(`${x} ${yOf(vals[i]).toFixed(1)}`);
    }
    return out;
  };
  const linePath = (vals: number[]) => "M " + stepXY(vals).join(" L ");

  let cum = times.map(() => 0);
  const bands = vis.map((ser) => {
    const bottom = cum.slice();
    const top = times.map((_, i) => bottom[i] + ser.values[i]);
    cum = top;
    return { ser, bottom, top, idx: series.indexOf(ser) };
  });
  const bandPath = (top: number[], bottom: number[]) => {
    const up = stepXY(top);
    const down = stepXY(bottom).reverse();
    return "M " + up.join(" L ") + " L " + down.join(" L ") + " Z";
  };

  const { ticks: yTickVals, step: yStep } = niceTicks(view.yMin, view.yMax, 5);
  const yTicks = yTickVals
    .filter((v) => v >= view.yMin - yStep * 0.01 && v <= view.yMax + yStep * 0.01)
    .map((v) => ({
      v,
      y: yOf(v),
      label: yStep < 1 ? v.toFixed(1) : fmtNum(v),
    }));
  const spanDays = xr / DAY;
  const xTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => {
    const t = view.xMin + xr * f;
    return { t, x: xOf(t) };
  });
  const todayX =
    todayMs >= view.xMin && todayMs <= view.xMax ? xOf(todayMs) : null;

  const allShown = hidden.size === 0;
  const setAll = (on: boolean) => {
    setPref({ allSeries: on });
    setHidden(on ? new Set() : new Set(series.map((s) => s.id)));
  };
  const toggleHide = (id: string) =>
    setHidden((cur) => {
      const n = new Set(cur);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const regionAt = (sx: number, sy: number): "plot" | "x" | "y" =>
    sx < padL ? "y" : sy > padT + plotH ? "x" : "plot";

  const onDown = (e: RMouse) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const sx = ((e.clientX - rect.left) / rect.width) * W;
    const sy = ((e.clientY - rect.top) / rect.height) * H;
    const reg = regionAt(sx, sy);
    // plot body → pan; but if box-zoom is armed, drag a marquee instead
    const kind =
      reg === "plot" ? (boxMode ? "box" : "pan") : reg;
    const afx = clamp((sx - padL) / plotW, 0, 1);
    const afy = clamp((sy - padT) / plotH, 0, 1);
    setDrag({
      kind,
      cx: e.clientX,
      cy: e.clientY,
      rl: rect.left,
      rt: rect.top,
      rw: rect.width,
      rh: rect.height,
      afx,
      afy,
      anchorTime: view.xMin + afx * xr,
      anchorVal: view.yMax - afy * yr,
      v0: { ...view },
    });
    if (kind === "box") {
      boxRef.current = { x: sx, y: sy, w: 0, h: 0 };
      setBoxRect({ x: sx, y: sy, w: 0, h: 0 });
    }
    setHi(null);
  };

  const onMove = (e: RMouse) => {
    if (drag) return;
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const sx = ((e.clientX - rect.left) / rect.width) * W;
    const sy = ((e.clientY - rect.top) / rect.height) * H;
    const reg = regionAt(sx, sy);
    setRegion(reg);
    // Marker zone: below the axis, or just above it — snap to the nearest
    // grant/cliff marker so hovering a pen shows that grant + its date.
    const nearBottom = sy > padT + plotH - 16;
    if (reg === "x" || (reg === "plot" && nearBottom)) {
      let bestMs: number | null = null;
      let bmd = Infinity;
      for (const s of series) {
        const marks: number[] = [];
        if (prefs.dates) marks.push(s.grantMs);
        if (prefs.cliffs && s.cliffMs != null) marks.push(s.cliffMs);
        for (const ms of marks) {
          if (ms < view.xMin || ms > view.xMax) continue;
          const d = Math.abs(xOf(ms) - sx);
          if (d < bmd) {
            bmd = d;
            bestMs = ms;
          }
        }
      }
      const idx = bestMs != null && bmd <= 12 ? times.indexOf(bestMs) : -1;
      if (idx >= 0) {
        setHi(idx);
        setGutter(true);
        return;
      }
      if (reg === "x") {
        setHi(null);
        setGutter(false);
        return;
      }
      // plot near the axis but not on a marker → fall through to normal hover
    }
    setGutter(false);
    if (reg !== "plot") {
      setHi(null);
      return;
    }
    let best = 0;
    let bd = Infinity;
    for (let i = 0; i < times.length; i++) {
      const d = Math.abs(xOf(times[i]) - sx);
      if (d < bd) {
        bd = d;
        best = i;
      }
    }
    setHi(best);
    setHy(sy);
  };

  // Which series are under the cursor? (may be several — e.g. the top band and
  // the total line coincide at the top of a stacked chart.) Each carries its own
  // denominator so % is "% of THAT thing," not % of the grand total.
  type Cand = {
    name: string;
    value: number;
    denom: number;
    color: string;
    y: number;
    evt: string; // "granted" / "cliffed" when the cursor is on that series' date
  };
  let shown: Cand[] = [];
  if (hi != null && !drag && gutter) {
    // hovering a marker in the gutter → show just that grant (granted/cliffed)
    const tHi = times[hi];
    const cands: Cand[] = [];
    series.forEach((s, idx) => {
      const isG = prefs.dates && s.grantMs === tHi;
      const isC = prefs.cliffs && s.cliffMs === tHi;
      if (!isG && !isC) return;
      const parts: string[] = [];
      if (isG) parts.push("granted");
      if (isC) parts.push("cliffed");
      cands.push({
        name: s.label,
        value: s.values[hi],
        denom: s.quantity,
        color: colorOf(idx),
        y: yOf(s.values[hi]),
        evt: parts.join(" · "),
      });
    });
    shown = cands.sort((a, b) => a.y - b.y).slice(0, 4);
  } else if (hi != null && !drag) {
    const tHi = times[hi];
    const eventFor = (s: GrantSeries): string => {
      const parts: string[] = [];
      if (s.grantMs === tHi) parts.push("granted");
      if (s.cliffMs === tHi) parts.push("cliffed");
      return parts.join(" · ");
    };
    const cands: Cand[] = [];
    if (prefs.total)
      cands.push({
        name: "Total",
        value: totalValues[hi],
        denom: totalGranted,
        color: "var(--ink)",
        y: yOf(totalValues[hi]),
        evt: "",
      });
    if (prefs.sand)
      bands.forEach((b) =>
        cands.push({
          name: b.ser.label,
          value: b.ser.values[hi],
          denom: b.ser.quantity,
          color: colorOf(b.idx),
          y: yOf(b.top[hi]),
          evt: eventFor(b.ser),
        }),
      );
    else
      vis.forEach((s) =>
        cands.push({
          name: s.label,
          value: s.values[hi],
          denom: s.quantity,
          color: colorOf(series.indexOf(s)),
          y: yOf(s.values[hi]),
          evt: eventFor(s),
        }),
      );
    if (cands.length) {
      const near = cands.filter((c) => Math.abs(c.y - hy) <= 14);
      if (near.length) shown = near;
      else {
        let best = cands[0];
        let bd = Infinity;
        for (const c of cands) {
          const d = Math.abs(c.y - hy);
          if (d < bd) {
            bd = d;
            best = c;
          }
        }
        shown = [best];
      }
      // drop 0%/pre-cliff grants with no event — they only clutter the tag
      const meaningful = shown.filter(
        (c) => c.name === "Total" || !!c.evt || c.value > 0,
      );
      shown = (meaningful.length ? meaningful : shown.slice(0, 1))
        .sort((a, b) => a.y - b.y)
        .slice(0, 4);
    }
  }

  const cursor = drag
    ? drag.kind === "y"
      ? "ns-resize"
      : drag.kind === "x"
        ? "ew-resize"
        : drag.kind === "box"
          ? "crosshair"
          : "grabbing"
    : boxMode && region === "plot"
      ? "crosshair"
      : region === "y"
        ? "ns-resize"
        : region === "x"
          ? "ew-resize"
          : "crosshair";
  const zoomed =
    view.xMin !== xMin ||
    view.xMax !== xMax ||
    view.yMin !== 0 ||
    view.yMax !== yMax;
  const reset = () => setView({ xMin, xMax, yMin: 0, yMax });

  return (
    <div style={{ userSelect: drag ? "none" : "auto" }}>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: "8px 16px",
          marginBottom: 10,
        }}
      >
        <Toggle label="Sandchart" checked={prefs.sand} onChange={(v) => setPref({ sand: v })} />
        <Toggle label="Total" checked={prefs.total} onChange={(v) => setPref({ total: v })} />
        <Toggle label="Cliffs" checked={prefs.cliffs} onChange={(v) => setPref({ cliffs: v })} />
        <Toggle label="Grant dates" checked={prefs.dates} onChange={(v) => setPref({ dates: v })} />
        <span style={{ width: 1, height: 16, background: "var(--line)" }} />
        <Toggle label="All series" checked={allShown} onChange={setAll} />
        {series.map((s, i) => (
          <button
            key={s.id}
            type="button"
            onClick={() => toggleHide(s.id)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              border: 0,
              background: "transparent",
              cursor: "pointer",
              fontSize: 13,
              fontFamily: "var(--fb)",
              opacity: hidden.has(s.id) ? 0.4 : 1,
              color: "var(--ink)",
            }}
          >
            <span style={{ width: 11, height: 11, borderRadius: 3, background: colorOf(i) }} />
            {s.label}
          </button>
        ))}
        <span style={{ marginLeft: "auto", display: "inline-flex", gap: 8 }}>
          <button
            type="button"
            onClick={() => setBoxMode((m) => !m)}
            title="Box zoom — click, then drag a rectangle on the chart to zoom to it"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              border: "1px solid " + (boxMode ? "var(--accent)" : "var(--line)"),
              background: boxMode ? "var(--accent-soft)" : "var(--bg2)",
              borderRadius: 6,
              padding: "3px 9px",
              fontSize: 12,
              cursor: "pointer",
              color: boxMode ? "var(--accent)" : "var(--ink)",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden>
              <circle cx="6.5" cy="6.5" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
              <line x1="10" y1="10" x2="15" y2="15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              <rect x="4.4" y="4.4" width="4.2" height="4.2" rx="0.6" fill="none" stroke="currentColor" strokeWidth="1" />
            </svg>
            Box zoom
          </button>
          {zoomed && (
            <button
              type="button"
              onClick={reset}
              style={{
                border: "1px solid var(--line)",
                background: "var(--bg2)",
                borderRadius: 6,
                padding: "3px 10px",
                fontSize: 12,
                cursor: "pointer",
                color: "var(--ink)",
              }}
            >
              Reset zoom
            </button>
          )}
        </span>
      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: "100%", height: "auto", display: "block", cursor, touchAction: "none" }}
        onMouseDown={onDown}
        onMouseMove={onMove}
        onMouseLeave={() => {
          setHi(null);
          setRegion(null);
          setGutter(false);
        }}
        onDoubleClick={reset}
      >
        <defs>
          <clipPath id="vc-plot">
            <rect x={padL} y={padT} width={plotW} height={plotH} />
          </clipPath>
        </defs>

        {/* axis drag zones */}
        <rect x={0} y={padT + plotH} width={W} height={padB} fill="transparent" />
        <rect x={0} y={0} width={padL} height={H} fill="transparent" />

        {yTicks.map((tk, i) => (
          <g key={i}>
            <line x1={padL} y1={tk.y} x2={W - padR} y2={tk.y} stroke="var(--line)" strokeWidth={1} />
            <text x={padL - 8} y={tk.y + 4} textAnchor="end" fontSize={11} fill="var(--muted)">
              {tk.label}
            </text>
          </g>
        ))}
        {xTicks.map((tk, i) => (
          <text
            key={i}
            x={tk.x}
            y={H - 14}
            textAnchor={i === 0 ? "start" : i === xTicks.length - 1 ? "end" : "middle"}
            fontSize={11}
            fill="var(--muted)"
          >
            {fmtXTick(tk.t, spanDays)}
          </text>
        ))}

        <g clipPath="url(#vc-plot)">
          {prefs.sand
            ? bands.map((b) => (
                <path
                  key={b.ser.id}
                  d={bandPath(b.top, b.bottom)}
                  fill={colorOf(b.idx)}
                  opacity={0.55}
                  stroke={colorOf(b.idx)}
                  strokeWidth={0.5}
                />
              ))
            : vis.map((s) => (
                <path
                  key={s.id}
                  d={linePath(s.values)}
                  fill="none"
                  stroke={colorOf(series.indexOf(s))}
                  strokeWidth={2}
                />
              ))}

          {prefs.total && (
            <path d={linePath(totalValues)} fill="none" stroke="var(--ink)" strokeWidth={1.25} opacity={0.85} />
          )}
        </g>

        {/* markers live in the gutter below the axis (never over the chart);
            cliffs first, grants painted on top so both show when they overlap */}
        {prefs.cliffs &&
          series.map((s, i) => {
            if (s.cliffMs == null || s.cliffMs < view.xMin || s.cliffMs > view.xMax)
              return null;
            const cx = xOf(s.cliffMs);
            return (
              <g key={"cl" + s.id}>
                <path
                  d={`M ${(cx - 7).toFixed(1)} ${M_BASE} L ${cx.toFixed(1)} ${M_APEX} L ${(cx + 7).toFixed(1)} ${M_BASE} Z`}
                  fill={colorOf(i)}
                />
                <path
                  d={`M ${(cx - 2.6).toFixed(1)} ${M_APEX + 4.5} L ${cx.toFixed(1)} ${M_APEX} L ${(cx + 2.6).toFixed(1)} ${M_APEX + 4.5} Z`}
                  fill="#fff"
                />
                <text x={cx} y={M_CLETTER} textAnchor="middle" fontSize={9} fill={colorOf(i)} fontWeight={700}>
                  C{i + 1}
                </text>
              </g>
            );
          })}

        {prefs.dates &&
          series.map((s, i) => {
            if (s.grantMs < view.xMin || s.grantMs > view.xMax) return null;
            const gx = xOf(s.grantMs);
            // a little pen, tip on the grant date, tilted ~12° off vertical
            const pen = `M ${gx} ${M_APEX} L ${(gx - 2).toFixed(1)} ${M_APEX + 4} L ${(gx - 2).toFixed(1)} ${M_APEX + 13} L ${(gx - 1).toFixed(1)} ${M_APEX + PEN_LEN} L ${(gx + 1).toFixed(1)} ${M_APEX + PEN_LEN} L ${(gx + 2).toFixed(1)} ${M_APEX + 13} L ${(gx + 2).toFixed(1)} ${M_APEX + 4} Z`;
            return (
              <g key={"gd" + s.id}>
                <g transform={`rotate(12 ${gx} ${M_APEX})`}>
                  <path d={pen} fill={colorOf(i)} stroke="var(--bg2)" strokeWidth={0.6} />
                  <line
                    x1={(gx - 2).toFixed(1)}
                    y1={M_APEX + 6}
                    x2={(gx + 2).toFixed(1)}
                    y2={M_APEX + 6}
                    stroke="#fff"
                    strokeWidth={0.8}
                  />
                </g>
                <text x={gx} y={M_GLETTER} textAnchor="middle" fontSize={9} fill={colorOf(i)} fontWeight={700}>
                  G{i + 1}
                </text>
              </g>
            );
          })}

        {todayX != null && (
          <>
            <line x1={todayX} y1={padT} x2={todayX} y2={padT + plotH} stroke="var(--accent)" strokeWidth={1} strokeDasharray="4 4" opacity={0.6} />
            <text x={todayX} y={padT - 6} textAnchor="middle" fontSize={10} fill="var(--accent)" fontWeight={700}>
              today
            </text>
          </>
        )}

        {boxRect && drag?.kind === "box" && (
          <rect
            x={boxRect.x}
            y={boxRect.y}
            width={boxRect.w}
            height={boxRect.h}
            fill="var(--accent)"
            fillOpacity={0.12}
            stroke="var(--accent)"
            strokeDasharray="4 3"
            strokeWidth={1}
          />
        )}

        {hi != null && shown.length > 0 && !boxMode && (
          <>
            <line x1={xOf(times[hi])} y1={padT} x2={xOf(times[hi])} y2={padT + plotH} stroke="var(--muted)" strokeWidth={1} opacity={0.4} />
            {shown.map((c, i) => (
              <circle key={i} cx={xOf(times[hi])} cy={c.y} r={4} fill={c.color} stroke="var(--bg2)" strokeWidth={2} />
            ))}
            {(() => {
              const boxW = shown.some((c) => c.evt) ? 236 : 188;
              const rowH = 16;
              const boxH = shown.length * rowH + 20;
              const tx = clamp(xOf(times[hi]), padL + boxW / 2, W - padR - boxW / 2);
              const topY = Math.min(...shown.map((c) => c.y));
              const botY = Math.max(...shown.map((c) => c.y));
              let ty = topY - 12 - boxH; // above the highest dot
              if (ty < padT + 2) ty = Math.min(botY + 14, padT + plotH - boxH); // else below
              const left = tx - boxW / 2;
              return (
                <g>
                  <rect x={left} y={ty} width={boxW} height={boxH} rx={6} fill="var(--ink)" opacity={0.93} />
                  {shown.map((c, i) => {
                    const ry = ty + 18 + i * rowH;
                    const pct = c.denom > 0 ? Math.round((c.value / c.denom) * 100) : 0;
                    return (
                      <g key={i}>
                        <rect x={left + 10} y={ry - 8} width={9} height={9} rx={2} fill={c.color === "var(--ink)" ? "#fff" : c.color} />
                        <text x={left + 25} y={ry} fontSize={11} fill="#fff" fontWeight={c.name === "Total" ? 700 : 500}>
                          {c.name}
                          {c.evt ? (
                            <tspan fill="#eac27a" fontStyle="italic" fontWeight={600}>
                              {"  " + c.evt}
                            </tspan>
                          ) : null}
                        </text>
                        <text x={left + boxW - 10} y={ry} textAnchor="end" fontSize={11} fill="#fff">
                          {fmtNum(c.value)} · {pct}%
                        </text>
                      </g>
                    );
                  })}
                  <text x={tx} y={ty + boxH - 6} textAnchor="middle" fontSize={9} fill="#fff" opacity={0.7}>
                    {fmtDay(times[hi])}
                  </text>
                </g>
              );
            })()}
          </>
        )}
      </svg>

      <p style={{ fontSize: 11, color: "var(--muted)", marginTop: 6 }}>
        Drag the plot to pan · drag the bottom axis (↔) to zoom time · drag the left axis (↕) to zoom value (around the cursor) · <strong>Box zoom</strong> then drag a rectangle · double-click to reset.
      </p>
    </div>
  );
}
