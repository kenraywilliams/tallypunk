"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { reservedUnits, type Vesting } from "./grants/vesting";

// ---- Data shapes (map 1:1 to the future Postgres tables) ----
export type PoolType = "real" | "phantom";

export interface Pool {
  id: string;
  name: string;
  type: PoolType;
  companyId: string | null;
  quantity: number | null; // null = unlimited ("Infinity pool")
  createdAt: string;
  createdBy: string;
}

export interface Company {
  id: string;
  name: string;
  createdAt: string;
  createdBy: string;
}

export type StakeholderType =
  | "founder"
  | "employee"
  | "advisor"
  | "investor"
  | "entity"
  | "other";

export interface Stakeholder {
  id: string;
  seq: number; // display ID — sequential, shown zero-padded (e.g. 000001)
  firstName: string;
  lastName: string;
  type: StakeholderType;
  companyId: string | null;
  email: string; // detail only — not shown in the table
  notes: string; // detail only
  createdAt: string;
  createdBy: string;
}

export interface Grant {
  id: string;
  seq: number; // display ID (0000001)
  stakeholderId: string;
  poolId: string | null; // null = no pool (GRANT-04)
  quantity: number;
  grantDate: string; // yyyy-mm-dd
  strike: number | null;
  vesting: Vesting;
  // Lifecycle (GRANT-16/17) — nullable columns in the future Grant table.
  // Terminate and Pause may coexist; both are reversible.
  terminationDate: string | null; // vesting stops; the day itself does NOT vest
  pauseStart: string | null;
  pauseEnd: string | null; // null while pauseStart is set = open-ended pause
  createdAt: string;
  createdBy: string;
}

export type LogAction = "CREATE" | "UPDATE" | "DELETE";

export interface LogEntry {
  id: string;
  ts: string;
  objectType: "pool" | "company" | "stakeholder" | "grant";
  objectId: string;
  action: LogAction;
  summary: string;
  actor: string;
}

interface Sandbox {
  hydrated: boolean;
  pools: Pool[];
  companies: Company[];
  stakeholders: Stakeholder[];
  grants: Grant[];
  logs: LogEntry[];
  flashId: string | null;
  addPool: (p: Omit<Pool, "id" | "createdAt" | "createdBy">) => Pool;
  updatePool: (
    id: string,
    patch: Partial<Omit<Pool, "id" | "createdAt" | "createdBy">>,
  ) => void;
  addCompany: (name: string) => Company;
  updateCompany: (id: string, patch: { name: string }) => void;
  addStakeholder: (
    s: Omit<Stakeholder, "id" | "seq" | "createdAt" | "createdBy">,
  ) => Stakeholder;
  updateStakeholder: (
    id: string,
    patch: Partial<Omit<Stakeholder, "id" | "createdAt" | "createdBy">>,
  ) => void;
  addGrant: (
    g: Omit<Grant, "id" | "seq" | "createdAt" | "createdBy">,
  ) => Grant;
  updateGrant: (
    id: string,
    patch: Partial<Omit<Grant, "id" | "seq" | "createdAt" | "createdBy">>,
  ) => void;
  grantsForStakeholder: (stakeholderId: string) => Grant[];
  grantsForPool: (poolId: string) => Grant[];
  poolsForCompany: (companyId: string) => Pool[];
  grantedFor: (poolId: string) => number;
  logsFor: (objectId: string) => LogEntry[];
  resetSandbox: () => void;
  toast: string | null;
  notify: (msg: string) => void;
}

const Ctx = createContext<Sandbox | null>(null);
const KEY = "tallypunk-sandbox-v1";
const ME = "Sandbox user";
const uid = () => Math.random().toString(36).slice(2, 10);

