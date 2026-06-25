"use client";

import { useState } from "react";
import { useSandbox, type Company } from "./SandboxProvider";
import Modal from "./Modal";

export default function CompanyDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated?: (c: Company) => void;
}) {
  const { companies, addCompany } = useSandbox();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const create = () => {
    const nm = name.trim();
    if (!nm) return;
    if (companies.some((c) => c.name.toLowerCase() === nm.toLowerCase())) {
      setError("A company with that name already exists.");
      return;
    }
    const c = addCompany(nm);
    onCreated?.(c);
    onClose();
  };

  return (
    <Modal title="New company" onClose={onClose} sm>
      <label className="lab">Company name</label>
      <input
        className="inp"
        autoFocus
        value={name}
        placeholder="Acme Inc"
        onChange={(e) => {
          setName(e.target.value);
          setError(null);
        }}
        onKeyDown={(e) => e.key === "Enter" && create()}
      />
      {error && <p className="form-err">{error}</p>}
      <div className="modal-actions">
        <button className="btn btn-ghost" onClick={onClose}>
          Cancel
        </button>
        <button className="btn btn-pri" onClick={create}>
          Create
        </button>
      </div>
    </Modal>
  );
}
