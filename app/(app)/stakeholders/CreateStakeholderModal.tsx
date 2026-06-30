"use client";

import Modal from "../Modal";
import StakeholderForm from "./StakeholderForm";
import type { Stakeholder } from "../SandboxProvider";

export default function CreateStakeholderModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (s: Stakeholder) => void;
}) {
  return (
    <Modal title="Add stakeholder" onClose={onClose}>
      <div className="skform">
        <StakeholderForm
          onDone={(s) => (s ? onCreated(s) : onClose())}
          onCancel={onClose}
        />
      </div>
    </Modal>
  );
}
