import type { Grant, Stakeholder, StakeholderType } from "../SandboxProvider";

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

// STK-06 — status from VESTING REALITY (decision: option A, 8 Jul 2026):
// Active if ANY grant is actively vesting (not terminated, not inside a pause
// window), else Paused if any grant is paused, else Terminated (all grants
// terminated). No grants → null ("—"). A pause whose end date has passed
// counts as active again. The person-level event record (s.terminationDate /
// pauseStart) is shown separately on the Profile — it does NOT override this.
export type StakeholderStatus = "active" | "paused" | "terminated" | null;

export function stakeholderStatus(
  grants: Grant[],
  today: string,
): StakeholderStatus {
  if (grants.length === 0) return null;
  let anyPaused = false;
  for (const g of grants) {
    if (g.terminationDate) continue;
    const paused = !!g.pauseStart && (!g.pauseEnd || g.pauseEnd >= today);
    if (paused) anyPaused = true;
    else return "active";
  }
  return anyPaused ? "paused" : "terminated";
}
