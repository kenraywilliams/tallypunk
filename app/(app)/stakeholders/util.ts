import type { Grant, Stakeholder, StakeholderType } from "../SandboxProvider";
import { vestedFraction } from "../grants/vesting";

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

// STK-06 — status from VESTING REALITY (option A, 8 Jul 2026), ranking
// Vesting > Paused > Fully vested > Terminated:
// Vesting if ANY grant is still accruing (not fully vested, not terminated,
// no pause window running); else Paused if any pause is running; else Fully
// vested if any grant reached 100%; else Terminated. No grants → null ("—";
// the dash stays the visible representation — "No grants" is only a filter
// label, GRANT-19/GBL-05). Derived fresh every render, so adding a new grant
// to a fully-vested/terminated person flips them back to Vesting by itself.
export type StakeholderStatus =
  | "vesting"
  | "paused"
  | "fully"
  | "terminated"
  | null;

export function stakeholderStatus(
  grants: Grant[],
  today: string,
): StakeholderStatus {
  if (grants.length === 0) return null;
  let anyPaused = false;
  let anyFully = false;
  for (const g of grants) {
    if (vestedFraction(g.vesting, g.grantDate, today, g) >= 1 - 1e-6) {
      anyFully = true;
      continue;
    }
    if (g.terminationDate) continue;
    // paused only while the window is RUNNING (scheduled/expired = vesting)
    const paused =
      !!g.pauseStart &&
      g.pauseStart <= today &&
      (!g.pauseEnd || g.pauseEnd >= today);
    if (paused) anyPaused = true;
    else return "vesting";
  }
  if (anyPaused) return "paused";
  if (anyFully) return "fully";
  return "terminated";
}
