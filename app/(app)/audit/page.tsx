"use client";

import { useSandbox, type LogEntry } from "../SandboxProvider";
import { fullName } from "../stakeholders/util";

// Global audit log (GBL-02, sandbox cut): every entry across every object —
// the safety net that catches what per-object logs can't show any more,
// because DELETE entries outlive the objects they describe.
export default function GlobalAuditPage() {
  const { logs, grants, stakeholders, pools, companies, hydrated } =
    useSandbox();

  const label = (l: LogEntry): string => {
    switch (l.objectType) {
      case "grant": {
        const g = grants.find((x) => x.id === l.objectId);
        return g ? `Grant #${String(g.seq).padStart(7, "0")}` : "Grant (deleted)";
      }
      case "stakeholder": {
        const s = stakeholders.find((x) => x.id === l.objectId);
        return s ? fullName(s) || "Stakeholder" : "Stakeholder (deleted)";
      }
      case "pool": {
        const p = pools.find((x) => x.id === l.objectId);
        return p ? p.name : "Pool (deleted)";
      }
      case "company": {
        const c = companies.find((x) => x.id === l.objectId);
        return c ? c.name : "Company (deleted)";
      }
      default:
        return l.objectType;
    }
  };

  return (
    <div className="listpage">
      <div className="page-head">
        <div>
          <h1 className="page-title">Audit log</h1>
          <p className="page-sub">
            Every action in this sandbox — deleted objects included
          </p>
        </div>
      </div>

      {!hydrated ? null : logs.length === 0 ? (
        <p className="muted-note">Nothing logged yet.</p>
      ) : (
        <div className="panel">
          <div className="logscroll" style={{ maxHeight: "none" }}>
            {logs.map((l) => (
              <div className="logrow" key={l.id}>
                <span className={"logtag tag-" + l.action.toLowerCase()}>
                  {l.action}
                </span>
                <div>
                  <div className="logsum">
                    <strong>{label(l)}</strong> — {l.summary}
                  </div>
                  <div className="logmeta">
                    {l.objectType} · {l.actor} ·{" "}
                    {new Date(l.ts).toLocaleString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