export function SandboxProvider({ children }: { children: React.ReactNode }) {
  const [hydrated, setHydrated] = useState(false);
  const [pools, setPools] = useState<Pool[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [stakeholders, setStakeholders] = useState<Stakeholder[]>([]);
  const [grants, setGrants] = useState<Grant[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [toastKey, setToastKey] = useState(0);
  const toastTimer = useRef<number | undefined>(undefined);
  const [flashId, setFlashId] = useState<string | null>(null);
  const flashTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const d = JSON.parse(raw);
        const fixActor = (v: string | undefined) =>
          !v || v === "You" ? ME : v;
        setPools(
          (Array.isArray(d.pools) ? d.pools : []).map((p: Pool) => ({
            ...p,
            createdBy: fixActor(p.createdBy),
          })),
        );
        setCompanies(
          (Array.isArray(d.companies) ? d.companies : []).map((c: Company) => ({
            ...c,
            createdBy: fixActor(c.createdBy),
          })),
        );
        {
          const arr: Stakeholder[] = Array.isArray(d.stakeholders)
            ? d.stakeholders
            : [];
          let maxSeq = arr.reduce(
            (mx, x) => (typeof x.seq === "number" ? Math.max(mx, x.seq) : mx),
            0,
          );
          setStakeholders(
            arr.map((x) => ({
              ...x,
              createdBy: fixActor(x.createdBy),
              seq: typeof x.seq === "number" ? x.seq : ++maxSeq,
            })),
          );
        }
        {
          const arr: Grant[] = Array.isArray(d.grants) ? d.grants : [];
          let maxSeq = arr.reduce(
            (mx, x) => (typeof x.seq === "number" ? Math.max(mx, x.seq) : mx),
            0,
          );
          setGrants(
            arr.map((x) => ({
              ...x,
              createdBy: fixActor(x.createdBy),
              seq: typeof x.seq === "number" ? x.seq : ++maxSeq,
              terminationDate: x.terminationDate ?? null,
              pauseStart: x.pauseStart ?? null,
              pauseEnd: x.pauseEnd ?? null,
            })),
          );
        }
        setLogs(
          (Array.isArray(d.logs) ? d.logs : []).map((l: LogEntry) => ({
            ...l,
            actor: fixActor(l.actor),
          })),
        );
      }
    } catch {
      /* ignore corrupt storage */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) {
      localStorage.setItem(
        KEY,
        JSON.stringify({ pools, companies, stakeholders, grants, logs }),
      );
    }
  }, [pools, companies, stakeholders, grants, logs, hydrated]);

  const notify = useCallback((msg: string) => {
    setToast(msg);
    setToastKey((k) => k + 1);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 3000);
  }, []);

  const flash = useCallback((id: string) => {
    setFlashId(id);
    if (flashTimer.current) window.clearTimeout(flashTimer.current);
    flashTimer.current = window.setTimeout(() => setFlashId(null), 4200);
  }, []);

  const pushLog = (
    objectType: "pool" | "company" | "stakeholder" | "grant",
    objectId: string,
    action: LogAction,
    summary: string,
  ) => {
    setLogs((cur) => [
      {
        id: uid(),
        ts: new Date().toISOString(),
        objectType,
        objectId,
        action,
        summary,
        actor: ME,
      },
      ...cur,
    ]);
  };

  const cname = (id: string | null) =>
    id ? (companies.find((c) => c.id === id)?.name ?? "—") : "None";
  const tlabel = (t: PoolType) => (t === "phantom" ? "Phantoms" : "Stock options");
  const sizeLabel = (q: number | null) =>
    q == null ? "∞ unlimited" : q.toLocaleString();

  const addPool: Sandbox["addPool"] = (p) => {
    const pool: Pool = {
      ...p,
      id: uid(),
      createdAt: new Date().toISOString(),
      createdBy: ME,
    };
    setPools((cur) => [...cur, pool]);
    pushLog("pool", pool.id, "CREATE", "Pool created");
    flash(pool.id);
    return pool;
  };

  const updatePool: Sandbox["updatePool"] = (id, patch) => {
    const old = pools.find((p) => p.id === id);
    if (!old) return;
    setPools((cur) => cur.map((p) => (p.id === id ? { ...p, ...patch } : p)));
    const parts: string[] = [];
    if (patch.name !== undefined && patch.name !== old.name)
      parts.push(`name ${old.name} → ${patch.name}`);
    if (patch.type !== undefined && patch.type !== old.type)
      parts.push(`type ${tlabel(old.type)} → ${tlabel(patch.type)}`);
    if (patch.companyId !== undefined && patch.companyId !== old.companyId)
      parts.push(`company ${cname(old.companyId)} → ${cname(patch.companyId)}`);
    if (patch.quantity !== undefined && patch.quantity !== old.quantity)
      parts.push(`size ${sizeLabel(old.quantity)} → ${sizeLabel(patch.quantity)}`);
    if (parts.length) pushLog("pool", id, "UPDATE", parts.join("; "));
    flash(id);
  };

  const addCompany: Sandbox["addCompany"] = (name) => {
    const c: Company = {
      id: uid(),
      name,
      createdAt: new Date().toISOString(),
      createdBy: ME,
    };
    setCompanies((cur) => [...cur, c]);
    pushLog("company", c.id, "CREATE", "Company created");
    flash(c.id);
    return c;
  };

  const updateCompany: Sandbox["updateCompany"] = (id, patch) => {
    const old = companies.find((c) => c.id === id);
    if (!old) return;
    setCompanies((cur) => cur.map((c) => (c.id === id ? { ...c, ...patch } : c)));
    if (patch.name !== old.name)
      pushLog("company", id, "UPDATE", `name ${old.name} → ${patch.name}`);
    flash(id);
  };

  const stTypeLabel = (t: StakeholderType) =>
    t.charAt(0).toUpperCase() + t.slice(1);

  const addStakeholder: Sandbox["addStakeholder"] = (s) => {
    const seq = stakeholders.reduce((mx, x) => Math.max(mx, x.seq), 0) + 1;
    const st: Stakeholder = {
      ...s,
      id: uid(),
      seq,
      createdAt: new Date().toISOString(),
      createdBy: ME,
    };
    setStakeholders((cur) => [...cur, st]);
    pushLog("stakeholder", st.id, "CREATE", "Stakeholder created");
    flash(st.id);
    return st;
  };

  const updateStakeholder: Sandbox["updateStakeholder"] = (id, patch) => {
    const old = stakeholders.find((s) => s.id === id);
    if (!old) return;
    setStakeholders((cur) =>
      cur.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    );
    const parts: string[] = [];
    if (patch.firstName !== undefined && patch.firstName !== old.firstName)
      parts.push(`first name ${old.firstName || "—"} → ${patch.firstName || "—"}`);
    if (patch.lastName !== undefined && patch.lastName !== old.lastName)
      parts.push(`last name ${old.lastName || "—"} → ${patch.lastName || "—"}`);
    if (patch.type !== undefined && patch.type !== old.type)
      parts.push(`type ${stTypeLabel(old.type)} → ${stTypeLabel(patch.type)}`);
    if (patch.companyId !== undefined && patch.companyId !== old.companyId)
      parts.push(`company ${cname(old.companyId)} → ${cname(patch.companyId)}`);
    if (patch.email !== undefined && patch.email !== old.email)
      parts.push(`email ${old.email || "—"} → ${patch.email || "—"}`);
    if (patch.notes !== undefined && patch.notes !== old.notes)
      parts.push("notes updated");
    if (parts.length) pushLog("stakeholder", id, "UPDATE", parts.join("; "));
    flash(id);
  };

  const pname = (id: string | null) =>
    id ? (pools.find((p) => p.id === id)?.name ?? "—") : "None";

  const addGrant: Sandbox["addGrant"] = (g) => {
    const seq = grants.reduce((mx, x) => Math.max(mx, x.seq), 0) + 1;
    const gr: Grant = {
      ...g,
      id: uid(),
      seq,
      createdAt: new Date().toISOString(),
      createdBy: ME,
    };
    setGrants((cur) => [...cur, gr]);
    pushLog("grant", gr.id, "CREATE", "Grant created");
    flash(gr.id);
    return gr;
  };

  const updateGrant: Sandbox["updateGrant"] = (id, patch) => {
    const old = grants.find((g) => g.id === id);
    if (!old) return;
    setGrants((cur) => cur.map((g) => (g.id === id ? { ...g, ...patch } : g)));
    const parts: string[] = [];
    if (patch.quantity !== undefined && patch.quantity !== old.quantity)
      parts.push(
        `quantity ${old.quantity.toLocaleString()} → ${patch.quantity.toLocaleString()}`,
      );
    if (patch.poolId !== undefined && patch.poolId !== old.poolId)
      parts.push(`pool ${pname(old.poolId)} → ${pname(patch.poolId)}`);
    if (patch.grantDate !== undefined && patch.grantDate !== old.grantDate)
      parts.push(`grant date ${old.grantDate} → ${patch.grantDate}`);
    if (patch.strike !== undefined && patch.strike !== old.strike)
      parts.push(`strike ${old.strike ?? "—"} → ${patch.strike ?? "—"}`);
    if (
      patch.stakeholderId !== undefined &&
      patch.stakeholderId !== old.stakeholderId
    )
      parts.push("stakeholder changed");
    if (patch.vesting !== undefined) parts.push("vesting updated");
    // lifecycle events (GRANT-16/17)
    if (
      patch.terminationDate !== undefined &&
      patch.terminationDate !== old.terminationDate
    )
      parts.push(
        patch.terminationDate
          ? `vesting terminated from ${patch.terminationDate}`
          : "termination removed — scheduled vesting resumes",
      );
    const pauseTouched =
      (patch.pauseStart !== undefined && patch.pauseStart !== old.pauseStart) ||
      (patch.pauseEnd !== undefined && patch.pauseEnd !== old.pauseEnd);
    if (pauseTouched) {
      const ns = patch.pauseStart !== undefined ? patch.pauseStart : old.pauseStart;
      const ne = patch.pauseEnd !== undefined ? patch.pauseEnd : old.pauseEnd;
      parts.push(
        ns
          ? `vesting paused ${ns} → ${ne ?? "open-ended"}`
          : "pause removed — schedule recomputed",
      );
    }
    if (parts.length) pushLog("grant", id, "UPDATE", parts.join("; "));
    flash(id);
  };

  const grantsForStakeholder = (stakeholderId: string) =>
    grants.filter((g) => g.stakeholderId === stakeholderId);
  const grantsForPool = (poolId: string) =>
    grants.filter((g) => g.poolId === poolId);

  const poolsForCompany = (companyId: string) =>
    pools.filter((p) => p.companyId === companyId);
  // Units a pool has RESERVED. A terminated grant only reserves what actually
  // vests — the forfeited remainder is back in the pool (GRANT-16); a paused
  // grant keeps its full reservation (GRANT-17).
  const grantedFor = (poolId: string) =>
    grants
      .filter((g) => g.poolId === poolId)
      .reduce(
        (sum, g) => sum + reservedUnits(g.quantity || 0, g.vesting, g.grantDate, g),
        0,
      );
  const logsFor = (objectId: string) =>
    logs.filter((l) => l.objectId === objectId);
  const resetSandbox = () => {
    setPools([]);
    setCompanies([]);
    setStakeholders([]);
    setGrants([]);
    setLogs([]);
  };

  return (
    <Ctx.Provider
      value={{
        hydrated,
        pools,
        companies,
        stakeholders,
        grants,
        logs,
        flashId,
        addPool,
        updatePool,
        addCompany,
        updateCompany,
        addStakeholder,
        updateStakeholder,
        addGrant,
        updateGrant,
        grantsForStakeholder,
        grantsForPool,
        poolsForCompany,
        grantedFor,
        logsFor,
        resetSandbox,
        toast,
        notify,
      }}
    >
      {children}
      {toast && (
        <div className="toast" key={toastKey}>
          {toast}
        </div>
      )}
    </Ctx.Provider>
  );
}

export function useSandbox() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useSandbox must be used inside SandboxProvider");
  return c;
}
