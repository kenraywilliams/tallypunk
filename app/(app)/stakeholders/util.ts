import type { Stakeholder, StakeholderType } from "../SandboxProvider";

export const TYPES: { value: StakeholderType; label: string }[] = [
  { value: "founder", label: "Founder" },
  { value: "employee", label: "Employee" },
  { value: "advisor", label: "Advisor" },
  { value: "investor", label: "Investor" },
  { value: "entity", label: "Entity" },
  { value: "other", label: "Other" },
];

export const typeLabel = (t: StakeholderType) =>
  TYPES.find((x) => x.value === t)?.label ?? t;

export const fullName = (s: Stakeholder) =>
  `${s.firstName} ${s.lastName}`.trim();

export const idLabel = (seq: number) => String(seq).padStart(6, "0");
