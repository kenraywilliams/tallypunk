"use client";

import { useState } from "react";
import { useSandbox } from "../SandboxProvider";
import CompanyDialog from "../CompanyDialog";

export default function CompaniesPage() {
  const { companies, hydrated } = useSandbox();
  const [open, setOpen] = useState(false);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Companies</h1>
          <p className="page-sub">Companies you manage</p>
        </div>
        {hydrated && companies.length > 0 && (
          <div className="right">
            <button className="btn btn-pri btn-sm" onClick={() => setOpen(true)}>
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
            onClick={() => setOpen(true)}
          >
            +
          </button>
          <div className="empty-title">No companies yet</div>
          <button className="btn btn-pri" onClick={() => setOpen(true)}>
            New company
          </button>
        </div>
      ) : (
        <table className="ptable">
          <thead>
            <tr>
              <th>Name</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {companies.map((c) => (
              <tr key={c.id}>
                <td>
                  <span className="ellip" title={c.name}>
                    {c.name}
                  </span>
                </td>
                <td>{new Date(c.createdAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {open && <CompanyDialog onClose={() => setOpen(false)} />}
    </div>
  );
}
