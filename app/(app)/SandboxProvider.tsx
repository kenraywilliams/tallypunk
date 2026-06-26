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

export type LogAction = "CREATE" | "UPDATE" | "DELETE";

export interface LogEntry {
  id: string;
  ts: string;
  objectType: "pool" | "company";
  objectId: string;
  action: LogAction;
  summary: string;
  actor: string;
}

interface Sandbox {
  hydrated: boolean;
  pools: Pool[];
  companies: Company[];
  logs: LogEntry[];
  flashId: string | null;
  addPool: (p: Omit<Pool, "id" | "createdAt" | "createdBy">) => Pool;
  updatePool: (
    id: string,
    patch: Partial<Omit<Pool, "id" | "createdAt" | "createdBy">>,
  ) => void;
  addCompany: (name: string) => Company;
  updateCompany: (id: string, patch: { name: string }) => void;
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
      localStorage.setItem(KEY, JSON.stringify({ pools, companies, logs }));
    }
  }, [pools, companies, logs, hydrated]);

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
    objectType: "pool" | "company",
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

  const poolsForCompany = (companyId: string) =>
    pools.filter((p) => p.companyId === companyId);
  const grantedFor = (_poolId: string) => 0; // no grants yet — wires to Grants later
  const logsFor = (objectId: string) =>
    logs.filter((l) => l.objectId === objectId);
  const resetSandbox = () => {
    setPools([]);
    setCompanies([]);
    setLogs([]);
  };

  return (
    <Ctx.Provider
      value={{
        hydrated,
        pools,
        companies,
        logs,
        flashId,
        addPool,
        updatePool,
        addCompany,
        updateCompany,
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
