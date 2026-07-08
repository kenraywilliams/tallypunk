"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { Company, Stakeholder } from "../SandboxProvider";
import { typeLabel } from "./util";

export type ColKey =
  | "id"
  | "first"
  | "last"
  | "type"
  | "company"
  | "email"
  | "granted"
  | "vested"
  | "status"
  | "created";

export interface ColDef {
  key: ColKey;
  label: string;
}

export const ALL_COLS: ColDef[] = [
  { key: "id", label: "ID" },
  { key: "first", label: "First name(s)" },
  { key: "last", label: "Last name(s)" },
  { key: "type", label: "Type" },
  { key: "company", label: "Company" },
  { key: "email", label: "Email" },
  { key: "granted", label: "Granted" },
  { key: "vested", label: "Vested" },
  { key: "status", label: "Status" },
  { key: "created", label: "Created" },
];

const DEFAULT_VISIBLE: ColKey[] = [
  "id",
  "first",
  "last",
  "type",
  "company",
  "granted",
  "vested",
  "status",
];

type Dir = "asc" | "desc";
export type NavField = "first" | "last";

// Equity numbers for the Granted / Vested columns — supplied by the page
// (which has the grants + vesting engine); the view stays presentation-only.
export interface StakeholderMetrics {
  granted: number; // total units across their grants
  vestedPct: number; // 0..1, lifecycle-aware, as of today
  statusRank: number; // 0 active · 1 paused · 2 terminated · 3 no grants
}

function sortValue(
  s: Stakeholder,
  key: ColKey,
  cname: (id: string | null) => string,
  metric?: (s: Stakeholder) => StakeholderMetrics,
): string | number {
  switch (key) {
    case "id":
      return s.seq;
    case "first":
      return s.firstName.toLowerCase();
    case "last":
      return s.lastName.toLowerCase();
    case "type":
      return typeLabel(s.type).toLowerCase();
    case "company":
      return cname(s.companyId).toLowerCase();
    case "email":
      return s.email.toLowerCase();
    case "granted":
      return metric ? metric(s).granted : 0;
    case "vested":
      return metric ? metric(s).vestedPct : 0;
    case "status":
      return metric ? metric(s).statusRank : 3;
    case "created":
      return s.createdAt;
    default:
      return "";
  }
}

export function sortStakeholders(
  list: Stakeholder[],
  companies: Company[],
  key: ColKey,
  dir: Dir,
  metric?: (s: Stakeholder) => StakeholderMetrics,
): Stakeholder[] {
  const cname = (id: string | null) =>
    id ? (companies.find((c) => c.id === id)?.name ?? "") : "";
  return [...list].sort((a, b) => {
    const va = sortValue(a, key, cname, metric);
    const vb = sortValue(b, key, cname, metric);
    const c = va < vb ? -1 : va > vb ? 1 : 0;
    return dir === "asc" ? c : -c;
  });
}

interface ViewCtx {
  hydrated: boolean;
  visible: ColKey[];
  sortKey: ColKey;
  sortDir: Dir;
  toggleCol: (k: ColKey) => void;
  moveCol: (k: ColKey, dir: "up" | "down") => void;
  cycleSort: (k: ColKey) => void;
  navField: NavField;
  navDir: Dir;
  setNavSort: (f: NavField) => void;
}

const Ctx = createContext<ViewCtx | null>(null);
const VKEY = "tallypunk-stk-view-v2";

export function StakeholderViewProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [hydrated, setHydrated] = useState(false);
  const [visible, setVisible] = useState<ColKey[]>(DEFAULT_VISIBLE);
  const [sortKey, setSortKey] = useState<ColKey>("id");
  const [sortDir, setSortDir] = useState<Dir>("asc");
  const [navField, setNavField] = useState<NavField>("first");
  const [navDir, setNavDir] = useState<Dir>("asc");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(VKEY);
      if (raw) {
        const d = JSON.parse(raw);
        if (Array.isArray(d.visible) && d.visible.length)
          // saved prefs predate the Status column → join it in once (STK-06)
          setVisible(
            d.visible.includes("status")
              ? d.visible
              : [...d.visible, "status"],
          );
        if (typeof d.sortKey === "string") setSortKey(d.sortKey);
        if (d.sortDir === "asc" || d.sortDir === "desc") setSortDir(d.sortDir);
        if (d.navField === "first" || d.navField === "last")
          setNavField(d.navField);
        if (d.navDir === "asc" || d.navDir === "desc") setNavDir(d.navDir);
      }
    } catch {
      /* ignore corrupt prefs */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated)
      localStorage.setItem(
        VKEY,
        JSON.stringify({ visible, sortKey, sortDir, navField, navDir }),
      );
  }, [visible, sortKey, sortDir, navField, navDir, hydrated]);

  const toggleCol = (k: ColKey) =>
    setVisible((cur) =>
      cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k],
    );

  const moveCol = (k: ColKey, dir: "up" | "down") =>
    setVisible((cur) => {
      const i = cur.indexOf(k);
      const j = dir === "up" ? i - 1 : i + 1;
      if (i === -1 || j < 0 || j >= cur.length) return cur;
      const next = [...cur];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  const cycleSort = (k: ColKey) => {
    if (sortKey === k) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(k);
      setSortDir("asc");
    }
  };

  const setNavSort = (f: NavField) => {
    if (navField === f) {
      setNavDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setNavField(f);
      setNavDir("asc");
    }
  };

  return (
    <Ctx.Provider
      value={{
        hydrated,
        visible,
        sortKey,
        sortDir,
        toggleCol,
        moveCol,
        cycleSort,
        navField,
        navDir,
        setNavSort,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useStakeholderView() {
  const c = useContext(Ctx);
  if (!c)
    throw new Error(
      "useStakeholderView must be used inside StakeholderViewProvider",
    );
  return c;
}
