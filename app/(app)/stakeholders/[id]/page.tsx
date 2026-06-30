"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useSandbox, type Company } from "../../SandboxProvider";
import CompanyDialog from "../../CompanyDialog";
import StakeholderForm from "../StakeholderForm";
import { idLabel, typeLabel } from "../util";

export default function StakeholderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { stakeholders, companies } = useSandbox();
  const [editing, setEditing] = useState(false);
  const [companyView, setCompanyView] = useState<Company | null>(null);

  const s = stakeholders.find((x) => x.id === id);
  if (!s) return null; // the [id] layout shows the not-found state

  const companyName = s.companyId
    ? (companies.find((c) => c.id === s.companyId)?.name ?? "—")
    : null;

  if (editing) {
    return (
      <div className="panel skform">
        <StakeholderForm
          stakeholder={s}
          onDone={() => setEditing(false)}
          onCancel={() => setEditing(false)}
        />
      </div>
    );
  }

  return (
    <div className="panel">
      <div className="vrow">
        <span className="vlab">ID</span>
        <span className="vval">{idLabel(s.seq)}</span>
      </div>
      <div className="vrow">
        <span className="vlab">Type</span>
        <span className="vval">{typeLabel(s.type)}</span>
      </div>
      <div className="vrow">
        <span className="vlab">Company</span>
        <span className="vval">
          {s.companyId ? (
            <button
              className="linkbtn"
              onClick={() =>
                setCompanyView(
                  companies.find((c) => c.id === s.companyId) ?? null,
                )
              }
            >
              {companyName}
            </button>
          ) : (
            <span className="muted-cell">—</span>
          )}
        </span>
      </div>
      <div className="vrow">
        <span className="vlab">Email</span>
        <span className="vval">
          {s.email ? (
            <a className="linkbtn" href={`mailto:${s.email}`}>
              {s.email}
            </a>
          ) : (
            <span className="muted-cell">—</span>
          )}
        </span>
      </div>
      <div className="vblock">
        <span className="vlab">Notes</span>
        <p className="vnote">
          {s.notes || <span className="muted-cell">—</span>}
        </p>
      </div>
      <div className="created-foot">
        Created {new Date(s.createdAt).toLocaleString()} by {s.createdBy}
      </div>
      <div className="modal-actions">
        <span style={{ flex: 1 }} />
        <button className="btn btn-pri" onClick={() => setEditing(true)}>
          Edit
        </button>
      </div>

      {companyView && (
        <CompanyDialog
          company={companyView}
          onClose={() => setCompanyView(null)}
        />
      )}
    </div>
  );
}
