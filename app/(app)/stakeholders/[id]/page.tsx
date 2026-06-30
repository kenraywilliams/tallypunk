"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useSandbox, type Company } from "../../SandboxProvider";
import CompanyDialog from "../../CompanyDialog";
import StakeholderForm from "../StakeholderForm";
import { idLabel, typeLabel } from "../util";

export default function StakeholderProfilePage() {
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

  const dash = <span className="muted-cell">—</span>;

  return (
    <div className="panel">
      <div className="pgrid2">
        <div className="prow">
          <span className="plab2">First name(s)</span>
          <span className="pval2">{s.firstName || dash}</span>
        </div>
        <div className="prow">
          <span className="plab2">Last name(s)</span>
          <span className="pval2">{s.lastName || dash}</span>
        </div>
        <div className="prow">
          <span className="plab2">ID</span>
          <span className="pval2">{idLabel(s.seq)}</span>
        </div>
        <div className="prow">
          <span className="plab2">Type</span>
          <span className="pval2">{typeLabel(s.type)}</span>
        </div>
        <div className="prow">
          <span className="plab2">Company</span>
          <span className="pval2">
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
              dash
            )}
          </span>
        </div>
        <div className="prow">
          <span className="plab2">Email</span>
          <span className="pval2">
            {s.email ? (
              <a className="linkbtn" href={`mailto:${s.email}`}>
                {s.email}
              </a>
            ) : (
              dash
            )}
          </span>
        </div>
        <div className="prow full">
          <span className="plab2">Notes</span>
          <span className="pval2 pval-note">{s.notes || dash}</span>
        </div>
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
