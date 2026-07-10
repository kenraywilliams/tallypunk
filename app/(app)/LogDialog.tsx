"use client";

import { useSandbox } from "./SandboxProvider";
import Modal from "./Modal";

export default function LogDialog({
  objectId,
  title,
  onClose,
  rollup,
}: {
  objectId: string;
  title: string;
  onClose: () => void;
  rollup?: "pool"; // pools also show entries of the grants drawn from them
}) {
  const { logsFor, logsForPool, grants } = useSandbox();
  const items = rollup === "pool" ? logsForPool(objectId) : logsFor(objectId);
  const grantLabel = (gid: string) => {
    const g = grants.find((x) => x.id === gid);
    return g ? `Grant #${String(g.seq).padStart(7, "0")}` : "Grant";
  };

  return (
    <Modal title={`Audit log — ${title}`} onClose={onClose} sm dismissable>
      {items.length === 0 ? (
        <p className="muted-note">No changes logged yet.</p>
      ) : (
        <div className="logscroll">
          {items.map((l) => (
            <div className="logrow" key={l.id}>
              <span className={"logtag tag-" + l.action.toLowerCase()}>
                {l.action}
              </span>
              <div>
                <div className="logsum">
                  {rollup === "pool" &&
                  l.objectType === "grant" &&
                  l.objectId !== objectId
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
      <div className="modal-actions">
        <button className="btn btn-ghost" onClick={onClose}>
          Close
        </button>
      </div>
    </Modal>
  );
}
