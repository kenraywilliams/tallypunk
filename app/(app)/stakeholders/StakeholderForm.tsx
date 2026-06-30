"use client";

import { useState } from "react";
import {
  useSandbox,
  type Stakeholder,
  type StakeholderType,
} from "../SandboxProvider";
import CompanyDialog from "../CompanyDialog";
import { TYPES, fullName } from "./util";

const NAME_MAX = 40;

export default function StakeholderForm({
  stakeholder,
  onDone,
  onCancel,
}: {
  stakeholder?: Stakeholder;
  onDone: (s?: Stakeholder) => void;
  onCancel: () => void;
}) {
  const { addStakeholder, updateStakeholder, companies, notify } = useSandbox();
  const s = stakeholder;
  const [firstName, setFirstName] = useState(s?.firstName ?? "");
  const [lastName, setLastName] = useState(s?.lastName ?? "");
  const [type, setType] = useState<StakeholderType>(s?.type ?? "employee");
  const [companyId, setCompanyId] = useState(s?.companyId ?? "");
  const [email, setEmail] = useState(s?.email ?? "");
  const [notes, setNotes] = useState(s?.notes ?? "");
  const [companyOpen, setCompanyOpen] = useState(false);

  const dirty =
    !s ||
    firstName.trim() !== s.firstName ||
    lastName.trim() !== s.lastName ||
    type !== s.type ||
    (companyId || null) !== s.companyId ||
    email.trim() !== s.email ||
    notes.trim() !== s.notes;

  const save = () => {
    const fn = firstName.trim();
    const ln = lastName.trim();
    // Nothing entered → default the record to "Stakeholder" (the ID keeps it unique).
    const payload = {
      firstName: fn || (ln ? "" : "Stakeholder"),
      lastName: ln,
      type,
      companyId: companyId || null,
      email: email.trim(),
      notes: notes.trim(),
    };
    if (s) {
      updateStakeholder(s.id, payload);
      notify(`${fullName({ ...s, ...payload })} updated`);
      onDone();
    } else {
      const created = addStakeholder(payload);
      notify(`${fullName(created)} created`);
      onDone(created);
    }
  };

  return (
    <>
      <div className="frow2">
        <div>
          <label className="lab">First name(s)</label>
          <input
            className="inp"
            autoFocus
            maxLength={NAME_MAX}
            value={firstName}
            placeholder="Ada"
            onChange={(e) => setFirstName(e.target.value)}
          />
        </div>
        <div>
          <label className="lab">Last name(s)</label>
          <input
            className="inp"
            maxLength={NAME_MAX}
            value={lastName}
            placeholder="Lovelace"
            onChange={(e) => setLastName(e.target.value)}
          />
        </div>
      </div>

      <label className="lab">Type</label>
      <select
        className="inp"
        value={type}
        onChange={(e) => setType(e.target.value as StakeholderType)}
      >
        {TYPES.map((t) => (
          <option key={t.value} value={t.value}>
            {t.label}
          </option>
        ))}
      </select>

      <label className="lab">Company</label>
      <div className="row">
        <select
          className="inp"
          value={companyId}
          onChange={(e) => setCompanyId(e.target.value)}
        >
          <option value="">— None —</option>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => setCompanyOpen(true)}
        >
          + New company
        </button>
      </div>

      <label className="lab">Email</label>
      <input
        className="inp"
        type="email"
        value={email}
        placeholder="ada@acme.com"
        onChange={(e) => setEmail(e.target.value)}
      />

      <label className="lab">Notes</label>
      <textarea
        className="inp txta"
        value={notes}
        placeholder="Anything worth remembering about this stakeholder…"
        onChange={(e) => setNotes(e.target.value)}
      />

      <div className="modal-actions">
        <button className="btn btn-ghost" onClick={onCancel}>
          Cancel
        </button>
        <button className="btn btn-pri" onClick={save} disabled={!dirty}>
          {s ? "Save" : "Add stakeholder"}
        </button>
      </div>

      {companyOpen && (
        <CompanyDialog
          onClose={() => setCompanyOpen(false)}
          onCreated={(c) => setCompanyId(c.id)}
        />
      )}
    </>
  );
}
