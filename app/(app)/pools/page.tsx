"use client";

import { useState } from "react";
import { useSandbox, type Company, type Pool } from "../SandboxProvider";
import CompanyDialog from "../CompanyDialog";
import EditIcon from "../EditIcon";
import PoolDialog from "./PoolDialog";

export default function PoolsPage() {
  const { pools, companies, hydrated, grantedFor } = useSandbox();
  const [dialog, setDialog] = useState<{ pool?: Pool; edit?: boolean } | null>(
    null,
  );
  const [companyDialog, setCompanyDialog] = useState<Company | null>(null);

  const companyOf = (id: string | null) =>
    id ? (companies.find((c) => c.id === id) ?? null) : null;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Pools</h1>
          <p className="page-sub">Option pools you grant from</p>
        </div>
        {hydrated && pools.length > 0 && (
          <div className="right">
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
              <th className="tcol-act" />
              <th>Name</th>
              <th>Type</th>
              <th>Company</th>
              <th>Size</th>
              <th>Granted</th>
              <th>Vested</th>
            </tr>
          </thead>
          <tbody>
            {pools.map((p) => {
              const co = companyOf(p.companyId);
              return (
                <tr key={p.id} onClick={() => setDialog({ pool: p })}>
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
                      <EditIcon />
                    </button>
                  </td>
                  <td className="cell-name">{p.name}</td>
                  <td>{p.type === "phantom" ? "Phantoms" : "Stock options"}</td>
                  <td>
                    {co ? (
                      <button
                        className="linkbtn"
                        onClick={(e) => {
                          e.stopPropagation();
                          setCompanyDialog(co);
                        }}
                      >
                        {co.name}
                      </button>
                    ) : (
                      <span className="muted-cell">—</span>
                    )}
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
                  <td>{grantedFor(p.id).toLocaleString()}</td>
                  <td>
                    <span className="muted-cell">—</span>
                  </td>
                </tr>
              );
            })}
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
      {companyDialog && (
        <CompanyDialog
          company={companyDialog}
          onClose={() => setCompanyDialog(null)}
        />
      )}
    </div>
  );
}
