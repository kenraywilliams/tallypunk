"use client";

import { useState } from "react";
import { useSandbox, type Company } from "./SandboxProvider";

export default function CompanyDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated?: (c: Company) => void;
}) {
  const { addCompany, notify } = useSandbox();
  const [name, setName] = useState("");

  const create = () => {
    const nm = name.trim();
    if (!nm) return;
    const c = addCompany(nm);
    notify(`Company “${c.name}” created`);
    onCreated?.(c);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-sm" onClick={(e) => e.stopPropagation()}>
        <h3 className="modal-title">New company</h3>
        <label className="lab">Company name</label>
        <input
          className="inp"
          autoFocus
          value={name}
          placeholder="Acme Inc"
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && create()}
        />
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-pri" onClick={create}>
            Create
          </button>
        </div>
      </div>
    </div>
  );
}
