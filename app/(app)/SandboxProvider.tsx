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
}

export interface Company {
  id: string;
  name: string;
  createdAt: string;
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
  addPool: (p: Omit<Pool, "id" | "createdAt">) => Pool;
  updatePool: (id: string, patch: Partial<Omit<Pool, "id" | "createdAt">>) => void;
  addCompany: (name: string) => Company;
  logsFor: (objectId: string) => LogEntry[];
  resetSandbox: () => void;
  toast: string | null;
  notify: (msg: string) => void;
}

const Ctx = createContext<Sandbox | null>(null);
const KEY = "tallypunk-sandbox-v1";
const uid = () => Math.random().toString(36).slice(2, 10);
const POOL_LABELS: Record<string, string> = {
  name: "name",
  type: "type",
  companyId: "company",
  quantity: "size",
};

export function SandboxProvider({ children }: { children: React.ReactNode }) {
  const [hydrated, setHydrated] = useState(false);
  const [pools, setPools] = useState<Pool[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [toastKey, setToastKey] = useState(0);
  const toastTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const d = JSON.parse(raw);
        setPools(Array.isArray(d.pools) ? d.pools : []);
        setCompanies(Array.isArray(d.companies) ? d.companies : []);
        setLogs(Array.isArray(d.logs) ? d.logs : []);
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
    toastTimer.current = window.setTimeout(() => setToast(null), 3500);
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
        actor: "You",
      },
      ...cur,
    ]);
  };

  const addPool: Sandbox["addPool"] = (p) => {
    const pool: Pool = { ...p, id: uid(), createdAt: new Date().toISOString() };
    setPools((cur) => [...cur, pool]);
    pushLog("pool", pool.id, "CREATE", `Created “${pool.name}”`);
    return pool;
  };

  const updatePool: Sandbox["updatePool"] = (id, patch) => {
    const old = pools.find((p) => p.id === id);
    setPools((cur) => cur.map((p) => (p.id === id ? { ...p, ...patch } : p)));
    if (old) {
      const changed = (Object.keys(patch) as (keyof typeof patch)[])
        .filter((k) => old[k] !== patch[k])
        .map((k) => POOL_LABELS[k] ?? k);
      pushLog(
        "pool",
        id,
        "UPDATE",
        changed.length ? `Changed ${changed.join(", ")}` : "Updated",
      );
    }
  };

  const addCompany: Sandbox["addCompany"] = (name) => {
    const c: Company = { id: uid(), name, createdAt: new Date().toISOString() };
    setCompanies((cur) => [...cur, c]);
    pushLog("company", c.id, "CREATE", `Created “${c.name}”`);
    return c;
  };

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
        addPool,
        updatePool,
        addCompany,
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
