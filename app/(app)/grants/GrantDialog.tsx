"use client";

import { type CSSProperties, useEffect, useRef, useState } from "react";
import { useSandbox, type Grant } from "../SandboxProvider";
import Modal from "../Modal";
import LogDialog from "../LogDialog";
import PoolDialog from "../pools/PoolDialog";
import { fullName, idLabel, stakeholderStatus } from "../stakeholders/util";
import {
  FREQS,
  annualSeed,
  defaultVesting,
  evenPercents,
  fullyVestedDate,
  isComplete,
  lifetimeVestedFraction,
  reservedUnits,
  sumPercents,
  todayISO,
  vestedFraction,
  type Freq,
  type Vesting,
} from "./vesting";

export const gid = (seq: number) => String(seq).padStart(7, "0");

// ---- grant lifecycle status (GRANT-16/17/19) — shared with the lists ----
// "Fully vested" wins over everything (100% vested = nothing left for a
// terminate/pause to touch); "Paused" only while the window is actually
// RUNNING (scheduled/expired pauses read Vesting — the banner still shows
// them); "Vesting" is the default state (renamed from Active, 8 Jul 2026).
export type GrantStatus = "vesting" | "paused" | "terminated" | "fully";
export const grantStatus = (g: {
  terminationDate: string | null;
  pauseStart: string | null;
  pauseEnd: string | null;
  vesting: Vesting;
  grantDate: string;
}): GrantStatus => {
  const today = todayISO();
  if (vestedFraction(g.vesting, g.grantDate, today, g) >= 1 - 1e-6)
    return "fully";
  if (g.terminationDate) return "terminated";
  return g.pauseStart &&
    g.pauseStart <= today &&
    (!g.pauseEnd || g.pauseEnd >= today)
    ? "paused"
    : "vesting";
};

const CHIP_COLORS: Record<GrantStatus, { bg: string; fg: string; label: string }> = {
  vesting: { bg: "#e3efe4", fg: "#2f7d4f", label: "Vesting" }, // green: in motion
  fully: { bg: "#e2eaf2", fg: "#3d6a96", label: "Fully vested" }, // blue: settled
  paused: { bg: "#f3ead9", fg: "#8a6a33", label: "Paused" },
  terminated: { bg: "#f6e2e0", fg: "#b23b3b", label: "Terminated" },
};

export function StatusChip({ status }: { status: GrantStatus }) {
  const c = CHIP_COLORS[status];
  return (
    <span
      style={{
        background: c.bg,
        color: c.fg,
        borderRadius: 999,
        padding: "2px 9px",
        fontSize: 11,
        fontWeight: 700,
        whiteSpace: "nowrap",
      }}
    >
      {c.label}
    </span>
  );
}
const QTY_MAX = 13;
const num = (s: string) => Number(s.replace(/[^\d.]/g, "") || 0);
const int = (s: string) => Math.floor(num(s));
const round2 = (n: number) => Math.round(n * 100) / 100;
const countDec = (n: number) => {
  if (!Number.isFinite(n) || Number.isInteger(n)) return 0;
  const s = String(n);
  const i = s.indexOf(".");
  return i < 0 ? 0 : s.length - i - 1;
};

// match if every typed token is a whole-word prefix in the name (first OR last)
const matchName = (name: string, q: string) => {
  const words = name.toLowerCase().split(/\s+/).filter(Boolean);
  const tokens = q.toLowerCase().split(/\s+/).filter(Boolean);
  return tokens.every((t) => words.some((w) => w.startsWith(t)));
};

// A % input: free decimal typing while focused; when idle shows 2dp if `pad`, else plain.
function PercentInput({
  value,
  decimals,
  onChange,
  style,
}: {
  value: number;
  decimals: number;
  onChange: (v: number) => void;
  style?: CSSProperties;
}) {
  const [focused, setFocused] = useState(false);
  const [draft, setDraft] = useState("");
  return (
    <input
      className="inp"
      inputMode="decimal"
      style={style}
      value={focused ? draft : value.toFixed(decimals)}
      onFocus={() => {
        setFocused(true);
        setDraft(String(value));
      }}
      onChange={(e) => {
        const raw = e.target.value.replace(/[^\d.]/g, "");
        setDraft(raw);
        onChange(round2(Number(raw) || 0));
      }}
      onBlur={() => setFocused(false)}
    />
  );
}

const boxS: CSSProperties = {
  border: "1px solid var(--line)",
  borderRadius: 10,
  padding: "12px 14px",
  marginTop: 6,
  background: "var(--bg)",
};
const rowS: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  marginTop: 7,
};
const rmS: CSSProperties = {
  border: "1px solid var(--line)",
  background: "var(--bg2)",
  borderRadius: 6,
  width: 28,
  height: 28,
  minWidth: 28,
  cursor: "pointer",
  color: "var(--muted)",
  lineHeight: 1,
  flex: "none",
};
const pctS: CSSProperties = { color: "var(--muted)", fontSize: 13, flex: "none" };
const yrS: CSSProperties = {
  width: 64,
  flex: "none",
  fontSize: 12,
  color: "var(--muted)",
  fontWeight: 600,
};
const ddS: CSSProperties = {
  position: "absolute",
  left: 0,
  right: 0,
  top: "calc(100% + 4px)",
  zIndex: 60,
  background: "var(--bg2)",
  border: "1px solid var(--line)",
  borderRadius: 8,
  boxShadow: "var(--shadow)",
  maxHeight: 240,
  overflowY: "auto",
  padding: 4,
};
const optBase: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 10,
  width: "100%",
  textAlign: "left",
  border: 0,
  color: "var(--ink)",
  padding: "8px 10px",
  borderRadius: 6,
  cursor: "pointer",
  fontSize: 14,
  fontFamily: "var(--fb)",
};

