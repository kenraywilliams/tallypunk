"use client";

import { useState } from "react";
import { useSandbox, type Pool } from "../SandboxProvider";
import PoolDialog from "./PoolDialog";

export default function PoolsPage() {
  const { pools, companies, hydrated, resetSandbox } = useSandbox();
  const [dialog, setDialog] = useState<{ pool?: Pool; edit?: boolean } | null>(
    null,
  );

  const companyName = (id: string | null) =>
    id ? (companies.find((c) => c.id === id)?.name ?? "—") : "—";

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Pools</h1>
          <p className="page-sub">Option pools you grant from</p>
        </div>
        {hydrated && pools.length > 0 && (
          <div className="right">
            <button className="reset" onClick={resetSandbox}>
              Reset sandbox
            </button>
            <button className="btn btn-pri btn-sm" onClick={() => setDialog({})}>
              + Create pool
            </button>
          </div>
        )}
      </div>

      {!hydrated ? null : pools.length === 0 ? (
        <div className="empty">
          <button
            className="plus"
            aria-label="Create pool"
            onClick={() => setDialog({})}
          >
            +
          </button>
          <div className="empty-title">No pools yet</div>
          <button className="btn btn-pri" onClick={() => setDialog({})}>
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
              <th className="tcol-act" />
            </tr>
          </thead>
          <tbody>
            {pools.map((p) => (
              <tr key={p.id} onClick={() => setDialog({ pool: p })}>
                <td>{p.name}</td>
                <td>{p.type === "phantom" ? "Phantoms" : "Stock options"}</td>
                <td>
                  <span className="ellip" title={companyName(p.companyId)}>
                    {companyName(p.companyId)}
                  </span>
                </td>
                <td>
                  {p.quantity == null ? (
                    <span className="pill-soft">
                      <span className="inf">∞</span> Unlimited
                    </span>
                  ) : (
                    p.quantity.toLocaleString()
                  )}
                </td>
                <td className="tcol-act">
                  <button
                    className="rowbtn"
                    aria-label="Edit pool"
                    title="Edit"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDialog({ pool: p, edit: true });
                    }}
                  >
                    ✎
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {dialog && (
        <PoolDialog
          pool={dialog.pool}
          startEdit={dialog.edit}
          onClose={() => setDialog(null)}
        />
      )}
    </div>
  );
}
