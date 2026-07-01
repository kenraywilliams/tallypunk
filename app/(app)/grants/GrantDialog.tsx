"use client";

import { useState } from "react";
import { useSandbox, type Grant } from "../SandboxProvider";
import Modal from "../Modal";
import PoolDialog from "../pools/PoolDialog";
import { fullName } from "../stakeholders/util";
import {
  FREQS,
  annualSeed,
  defaultVesting,
  evenSplit,
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
  const { stakeholders, pools, addGrant, updateGrant, notify } = useSandbox();
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
  const [evenPct, setEvenPct] = useState("25");
  const [poolOpen, setPoolOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sh = (id: string) => stakeholders.find((s) => s.id === id);
  const poolName = (id: string | null) =>
    id ? (pools.find((p) => p.id === id)?.name ?? "—") : "None";

  // ---- vesting editors ----
  const setCliff = (patch: { years?: number; months?: number }) => {
    if (vesting.mode !== "normal") return;
    setVesting({ ...vesting, cliff: { ...vesting.cliff, ...patch } });
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
    if (vesting.mode !== "normal") return;
    setVesting({
      ...vesting,
      annualPercents: vesting.annualPercents.filter((_, idx) => idx !== i),
    });
  };
  const applyEven = () => {
    if (vesting.mode !== "normal") return;
    setVesting({ ...vesting, annualPercents: evenSplit(Number(evenPct)) });
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
  const valid = !!stakeholderId && Number(qty) > 0 && complete;

  const save = () => {
    if (!stakeholderId) return setError("Choose a stakeholder.");
    const q = Number(qty);
    if (!q || q <= 0) return setError("Enter a quantity.");
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

  return (
    <Modal title={title} onClose={onClose} lg dismissable={!!grant && !editing}>
      {editing ? (
        <>
          <label className="lab">Stakeholder</label>
          <select
            className="inp"
            value={stakeholderId}
            onChange={(e) => {
              setStakeholderId(e.target.value);
              setError(null);
            }}
          >
            <option value="">— Select stakeholder —</option>
            {stakeholders.map((s) => (
              <option key={s.id} value={s.id}>
                {fullName(s) || "—"}
              </option>
            ))}
          </select>

          <label className="lab">Pool</label>
          <div className="row">
            <select
              className="inp"
              value={poolId}
              onChange={(e) => setPoolId(e.target.value)}
            >
              <option value="">— None —</option>
              {pools.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setPoolOpen(true)}
            >
              + Create pool
            </button>
          </div>

          <div className="frow2">
            <div>
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
            </div>
            <div>
              <label className="lab">Strike price (optional)</label>
              <input
                className="inp"
                inputMode="decimal"
                placeholder="e.g. 0.50"
                value={strike}
                onChange={(e) => setStrike(e.target.value.replace(/[^\d.]/g, ""))}
              />
            </div>
          </div>

          <label className="lab">Grant date</label>
          <input
            className="inp"
            type="date"
            value={grantDate}
            onChange={(e) => setGrantDate(e.target.value)}
          />

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
              className={"seg-b" + (vesting.mode === "advanced" ? " on" : "")}
              onClick={toAdvanced}
            >
              Advanced
            </button>
          </div>

          <div className="vbuild">
            {vesting.mode === "normal" ? (
              <>
                <div className="frow2">
                  <div>
                    <label className="lab">Cliff</label>
                    <div className="row">
                      <div className="pctwrap" style={{ flex: 1 }}>
                        <input
                          className="inp"
                          inputMode="numeric"
                          value={vesting.cliff.years}
                          onChange={(e) =>
                            setCliff({ years: num(e.target.value) })
                          }
                        />
                        <span className="pctsign">yr</span>
                      </div>
                      <div className="pctwrap" style={{ flex: 1 }}>
                        <input
                          className="inp"
                          inputMode="numeric"
                          value={vesting.cliff.months}
                          onChange={(e) =>
                            setCliff({ months: num(e.target.value) })
                          }
                        />
                        <span className="pctsign">mo</span>
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="lab">Frequency</label>
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
                  </div>
                </div>

                <label className="lab">Vest per year</label>
                <div className="row">
                  <div className="pctwrap" style={{ flex: 1 }}>
                    <input
                      className="inp"
                      inputMode="decimal"
                      value={evenPct}
                      onChange={(e) =>
                        setEvenPct(e.target.value.replace(/[^\d.]/g, ""))
                      }
                    />
                    <span className="pctsign">%</span>
                  </div>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={applyEven}
                  >
                    Fill evenly
                  </button>
                </div>

                {vesting.annualPercents.map((p, i) => (
                  <div className="vyear" key={i}>
                    <span className="yr">Year {i + 1}</span>
                    <div className="pctwrap">
                      <input
                        className="inp"
                        inputMode="decimal"
                        value={p}
                        onChange={(e) => setYear(i, num(e.target.value))}
                      />
                      <span className="pctsign">%</span>
                    </div>
                    <button
                      type="button"
                      className="vrm"
                      aria-label="Remove year"
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
                <p className="vhint">
                  Pick the exact date and share for each vesting event.
                </p>
                {vesting.tranches.map((t, i) => (
                  <div className="vtranche" key={i}>
                    <input
                      className="inp"
                      type="date"
                      value={t.date}
                      onChange={(e) => setTranche(i, { date: e.target.value })}
                    />
                    <div className="pctwrap">
                      <input
                        className="inp"
                        inputMode="decimal"
                        value={t.percent}
                        onChange={(e) =>
                          setTranche(i, { percent: num(e.target.value) })
                        }
                      />
                      <span className="pctsign">%</span>
                    </div>
                    <button
                      type="button"
                      className="vrm"
                      aria-label="Remove tranche"
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

            <div className={"vtotal " + (complete ? "ok" : "bad")}>
              <span>Total vesting</span>
              <span>{complete ? `${total}% ✓` : `${total}% — must equal 100%`}</span>
            </div>
            {complete && fvd && (
              <p className="vhint">
                Fully vested by <strong>{fvd}</strong> · vested today{" "}
                <strong>{vestedNow}%</strong>.
              </p>
            )}
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
          onCreated={(p) => setPoolId(p.id)}
        />
      )}
    </Modal>
  );
}
