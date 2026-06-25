"use client";

import { useState } from "react";
import { useSandbox } from "../SandboxProvider";
import CreatePoolDialog from "./CreatePoolDialog";

export default function PoolsPage() {
  const { pools, companies, hydrated, resetSandbox } = useSandbox();
  const [open, setOpen] = useState(false);

  const companyName = (id: string | null) =>
    id ? (companies.find((c) => c.id === id)?.name ?? "—") : "—";

  if (!hydrated) {
    return (
      <div className="page">
        <div className="page-head">
          <h1 className="page-title">Pools</h1>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-head">
        <h1 className="page-title">Pools</h1>
        {pools.length > 0 && (
          <div className="right">
            <button className="reset" onClick={resetSandbox}>
              Reset sandbox
            </button>
            <button className="btn btn-pri btn-sm" onClick={() => setOpen(true)}>
              + Create pool
            </button>
          </div>
        )}
      </div>

      {pools.length === 0 ? (
        <div className="empty">
          <button
            className="plus"
            aria-label="Create pool"
            onClick={() => setOpen(true)}
          >
            +
          </button>
          <div className="empty-title">No pools yet</div>
          <div className="empty-sub">
            Create your first pool to start granting options.
          </div>
          <button className="btn btn-pri" onClick={() => setOpen(true)}>
            Create pool
          </button>
        </div>
      ) : (
        <table className="ptable">
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th>Company</th>
              <th>Size</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {pools.map((p) => (
              <tr key={p.id}>
                <td>{p.name}</td>
                <td>{p.type === "phantom" ? "Phantom" : "Stock options"}</td>
                <td>{companyName(p.companyId)}</td>
                <td>
                  {p.quantity == null ? (
                    <span className="pill-soft">∞ Unlimited</span>
                  ) : (
                    `${p.quantity.toLocaleString()} options`
                  )}
                </td>
                <td>{new Date(p.createdAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {open && <CreatePoolDialog onClose={() => setOpen(false)} />}
    </div>
  );
}
