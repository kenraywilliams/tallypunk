"use client";

import { useParams } from "next/navigation";
import { useSandbox } from "../../../SandboxProvider";

export default function StakeholderHistoryPage() {
  const { id } = useParams<{ id: string }>();
  const { logsFor } = useSandbox();
  const items = logsFor(id);

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
                <div className="logsum">{l.summary}</div>
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
