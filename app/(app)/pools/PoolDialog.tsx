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
  const { companies, pools, addPool, updatePool, grantedFor, notify } =
    useSandbox();
  const [editing, setEditing] = useState(pool ? !!startEdit : true);
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
      {editing ? (
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
            <button className="btn btn-pri" onClick={save} disabled={!dirty}>
              {pool ? "Save" : "Create pool"}
            </button>
          </div>
          {error && <p className="form-err" style={{ textAlign: "right" }}>{error}</p>}
        </>
      ) : pool ? (
        <>
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
          <div className="modal-actions">
            <button className="btn btn-ghost btn-sm" onClick={() => setLogOpen(true)}>
              Audit log
            </button>
            <span style={{ flex: 1 }} />
            <button className="btn btn-pri" onClick={() => setEditing(true)}>
              Edit
            </button>
          </div>
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
          onClose={() => setLogOpen(false)}
        />
      )}
    </Modal>
  );
}
