"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

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

export type LogAction = "CREATE" | "UPDATE" | "DELETE";

export interface LogEntry {
  id: string;
  ts: string;
  objectType: "pool" | "company" | "stakeholder";
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
        JSON.stringify({ pools, companies, stakeholders, logs }),
      );
    }
  }, [pools, companies, stakeholders, logs, hydrated]);

  const notify = useCallback((msg: string) => {
    setToast(msg);
    setToastKey((k) => k + 1);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 3000);
  }, []);

  const flash = useCallback((id: string) => {
    setFlashId(id);
    if (flashTimer.current) window.clearTimeout(flashTimer.current);
    flashTimer.current = window.setTimeout(() => setFlashId(null), 2500);
  }, []);

  const pushLog = (
    objectType: "pool" | "company" | "stakeholder",
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

  const poolsForCompany = (companyId: string) =>
    pools.filter((p) => p.companyId === companyId);
  const grantedFor = (_poolId: string) => 0; // no grants yet — wires to Grants later
  const logsFor = (objectId: string) =>
    logs.filter((l) => l.objectId === objectId);
  const resetSandbox = () => {
    setPools([]);
    setCompanies([]);
    setStakeholders([]);
    setLogs([]);
  };

  return (
    <Ctx.Provider
      value={{
        hydrated,
        pools,
        companies,
        stakeholders,
        logs,
        flashId,
        addPool,
        updatePool,
        addCompany,
        updateCompany,
        addStakeholder,
        updateStakeholder,
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
