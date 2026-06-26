"use client";

import { useSandbox } from "./SandboxProvider";
import Modal from "./Modal";

export default function LogDialog({
  objectId,
  title,
  onClose,
}: {
  objectId: string;
  title: string;
  onClose: () => void;
}) {
  const { logsFor } = useSandbox();
  const items = logsFor(objectId);

  return (
    <Modal title={`History — ${title}`} onClose={onClose} sm dismissable>
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
                <div className="logsum">{l.summary}</div>
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
