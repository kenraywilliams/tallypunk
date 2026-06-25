"use client";

import { useState } from "react";
import { useSandbox, type PoolType } from "../SandboxProvider";
import CompanyDialog from "../CompanyDialog";

export default function CreatePoolDialog({ onClose }: { onClose: () => void }) {
  const { companies, addPool, notify } = useSandbox();
  const [name, setName] = useState("Pool 1");
  const [type, setType] = useState<PoolType>("real");
  const [companyId, setCompanyId] = useState("");
  const [qty, setQty] = useState("");
  const [infinity, setInfinity] = useState(false);
  const [companyOpen, setCompanyOpen] = useState(false);

  const create = () => {
    const finalName = name.trim() || "Pool 1";
    const qNum = Number(qty);
    const hasQty =
      !infinity && qty.trim() !== "" && !Number.isNaN(qNum) && qNum > 0;
    const quantity = hasQty ? qNum : null;
    const pool = addPool({
      name: finalName,
      type,
      companyId: companyId || null,
      quantity,
    });
    notify(
      hasQty || infinity
        ? `“${pool.name}” created`
        : `“${pool.name}” created as an unlimited pool`,
    );
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3 className="modal-title">Create pool</h3>

        <label className="lab">Pool name</label>
        <input
          className="inp"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

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
            title="Phantom (virtual) stock — cash-settled, tracks value like options but pays cash. No real shares issued, so no cap-table dilution."
          >
            Phantom <span className="info">ⓘ</span>
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
              type="number"
              min="0"
              placeholder="e.g. 100000"
              value={infinity ? "" : qty}
              disabled={infinity}
              onChange={(e) => setQty(e.target.value)}
            />
            <span className="unit">{infinity ? "∞" : "options"}</span>
          </div>
          <label
            className="chk"
            title="Uncapped pool — allows grants without a fixed size; size it later."
          >
            <input
              type="checkbox"
              checked={infinity}
              onChange={(e) => setInfinity(e.target.checked)}
            />
            Infinity pool ∞
          </label>
        </div>

        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-pri" onClick={create}>
            Create pool
          </button>
        </div>

        {companyOpen && (
          <CompanyDialog
            onClose={() => setCompanyOpen(false)}
            onCreated={(c) => setCompanyId(c.id)}
          />
        )}
      </div>
    </div>
  );
}
