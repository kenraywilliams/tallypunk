"use client";

import { useState } from "react";
import { useSandbox, type Company, type Pool } from "./SandboxProvider";
import LogDialog from "./LogDialog";
import Modal from "./Modal";
import PoolDialog from "./pools/PoolDialog";

export default function CompanyDialog({
  company,
  startEdit,
  onClose,
  onCreated,
}: {
  company?: Company;
  startEdit?: boolean;
  onClose: () => void;
  onCreated?: (c: Company) => void;
}) {
  const { companies, addCompany, updateCompany, poolsForCompany } = useSandbox();
  const [editing, setEditing] = useState(company ? !!startEdit : true);
  const [name, setName] = useState(company?.name ?? "");
  const [error, setError] = useState<string | null>(null);
  const [logOpen, setLogOpen] = useState(false);
  const [poolView, setPoolView] = useState<Pool | null>(null);

  const submit = () => {
    const nm = name.trim();
    if (!nm) {
      setError("Enter a company name.");
      return;
    }
    const dup = companies.some(
      (c) => c.id !== company?.id && c.name.toLowerCase() === nm.toLowerCase(),
    );
    if (dup) {
      setError("A company with that name already exists.");
      return;
    }
    if (company) {
      updateCompany(company.id, { name: nm });
      setEditing(false);
    } else {
      const c = addCompany(nm);
      onCreated?.(c);
      onClose();
    }
  };

  const resetForm = () => {
    setName(company?.name ?? "");
    setError(null);
  };
  const dirty = !company || name.trim() !== company.name;
  const title = company ? (editing ? "Edit company" : company.name) : "New company";
  const linked = company ? poolsForCompany(company.id) : [];

  return (
    <Modal
      title={title}
      onClose={onClose}
      sm={!company}
      dismissable={!!company && !editing}
    >
      {editing ? (
        <>
          <label className="lab">Company name</label>
          <input
            className="inp"
            autoFocus
            maxLength={40}
            value={name}
            placeholder="Acme Inc"
            onChange={(e) => {
              setName(e.target.value);
              setError(null);
            }}
            onKeyDown={(e) => e.key === "Enter" && submit()}
          />
          {error && <p className="form-err">{error}</p>}
          <div className="modal-actions">
            <button
              className="btn btn-ghost"
              onClick={() => {
                if (company) {
                  resetForm();
                  setEditing(false);
                } else {
                  onClose();
                }
              }}
            >
              Cancel
            </button>
            <button className="btn btn-pri" onClick={submit} disabled={!dirty}>
              {company ? "Save" : "Create"}
            </button>
          </div>
        </>
      ) : company ? (
        <>
          <div className="vrow">
            <span className="vlab">Pools</span>
            <span className="vval">
              {linked.length === 0 ? (
                <span className="muted-note" style={{ margin: 0 }}>
                  None yet
                </span>
              ) : (
                <span className="linkwrap">
                  {linked.map((p) => (
                    <button
                      key={p.id}
                      className="linkbtn"
                      onClick={() => setPoolView(p)}
                    >
                      {p.name}
                    </button>
                  ))}
                </span>
              )}
            </span>
          </div>
          <div className="created-foot">
            Created {new Date(company.createdAt).toLocaleString()} by{" "}
            {company.createdBy}
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

      {logOpen && company && (
        <LogDialog
          objectId={company.id}
          title={company.name}
          onClose={() => setLogOpen(false)}
        />
      )}
      {poolView && (
        <PoolDialog pool={poolView} onClose={() => setPoolView(null)} />
      )}
    </Modal>
  );
}
