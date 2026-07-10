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
  // POOL-09: the General Pool — an inherent structure that always exists.
  // Infinite, undeletable, uneditable; the landing zone for pool deletes.
  isGeneral?: boolean;
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
  // Person-level lifecycle RECORD (GRANT-18): the event lives here and drives
  // buttons / status / Profile; the fanned-out effect lives on each grant.
  terminationDate?: string | null;
  pauseStart?: string | null;
  pauseEnd?: string | null;
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
  // GRANT-18: true when the event was fanned out from a person-level action
  // (an "inherited" event); individual grant-level events leave these false.
  terminationInherited?: boolean;
  pauseInherited?: boolean;
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
  // Grant entries only: the stakeholder who OWNED the grant when the entry
  // was written (audit attribution — a reassigned grant's earlier history
  // stays on the previous person's timeline; nullable FK in Postgres).
  stakeholderId?: string | null;
  // Grant entries only: the pool the grant DREW FROM when the entry was
  // written — grant activity rolls up on the pool's audit log too.
  poolId?: string | null;
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
  // person-level lifecycle (GRANT-18)
  terminateAllFor: (
    stakeholderId: string,
    date: string,
  ) => { affected: string[]; skipped: string[] };
  pauseAllFor: (
    stakeholderId: string,
    ps: string,
    pe: string | null,
  ) => { affected: string[]; skipped: string[] };
  reinstatePreflight: (
    stakeholderId: string,
    selectedIds: string[],
  ) => {
    grantId: string;
    inherited: boolean;
    selected: boolean;
    needed: number;
    poolId: string | null;
    ok: boolean;
    shortfall: number;
  }[];
  reinstateAllFor: (
    stakeholderId: string,
    selectedIds: string[],
  ) => { restored: string[]; blocked: string[] };
  unPauseAllFor: (
    stakeholderId: string,
  ) => { affected: string[]; skipped: string[] };
  grantsForPool: (poolId: string) => Grant[];
  poolsForCompany: (companyId: string) => Pool[];
  grantedFor: (poolId: string) => number;
  logsFor: (objectId: string) => LogEntry[];
  logsForStakeholder: (stakeholderId: string) => LogEntry[];
  logsForPool: (poolId: string) => LogEntry[];
  // deletes (GBL-09) — hard, cascade rules per object
  deleteGrant: (id: string) => void;
  deleteStakeholder: (id: string) => void;
  deleteCompany: (id: string) => void;
  deletePool: (
    id: string,
    plan: Record<
      string,
      { action: "move"; poolId: string | null } | { action: "delete" }
    >,
  ) => void;
  resetSandbox: () => void;
  toast: string | null;
  notify: (msg: string) => void;
}

const Ctx = createContext<Sandbox | null>(null);
const KEY = "tallypunk-sandbox-v1";
const ME = "Sandbox user";
const uid = () => Math.random().toString(36).slice(2, 10);
const gidPad = (seq: number) => String(seq).padStart(7, "0");

// POOL-09: the General Pool — always exists, infinite, undeletable.
const makeGeneralPool = (): Pool => ({
  id: uid(),
  name: "General Pool",
  type: "real",
  companyId: null,
  quantity: null,
  isGeneral: true,
  createdAt: new Date().toISOString(),
  createdBy: ME,
});