export default function GrantDialog({
  grant: grantProp,
  startEdit,
  presetStakeholderId,
  onClose,
}: {
  grant?: Grant;
  startEdit?: boolean;
  presetStakeholderId?: string;
  onClose: () => void;
}) {
  const {
    stakeholders,
    pools,
    grants,
    grantsForStakeholder,
    grantedFor,
    addGrant,
    updateGrant,
    deleteGrant,
    notify,
  } = useSandbox();
  // The prop is a SNAPSHOT taken when the row was clicked. After a lifecycle
  // action (terminate/pause/resume) the provider updates but the snapshot
  // doesn't — so banners/buttons/dates went stale until close+reopen. Always
  // render the live grant from context instead.
  const grant = grantProp
    ? (grants.find((g) => g.id === grantProp.id) ?? grantProp)
    : undefined;
  const [editing, setEditing] = useState(grant ? !!startEdit : true);
  const [stakeholderId, setStakeholderId] = useState(
    grant?.stakeholderId ?? presetStakeholderId ?? "",
  );
  const [poolId, setPoolId] = useState(grant?.poolId ?? "");
  const [qty, setQty] = useState(grant ? String(grant.quantity) : "");
  const [grantDate, setGrantDate] = useState(grant?.grantDate ?? todayISO());
  const [strike, setStrike] = useState(
    grant?.strike != null ? String(grant.strike) : "",
  );
  const [vesting, setVesting] = useState<Vesting>(
    grant?.vesting ?? defaultVesting(),
  );
  const [poolOpen, setPoolOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [periodDraft, setPeriodDraft] = useState<string | null>(null);

  // ---- lifecycle (GRANT-16/17) — view-mode panels ----
  const [panel, setPanel] = useState<
    null | "terminate" | "pause" | "unterminate" | "removepause" | "delete"
  >(null);
  const [termDraft, setTermDraft] = useState(todayISO());
  const [amendDraft, setAmendDraft] = useState(""); // amend termination date
  const [psDraft, setPsDraft] = useState(grant?.pauseStart ?? todayISO());
  const [peDraft, setPeDraft] = useState(grant?.pauseEnd ?? "");

  const sh = (id: string) => stakeholders.find((s) => s.id === id);
  const poolName = (id: string | null) =>
    id ? (pools.find((p) => p.id === id)?.name ?? "—") : "None";

  // ---- typeable stakeholder picker ----
  const selStake = sh(stakeholderId);
  const selName = selStake ? fullName(selStake) : "";
  const selNameRef = useRef(selName);
  selNameRef.current = selName;
  const [shQuery, setShQuery] = useState(selName);
  const [shOpen, setShOpen] = useState(false);
  const shRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (shRef.current && !shRef.current.contains(e.target as Node)) {
        setShOpen(false);
        setShQuery(selNameRef.current); // revert to the picked one
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);
  const stakeholdersSorted = [...stakeholders].sort((a, b) =>
    fullName(a).toLowerCase().localeCompare(fullName(b).toLowerCase()),
  );
  const shFiltered = stakeholdersSorted.filter((s) =>
    matchName(fullName(s) || "", shQuery),
  );

  // ---- typeable pool picker ----
  const selPool = poolId ? (pools.find((p) => p.id === poolId) ?? null) : null;
  const selPoolName = selPool ? selPool.name : "";
  const selPoolNameRef = useRef(selPoolName);
  selPoolNameRef.current = selPoolName;
  const [poolQuery, setPoolQuery] = useState(selPoolName);
  const [poolShow, setPoolShow] = useState(false);
  const poolRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (poolRef.current && !poolRef.current.contains(e.target as Node)) {
        setPoolShow(false);
        setPoolQuery(selPoolNameRef.current);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);
  const poolsSorted = [...pools].sort((a, b) =>
    a.name.toLowerCase().localeCompare(b.name.toLowerCase()),
  );
  const poolFiltered = poolsSorted.filter((p) => matchName(p.name, poolQuery));

  // ---- pool capacity (GRANT-07 / POOL-04) ----
  const poolRemaining =
    selPool && selPool.quantity != null
      ? selPool.quantity -
        grantedFor(selPool.id) +
        (grant && grant.poolId === selPool.id ? grant.quantity : 0)
      : null;
  const overCapacity = poolRemaining != null && Number(qty) > poolRemaining;

  // ---- vesting editors ----
  // Vesting period = number of schedule years (N). The cliff is a gate WITHIN
  // that period (0..N), not extra years on top.
  const period = vesting.mode === "normal" ? vesting.annualPercents.length : 0;
  const setPeriod = (p: number) => {
    if (vesting.mode !== "normal") return;
    const pp = Math.max(1, p);
    const cy = Math.min(vesting.cliff.years, pp); // cliff can't exceed the period
    const cm = cy === pp ? 0 : vesting.cliff.months;
    setVesting({
      ...vesting,
      cliff: { years: cy, months: cm },
      annualPercents: evenPercents(pp),
    });
  };
  const setCliffYears = (cy: number) => {
    if (vesting.mode !== "normal") return;
    const N = vesting.annualPercents.length;
    const cyy = Math.max(0, Math.min(cy, N)); // 0..period
    const cm = cyy === N ? 0 : vesting.cliff.months; // full-period cliff = single vest
    setVesting({ ...vesting, cliff: { years: cyy, months: cm } });
  };
  const setCliffMonths = (m: number) => {
    if (vesting.mode !== "normal") return;
    const N = vesting.annualPercents.length;
    const maxMo = Math.max(0, N * 12 - vesting.cliff.years * 12);
    setVesting({
      ...vesting,
      cliff: { ...vesting.cliff, months: Math.max(0, Math.min(m, maxMo)) },
    });
  };
  const setFreq = (f: Freq) => {
    if (vesting.mode !== "normal") return;
    setVesting({ ...vesting, freq: f });
  };
  const setYear = (i: number, val: number) => {
    if (vesting.mode !== "normal") return;
    const next = [...vesting.annualPercents];
    next[i] = val;
    setVesting({ ...vesting, annualPercents: next });
  };
  const addYear = () => {
    if (vesting.mode !== "normal") return;
    setVesting({ ...vesting, annualPercents: [...vesting.annualPercents, 0] });
  };
  const removeYear = (i: number) => {
    if (vesting.mode !== "normal" || vesting.annualPercents.length <= 1) return;
    const next = vesting.annualPercents.filter((_, idx) => idx !== i);
    const cy = Math.min(vesting.cliff.years, next.length);
    const cm = cy === next.length ? 0 : vesting.cliff.months;
    setVesting({
      ...vesting,
      annualPercents: next,
      cliff: { years: cy, months: cm },
    });
  };
  const setTranche = (i: number, patch: { date?: string; percent?: number }) => {
    if (vesting.mode !== "advanced") return;
    setVesting({
      ...vesting,
      tranches: vesting.tranches.map((t, idx) =>
        idx === i ? { ...t, ...patch } : t,
      ),
    });
  };
  const addTranche = () => {
    if (vesting.mode !== "advanced") return;
    setVesting({
      ...vesting,
      tranches: [...vesting.tranches, { date: todayISO(), percent: 0 }],
    });
  };
  const removeTranche = (i: number) => {
    if (vesting.mode !== "advanced") return;
    setVesting({
      ...vesting,
      tranches: vesting.tranches.filter((_, idx) => idx !== i),
    });
  };
  const toNormal = () => {
    if (vesting.mode !== "normal") setVesting(defaultVesting());
  };
  const toAdvanced = () => {
    if (vesting.mode === "advanced") return;
    setVesting({ mode: "advanced", tranches: annualSeed(vesting, grantDate) });
  };

  const total = sumPercents(vesting);
  const complete = isComplete(vesting);
  const fvd = fullyVestedDate(vesting, grantDate, grant);
  const vestedNow = Math.round(
    vestedFraction(vesting, grantDate, todayISO(), grant) * 100,
  );
  const valid =
    !!stakeholderId && Number(qty) > 0 && complete && !overCapacity;

  const save = () => {
    if (!stakeholderId) return setError("Choose a stakeholder.");
    const q = Number(qty);
    if (!q || q <= 0) return setError("Enter a quantity.");
    if (overCapacity)
      return setError(
        `That's more than ${selPool?.name} has left (${poolRemaining?.toLocaleString()} available).`,
      );
    if (!complete)
      return setError(`Vesting must total 100% (currently ${total}%).`);
    const payload = {
      stakeholderId,
      poolId: poolId || null,
      quantity: q,
      grantDate,
      strike: strike ? Number(strike) : null,
      vesting,
      // lifecycle is managed from view mode (GRANT-16/17), untouched here
      terminationDate: grant?.terminationDate ?? null,
      pauseStart: grant?.pauseStart ?? null,
      pauseEnd: grant?.pauseEnd ?? null,
    };
    if (grant) {
      updateGrant(grant.id, payload);
      notify("Grant updated");
      setEditing(false);
    } else {
      const g = addGrant(payload);
      notify(`Grant #${gid(g.seq)} created`);
      onClose();
    }
  };

  // ---- lifecycle actions (view mode only) ----
  const grantPool = grant?.poolId
    ? (pools.find((p) => p.id === grant.poolId) ?? null)
    : null;
  const lifetimeFrac = grant
    ? lifetimeVestedFraction(grant.vesting, grant.grantDate, grant)
    : 1;

  // Terminate preview for the drafted date (termination day itself excluded)
  const termPreview = grant
    ? (() => {
        const lc = {
          terminationDate: termDraft,
          pauseStart: grant.pauseStart,
          pauseEnd: grant.pauseEnd,
        };
        const keep = reservedUnits(grant.quantity, grant.vesting, grant.grantDate, lc);
        return { keep, returned: grant.quantity - keep };
      })()
    : { keep: 0, returned: 0 };

  const doTerminate = () => {
    if (!grant || !termDraft) return;
    updateGrant(grant.id, {
      terminationDate: termDraft,
      terminationInherited: false, // individual action
    });
    notify(
      grantPool && termPreview.returned > 0
        ? `Vesting terminated — ${termPreview.returned.toLocaleString()} units returned to ${grantPool.name}`
        : "Vesting terminated",
    );
    setPanel(null);
  };

  // Un-terminate re-reserves the returned units — blocked if the pool can no
  // longer supply them (GRANT-16). Returns how many units short, 0 = fine.
  const unterminateShort = (() => {
    if (!grant || !grant.terminationDate || !grantPool || grantPool.quantity == null)
      return 0;
    const delta =
      grant.quantity -
      reservedUnits(grant.quantity, grant.vesting, grant.grantDate, grant);
    const remaining = grantPool.quantity - grantedFor(grantPool.id);
    return delta > remaining ? delta - remaining : 0;
  })();

  const doUnterminate = () => {
    if (!grant || unterminateShort > 0) return;
    updateGrant(grant.id, {
      terminationDate: null,
      terminationInherited: false,
    });
    notify("Termination removed — scheduled vesting resumes");
    setPanel(null);
  };

  // Amend the termination date in place (GRANT-16 refinement, 9 Jul 2026).
  // Moving it LATER re-reserves more units — guard the pool like un-terminate.
  const amendShort = (() => {
    if (
      !grant?.terminationDate ||
      !amendDraft ||
      !grantPool ||
      grantPool.quantity == null
    )
      return 0;
    const cur = reservedUnits(grant.quantity, grant.vesting, grant.grantDate, grant);
    const next = reservedUnits(grant.quantity, grant.vesting, grant.grantDate, {
      terminationDate: amendDraft,
      pauseStart: grant.pauseStart,
      pauseEnd: grant.pauseEnd,
    });
    const delta = next - cur;
    const remaining = grantPool.quantity - grantedFor(grantPool.id);
    return delta > remaining ? delta - remaining : 0;
  })();

  const doAmendTermination = () => {
    if (!grant || !amendDraft || amendShort > 0) return;
    updateGrant(grant.id, { terminationDate: amendDraft });
    notify(`Termination date moved to ${amendDraft}`);
    setPanel(null);
  };

  const pauseInvalid = !psDraft || (!!peDraft && peDraft < psDraft);
  const doPause = () => {
    if (!grant || pauseInvalid) return;
    updateGrant(grant.id, {
      pauseStart: psDraft,
      pauseEnd: peDraft || null,
      pauseInherited: false, // individual action
    });
    notify(
      grantPool
        ? `Vesting paused — units stay reserved in ${grantPool.name}`
        : "Vesting paused",
    );
    setPanel(null);
  };

  const doRemovePause = () => {
    if (!grant) return;
    updateGrant(grant.id, {
      pauseStart: null,
      pauseEnd: null,
      pauseInherited: false,
    });
    notify("Pause removed — schedule recomputed");
    setPanel(null);
  };

  // Lifecycle banners — shown in BOTH view and edit modes so a terminated /
  // paused grant is never mistaken for an active one mid-edit.
  const lifecycleBanners = grant ? (
    <>
      {grant.terminationDate && (
        <div
          style={{
            background: "#f6e2e0",
            color: "#b23b3b",
            borderRadius: 10,
            padding: "10px 14px",
            fontSize: 13.5,
            fontWeight: 600,
            marginBottom: 8,
          }}
        >
          {lifetimeFrac >= 1 - 1e-6
            ? `Vesting terminated from ${grant.terminationDate} — the grant was already fully vested, so nothing was forfeited.`
            : `Vesting terminated from ${grant.terminationDate} — vested before that date stays vested; the rest is forfeited${grantPool ? ` (returned to ${grantPool.name})` : ""}.`}
        </div>
      )}
      {grant.pauseStart && (
        <div
          style={{
            background: "#f3ead9",
            color: "#8a6a33",
            borderRadius: 10,
            padding: "10px 14px",
            fontSize: 13.5,
            fontWeight: 600,
            marginBottom: 8,
          }}
        >
          {grant.pauseEnd
            ? `Vesting paused ${grant.pauseStart} → ${grant.pauseEnd} — the schedule shifts by the pause length.`
            : `Vesting paused since ${grant.pauseStart} (open-ended) — flat until resumed.`}{" "}
          Units stay reserved in the pool.
          {grant.terminationDate &&
            grant.pauseStart &&
            grant.pauseStart >= grant.terminationDate &&
            " This pause starts after the termination, so it currently has no effect — kept in case the termination is removed."}
        </div>
      )}
    </>
  ) : null;

  const title = grant
    ? editing
      ? `Edit grant #${gid(grant.seq)}`
      : `Grant #${gid(grant.seq)}`
    : "Create grant";

  const decY =
    vesting.mode === "normal"
      ? Math.max(0, ...vesting.annualPercents.map(countDec))
      : 0;
  const decT =
    vesting.mode === "advanced"
      ? Math.max(0, ...vesting.tranches.map((t) => countDec(t.percent)))
      : 0;

  return (
    <Modal title={title} onClose={onClose} lg dismissable={!!grant && !editing}>
      {editing ? (
        <>
          {lifecycleBanners}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: "18px 28px",
            }}
          >
            {/* ---- grant details ---- */}
            <div style={{ minWidth: 0 }}>
              <label className="lab">Stakeholder</label>
              <div style={{ position: "relative" }} ref={shRef}>
                <input
                  className="inp"
                  placeholder="Type a name to search…"
                  value={shQuery}
                  onFocus={() => {
                    setShQuery(""); // clear so you can search from scratch
                    setShOpen(true);
                    setError(null);
                  }}
                  onChange={(e) => {
                    setShQuery(e.target.value);
                    setShOpen(true);
                  }}
                />
                {shOpen && shFiltered.length > 0 && (
                  <div
                    style={{
                      position: "absolute",
                      left: 0,
                      right: 0,
                      top: "calc(100% + 4px)",
                      zIndex: 60,
                      background: "var(--bg2)",
                      border: "1px solid var(--line)",
                      borderRadius: 8,
                      boxShadow: "var(--shadow)",
                      maxHeight: 240,
                      overflowY: "auto",
                      padding: 4,
                    }}
                  >
                    {shFiltered.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          gap: 10,
                          width: "100%",
                          textAlign: "left",
                          border: 0,
                          background:
                            s.id === stakeholderId
                              ? "var(--accent-soft)"
                              : "transparent",
                          color: "var(--ink)",
                          padding: "8px 10px",
                          borderRadius: 6,
                          cursor: "pointer",
                          fontSize: 14,
                          fontFamily: "var(--fb)",
                        }}
                        onClick={() => {
                          setStakeholderId(s.id);
                          setShQuery(fullName(s) || "—");
                          setShOpen(false);
                        }}
                      >
                        <span
                          style={{
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {fullName(s) || "—"}
                        </span>
                        <span
                          style={{
                            color: "var(--muted)",
                            fontSize: 12,
                            flex: "none",
                          }}
                        >
                          {idLabel(s.seq)}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* STK-06: creating a grant for a terminated person flips their
                  status back to Active (vesting reality) — say so up front */}
              {!grant &&
                selStake &&
                (() => {
                  const status = stakeholderStatus(
                    grantsForStakeholder(selStake.id),
                    todayISO(),
                  );
                  const pl = selStake.terminationDate;
                  if (!pl && status !== "terminated") return null;
                  return (
                    <div
                      style={{
                        background: "#f3ead9",
                        color: "#8a6a33",
                        borderRadius: 8,
                        padding: "9px 12px",
                        fontSize: 12.5,
                        fontWeight: 600,
                        marginTop: 8,
                      }}
                    >
                      {fullName(selStake) || "This stakeholder"} is terminated
                      {pl
                        ? ` (person-level, from ${pl})`
                        : " (all their grants are terminated)"}
                      . This new grant vests normally, so their status will
                      show <strong>Active</strong> again — their previously
                      terminated grants stay terminated.
                    </div>
                  );
                })()}

              <label className="lab">Pool</label>
              <div className="row">
                <div style={{ position: "relative", flex: 1 }} ref={poolRef}>
                  <input
                    className="inp"
                    placeholder="— None — (type to search)"
                    value={poolQuery}
                    onFocus={() => {
                      setPoolQuery("");
                      setPoolShow(true);
                    }}
                    onChange={(e) => {
                      setPoolQuery(e.target.value);
                      setPoolShow(true);
                    }}
                  />
                  {poolShow && (
                    <div style={ddS}>
                      <button
                        type="button"
                        style={{
                          ...optBase,
                          background: !poolId
                            ? "var(--accent-soft)"
                            : "transparent",
                          color: "var(--muted)",
                        }}
                        onClick={() => {
                          setPoolId("");
                          setPoolQuery("");
                          setPoolShow(false);
                        }}
                      >
                        — None —
                      </button>
                      {poolFiltered.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          style={{
                            ...optBase,
                            background:
                              p.id === poolId
                                ? "var(--accent-soft)"
                                : "transparent",
                          }}
                          onClick={() => {
                            setPoolId(p.id);
                            setPoolQuery(p.name);
                            setPoolShow(false);
                          }}
                        >
                          <span
                            style={{
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {p.name}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setPoolOpen(true)}
                >
                  + Create pool
                </button>
              </div>

              <label className="lab">Quantity</label>
              <input
                className="inp"
                inputMode="numeric"
                placeholder="e.g. 10000"
                value={qty}
                onChange={(e) => {
                  setQty(e.target.value.replace(/[^\d]/g, "").slice(0, QTY_MAX));
                  setError(null);
                }}
              />
              {selPool && selPool.quantity != null && (
                <p
                  style={{
                    fontSize: 12,
                    marginTop: 6,
                    color: overCapacity ? "#b23b3b" : "var(--muted)",
                  }}
                >
                  {overCapacity
                    ? `Exceeds pool — only ${poolRemaining?.toLocaleString()} left in ${selPool.name}.`
                    : `${poolRemaining?.toLocaleString()} of ${selPool.quantity.toLocaleString()} left in ${selPool.name}.`}
                </p>
              )}

              <label className="lab">Strike price (optional)</label>
              <input
                className="inp"
                inputMode="decimal"
                placeholder="e.g. 0.50"
                value={strike}
                onChange={(e) => setStrike(e.target.value.replace(/[^\d.]/g, ""))}
              />

              <label className="lab">Grant date</label>
              <input
                className="inp"
                type="date"
                value={grantDate}
                onChange={(e) => setGrantDate(e.target.value)}
              />
            </div>

            {/* ---- vesting ---- */}
            <div style={{ minWidth: 0 }}>
              <label className="lab">Vesting</label>
              <div className="seg">
                <button
                  type="button"
                  className={"seg-b" + (vesting.mode === "normal" ? " on" : "")}
                  onClick={toNormal}
                >
                  Normal
                </button>
                <button
                  type="button"
                  className={
                    "seg-b" + (vesting.mode === "advanced" ? " on" : "")
                  }
                  onClick={toAdvanced}
                >
                  Advanced
                </button>
              </div>

              <div style={boxS}>
                {vesting.mode === "normal" ? (
                  <>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: 12,
                      }}
                    >
                      <div>
                        <label className="lab">Vesting period</label>
                        <div style={rowS}>
                          <input
                            className="inp"
                            inputMode="numeric"
                            value={periodDraft ?? String(period)}
                            onFocus={() => setPeriodDraft(String(period))}
                            onChange={(e) =>
                              setPeriodDraft(
                                e.target.value.replace(/[^\d]/g, ""),
                              )
                            }
                            onBlur={() => {
                              setPeriod(Math.max(1, int(periodDraft ?? "")));
                              setPeriodDraft(null);
                            }}
                          />
                          <span style={pctS}>yr</span>
                        </div>
                      </div>
                      <div>
                        <label className="lab">Cliff</label>
                        <div style={rowS}>
                          <input
                            className="inp"
                            inputMode="numeric"
                            value={vesting.cliff.years}
                            onChange={(e) => setCliffYears(int(e.target.value))}
                          />
                          <span style={pctS}>yr</span>
                          <input
                            className="inp"
                            inputMode="numeric"
                            value={vesting.cliff.months}
                            onChange={(e) => setCliffMonths(int(e.target.value))}
                          />
                          <span style={pctS}>mo</span>
                        </div>
                      </div>
                    </div>

                    <label className="lab">Vesting frequency</label>
                    <select
                      className="inp"
                      value={vesting.freq}
                      onChange={(e) => setFreq(e.target.value as Freq)}
                    >
                      {FREQS.map((f) => (
                        <option key={f.value} value={f.value}>
                          {f.label}
                        </option>
                      ))}
                    </select>

                    <label className="lab">Vesting schedule</label>
                    {vesting.annualPercents.map((p, i) => (
                      <div style={rowS} key={i}>
                        <span style={yrS}>Year {i + 1}</span>
                        <PercentInput
                          value={p}
                          decimals={decY}
                          onChange={(v) => setYear(i, v)}
                          style={{ flex: 1, minWidth: 0 }}
                        />
                        <span style={pctS}>%</span>
                        <button
                          type="button"
                          style={rmS}
                          title="Remove year"
                          onClick={() => removeYear(i)}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      style={{ marginTop: 8 }}
                      onClick={addYear}
                    >
                      + Add year
                    </button>
                    {(vesting.cliff.years > 0 || vesting.cliff.months > 0) && (
                      <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 10 }}>
                        Nothing vests until the cliff (
                        {vesting.cliff.years > 0 ? `${vesting.cliff.years} yr` : ""}
                        {vesting.cliff.months > 0 ? ` ${vesting.cliff.months} mo` : ""}
                        ). On that date everything earned so far vests at once, then
                        it steps{" "}
                        {FREQS.find((f) => f.value === vesting.freq)?.label.toLowerCase()}.
                      </p>
                    )}
                  </>
                ) : (
                  <>
                    <p style={{ fontSize: 12, color: "var(--muted)", margin: 0 }}>
                      Pick the exact date and share for each vesting event.
                    </p>
                    {vesting.tranches.map((t, i) => (
                      <div style={rowS} key={i}>
                        <input
                          className="inp"
                          type="date"
                          style={{ flex: 1, minWidth: 0 }}
                          value={t.date}
                          onChange={(e) =>
                            setTranche(i, { date: e.target.value })
                          }
                        />
                        <PercentInput
                          value={t.percent}
                          decimals={decT}
                          onChange={(v) => setTranche(i, { percent: v })}
                          style={{ width: 74, flex: "none" }}
                        />
                        <span style={pctS}>%</span>
                        <button
                          type="button"
                          style={rmS}
                          title="Remove"
                          onClick={() => removeTranche(i)}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      style={{ marginTop: 8 }}
                      onClick={addTranche}
                    >
                      + Add vesting date
                    </button>
                  </>
                )}

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginTop: 12,
                    paddingTop: 10,
                    borderTop: "1px solid var(--line)",
                    fontWeight: 700,
                    fontSize: 14,
                    color: complete ? "#2f7d4f" : "#b23b3b",
                  }}
                >
                  <span>Total vesting</span>
                  <span>
                    {complete ? `${total}% ✓` : `${total}% — must equal 100%`}
                  </span>
                </div>
                {complete && fvd && (
                  <p
                    style={{
                      fontSize: 12,
                      color: "var(--muted)",
                      marginTop: 8,
                    }}
                  >
                    Fully vested by <strong>{fvd}</strong> · vested today{" "}
                    <strong>{vestedNow}%</strong>.
                  </p>
                )}
              </div>
            </div>
          </div>

          {error && <p className="form-err">{error}</p>}

          <div className="modal-actions">
            <button
              className="btn btn-ghost"
              onClick={() => (grant ? setEditing(false) : onClose())}
            >
              Cancel
            </button>
            <button className="btn btn-pri" onClick={save} disabled={!valid}>
              {grant ? "Save" : "Create grant"}
            </button>
          </div>
        </>
      ) : grant ? (
        <>
          {lifecycleBanners}
          <div className="vrow">
            <span className="vlab">Stakeholder</span>
            <span className="vval">
              {sh(grant.stakeholderId) ? fullName(sh(grant.stakeholderId)!) : "—"}
            </span>
          </div>
          <div className="vrow">
            <span className="vlab">Pool</span>
            <span className="vval">{poolName(grant.poolId)}</span>
          </div>
          <div className="vrow">
            <span className="vlab">Quantity</span>
            <span className="vval">{grant.quantity.toLocaleString()}</span>
          </div>
          <div className="vrow">
            <span className="vlab">Grant date</span>
            <span className="vval">{grant.grantDate}</span>
          </div>
          <div className="vrow">
            <span className="vlab">Strike</span>
            <span className="vval">
              {grant.strike != null ? (
                grant.strike
              ) : (
                <span className="muted-cell">—</span>
              )}
            </span>
          </div>
          <div className="vrow">
            <span className="vlab">Vested today</span>
            <span className="vval">
              {vestedNow}% ·{" "}
              {Math.floor(
                grant.quantity *
                  vestedFraction(
                    grant.vesting,
                    grant.grantDate,
                    todayISO(),
                    grant,
                  ),
              ).toLocaleString()}
            </span>
          </div>
          {grant.terminationDate && (
            <div className="vrow">
              <span className="vlab">Forfeited</span>
              <span className="vval">
                {(
                  grant.quantity -
                  reservedUnits(
                    grant.quantity,
                    grant.vesting,
                    grant.grantDate,
                    grant,
                  )
                ).toLocaleString()}
              </span>
            </div>
          )}
          <div className="vrow">
            <span className="vlab">Fully vested</span>
            <span className="vval">
              {grant.terminationDate && lifetimeFrac < 1 ? (
                <span className="muted-cell">— vesting terminated</span>
              ) : (
                (fvd ?? <span className="muted-cell">— vesting paused</span>)
              )}
            </span>
          </div>
          <div className="created-foot">
            Created {new Date(grant.createdAt).toLocaleString()} by{" "}
            {grant.createdBy}
          </div>

          {/* ---- lifecycle panels (GRANT-16/17) ---- */}
          {panel === "terminate" && (
            <div style={boxS}>
              <label className="lab">Terminate vesting from</label>
              <div style={rowS}>
                <input
                  className="inp"
                  type="date"
                  style={{ flex: 1, minWidth: 0 }}
                  value={termDraft}
                  onChange={(e) => setTermDraft(e.target.value)}
                />
              </div>
              <p style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 10 }}>
                Vesting stops from this date — a tranche landing exactly on it
                does <strong>not</strong> vest.{" "}
                {termPreview.keep === 0 ? (
                  <strong>Before the cliff: nothing vested — all{" "}
                  {grant.quantity.toLocaleString()} units forfeited.</strong>
                ) : termPreview.returned === 0 ? (
                  <strong>Already fully vested by this date — terminating has
                  no effect.</strong>
                ) : (
                  <>
                    Keeps <strong>{termPreview.keep.toLocaleString()}</strong>{" "}
                    vested; forfeits{" "}
                    <strong>{termPreview.returned.toLocaleString()}</strong>
                    {grantPool ? ` (returned to ${grantPool.name})` : ""}.
                  </>
                )}{" "}
                Reversible — you can un-terminate later.
              </p>
              <div className="modal-actions">
                <button className="btn btn-ghost" onClick={() => setPanel(null)}>
                  Cancel
                </button>
                <button
                  className="btn btn-pri"
                  disabled={!termDraft}
                  onClick={doTerminate}
                >
                  Terminate vesting
                </button>
              </div>
            </div>
          )}

          {panel === "unterminate" && (
            <div style={boxS}>
              <p style={{ fontSize: 12.5, color: "var(--muted)", margin: 0 }}>
                <strong>All previously-scheduled vesting will resume</strong> —
                use <strong>Pause vesting</strong> instead if you want a
                temporary hold.
                {grantPool && unterminateShort === 0
                  ? ` The forfeited units will be re-reserved in ${grantPool.name}.`
                  : ""}
              </p>
              {unterminateShort > 0 && grantPool && (
                <div
                  style={{
                    background: "#f6e2e0",
                    color: "#b23b3b",
                    borderRadius: 8,
                    padding: "9px 12px",
                    fontSize: 13,
                    fontWeight: 600,
                    marginTop: 10,
                  }}
                >
                  Blocked — {grantPool.name} is{" "}
                  {unterminateShort.toLocaleString()} unit
                  {unterminateShort === 1 ? "" : "s"} short of re-reserving
                  this grant (they were re-granted meanwhile). Free up
                  capacity or expand the pool first.
                </div>
              )}
              {/* third option: keep the termination, just move its date */}
              <label className="lab" style={{ marginTop: 12 }}>
                …or amend the termination date (currently{" "}
                {grant.terminationDate})
              </label>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  className="inp"
                  type="date"
                  style={{ maxWidth: 200 }}
                  value={amendDraft}
                  onChange={(e) => setAmendDraft(e.target.value)}
                />
                <button
                  className="btn btn-ghost"
                  disabled={
                    !amendDraft ||
                    amendDraft === grant.terminationDate ||
                    amendShort > 0
                  }
                  title={
                    amendShort > 0 && grantPool
                      ? `Moving it later needs more units than ${grantPool.name} has — short ${amendShort.toLocaleString()}`
                      : undefined
                  }
                  onClick={doAmendTermination}
                >
                  Amend date
                </button>
              </div>
              {amendShort > 0 && grantPool && (
                <p style={{ fontSize: 12, color: "#b23b3b", fontWeight: 600, marginTop: 6 }}>
                  Moving the date later re-reserves more units —{" "}
                  {grantPool.name} is {amendShort.toLocaleString()} short.
                </p>
              )}
              <div className="modal-actions">
                <button className="btn btn-ghost" onClick={() => setPanel(null)}>
                  Cancel
                </button>
                <button
                  className="btn btn-pri"
                  disabled={unterminateShort > 0}
                  title={
                    unterminateShort > 0 && grantPool
                      ? `${grantPool.name} is ${unterminateShort.toLocaleString()} unit${unterminateShort === 1 ? "" : "s"} short — free up capacity or expand the pool`
                      : undefined
                  }
                  onClick={doUnterminate}
                >
                  Reinstate vesting
                </button>
              </div>
            </div>
          )}

          {panel === "delete" && (
            <div style={boxS}>
              <p style={{ fontSize: 12.5, color: "var(--muted)", margin: 0 }}>
                <strong style={{ color: "#b23b3b" }}>
                  Delete is permanent
                </strong>{" "}
                — the grant is removed from every list, chart and report (its
                audit trail survives on the stakeholder's and pool's logs).
                This is <strong>not</strong> Terminate: use{" "}
                <strong>Terminate vesting</strong> for a leaver.{" "}
                {(() => {
                  const vested = Math.floor(
                    grant.quantity *
                      vestedFraction(
                        grant.vesting,
                        grant.grantDate,
                        todayISO(),
                        grant,
                      ),
                  );
                  const freed = reservedUnits(
                    grant.quantity,
                    grant.vesting,
                    grant.grantDate,
                    grant,
                  );
                  return (
                    <>
                      {vested > 0 && (
                        <strong style={{ color: "#b23b3b" }}>
                          {vested.toLocaleString()} units have already vested —
                          deleting erases that record.{" "}
                        </strong>
                      )}
                      {freed.toLocaleString()} reserved units{" "}
                      {grantPool
                        ? `return to ${grantPool.name}.`
                        : "are released (no pool)."}
                    </>
                  );
                })()}
              </p>
              <div className="modal-actions">
                <button className="btn btn-ghost" onClick={() => setPanel(null)}>
                  Cancel
                </button>
                <button
                  className="btn btn-pri"
                  onClick={() => {
                    deleteGrant(grant.id);
                    notify(`Grant #${gid(grant.seq)} deleted`);
                    onClose();
                  }}
                >
                  Delete grant
                </button>
              </div>
            </div>
          )}

          {panel === "removepause" && (
            <div style={boxS}>
              <p style={{ fontSize: 12.5, color: "var(--muted)", margin: 0 }}>
                <strong>This removes the pause entirely</strong> — the schedule
                recomputes as if it had never happened (any delay snaps back).
                It's a <strong>removal, not an un-pause</strong>: to end a
                leave, set the pause's <strong>Until</strong> date instead.
                The pause stays visible in the audit log.
              </p>
              <div className="modal-actions">
                <button
                  className="btn btn-ghost"
                  onClick={() => setPanel("pause")}
                >
                  Back
                </button>
                <button className="btn btn-pri" onClick={doRemovePause}>
                  Remove pause
                </button>
              </div>
            </div>
          )}

          {panel === "pause" && (
            <div style={boxS}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 12,
                }}
              >
                <div>
                  <label className="lab">Pause from</label>
                  <input
                    className="inp"
                    type="date"
                    value={psDraft}
                    onChange={(e) => setPsDraft(e.target.value)}
                  />
                </div>
                <div>
                  <label className="lab">Until (optional)</label>
                  <input
                    className="inp"
                    type="date"
                    value={peDraft}
                    onChange={(e) => setPeDraft(e.target.value)}
                  />
                </div>
              </div>
              <p style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 10 }}>
                {peDraft
                  ? "Every vesting date from the pause start shifts by the pause length — the grant still reaches 100%, just later."
                  : "Without an end date, vesting freezes until you resume (add an end date later and the schedule recomputes)."}{" "}
                Units <strong>stay reserved</strong> in the pool — pausing
                returns nothing (unlike Terminate).
                {peDraft && peDraft < psDraft && (
                  <strong style={{ color: "#b23b3b" }}>
                    {" "}
                    End date is before the start.
                  </strong>
                )}
              </p>
              <div className="modal-actions">
                <button className="btn btn-ghost" onClick={() => setPanel(null)}>
                  Cancel
                </button>
                {grant.pauseStart && (
                  <button
                    className="btn btn-ghost"
                    onClick={() => setPanel("removepause")}
                  >
                    Remove pause…
                  </button>
                )}
                <button
                  className="btn btn-pri"
                  disabled={pauseInvalid}
                  onClick={doPause}
                >
                  {grant.pauseStart ? "Update pause" : "Pause vesting"}
                </button>
              </div>
            </div>
          )}

          {panel === null && (
            <div className="modal-actions">
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setLogOpen(true)}
              >
                Audit log
              </button>
              <button
                className="btn btn-ghost btn-sm"
                style={{ color: "#b23b3b", borderColor: "#e0b7b0" }}
                onClick={() => setPanel("delete")}
              >
                Delete…
              </button>
              {grant.terminationDate ? (
                <button
                  className="btn btn-ghost"
                  onClick={() => {
                    setAmendDraft(grant.terminationDate ?? "");
                    setPanel("unterminate");
                  }}
                >
                  Un-terminate…
                </button>
              ) : (
                <button
                  className="btn btn-ghost"
                  onClick={() => {
                    setTermDraft(todayISO());
                    setPanel("terminate");
                  }}
                >
                  Terminate vesting…
                </button>
              )}
              <button
                className="btn btn-ghost"
                onClick={() => {
                  setPsDraft(grant.pauseStart ?? todayISO());
                  setPeDraft(grant.pauseEnd ?? "");
                  setPanel("pause");
                }}
              >
                {grant.pauseStart ? "Edit pause…" : "Pause vesting…"}
              </button>
              <span style={{ flex: 1 }} />
              <button className="btn btn-pri" onClick={() => setEditing(true)}>
                Edit
              </button>
            </div>
          )}
        </>
      ) : null}

      {poolOpen && (
        <PoolDialog
          onClose={() => setPoolOpen(false)}
          onCreated={(p) => {
            setPoolId(p.id);
            setPoolQuery(p.name);
          }}
        />
      )}
      {logOpen && grant && (
        <LogDialog
          objectId={grant.id}
          title={`Grant #${gid(grant.seq)}`}
          onClose={() => setLogOpen(false)}
        />
      )}
    </Modal>
  );
}
