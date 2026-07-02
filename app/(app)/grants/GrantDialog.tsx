"use client";

import { type CSSProperties, useEffect, useRef, useState } from "react";
import { useSandbox, type Grant } from "../SandboxProvider";
import Modal from "../Modal";
import PoolDialog from "../pools/PoolDialog";
import { fullName, idLabel } from "../stakeholders/util";
import {
  FREQS,
  annualSeed,
  defaultVesting,
  evenPercents,
  fullyVestedDate,
  isComplete,
  sumPercents,
  todayISO,
  vestedFraction,
  type Freq,
  type Vesting,
} from "./vesting";

export const gid = (seq: number) => String(seq).padStart(7, "0");
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
  grant,
  startEdit,
  presetStakeholderId,
  onClose,
}: {
  grant?: Grant;
  startEdit?: boolean;
  presetStakeholderId?: string;
  onClose: () => void;
}) {
  const { stakeholders, pools, grantedFor, addGrant, updateGrant, notify } =
    useSandbox();
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
  const [error, setError] = useState<string | null>(null);
  const [periodDraft, setPeriodDraft] = useState<string | null>(null);

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
  const period =
    vesting.mode === "normal"
      ? vesting.cliff.years + vesting.annualPercents.length
      : 0;
  const setPeriod = (p: number) => {
    if (vesting.mode !== "normal") return;
    const pp = Math.max(1, p);
    // if the period no longer leaves room for the cliff, lower the cliff (don't block)
    const cy = pp <= vesting.cliff.years ? Math.max(0, pp - 1) : vesting.cliff.years;
    const rows = Math.max(1, pp - cy);
    setVesting({
      ...vesting,
      cliff: { ...vesting.cliff, years: cy },
      annualPercents: evenPercents(rows),
    });
  };
  const setCliffYears = (cy: number) => {
    if (vesting.mode !== "normal") return;
    const curPeriod = vesting.cliff.years + vesting.annualPercents.length;
    const rows = Math.max(1, curPeriod - cy);
    setVesting({
      ...vesting,
      cliff: { ...vesting.cliff, years: cy },
      annualPercents: evenPercents(rows),
    });
  };
  const setCliffMonths = (m: number) => {
    if (vesting.mode !== "normal") return;
    setVesting({ ...vesting, cliff: { ...vesting.cliff, months: m } });
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
    setVesting({
      ...vesting,
      annualPercents: vesting.annualPercents.filter((_, idx) => idx !== i),
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
  const fvd = fullyVestedDate(vesting, grantDate);
  const vestedNow = Math.round(
    vestedFraction(vesting, grantDate, todayISO()) * 100,
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
                        <span style={yrS}>Year {vesting.cliff.years + i + 1}</span>
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
                  vestedFraction(grant.vesting, grant.grantDate, todayISO()),
              ).toLocaleString()}
            </span>
          </div>
          <div className="vrow">
            <span className="vlab">Fully vested</span>
            <span className="vval">{fvd ?? "—"}</span>
          </div>
          <div className="created-foot">
            Created {new Date(grant.createdAt).toLocaleString()} by{" "}
            {grant.createdBy}
          </div>
          <div className="modal-actions">
            <span style={{ flex: 1 }} />
            <button className="btn btn-pri" onClick={() => setEditing(true)}>
              Edit
            </button>
          </div>
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
    </Modal>
  );
}