export function SandboxProvider({ children }: { children: React.ReactNode }) {
  const [hydrated, setHydrated] = useState(false);
  const [pools, setPools] = useState<Pool[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [stakeholders, setStakeholders] = useState<Stakeholder[]>([]);
  const [grants, setGrants] = useState<Grant[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  // GBL-08: display IDs are MONOTONIC — persisted counters, never recomputed
  // from the live arrays (max+1 would reuse a deleted object's number).
  const [seqs, setSeqs] = useState({ stakeholder: 0, grant: 0 });
  const [toast, setToast] = useState<string | null>(null);
  const [toastKey, setToastKey] = useState(0);
  const toastTimer = useRef<number | undefined>(undefined);
  const [flashId, setFlashId] = useState<string | null>(null);
  const flashTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    let maxStSeq = 0;
    let maxGrSeq = 0;
    let loadedSeqs: { stakeholder: number; grant: number } | null = null;
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
        if (
          d.seqs &&
          typeof d.seqs.stakeholder === "number" &&
          typeof d.seqs.grant === "number"
        )
          loadedSeqs = d.seqs;
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
          maxStSeq = maxSeq;
        }
        let grantArr: Grant[] = [];
        {
          const arr: Grant[] = Array.isArray(d.grants) ? d.grants : [];
          let maxSeq = arr.reduce(
            (mx, x) => (typeof x.seq === "number" ? Math.max(mx, x.seq) : mx),
            0,
          );
          grantArr = arr.map((x) => ({
            ...x,
            createdBy: fixActor(x.createdBy),
            seq: typeof x.seq === "number" ? x.seq : ++maxSeq,
            terminationDate: x.terminationDate ?? null,
            pauseStart: x.pauseStart ?? null,
            pauseEnd: x.pauseEnd ?? null,
          }));
          setGrants(grantArr);
          maxGrSeq = maxSeq;
        }
        setLogs(
          (Array.isArray(d.logs) ? d.logs : []).map((l: LogEntry) => ({
            ...l,
            actor: fixActor(l.actor),
            // Backfill: grant entries written before attribution existed
            // adopt the grant's CURRENT owner/pool — exact unless reassigned
            // pre-backfill (sandbox-acceptable).
            ...(l.objectType === "grant" && l.stakeholderId === undefined
              ? {
                  stakeholderId:
                    grantArr.find((g) => g.id === l.objectId)?.stakeholderId ??
                    null,
                }
              : {}),
            ...(l.objectType === "grant" && l.poolId === undefined
              ? {
                  poolId:
                    grantArr.find((g) => g.id === l.objectId)?.poolId ?? null,
                }
              : {}),
          })),
        );
      }
    } catch {
      /* ignore corrupt storage */
    }
    // monotonic ID counters: saved values win; else seed from current maxima
    setSeqs(
      loadedSeqs ?? { stakeholder: maxStSeq, grant: maxGrSeq },
    );
    // POOL-09: the General Pool always exists (fresh sandboxes included)
    setPools((cur) =>
      cur.some((p) => p.isGeneral) ? cur : [...cur, makeGeneralPool()],
    );
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) {
      localStorage.setItem(
        KEY,
        JSON.stringify({ pools, companies, stakeholders, grants, logs, seqs }),
      );
    }
  }, [pools, companies, stakeholders, grants, logs, seqs, hydrated]);

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
    stakeholderId?: string | null,
    poolId?: string | null,
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
        ...(stakeholderId !== undefined ? { stakeholderId } : {}),
        ...(poolId !== undefined ? { poolId } : {}),
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
    const seq = seqs.stakeholder + 1;
    setSeqs((cur) => ({ ...cur, stakeholder: seq }));
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
    const seq = seqs.grant + 1;
    setSeqs((cur) => ({ ...cur, grant: seq }));
    const gr: Grant = {
      ...g,
      id: uid(),
      seq,
      createdAt: new Date().toISOString(),
      createdBy: ME,
    };
    setGrants((cur) => [...cur, gr]);
    pushLog(
      "grant",
      gr.id,
      "CREATE",
      "Grant created",
      gr.stakeholderId,
      gr.poolId,
    );
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
    const sname = (sid: string) => {
      const s = stakeholders.find((x) => x.id === sid);
      return s ? `${s.firstName} ${s.lastName}`.trim() || "—" : "—";
    };
    const reassigned =
      patch.stakeholderId !== undefined &&
      patch.stakeholderId !== old.stakeholderId;
    if (patch.strike !== undefined && patch.strike !== old.strike)
      parts.push(`strike ${old.strike ?? "—"} → ${patch.strike ?? "—"}`);
    if (reassigned)
      parts.push(
        `stakeholder ${sname(old.stakeholderId)} → ${sname(patch.stakeholderId!)}`,
      );
    if (patch.vesting !== undefined) parts.push("vesting updated");
    // lifecycle events (GRANT-16/17)
    if (
      patch.terminationDate !== undefined &&
      patch.terminationDate !== old.terminationDate
    )
      parts.push(
        patch.terminationDate && old.terminationDate
          ? `termination date ${old.terminationDate} → ${patch.terminationDate}`
          : patch.terminationDate
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
    // Attribution: entries belong to the CURRENT owner's timeline (person AND
    // pool). On a reassignment/pool move, the previous timeline keeps its
    // history plus a note of where the grant went (GBL-06).
    const owner = reassigned ? patch.stakeholderId! : old.stakeholderId;
    const rePooled = patch.poolId !== undefined && patch.poolId !== old.poolId;
    const ownerPool = rePooled ? (patch.poolId ?? null) : old.poolId;
    if (parts.length)
      pushLog("grant", id, "UPDATE", parts.join("; "), owner, ownerPool);
    if (reassigned)
      pushLog(
        "grant",
        id,
        "UPDATE",
        `grant reassigned to ${sname(patch.stakeholderId!)} — its history from here lives with them`,
        old.stakeholderId,
        ownerPool,
      );
    if (rePooled && old.poolId)
      pushLog(
        "grant",
        id,
        "UPDATE",
        `grant #${gidPad(old.seq)} moved to ${pname(patch.poolId ?? null)} — its history from here lives there`,
        owner,
        old.poolId,
      );
    flash(id);
  };

  const grantsForStakeholder = (stakeholderId: string) =>
    grants.filter((g) => g.stakeholderId === stakeholderId);

  // ---- person-level lifecycle (GRANT-18) ----
  // Fan-out: the action writes the event onto each eligible grant (tagged
  // inherited) AND records it on the stakeholder. Individual grant events
  // always win — those grants are skipped and reported.

  const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;

  const terminateAllFor = (stakeholderId: string, date: string) => {
    const gs = grants.filter((g) => g.stakeholderId === stakeholderId);
    const affected = gs.filter((g) => !g.terminationDate);
    const skipped = gs.filter((g) => !!g.terminationDate);
    setGrants((cur) =>
      cur.map((g) =>
        g.stakeholderId === stakeholderId && !g.terminationDate
          ? { ...g, terminationDate: date, terminationInherited: true }
          : g,
      ),
    );
    setStakeholders((cur) =>
      cur.map((s) =>
        s.id === stakeholderId ? { ...s, terminationDate: date } : s,
      ),
    );
    affected.forEach((g) =>
      pushLog(
        "grant",
        g.id,
        "UPDATE",
        `vesting terminated from ${date} (person-level)`,
        stakeholderId,
        g.poolId,
      ),
    );
    pushLog(
      "stakeholder",
      stakeholderId,
      "UPDATE",
      `terminated vesting from ${date} — applied to ${plural(affected.length, "grant")}, ${skipped.length} skipped (own termination)`,
    );
    flash(stakeholderId);
    return { affected: affected.map((g) => g.id), skipped: skipped.map((g) => g.id) };
  };

  const pauseAllFor = (
    stakeholderId: string,
    ps: string,
    pe: string | null,
  ) => {
    const gs = grants.filter((g) => g.stakeholderId === stakeholderId);
    // skip grants with their own pause (individual wins) AND terminated
    // grants — pausing one would shift tranches past its termination cut and
    // retroactively change what was forfeited.
    const eligible = (g: Grant) => !g.pauseStart && !g.terminationDate;
    const affected = gs.filter(eligible);
    const skipped = gs.filter((g) => !eligible(g));
    setGrants((cur) =>
      cur.map((g) =>
        g.stakeholderId === stakeholderId && eligible(g)
          ? { ...g, pauseStart: ps, pauseEnd: pe, pauseInherited: true }
          : g,
      ),
    );
    setStakeholders((cur) =>
      cur.map((s) =>
        s.id === stakeholderId ? { ...s, pauseStart: ps, pauseEnd: pe } : s,
      ),
    );
    affected.forEach((g) =>
      pushLog(
        "grant",
        g.id,
        "UPDATE",
        `vesting paused ${ps} → ${pe ?? "open-ended"} (person-level)`,
        stakeholderId,
        g.poolId,
      ),
    );
    pushLog(
      "stakeholder",
      stakeholderId,
      "UPDATE",
      `paused vesting ${ps} → ${pe ?? "open-ended"} — applied to ${plural(affected.length, "grant")}, ${skipped.length} skipped (own pause or terminated)`,
    );
    flash(stakeholderId);
    return { affected: affected.map((g) => g.id), skipped: skipped.map((g) => g.id) };
  };

  // Capacity pre-flight for person-level reinstate: pools are allocated
  // CUMULATIVELY in grant order across the SELECTED grants — two grants on
  // one pool may each fit alone but not together.
  const reinstatePreflight = (stakeholderId: string, selectedIds: string[]) => {
    const sel = new Set(selectedIds);
    const remaining = new Map<string, number>();
    return grants
      .filter((g) => g.stakeholderId === stakeholderId && g.terminationDate)
      .map((g) => {
        const needed =
          (g.quantity || 0) -
          reservedUnits(g.quantity, g.vesting, g.grantDate, g);
        let ok = true;
        let shortfall = 0;
        if (sel.has(g.id) && g.poolId) {
          const pool = pools.find((p) => p.id === g.poolId);
          if (pool && pool.quantity != null) {
            if (!remaining.has(pool.id))
              remaining.set(pool.id, pool.quantity - grantedFor(pool.id));
            const rem = remaining.get(pool.id)!;
            ok = needed <= rem;
            if (ok) remaining.set(pool.id, rem - needed);
            else shortfall = needed - rem;
          }
        }
        return {
          grantId: g.id,
          inherited: !!g.terminationInherited,
          selected: sel.has(g.id),
          needed,
          poolId: g.poolId,
          ok: sel.has(g.id) ? ok : false,
          shortfall,
        };
      });
  };

  const reinstateAllFor = (stakeholderId: string, selectedIds: string[]) => {
    const rows = reinstatePreflight(stakeholderId, selectedIds);
    const restore = new Set(
      rows.filter((r) => r.selected && r.ok).map((r) => r.grantId),
    );
    const blocked = rows.filter((r) => r.selected && !r.ok);
    // After a person-level reinstate NO grant keeps an inherited termination:
    // restored ones clear it; blocked/deselected ones become grant-level.
    setGrants((cur) =>
      cur.map((g) => {
        if (g.stakeholderId !== stakeholderId) return g;
        if (restore.has(g.id))
          return { ...g, terminationDate: null, terminationInherited: false };
        if (g.terminationDate && g.terminationInherited)
          return { ...g, terminationInherited: false };
        return g;
      }),
    );
    setStakeholders((cur) =>
      cur.map((s) =>
        s.id === stakeholderId ? { ...s, terminationDate: null } : s,
      ),
    );
    restore.forEach((gid) =>
      pushLog(
        "grant",
        gid,
        "UPDATE",
        "termination removed — scheduled vesting resumes (person-level reinstate)",
        stakeholderId,
        grants.find((g) => g.id === gid)?.poolId ?? null,
      ),
    );
    blocked.forEach((r) =>
      pushLog(
        "grant",
        r.grantId,
        "UPDATE",
        `reinstate blocked — pool short ${r.shortfall.toLocaleString()} units; stays terminated (now grant-level)`,
        stakeholderId,
        r.poolId,
      ),
    );
    pushLog(
      "stakeholder",
      stakeholderId,
      "UPDATE",
      `reinstated vesting — ${plural(restore.size, "grant")} restored, ${blocked.length} blocked by pool capacity, ${rows.filter((r) => !r.selected).length} left terminated by choice`,
    );
    flash(stakeholderId);
    return {
      restored: [...restore],
      blocked: blocked.map((r) => r.grantId),
    };
  };

  const unPauseAllFor = (stakeholderId: string) => {
    const gs = grants.filter((g) => g.stakeholderId === stakeholderId);
    const affected = gs.filter((g) => g.pauseStart && g.pauseInherited);
    const skipped = gs.filter((g) => g.pauseStart && !g.pauseInherited);
    setGrants((cur) =>
      cur.map((g) =>
        g.stakeholderId === stakeholderId && g.pauseStart && g.pauseInherited
          ? { ...g, pauseStart: null, pauseEnd: null, pauseInherited: false }
          : g,
      ),
    );
    setStakeholders((cur) =>
      cur.map((s) =>
        s.id === stakeholderId ? { ...s, pauseStart: null, pauseEnd: null } : s,
      ),
    );
    affected.forEach((g) =>
      pushLog(
        "grant",
        g.id,
        "UPDATE",
        "pause removed — schedule recomputed (person-level un-pause)",
        stakeholderId,
        g.poolId,
      ),
    );
    pushLog(
      "stakeholder",
      stakeholderId,
      "UPDATE",
      `removed person-level pause — ${plural(affected.length, "grant")} resumed, ${skipped.length} kept their own pause`,
    );
    flash(stakeholderId);
    return { affected: affected.map((g) => g.id), skipped: skipped.map((g) => g.id) };
  };
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
  // ---- deletes (GBL-09) — hard, irreversible; every delete logs, and the
  // summary echoes onto the parent's timeline wherever one exists ----

  const deleteGrant = (id: string) => {
    const g = grants.find((x) => x.id === id);
    if (!g) return;
    const freed = reservedUnits(g.quantity, g.vesting, g.grantDate, g);
    setGrants((cur) => cur.filter((x) => x.id !== id));
    pushLog(
      "grant",
      id,
      "DELETE",
      `Grant #${gidPad(g.seq)} deleted — ${freed.toLocaleString()} reserved units ${g.poolId ? `returned to ${pname(g.poolId)}` : "released (no pool)"}`,
      g.stakeholderId,
      g.poolId,
    );
  };

  const deleteStakeholder = (id: string) => {
    const s = stakeholders.find((x) => x.id === id);
    if (!s) return;
    const gs = grants.filter((g) => g.stakeholderId === id);
    // per-pool freed units for the summary entry
    const freedByPool = new Map<string, number>();
    gs.forEach((g) => {
      const freed = reservedUnits(g.quantity, g.vesting, g.grantDate, g);
      const key = g.poolId ? pname(g.poolId) : "no pool";
      freedByPool.set(key, (freedByPool.get(key) ?? 0) + freed);
      pushLog(
        "grant",
        g.id,
        "DELETE",
        `Grant #${gidPad(g.seq)} deleted with its stakeholder — ${freed.toLocaleString()} reserved units ${g.poolId ? `returned to ${pname(g.poolId)}` : "released"}`,
        id,
        g.poolId,
      );
    });
    const perPool = [...freedByPool.entries()]
      .map(([n, u]) => `${n} +${u.toLocaleString()}`)
      .join(", ");
    const who = `${s.firstName} ${s.lastName}`.trim() || "—";
    setGrants((cur) => cur.filter((g) => g.stakeholderId !== id));
    setStakeholders((cur) => cur.filter((x) => x.id !== id));
    pushLog(
      "stakeholder",
      id,
      "DELETE",
      `Stakeholder ${who} (#${String(s.seq).padStart(6, "0")}) deleted — ${gs.length} grant${gs.length === 1 ? "" : "s"} deleted${perPool ? ` (units returned: ${perPool})` : ""}`,
    );
    if (s.companyId)
      pushLog(
        "company",
        s.companyId,
        "DELETE",
        `stakeholder ${who} deleted (${gs.length} grant${gs.length === 1 ? "" : "s"} went with them)`,
      );
  };

  const deleteCompany = (id: string) => {
    const c = companies.find((x) => x.id === id);
    if (!c) return;
    const affPools = pools.filter((p) => p.companyId === id);
    const affSts = stakeholders.filter((s) => s.companyId === id);
    setPools((cur) =>
      cur.map((p) => (p.companyId === id ? { ...p, companyId: null } : p)),
    );
    setStakeholders((cur) =>
      cur.map((s) => (s.companyId === id ? { ...s, companyId: null } : s)),
    );
    // echo on every detached child's timeline
    affPools.forEach((p) =>
      pushLog("pool", p.id, "UPDATE", `company ${c.name} deleted — company set to —`),
    );
    affSts.forEach((s) =>
      pushLog(
        "stakeholder",
        s.id,
        "UPDATE",
        `company ${c.name} deleted — company set to —`,
      ),
    );
    setCompanies((cur) => cur.filter((x) => x.id !== id));
    pushLog(
      "company",
      id,
      "DELETE",
      `Company ${c.name} deleted — ${affPools.length} pool${affPools.length === 1 ? "" : "s"} and ${affSts.length} stakeholder${affSts.length === 1 ? "" : "s"} detached (kept, company cleared)`,
    );
  };

  // plan: per-grant disposition; anything unlisted defaults to General Pool.
  // Capacity is validated by the wizard UI pre-flight; the General Pool never
  // blocks (infinite).
  const deletePool = (
    id: string,
    plan: Record<
      string,
      { action: "move"; poolId: string | null } | { action: "delete" }
    >,
  ) => {
    const p = pools.find((x) => x.id === id);
    if (!p || p.isGeneral) return;
    const general = pools.find((x) => x.isGeneral) ?? null;
    const gs = grants.filter((g) => g.poolId === id);
    let moved = 0;
    let removed = 0;
    gs.forEach((g) => {
      const d = plan[g.id] ?? { action: "move" as const, poolId: general?.id ?? null };
      if (d.action === "delete") {
        removed++;
        const freed = reservedUnits(g.quantity, g.vesting, g.grantDate, g);
        pushLog(
          "grant",
          g.id,
          "DELETE",
          `Grant #${gidPad(g.seq)} deleted with pool ${p.name} (${freed.toLocaleString()} reserved units released)`,
          g.stakeholderId,
          id,
        );
      } else {
        moved++;
        pushLog(
          "grant",
          g.id,
          "UPDATE",
          `pool ${p.name} → ${pname(d.poolId)} (pool deleted)`,
          g.stakeholderId,
          d.poolId,
        );
      }
    });
    setGrants((cur) =>
      cur.flatMap((g) => {
        if (g.poolId !== id) return [g];
        const d = plan[g.id] ?? { action: "move" as const, poolId: general?.id ?? null };
        return d.action === "delete" ? [] : [{ ...g, poolId: d.poolId }];
      }),
    );
    setPools((cur) => cur.filter((x) => x.id !== id));
    pushLog(
      "pool",
      id,
      "DELETE",
      `Pool ${p.name} deleted — ${moved} grant${moved === 1 ? "" : "s"} transferred, ${removed} deleted`,
    );
  };

  const logsFor = (objectId: string) =>
    logs.filter((l) => l.objectId === objectId);
  // A pool's audit = its own entries + every grant entry attributed to it
  // (drawn-from pool at write time) — granting/vesting events roll up here.
  const logsForPool = (poolId: string) =>
    logs.filter(
      (l) =>
        l.objectId === poolId ||
        (l.objectType === "grant" && l.poolId === poolId),
    );
  // A stakeholder's audit = their own entries + every grant entry ATTRIBUTED
  // to them (owner at write time — reassigned grants' earlier history stays
  // on the previous owner's timeline).
  const logsForStakeholder = (stakeholderId: string) =>
    logs.filter(
      (l) =>
        l.objectId === stakeholderId ||
        (l.objectType === "grant" && l.stakeholderId === stakeholderId),
    );
  const resetSandbox = () => {
    setPools([makeGeneralPool()]); // the General Pool is inherent — reborn
    setCompanies([]);
    setStakeholders([]);
    setGrants([]);
    setLogs([]);
    setSeqs({ stakeholder: 0, grant: 0 });
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
        terminateAllFor,
        pauseAllFor,
        reinstatePreflight,
        reinstateAllFor,
        unPauseAllFor,
        grantsForPool,
        poolsForCompany,
        grantedFor,
        logsFor,
        logsForStakeholder,
        logsForPool,
        deleteGrant,
        deleteStakeholder,
        deleteCompany,
        deletePool,
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
