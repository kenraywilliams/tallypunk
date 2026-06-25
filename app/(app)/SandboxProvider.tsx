"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

// ---- Data shapes (these map 1:1 to the future Postgres tables) ----
export type PoolType = "real" | "phantom";

export interface Pool {
  id: string;
  name: string;
  type: PoolType; // real = stock options · phantom = virtual/cash-settled
  companyId: string | null;
  quantity: number | null; // null = unlimited ("Infinity pool")
  createdAt: string; // ISO
}

export interface Company {
  id: string;
  name: string;
  createdAt: string;
}

interface Sandbox {
  hydrated: boolean;
  pools: Pool[];
  companies: Company[];
  addPool: (p: Omit<Pool, "id" | "createdAt">) => Pool;
  addCompany: (name: string) => Company;
  resetSandbox: () => void;
  toast: string | null;
  notify: (msg: string) => void;
}

const Ctx = createContext<Sandbox | null>(null);
const KEY = "tallypunk-sandbox-v1";
const uid = () => Math.random().toString(36).slice(2, 10);

export function SandboxProvider({ children }: { children: React.ReactNode }) {
  const [hydrated, setHydrated] = useState(false);
  const [pools, setPools] = useState<Pool[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);

  // load from this browser's localStorage on first mount (client only)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const d = JSON.parse(raw);
        setPools(Array.isArray(d.pools) ? d.pools : []);
        setCompanies(Array.isArray(d.companies) ? d.companies : []);
      }
    } catch {
      /* ignore corrupt storage */
    }
    setHydrated(true);
  }, []);

  // persist on change
  useEffect(() => {
    if (hydrated) {
      localStorage.setItem(KEY, JSON.stringify({ pools, companies }));
    }
  }, [pools, companies, hydrated]);

  const notify = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 4000);
  }, []);

  const addPool: Sandbox["addPool"] = (p) => {
    const pool: Pool = { ...p, id: uid(), createdAt: new Date().toISOString() };
    setPools((cur) => [...cur, pool]);
    return pool;
  };

  const addCompany: Sandbox["addCompany"] = (name) => {
    const c: Company = { id: uid(), name, createdAt: new Date().toISOString() };
    setCompanies((cur) => [...cur, c]);
    return c;
  };

  const resetSandbox = () => {
    setPools([]);
    setCompanies([]);
  };

  return (
    <Ctx.Provider
      value={{
        hydrated,
        pools,
        companies,
        addPool,
        addCompany,
        resetSandbox,
        toast,
        notify,
      }}
    >
      {children}
      {toast && <div className="toast">{toast}</div>}
    </Ctx.Provider>
  );
}

export function useSandbox() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useSandbox must be used inside SandboxProvider");
  return c;
}
