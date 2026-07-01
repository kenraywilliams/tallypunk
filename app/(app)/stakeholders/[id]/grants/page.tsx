"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useSandbox, type Grant } from "../../../SandboxProvider";
import GrantDialog, { gid } from "../../../grants/GrantDialog";
import { todayISO, vestedUnits } from "../../../grants/vesting";

export default function StakeholderGrantsPage() {
  const { id } = useParams<{ id: string }>();
  const { grantsForStakeholder, pools } = useSandbox();
  const [dialog, setDialog] = useState<{
    grant?: Grant;
    edit?: boolean;
  } | null>(null);

  const grants = grantsForStakeholder(id);
  const today = todayISO();
  const totalGranted = grants.reduce((s, g) => s + g.quantity, 0);
  const totalVested = grants.reduce(
    (s, g) => s + vestedUnits(g.quantity, g.vesting, g.grantDate, today),
    0,
  );
  const poolName = (pid: string | null) =>
    pid ? (pools.find((p) => p.id === pid)?.name ?? "—") : "None";

  return (
    <div className="panel">
      <div className="vrow">
        <span className="vlab">Total granted</span>
        <span className="vval">{totalGranted.toLocaleString()}</span>
      </div>
      <div className="vrow">
        <span className="vlab">Total vested (today)</span>
        <span className="vval">{totalVested.toLocaleString()}</span>
      </div>

      {grants.length === 0 ? (
        <p className="muted-note">
          No grants yet. Use <strong>+ Create grant</strong> to add one.
        </p>
      ) : (
        <div className="linkwrap-l" style={{ marginTop: 14 }}>
          {grants.map((g, i) => (
            <button
              key={g.id}
              className="linkbtn"
              onClick={() => setDialog({ grant: g })}
              title={`#${gid(g.seq)} · ${g.quantity.toLocaleString()} · ${poolName(
                g.poolId,
              )}`}
            >
              Grant {i + 1}
            </button>
          ))}
        </div>
      )}

      <div className="modal-actions">
        <span style={{ flex: 1 }} />
        <button className="btn btn-pri btn-sm" onClick={() => setDialog({})}>
          + Create grant
        </button>
      </div>

      {dialog && (
        <GrantDialog
          grant={dialog.grant}
          startEdit={dialog.edit}
          presetStakeholderId={id}
          onClose={() => setDialog(null)}
        />
      )}
    </div>
  );
}
