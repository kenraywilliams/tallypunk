"use client";

import { useState } from "react";
import { useSandbox, type Company, type Pool } from "../SandboxProvider";
import CompanyDialog from "../CompanyDialog";
import EditIcon from "../EditIcon";
import PoolDialog from "../pools/PoolDialog";

export default function CompaniesPage() {
  const { companies, hydrated, poolsForCompany } = useSandbox();
  const [dialog, setDialog] = useState<{ company?: Company; edit?: boolean } | null>(
    null,
  );
  const [poolDialog, setPoolDialog] = useState<Pool | null>(null);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Companies</h1>
          <p className="page-sub">Companies you manage</p>
        </div>
        {hydrated && companies.length > 0 && (
          <div className="right">
            <button className="btn btn-pri btn-sm" onClick={() => setDialog({})}>
              + New company
            </button>
          </div>
        )}
      </div>

      {!hydrated ? null : companies.length === 0 ? (
        <div className="empty">
          <button
            className="plus"
            aria-label="New company"
            onClick={() => setDialog({})}
          >
            +
          </button>
          <div className="empty-title">No companies yet</div>
          <button className="btn btn-pri" onClick={() => setDialog({})}>
            New company
          </button>
        </div>
      ) : (
        <table className="ptable">
          <thead>
            <tr>
              <th className="tcol-act" />
              <th>Name</th>
              <th>Pools</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {companies.map((c) => {
              const linked = poolsForCompany(c.id);
              return (
                <tr key={c.id} onClick={() => setDialog({ company: c })}>
                  <td className="tcol-act">
                    <button
                      className="rowbtn"
                      aria-label="Edit company"
                      title="Edit"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDialog({ company: c, edit: true });
                      }}
                    >
                      <EditIcon />
                    </button>
                  </td>
                  <td className="cell-name">
                    <span className="ellip" title={c.name}>
                      {c.name}
                    </span>
                  </td>
                  <td>
                    {linked.length === 0 ? (
                      <span className="muted-cell">—</span>
                    ) : (
                      <span className="linkwrap-l">
                        {linked.map((p) => (
                          <button
                            key={p.id}
                            className="linkbtn"
                            onClick={(e) => {
                              e.stopPropagation();
                              setPoolDialog(p);
                            }}
                          >
                            {p.name}
                          </button>
                        ))}
                      </span>
                    )}
                  </td>
                  <td>{new Date(c.createdAt).toLocaleDateString()}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {dialog && (
        <CompanyDialog
          company={dialog.company}
          startEdit={dialog.edit}
          onClose={() => setDialog(null)}
        />
      )}
      {poolDialog && (
        <PoolDialog pool={poolDialog} onClose={() => setPoolDialog(null)} />
      )}
    </div>
  );
}
