"use client";

import { useState } from "react";
import {
  useSandbox,
  type Company,
  type Pool,
  type PoolType,
} from "../SandboxProvider";
import CompanyDialog from "../CompanyDialog";
import LogDialog from "../LogDialog";
import Modal from "../Modal";
import Tip from "../Tip";
import { reservedUnits } from "../grants/vesting";

const PHANTOM_TIP =
  "Phantom (virtual) stock — cash-settled. Tracks value like real options but pays out cash, so no actual shares are issued and the cap table isn't diluted.";
const INFINITY_TIP =
  "Uncapped pool — lets you grant options without setting a fixed size, handy before you know the pool size. Give it a real size later and grants are then capacity-checked against it.";
const NAME_MAX = 20;
const QTY_MAX_DIGITS = 13; // 9,999,999,999,999 = one below 10 trillion

export default function PoolDialog({
  pool,
  startEdit,
  onClose,
  onCreated,
}: {
  pool?: Pool;
  startEdit?: boolean;
  onClose: () => void;
  onCreated?: (p: Pool) => void;
}) {
  const {
    companies,
    pools,
    stakeholders,
    addPool,
    updatePool,
    grantedFor,
    grantsForPool,
    deletePool,
    notify,
  } = useSandbox();
  // the General Pool is an inherent structure — never editable
  const [editing, setEditing] = useState(
    pool ? !!startEdit && !pool.isGeneral : true,
  );

  // ---- delete wizard (GBL-09 pool cascade) ----
  const [delOpen, setDelOpen] = useState(false);
  const [delMode, setDelMode] = useState<"general" | "choose" | "delete">(
    "general",
  );
  const [chosenId, setChosenId] = useState("");
  // per-grant override: "top" (follow the top-level choice) | "general" |
  // "delete" | a specific pool id
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [delConfirm, setDelConfirm] = useState("");
  const [delSummary, setDelSummary] = useState<null | {
    poolName: string;
    rows: { label: string; owner: string; landed: string }[];
  }>(null);
  const [name, setName] = useState(pool?.name ?? "Pool 1");
  const [type, setType] = useState<PoolType>(pool?.type ?? "real");
  const [companyId, setCompanyId] = useState(pool?.companyId ?? "");
  const [qty, setQty] = useState(pool?.quantity != null ? String(pool.quantity) : "");
  const [qtyFocused, setQtyFocused] = useState(false);
  const [infinity, setInfinity] = useState(pool ? pool.quantity == null : false);
  const [companyOpen, setCompanyOpen] = useState(false);
  const [companyView, setCompanyView] = useState<Company | null>(null);
  const [logOpen, setLogOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetForm = () => {
    setName(pool?.name ?? "Pool 1");
    setType(pool?.type ?? "real");
    setCompanyId(pool?.companyId ?? "");
    setQty(pool?.quantity != null ? String(pool.quantity) : "");
    setInfinity(pool ? pool.quantity == null : false);
    setError(null);
  };

  const companyName = (id: string | null) =>
    id ? (companies.find((c) => c.id === id)?.name ?? "—") : "—";
  const qtyDisplay = infinity
    ? ""
    : qtyFocused
      ? qty
      : qty === ""
        ? ""
        : Number(qty).toLocaleString();

  const effCompany = companyId || null;
  const effQtyNum = Number(qty);
  const effQty =
    !infinity && qty !== "" && !Number.isNaN(effQtyNum) && effQtyNum > 0
      ? effQtyNum
      : null;
  const dirty =
    !pool ||
    name.trim() !== pool.name ||
    type !== pool.type ||
    effCompany !== pool.companyId ||
    effQty !== pool.quantity;
  const showInfinityNote =
    !!pool && !infinity && (qty === "" || Number(qty) <= 0) && !dirty;

  // Pool-size FLOOR: a pool can never be sized below what it has already
  // RESERVED (termination-aware — forfeited units don't count). Without this,
  // shrinking a pool (or unticking Infinity after granting) silently creates
  // a deficit and the cap means nothing.
  const reserved = pool ? grantedFor(pool.id) : 0;
  const belowReserved =
    !!pool && !infinity && effQty != null && effQty < reserved;

  // ---- delete-wizard derivations ----
  const affected = pool ? grantsForPool(pool.id) : [];
  const generalId = pools.find((x) => x.isGeneral)?.id ?? null;
  const otherPools = pools.filter((x) => x.id !== pool?.id && !x.isGeneral);
  const resolve = (
    gId: string,
  ): { action: "move"; poolId: string | null } | { action: "delete" } => {
    const ov = overrides[gId] ?? "top";
    const eff =
      ov === "top"
        ? delMode === "general"
          ? "general"
          : delMode === "delete"
            ? "delete"
            : chosenId || "general"
        : ov;
    if (eff === "delete") return { action: "delete" };
    if (eff === "general") return { action: "move", poolId: generalId };
    return { action: "move", poolId: eff };
  };
  const ownerName = (sid: string) => {
    const s = stakeholders.find((x) => x.id === sid);
    return s ? `${s.firstName} ${s.lastName}`.trim() || "—" : "—";
  };
  // capacity pre-flight: cumulative demand per FINITE target pool (the
  // General Pool never blocks — infinite by construction)
  const shortfalls: { target: Pool; short: number }[] = [];
  if (delOpen && pool) {
    const demand = new Map<string, number>();
    affected.forEach((g) => {
      const d = resolve(g.id);
      if (d.action === "move" && d.poolId && d.poolId !== generalId)
        demand.set(
          d.poolId,
          (demand.get(d.poolId) ?? 0) +
            reservedUnits(g.quantity, g.vesting, g.grantDate, g),
        );
    });
    demand.forEach((need, pid) => {
      const t = pools.find((x) => x.id === pid);
      if (t && t.quantity != null) {
        const rem = t.quantity - grantedFor(pid);
        if (need > rem) shortfalls.push({ target: t, short: need - rem });
      }
    });
  }
  const delBlocked =
    shortfalls.length > 0 ||
    delConfirm.trim().toLowerCase() !== "delete" ||
    (delMode === "choose" &&
      !chosenId &&
      affected.some((g) => (overrides[g.id] ?? "top") === "top"));

  const doDeletePool = () => {
    if (!pool || delBlocked) return;
    const plan: Record<
      string,
      { action: "move"; poolId: string | null } | { action: "delete" }
    > = {};
    const rows = affected
      .map((g) => {
        const d = resolve(g.id);
        plan[g.id] = d;
        return {
          label: `Grant #${String(g.seq).padStart(7, "0")}`,
          owner: ownerName(g.stakeholderId),
          landed:
            d.action === "delete"
              ? "deleted"
              : `moved to ${d.poolId ? (pools.find((x) => x.id === d.poolId)?.name ?? "—") : "None"}`,
        };
      })
      .sort((a, b) => a.owner.localeCompare(b.owner));
    const poolName = pool.name;
    deletePool(pool.id, plan);
    notify(`${poolName} deleted`);
    setDelSummary({ poolName, rows });
  };

  const save = () => {
    const finalName = name.trim() || "Pool 1";
    const dup = pools.some(
      (p) => p.id !== pool?.id && p.name.toLowerCase() === finalName.toLowerCase(),
    );
    if (dup) {
      setError("A pool with that name already exists.");
      return;
    }
    const n = Number(qty);
    const hasQty = !infinity && qty !== "" && !Number.isNaN(n) && n > 0;
    const quantity = hasQty ? n : null;
    if (pool && quantity != null && quantity < reserved) {
      setError(
        `This pool has ${reserved.toLocaleString()} units granted — minimum size is ${reserved.toLocaleString()} (or tick Infinity ∞).`,
      );
      return;
    }
    if (pool) {
      updatePool(pool.id, {
        name: finalName,
        type,
        companyId: companyId || null,
        quantity,
      });
      notify(`${finalName} updated`);
    } else {
      const created = addPool({
        name: finalName,
        type,
        companyId: companyId || null,
        quantity,
      });
      notify(
        hasQty || infinity
          ? `${created.name} created`
          : `${created.name} created as an unlimited pool`,
      );
      onCreated?.(created);
    }
    onClose();
  };

  const titleText = pool ? (editing ? "Edit pool" : pool.name) : "Create pool";

  return (
    <Modal
      title={titleText}
      onClose={onClose}
      dismissable={!!pool && !editing}
    >
      {delSummary ? (
        <>
          <div style={{ fontWeight: 700, fontSize: 14 }}>
            Done — {delSummary.poolName} deleted
          </div>
          {delSummary.rows.length === 0 ? (
            <p className="muted-note">No grants were affected.</p>
          ) : (
            <div style={{ marginTop: 8, maxHeight: 260, overflowY: "auto" }}>
              {delSummary.rows.map((r, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 10,
                    padding: "6px 0",
                    borderBottom: "1px solid var(--line)",
                    fontSize: 13.5,
                  }}
                >
                  <span>
                    <strong>{r.owner}</strong> · {r.label}
                  </span>
                  <span style={{ color: "var(--muted)" }}>{r.landed}</span>
                </div>
              ))}
            </div>
          )}
          <div className="modal-actions">
            <button className="btn btn-pri" onClick={onClose}>
              Close
            </button>
          </div>
        </>
      ) : editing ? (
        <>
          <label className="lab">Pool name</label>
          <input
            className="inp"
            maxLength={NAME_MAX}
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setError(null);
            }}
          />
          {error && <p className="form-err">{error}</p>}

          <label className="lab">Pool type</label>
          <div className="seg">
            <button
              type="button"
              className={"seg-b" + (type === "real" ? " on" : "")}
              onClick={() => setType("real")}
            >
              Stock options
            </button>
            <button
              type="button"
              className={"seg-b" + (type === "phantom" ? " on" : "")}
              onClick={() => setType("phantom")}
            >
              Phantoms <Tip text={PHANTOM_TIP} />
            </button>
          </div>

          <label className="lab">Company</label>
          <div className="row">
            <select
              className="inp"
              value={companyId}
              onChange={(e) => setCompanyId(e.target.value)}
            >
              <option value="">— None —</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setCompanyOpen(true)}
            >
              + New company
            </button>
          </div>

          <label className="lab">Quantity</label>
          <div className="row">
            <div className="qty">
              <input
                className="inp"
                type="text"
                inputMode="numeric"
                placeholder="e.g. 100000"
                value={qtyDisplay}
                onFocus={() => setQtyFocused(true)}
                onBlur={() => setQtyFocused(false)}
                onChange={(e) => {
                  const v = e.target.value.replace(/[^\d]/g, "").slice(0, QTY_MAX_DIGITS);
                  setQty(v);
                  if (infinity && v !== "") setInfinity(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.currentTarget.blur();
                }}
              />
              <span className="unit">
                {infinity ? <span className="inf">∞</span> : "options"}
              </span>
            </div>
            <label className="chk">
              <input
                type="checkbox"
                checked={infinity}
                onChange={(e) => setInfinity(e.target.checked)}
              />
              Infinity pool <span className="inf">∞</span>
              <Tip text={INFINITY_TIP} pos="right" />
            </label>
          </div>

          {showInfinityNote && (
            <p className="form-err">
              Unticking Infinity pool requires a quantity to be entered.
            </p>
          )}
          {belowReserved && (
            <p className="form-err">
              This pool has {reserved.toLocaleString()} units granted — minimum
              size is {reserved.toLocaleString()} (or tick Infinity ∞).
            </p>
          )}

          <div className="modal-actions">
            <button
              className="btn btn-ghost"
              onClick={() => {
                if (pool) {
                  resetForm();
                  setEditing(false);
                } else {
                  onClose();
                }
              }}
            >
              Cancel
            </button>
            <button
              className="btn btn-pri"
              onClick={save}
              disabled={!dirty || belowReserved}
              title={
                belowReserved
                  ? `Minimum size is ${reserved.toLocaleString()} — units already granted from this pool`
                  : undefined
              }
            >
              {pool ? "Save" : "Create pool"}
            </button>
          </div>
          {error && <p className="form-err" style={{ textAlign: "right" }}>{error}</p>}
        </>
      ) : pool ? (
        <>
          {/* deficit banner — pools created before the size floor existed (or
              hit by an old bug) can be over-granted; surface it loudly */}
          {pool.quantity != null && reserved > pool.quantity && (
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
              Over-granted — {reserved.toLocaleString()} units granted from a
              pool of {pool.quantity.toLocaleString()} (
              {(reserved - pool.quantity).toLocaleString()} over). Increase the
              size or tick Infinity ∞.
            </div>
          )}
          <div className="vrow">
            <span className="vlab">Type</span>
            <span className="vval">
              {pool.type === "phantom" ? "Phantoms" : "Stock options"}
            </span>
          </div>
          <div className="vrow">
            <span className="vlab">Company</span>
            <span className="vval">
              {pool.companyId ? (
                <button
                  className="linkbtn"
                  onClick={() =>
                    setCompanyView(
                      companies.find((c) => c.id === pool.companyId) ?? null,
                    )
                  }
                >
                  {companyName(pool.companyId)}
                </button>
              ) : (
                "—"
              )}
            </span>
          </div>
          <div className="vrow">
            <span className="vlab">Size</span>
            <span className="vval">
              {pool.quantity == null ? (
                <span className="pill-soft">
                  <span className="inf">∞</span> Unlimited
                </span>
              ) : (
                pool.quantity.toLocaleString()
              )}
            </span>
          </div>
          <div className="vrow">
            <span className="vlab">Granted</span>
            <span className="vval">{grantedFor(pool.id).toLocaleString()}</span>
          </div>
          <div className="vrow">
            <span className="vlab">Vested</span>
            <span className="vval">
              <span className="muted-cell">—</span>
            </span>
          </div>
          <div className="created-foot">
            Created {new Date(pool.createdAt).toLocaleString()} by {pool.createdBy}
          </div>
          {pool.isGeneral && (
            <p className="muted-note" style={{ marginTop: 10 }}>
              The General Pool is an inherent structure — always available,
              infinite, and can't be edited or deleted. Grants land here when
              their pool is deleted.
            </p>
          )}

          {delOpen && !pool.isGeneral && (
            <div
              style={{
                border: "1px solid var(--line)",
                borderRadius: 10,
                padding: "12px 14px",
                marginTop: 10,
                background: "var(--bg)",
              }}
            >
              <p
                style={{
                  fontSize: 12.5,
                  color: "#b23b3b",
                  fontWeight: 600,
                  margin: 0,
                }}
              >
                Deleting {pool.name} is permanent. Its grants are not — choose
                where they go:
              </p>
              <div className="seg" style={{ marginTop: 10 }}>
                <button
                  type="button"
                  className={"seg-b" + (delMode === "general" ? " on" : "")}
                  onClick={() => setDelMode("general")}
                >
                  Move all to General Pool
                </button>
                <button
                  type="button"
                  className={"seg-b" + (delMode === "choose" ? " on" : "")}
                  onClick={() => setDelMode("choose")}
                >
                  Move all to a pool…
                </button>
                <button
                  type="button"
                  className={"seg-b" + (delMode === "delete" ? " on" : "")}
                  onClick={() => setDelMode("delete")}
                >
                  Delete all grants
                </button>
              </div>
              {delMode === "choose" && (
                <select
                  className="inp"
                  style={{ marginTop: 8, maxWidth: 280 }}
                  value={chosenId}
                  onChange={(e) => setChosenId(e.target.value)}
                >
                  <option value="">— pick the target pool —</option>
                  {otherPools.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                      {p.quantity != null
                        ? ` (${(p.quantity - grantedFor(p.id)).toLocaleString()} left)`
                        : " (∞)"}
                    </option>
                  ))}
                </select>
              )}

              {affected.length === 0 ? (
                <p className="muted-note" style={{ marginTop: 10 }}>
                  No grants draw from this pool.
                </p>
              ) : (
                <div style={{ marginTop: 10, maxHeight: 220, overflowY: "auto" }}>
                  {affected.map((g) => (
                    <div
                      key={g.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        flexWrap: "wrap",
                        gap: 8,
                        padding: "6px 0",
                        borderBottom: "1px solid var(--line)",
                        fontSize: 13,
                      }}
                    >
                      <span>
                        <strong>#{String(g.seq).padStart(7, "0")}</strong> ·{" "}
                        {ownerName(g.stakeholderId)} ·{" "}
                        {reservedUnits(
                          g.quantity,
                          g.vesting,
                          g.grantDate,
                          g,
                        ).toLocaleString()}{" "}
                        units
                      </span>
                      <select
                        className="inp"
                        style={{
                          marginLeft: "auto",
                          width: 200,
                          padding: "5px 8px",
                          fontSize: 12.5,
                        }}
                        value={overrides[g.id] ?? "top"}
                        onChange={(e) =>
                          setOverrides((cur) => ({
                            ...cur,
                            [g.id]: e.target.value,
                          }))
                        }
                      >
                        <option value="top">— follow the choice above —</option>
                        <option value="general">General Pool</option>
                        {otherPools.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                        <option value="delete">Delete this grant</option>
                      </select>
                    </div>
                  ))}
                </div>
              )}

              {shortfalls.map(({ target, short }) => (
                <div
                  key={target.id}
                  style={{
                    background: "#f6e2e0",
                    color: "#b23b3b",
                    borderRadius: 8,
                    padding: "9px 12px",
                    fontSize: 13,
                    fontWeight: 600,
                    marginTop: 10,
                    display: "flex",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: 8,
                  }}
                >
                  <span>
                    {target.name} is {short.toLocaleString()} units short.
                  </span>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() =>
                      updatePool(target.id, {
                        quantity: (target.quantity ?? 0) + short,
                      })
                    }
                  >
                    + Add {short.toLocaleString()}
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => updatePool(target.id, { quantity: null })}
                  >
                    Make it Infinity ∞
                  </button>
                </div>
              ))}

              <label className="lab" style={{ marginTop: 10 }}>
                Type <strong>delete</strong> to confirm
              </label>
              <input
                className="inp"
                style={{ maxWidth: 220 }}
                value={delConfirm}
                onChange={(e) => setDelConfirm(e.target.value)}
                placeholder="delete"
              />
              <div className="modal-actions">
                <button
                  className="btn btn-ghost"
                  onClick={() => {
                    setDelOpen(false);
                    setDelConfirm("");
                    setOverrides({});
                  }}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-pri"
                  disabled={delBlocked}
                  onClick={doDeletePool}
                >
                  Delete pool
                </button>
              </div>
            </div>
          )}

          {!delOpen && (
            <div className="modal-actions">
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setLogOpen(true)}
              >
                Audit log
              </button>
              {!pool.isGeneral && (
                <button
                  className="btn btn-ghost btn-sm"
                  style={{ color: "#b23b3b", borderColor: "#e0b7b0" }}
                  onClick={() => {
                    setDelMode("general");
                    setChosenId("");
                    setOverrides({});
                    setDelConfirm("");
                    setDelOpen(true);
                  }}
                >
                  Delete…
                </button>
              )}
              <span style={{ flex: 1 }} />
              {!pool.isGeneral && (
                <button className="btn btn-pri" onClick={() => setEditing(true)}>
                  Edit
                </button>
              )}
            </div>
          )}
        </>
      ) : null}

      {companyOpen && (
        <CompanyDialog
          onClose={() => setCompanyOpen(false)}
          onCreated={(c) => setCompanyId(c.id)}
        />
      )}
      {companyView && (
        <CompanyDialog
          company={companyView}
          onClose={() => setCompanyView(null)}
        />
      )}
      {logOpen && pool && (
        <LogDialog
          objectId={pool.id}
          title={pool.name}
          rollup="pool"
          onClose={() => setLogOpen(false)}
        />
      )}
    </Modal>
  );
}
