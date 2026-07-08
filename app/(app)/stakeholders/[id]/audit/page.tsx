"use client";

import { useParams } from "next/navigation";
import { useSandbox } from "../../../SandboxProvider";
import { gid } from "../../../grants/GrantDialog";

export default function StakeholderAuditPage() {
  const { id } = useParams<{ id: string }>();
  const { logsForStakeholder, grants } = useSandbox();
  // Own entries + grant entries attributed to this person (a reassigned
  // grant's earlier history stays here; later history follows the new owner).
  const items = logsForStakeholder(id);

  const grantLabel = (objectId: string) => {
    const g = grants.find((x) => x.id === objectId);
    return g ? `Grant #${gid(g.seq)}` : "Grant";
  };

  return (
    <div className="panel">
      {items.length === 0 ? (
        <p className="muted-note">No changes logged yet.</p>
      ) : (
        <div className="logscroll" style={{ maxHeight: "none" }}>
          {items.map((l) => (
            <div className="logrow" key={l.id}>
              <span className={"logtag tag-" + l.action.toLowerCase()}>
                {l.action}
              </span>
              <div>
                <div className="logsum">
                  {l.objectType === "grant"
                    ? `${grantLabel(l.objectId)} — ${l.summary}`
                    : l.summary}
                </div>
                <div className="logmeta">
                  {l.actor} · {new Date(l.ts).toLocaleString()}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
