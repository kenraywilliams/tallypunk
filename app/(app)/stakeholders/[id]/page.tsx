"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSandbox, type Company } from "../../SandboxProvider";
import CompanyDialog from "../../CompanyDialog";
import StakeholderForm from "../StakeholderForm";
import { fullName, idLabel, stakeholderStatus, typeLabel } from "../util";
import { gid, StatusChip } from "../../grants/GrantDialog";
import { reservedUnits, todayISO } from "../../grants/vesting";

export default function StakeholderProfilePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const {
    stakeholders,
    companies,
    pools,
    grantsForStakeholder,
    deleteStakeholder,
    notify,
  } = useSandbox();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmText, setConfirmText] = useState("");
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
        <div className="prow">
          <span className="plab2">Vesting status</span>
          <span className="pval2">
            {(() => {
              // STK-06, option A: status = vesting reality (derived from the
              // grants); the person-level event record is shown alongside.
              const status = stakeholderStatus(
                grantsForStakeholder(s.id),
                todayISO(),
              );
              if (status === null) return dash;
              return <StatusChip status={status} />;
            })()}
          </span>
        </div>
        {(s.terminationDate || s.pauseStart) && (
          <div className="prow">
            <span className="plab2">Person-level event</span>
            <span className="pval2" style={{ fontSize: 13 }}>
              {s.terminationDate
                ? `Terminated vesting from ${s.terminationDate}`
                : `Paused vesting ${s.pauseStart} → ${s.pauseEnd ?? "open-ended"}`}
              {" — manage under the Grants tab"}
            </span>
          </div>
        )}
        <div className="prow full">
          <span className="plab2">Notes</span>
          <span className="pval2 pval-note">{s.notes || dash}</span>
        </div>
      </div>

      <div className="created-foot">
        Created {new Date(s.createdAt).toLocaleString()} by {s.createdBy}
      </div>

      {deleting && (
        <div
          style={{
            border: "1px solid var(--line)",
            borderRadius: 10,
            padding: "12px 14px",
            marginTop: 6,
            background: "var(--bg)",
          }}
        >
          {(() => {
            const gs = grantsForStakeholder(s.id);
            const poolName = (pid: string | null) =>
              pid
                ? (pools.find((p) => p.id === pid)?.name ?? "—")
                : "no pool";
            return (
              <>
                <p
                  style={{
                    fontSize: 12.5,
                    color: "#b23b3b",
                    fontWeight: 600,
                    margin: 0,
                  }}
                >
                  Deleting {fullName(s) || "this stakeholder"} DESTROYS their{" "}
                  {gs.length} grant{gs.length === 1 ? "" : "s"} — permanent, no
                  undo. This is not Terminate.
                </p>
                {gs.length > 0 && (
                  <div
                    style={{
                      maxHeight: 160,
                      overflowY: "auto",
                      marginTop: 8,
                      fontSize: 13,
                    }}
                  >
                    {gs.map((g) => (
                      <div
                        key={g.id}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 10,
                          padding: "5px 0",
                          borderBottom: "1px solid var(--line)",
                        }}
                      >
                        <span>Grant #{gid(g.seq)}</span>
                        <span style={{ color: "var(--muted)" }}>
                          {reservedUnits(
                            g.quantity,
                            g.vesting,
                            g.grantDate,
                            g,
                          ).toLocaleString()}{" "}
                          units → {poolName(g.poolId)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                <label className="lab" style={{ marginTop: 10 }}>
                  Type <strong>delete</strong> to confirm
                </label>
                <input
                  className="inp"
                  style={{ maxWidth: 220 }}
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="delete"
                />
                <div className="modal-actions">
                  <button
                    className="btn btn-ghost"
                    onClick={() => {
                      setDeleting(false);
                      setConfirmText("");
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    className="btn btn-pri"
                    disabled={confirmText.trim().toLowerCase() !== "delete"}
                    onClick={() => {
                      const who = fullName(s) || "Stakeholder";
                      deleteStakeholder(s.id);
                      notify(
                        `${who} deleted — ${gs.length} grant${gs.length === 1 ? "" : "s"} removed, units returned to pools`,
                      );
                      router.push("/stakeholders");
                    }}
                  >
                    Delete stakeholder
                  </button>
                </div>
              </>
            );
          })()}
        </div>
      )}

      {!deleting && (
        <div className="modal-actions">
          <button
            className="btn btn-ghost btn-sm"
            style={{ color: "#b23b3b", borderColor: "#e0b7b0" }}
            onClick={() => {
              setConfirmText("");
              setDeleting(true);
            }}
          >
            Delete…
          </button>
          <span style={{ flex: 1 }} />
          <button className="btn btn-pri" onClick={() => setEditing(true)}>
            Edit
          </button>
        </div>
      )}

      {companyView && (
        <CompanyDialog
          company={companyView}
          onClose={() => setCompanyView(null)}
        />
      )}
    </div>
  );
}
