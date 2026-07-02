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
const H = 340;
const padL = 60;
const padR = 18;
const padT = 20;
const padB = 42;
const plotW = W - padL - padR;
const plotH = H - padT - padB;
const DAY = 86400000;
const MIN_XW = 14 * DAY; // tightest time window: two weeks

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
  const [region, setRegion] = useState<"plot" | "x" | "y" | null>(null);
  const [drag, setDrag] = useState<null | {
    kind: "pan" | "x" | "y";
    cx: number;
    cy: number;
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
    const onUp = () => setDrag(null);
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
  const baseY = yOf(0);
  const baselineVisible = baseY <= padT + plotH + 0.5;
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
    const kind = reg === "plot" ? "pan" : reg; // plot body → pan toward cursor
    const afx = clamp((sx - padL) / plotW, 0, 1);
    const afy = clamp((sy - padT) / plotH, 0, 1);
    setDrag({
      kind,
      cx: e.clientX,
      cy: e.clientY,
      rw: rect.width,
      rh: rect.height,
      afx,
      afy,
      anchorTime: view.xMin + afx * xr,
      anchorVal: view.yMax - afy * yr,
      v0: { ...view },
    });
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
  };
  let shown: Cand[] = [];
  if (hi != null && !drag) {
    const cands: Cand[] = [];
    if (prefs.total)
      cands.push({
        name: "Total",
        value: totalValues[hi],
        denom: totalGranted,
        color: "var(--ink)",
        y: yOf(totalValues[hi]),
      });
    if (prefs.sand)
      bands.forEach((b) =>
        cands.push({
          name: b.ser.label,
          value: b.ser.values[hi],
          denom: b.ser.quantity,
          color: colorOf(b.idx),
          y: yOf(b.top[hi]),
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
      shown = [...shown].sort((a, b) => a.y - b.y).slice(0, 4);
    }
  }

  const cursor = drag
    ? drag.kind === "y"
      ? "ns-resize"
      : drag.kind === "x"
        ? "ew-resize"
        : "grabbing"
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
        {zoomed && (
          <button
            type="button"
            onClick={reset}
            style={{
              marginLeft: "auto",
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
            <path d={linePath(totalValues)} fill="none" stroke="var(--ink)" strokeWidth={2.5} opacity={0.85} />
          )}
        </g>

        {prefs.dates &&
          baselineVisible &&
          series.map((s, i) =>
            s.grantMs >= view.xMin && s.grantMs <= view.xMax ? (
              <g key={"gd" + s.id}>
                <line x1={xOf(s.grantMs)} y1={baseY} x2={xOf(s.grantMs)} y2={baseY - 8} stroke={colorOf(i)} strokeWidth={2} />
                <text x={xOf(s.grantMs)} y={baseY + 13} textAnchor="middle" fontSize={9} fill={colorOf(i)} fontWeight={700}>
                  G{i + 1}
                </text>
              </g>
            ) : null,
          )}

        {prefs.cliffs &&
          baselineVisible &&
          series.map((s, i) =>
            s.cliffMs == null || s.cliffMs < view.xMin || s.cliffMs > view.xMax ? null : (
              <g key={"cl" + s.id}>
                <path
                  d={`M ${(xOf(s.cliffMs) - 8).toFixed(1)} ${baseY} L ${xOf(s.cliffMs).toFixed(1)} ${baseY - 13} L ${(xOf(s.cliffMs) + 8).toFixed(1)} ${baseY} Z`}
                  fill={colorOf(i)}
                />
                <path
                  d={`M ${(xOf(s.cliffMs) - 3).toFixed(1)} ${baseY - 8} L ${xOf(s.cliffMs).toFixed(1)} ${baseY - 13} L ${(xOf(s.cliffMs) + 3).toFixed(1)} ${baseY - 8} Z`}
                  fill="#fff"
                />
                <text x={xOf(s.cliffMs)} y={baseY - 17} textAnchor="middle" fontSize={9} fill={colorOf(i)} fontWeight={700}>
                  C{i + 1}
                </text>
              </g>
            ),
          )}

        {todayX != null && (
          <>
            <line x1={todayX} y1={padT} x2={todayX} y2={padT + plotH} stroke="var(--accent)" strokeWidth={1} strokeDasharray="4 4" opacity={0.6} />
            <text x={todayX} y={padT - 6} textAnchor="middle" fontSize={10} fill="var(--accent)" fontWeight={700}>
              today
            </text>
          </>
        )}

        {hi != null && shown.length > 0 && (
          <>
            <line x1={xOf(times[hi])} y1={padT} x2={xOf(times[hi])} y2={padT + plotH} stroke="var(--muted)" strokeWidth={1} opacity={0.4} />
            {shown.map((c, i) => (
              <circle key={i} cx={xOf(times[hi])} cy={c.y} r={4} fill={c.color} stroke="var(--bg2)" strokeWidth={2} />
            ))}
            {(() => {
              const boxW = 188;
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
        Drag the plot to pan · drag the bottom axis (↔) to zoom time · drag the left axis (↕) to zoom value — it zooms around the cursor · double-click to reset.
      </p>
    </div>
  );
}
