"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useSandbox, type Grant } from "../SandboxProvider";
import EditIcon from "../EditIcon";
import { fullName } from "../stakeholders/util";
import {
  ColumnsMenu,
  FilterFunnel,
  sortRows,
  useColumnFilters,
  useHeaderDrag,
  useListView,
  type ColDef,
} from "../listview";
import GrantDialog, { gid, grantStatus, StatusChip } from "./GrantDialog";
import {
  fullyVestedDate,
  reservedUnits,
  todayISO,
  vestedFraction,
  vestedUnits,
} from "./vesting";

type GrantCol =
  | "id"
  | "stakeholder"
  | "first"
  | "last"
  | "pool"
  | "quantity"
  | "date"
  | "vested"
  | "vestedNum"
  | "vestedPct"
  | "fully"
  | "status";
const COLS: ColDef<GrantCol>[] = [
  { key: "id", label: "ID" },
  { key: "first", label: "First name(s)" },
  { key: "last", label: "Last name(s)" },
  { key: "stakeholder", label: "Stakeholder (full name)" }, // combined — hidden by default
  { key: "pool", label: "Pool" },
  { key: "quantity", label: "Quantity" },
  { key: "date", label: "Grant date" },
  { key: "vestedPct", label: "Vested %" }, // the default vested view
  { key: "vestedNum", label: "Vested #" }, // units only — optional
  { key: "vested", label: "Vested" }, // combined % · # — optional
  { key: "fully", label: "Fully vested" },
  { key: "status", label: "Status" },
];
// first/last mirror the Stakeholders list so name sorting works the same way
const DEFAULT: GrantCol[] = [
  "id",
  "first",
  "last",
  "pool",
  "quantity",
  "status",
  "date",
  "vestedPct",
];
// saved views predate first/last, status placement + the vested split → adjust
const migrateCols = (v: GrantCol[]): GrantCol[] => {
  const out = [...v];
  const si = out.indexOf("stakeholder");
  if (si >= 0 && !out.includes("first")) out.splice(si, 1, "first", "last");
  if (!out.includes("status")) {
    const qi = out.indexOf("quantity");
    out.splice(qi >= 0 ? qi + 1 : out.length, 0, "status");
  }
  // the combined Vested column moved off the defaults — saved views that had
  // it swap to Vested % (re-add Vested / Vested # via Columns if wanted)
  const vi = out.indexOf("vested");
  if (vi >= 0 && !out.includes("vestedPct")) out.splice(vi, 1, "vestedPct");
  return out;
};

const STATUS_ORDER = ["Vesting", "Paused", "Fully vested", "Terminated"];
const statusLabel = (g: Grant) => {
  const st = grantStatus(g);
  return st === "vesting"
    ? "Vesting"
    : st === "paused"
      ? "Paused"
      : st === "fully"
        ? "Fully vested"
        : "Terminated";
};

// columns that carry a funnel filter (GBL-05 filters)
type FilterCol = "stakeholder" | "pool" | "status";
const FILTER_COLS: FilterCol[] = ["stakeholder", "pool", "status"];

export default function GrantsPage() {
  const {
    grants,
    stakeholders,
    pools,
    grantedFor,
    updateGrant,
    updatePool,
    notify,
    hydrated,
    flashId,
  } = useSandbox();
  const { visible, sortKey, sortDir, toggleCol, moveCol, reorderCol, cycleSort } =
    useListView<GrantCol>(
      "tallypunk-grants-view",
      COLS,
      DEFAULT,
      "id",
      migrateCols,
    );
  const { filters, setFilter, clearAll, active, passes } =
    useColumnFilters<FilterCol>();
  // drag the REAL column headers to reorder (arrows in the menu still work)
  const { thProps } = useHeaderDrag(visible, reorderCol);
  const [dialog, setDialog] = useState<{
    grant?: Grant;
    edit?: boolean;
  } | null>(null);

  const today = todayISO();
  const sFor = (id: string) => stakeholders.find((x) => x.id === id);
  const shName = (id: string) => {
    const s = sFor(id);
    return s ? fullName(s) || "—" : "—";
  };
  const poolName = (id: string | null) =>
    id ? (pools.find((p) => p.id === id)?.name ?? "—") : "None";

  const value = (g: Grant, key: GrantCol): string | number => {
    switch (key) {
      case "id":
        return g.seq;
      case "stakeholder":
        return shName(g.stakeholderId).toLowerCase();
      case "first":
        return (sFor(g.stakeholderId)?.firstName ?? "").toLowerCase();
      case "last":
        return (sFor(g.stakeholderId)?.lastName ?? "").toLowerCase();
      case "pool":
        return poolName(g.poolId).toLowerCase();
      case "quantity":
        return g.quantity;
      case "date":
        return g.grantDate;
      case "vested":
      case "vestedPct":
        return vestedFraction(g.vesting, g.grantDate, today, g);
      case "vestedNum":
        return vestedUnits(g.quantity, g.vesting, g.grantDate, today, g);
      case "fully":
        return fullyVestedDate(g.vesting, g.grantDate, g) ?? "";
      case "status": {
        const st = grantStatus(g);
        return st === "vesting" ? 0 : st === "paused" ? 1 : st === "fully" ? 2 : 3;
      }
      default:
        return "";
    }
  };

  const cell = (g: Grant, key: GrantCol): ReactNode => {
    switch (key) {
      case "id":
        return <span className="muted-cell">{gid(g.seq)}</span>;
      case "stakeholder":
        return shName(g.stakeholderId);
      case "first":
        return (
          sFor(g.stakeholderId)?.firstName || (
            <span className="muted-cell">—</span>
          )
        );
      case "last":
        return (
          sFor(g.stakeholderId)?.lastName || (
            <span className="muted-cell">—</span>
          )
        );
      case "pool":
        return g.poolId ? (
          poolName(g.poolId)
        ) : (
          <span className="muted-cell">None</span>
        );
      case "quantity":
        return g.quantity.toLocaleString();
      case "date":
        return g.grantDate;
      case "vested": {
        const pct = Math.round(
          vestedFraction(g.vesting, g.grantDate, today, g) * 100,
        );
        const u = vestedUnits(g.quantity, g.vesting, g.grantDate, today, g);
        return `${pct}% · ${u.toLocaleString()}`;
      }
      case "vestedPct":
        return `${Math.round(vestedFraction(g.vesting, g.grantDate, today, g) * 100)}%`;
      case "vestedNum":
        return vestedUnits(
          g.quantity,
          g.vesting,
          g.grantDate,
          today,
          g,
        ).toLocaleString();
      case "fully":
        return g.terminationDate ? (
          <span className="muted-cell">—</span>
        ) : (
          (fullyVestedDate(g.vesting, g.grantDate, g) ?? (
            <span className="muted-cell">—</span>
          ))
        );
      case "status":
        return <StatusChip status={grantStatus(g)} />;
      default:
        return null;
    }
  };

  // ---- funnel filters ----
  const filterValue = (g: Grant, col: FilterCol): string =>
    col === "stakeholder"
      ? shName(g.stakeholderId)
      : col === "pool"
        ? poolName(g.poolId)
        : statusLabel(g);
  // distinct options come from ALL rows so the menu stays stable while filtered
  const filterOptions = (col: FilterCol): string[] => {
    if (col === "status") {
      const present = new Set<string>(grants.map((g) => statusLabel(g)));
      return STATUS_ORDER.filter((v) => present.has(v));
    }
    return [...new Set(grants.map((g) => filterValue(g, col)))].sort((a, b) =>
      a.toLowerCase().localeCompare(b.toLowerCase()),
    );
  };
  const filtered = grants.filter((g) =>
    FILTER_COLS.every((c) => passes(c, filterValue(g, c))),
  );

  const rows = sortRows(filtered, sortKey, sortDir, value);

  // ---- bulk actions v1: terminate / pause (GBL-10, grant-level events) ----
  const [bulkMode, setBulkMode] = useState(false);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [bulkPanel, setBulkPanel] = useState<
    null | "term" | "pause" | "summary"
  >(null);
  const [bDate, setBDate] = useState(todayISO());
  const [bPs, setBPs] = useState(todayISO());
  const [bPe, setBPe] = useState("");
  const [bSummary, setBSummary] = useState<{ title: string; ids: string[] }>({
    title: "",
    ids: [],
  });
  // RULE: selection is pruned to what the filters still show — invisible
  // grants must never be actioned.
  const filteredIdsKey = filtered
    .map((g) => g.id)
    .sort()
    .join("|");
  useEffect(() => {
    setSel((cur) => {
      const visibleIds = new Set(filtered.map((g) => g.id));
      const next = new Set([...cur].filter((id) => visibleIds.has(id)));
      return next.size === cur.size ? cur : next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredIdsKey]);
  const allSelected = rows.length > 0 && rows.every((g) => sel.has(g.id));
  const toggleSel = (id: string) =>
    setSel((cur) => {
      const n = new Set(cur);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const selGrants = rows.filter((g) => sel.has(g.id));
  const exitBulk = () => {
    setBulkMode(false);
    setSel(new Set());
    setBulkPanel(null);
  };
  // after a batch, selection clears (nothing more to do with it) and the
  // acted rows FLASH — same highlight as everywhere else
  const [bFlash, setBFlash] = useState<Set<string>>(new Set());
  const bFlashTimer = useRef<number | undefined>(undefined);
  const flashMany = (ids: string[]) => {
    setBFlash(new Set(ids));
    if (bFlashTimer.current) window.clearTimeout(bFlashTimer.current);
    bFlashTimer.current = window.setTimeout(() => setBFlash(new Set()), 4200);
  };

  // Grant-level bulk UPDATES existing events (same authority as the single-
  // grant flows). Terminations moving LATER re-reserve pool units, so the
  // panel runs a cumulative per-pool pre-flight — the batch's own freed units
  // (fresh/earlier terminations) legitimately offset the demand.
  const curRes = (g: Grant) =>
    reservedUnits(g.quantity, g.vesting, g.grantDate, g);
  const newResAt = (g: Grant, date: string) =>
    reservedUnits(g.quantity, g.vesting, g.grantDate, {
      terminationDate: date,
      pauseStart: g.pauseStart,
      pauseEnd: g.pauseEnd,
    });
  // pools that can't absorb the batch's NET reservation change → their
  // later-moves are skipped; returns poolId → shortfall
  const termBlockedPools = (): Map<string, number> => {
    const deltaByPool = new Map<string, number>();
    selGrants.forEach((g) => {
      if (!g.poolId) return;
      const p = pools.find((x) => x.id === g.poolId);
      if (!p || p.quantity == null) return;
      deltaByPool.set(
        g.poolId,
        (deltaByPool.get(g.poolId) ?? 0) + (newResAt(g, bDate) - curRes(g)),
      );
    });
    const blocked = new Map<string, number>();
    deltaByPool.forEach((delta, pid) => {
      const p = pools.find((x) => x.id === pid)!;
      const remaining = p.quantity! - grantedFor(pid);
      if (delta > remaining) blocked.set(pid, delta - remaining);
    });
    return blocked;
  };

  const doBulkTerm = () => {
    const blocked = termBlockedPools();
    let fresh = 0;
    let amended = 0;
    let skippedShort = 0;
    const acted: string[] = [];
    selGrants.forEach((g) => {
      if (!g.terminationDate) {
        updateGrant(g.id, {
          terminationDate: bDate,
          terminationInherited: false,
        });
        fresh++;
        acted.push(g.id);
      } else if (bDate === g.terminationDate) {
        // unchanged
      } else if (bDate < g.terminationDate) {
        updateGrant(g.id, { terminationDate: bDate }); // earlier = frees units
        amended++;
        acted.push(g.id);
      } else if (g.poolId && blocked.has(g.poolId)) {
        skippedShort++; // pool can't re-supply the later move
      } else {
        updateGrant(g.id, { terminationDate: bDate }); // later, pool-checked
        amended++;
        acted.push(g.id);
      }
    });
    notify(
      `Terminated ${fresh}${amended ? `, moved ${amended} date${amended === 1 ? "" : "s"}` : ""}${skippedShort ? ` — ${skippedShort} skipped (pool short on units for the later move)` : ""}`,
    );
    setBSummary({
      title: `Terminated vesting from ${bDate}`,
      ids: selGrants.map((g) => g.id),
    });
    setSel(new Set());
    flashMany(acted);
    setBulkPanel("summary");
  };
  const bulkPauseInvalid = !bPs || (!!bPe && bPe < bPs);
  const doBulkPause = () => {
    if (bulkPauseInvalid) return;
    let fresh = 0;
    let updated = 0;
    let skipped = 0;
    const acted: string[] = [];
    selGrants.forEach((g) => {
      if (g.terminationDate) {
        skipped++; // pausing a terminated grant could change forfeiture
        return;
      }
      if (g.pauseStart) updated++;
      else fresh++;
      acted.push(g.id);
      updateGrant(g.id, {
        pauseStart: bPs,
        pauseEnd: bPe || null,
        pauseInherited: false,
      });
    });
    notify(
      `Paused ${fresh}${updated ? `, overwrote ${updated} existing pause${updated === 1 ? "" : "s"}` : ""}${skipped ? ` — ${skipped} skipped (terminated)` : ""}`,
    );
    setBSummary({
      title: `Paused vesting ${bPs} → ${bPe || "open-ended"}`,
      ids: selGrants.map((g) => g.id),
    });
    setSel(new Set());
    flashMany(acted);
    setBulkPanel("summary");
  };
  const glabel = (g: Grant) => `#${gid(g.seq)} · ${shName(g.stakeholderId)}`;

  return (
    <div className="listpage">
      <div className="page-head">
        <div>
          <h1 className="page-title">Grants</h1>
          <p className="page-sub">Equity granted to stakeholders</p>
        </div>
        {hydrated && grants.length > 0 && (
          <div className="right">
            <button
              className={"btn btn-sm " + (bulkMode ? "btn-pri" : "btn-ghost")}
              onClick={() => (bulkMode ? exitBulk() : setBulkMode(true))}
            >
              {bulkMode ? "Done" : "Bulk actions"}
            </button>
            <ColumnsMenu
              visible={visible}
              allCols={COLS}
              toggleCol={toggleCol}
              moveCol={moveCol}
            />
            <button className="btn btn-pri btn-sm" onClick={() => setDialog({})}>
              + Create grant
            </button>
          </div>
        )}
      </div>

      {!hydrated ? null : grants.length === 0 ? (
        <div className="empty">
          <button
            className="plus"
            aria-label="Create grant"
            onClick={() => setDialog({})}
          >
            +
          </button>
          <div className="empty-title">No grants yet</div>
          <button className="btn btn-pri" onClick={() => setDialog({})}>
            Create grant
          </button>
        </div>
      ) : (
        <>
          {active && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                fontSize: 13,
                color: "var(--muted)",
                margin: "0 0 8px",
              }}
            >
              <span>
                Filtered — showing <strong>{rows.length}</strong> of{" "}
                {grants.length}
              </span>
              <button className="linkbtn" onClick={clearAll}>
                Clear filters
              </button>
            </div>
          )}

          {bulkMode && bulkPanel === null && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                margin: "0 0 8px",
                fontSize: 13.5,
                minHeight: 32, // same height empty or full — no layout jump
              }}
            >
              {sel.size === 0 ? (
                <span style={{ color: "var(--muted)" }}>
                  Select the grants to act on — tick rows or the header box
                  (filtered rows only)
                </span>
              ) : (
                <>
                  <strong>{sel.size} selected</strong>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => {
                      setBDate(todayISO());
                      setBulkPanel("term");
                    }}
                  >
                    Terminate…
                  </button>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => {
                      setBPs(todayISO());
                      setBPe("");
                      setBulkPanel("pause");
                    }}
                  >
                    Pause…
                  </button>
                  <button className="linkbtn" onClick={() => setSel(new Set())}>
                    Clear selection
                  </button>
                </>
              )}
            </div>
          )}

          {bulkPanel === "term" && (
            <div
              style={{
                border: "1px solid var(--line)",
                borderRadius: 10,
                padding: "12px 14px",
                margin: "0 0 10px",
                background: "var(--bg)",
              }}
            >
              <label className="lab">
                Terminate {sel.size} grant{sel.size === 1 ? "" : "s"} from
              </label>
              <input
                className="inp"
                type="date"
                style={{ maxWidth: 220 }}
                value={bDate}
                onChange={(e) => setBDate(e.target.value)}
              />
              {(() => {
                const blocked = termBlockedPools();
                return (
                  <>
                    <div
                      style={{ marginTop: 8, maxHeight: 220, overflowY: "auto" }}
                    >
                      {selGrants.map((g) => {
                        let note: ReactNode;
                        if (g.terminationDate) {
                          // current date shown as FYI — it gets overwritten
                          note =
                            bDate === g.terminationDate ? (
                              `already terminated ${g.terminationDate} — unchanged`
                            ) : g.poolId &&
                              bDate > g.terminationDate &&
                              blocked.has(g.poolId) ? (
                              <span style={{ color: "#b23b3b" }}>
                                skipped — {poolName(g.poolId)} is short for the
                                later move (current: {g.terminationDate})
                              </span>
                            ) : (
                              `current termination ${g.terminationDate} — will be overwritten to ${bDate}${bDate > g.terminationDate ? ` (re-reserves ${(newResAt(g, bDate) - curRes(g)).toLocaleString()} from ${poolName(g.poolId)})` : ""}`
                            );
                        } else {
                          const keep = newResAt(g, bDate);
                          note = (
                            <>
                              keeps {keep.toLocaleString()} · forfeits{" "}
                              {(g.quantity - keep).toLocaleString()}
                              {g.poolId ? ` → ${poolName(g.poolId)}` : ""}
                            </>
                          );
                        }
                        return (
                          <div
                            key={g.id}
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              gap: 10,
                              padding: "5px 0",
                              borderBottom: "1px solid var(--line)",
                              fontSize: 13,
                            }}
                          >
                            <span>{glabel(g)}</span>
                            <span style={{ color: "var(--muted)" }}>{note}</span>
                          </div>
                        );
                      })}
                    </div>
                    {[...blocked.entries()].map(([pid, short]) => {
                      const p = pools.find((x) => x.id === pid);
                      if (!p) return null;
                      return (
                        <div
                          key={pid}
                          style={{
                            background: "#f6e2e0",
                            color: "#b23b3b",
                            borderRadius: 8,
                            padding: "9px 12px",
                            fontSize: 13,
                            fontWeight: 600,
                            marginTop: 10,
                            display: "flex",
                            alignItems: "center",
                            flexWrap: "wrap",
                            gap: 8,
                          }}
                        >
                          <span>
                            {p.name} is {short.toLocaleString()} units short
                            for the later moves.
                          </span>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={() =>
                              updatePool(p.id, {
                                quantity: (p.quantity ?? 0) + short,
                              })
                            }
                          >
                            + Add {short.toLocaleString()}
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={() => updatePool(p.id, { quantity: null })}
                          >
                            Make it Infinity ∞
                          </button>
                        </div>
                      );
                    })}
                  </>
                );
              })()}
              <div className="modal-actions">
                <button
                  className="btn btn-ghost"
                  onClick={() => setBulkPanel(null)}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-pri"
                  disabled={!bDate}
                  onClick={doBulkTerm}
                >
                  Terminate all listed
                </button>
              </div>
            </div>
          )}

          {bulkPanel === "pause" && (
            <div
              style={{
                border: "1px solid var(--line)",
                borderRadius: 10,
                padding: "12px 14px",
                margin: "0 0 10px",
                background: "var(--bg)",
              }}
            >
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <div>
                  <label className="lab">Pause from</label>
                  <input
                    className="inp"
                    type="date"
                    value={bPs}
                    onChange={(e) => setBPs(e.target.value)}
                  />
                </div>
                <div>
                  <label className="lab">Until (optional)</label>
                  <input
                    className="inp"
                    type="date"
                    value={bPe}
                    onChange={(e) => setBPe(e.target.value)}
                  />
                </div>
              </div>
              <div style={{ marginTop: 8, maxHeight: 220, overflowY: "auto" }}>
                {selGrants.map((g) => (
                  <div
                    key={g.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 10,
                      padding: "5px 0",
                      borderBottom: "1px solid var(--line)",
                      fontSize: 13,
                    }}
                  >
                    <span>{glabel(g)}</span>
                    <span style={{ color: "var(--muted)" }}>
                      {g.terminationDate
                        ? `skipped — terminated ${g.terminationDate}`
                        : g.pauseStart
                          ? `current pause ${g.pauseStart} → ${g.pauseEnd ?? "open-ended"} — will be overwritten`
                          : "will pause"}
                    </span>
                  </div>
                ))}
              </div>
              <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 8 }}>
                Units stay reserved in their pools.
                {bPe && bPe < bPs && (
                  <strong style={{ color: "#b23b3b" }}>
                    {" "}
                    End date is before the start.
                  </strong>
                )}
              </p>
              <div className="modal-actions">
                <button
                  className="btn btn-ghost"
                  onClick={() => setBulkPanel(null)}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-pri"
                  disabled={bulkPauseInvalid}
                  onClick={doBulkPause}
                >
                  Pause all listed
                </button>
              </div>
            </div>
          )}

          {bulkPanel === "summary" && (
            <div
              style={{
                border: "1px solid var(--line)",
                borderRadius: 10,
                padding: "12px 14px",
                margin: "0 0 10px",
                background: "var(--bg)",
              }}
            >
              <div style={{ fontWeight: 700, fontSize: 14 }}>
                Done — {bSummary.title}
              </div>
              <p
                style={{
                  fontSize: 12,
                  color: "var(--muted)",
                  margin: "6px 0 0",
                }}
              >
                Live list — click a grant to open and adjust it.
              </p>
              <div style={{ marginTop: 6, maxHeight: 220, overflowY: "auto" }}>
                {bSummary.ids.map((gidStr) => {
                  const g = grants.find((x) => x.id === gidStr);
                  if (!g) return null;
                  return (
                    <div
                      key={gidStr}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "5px 0",
                        borderBottom: "1px solid var(--line)",
                        fontSize: 13,
                      }}
                    >
                      <button
                        className="linkbtn"
                        onClick={() => setDialog({ grant: g })}
                      >
                        {glabel(g)}
                      </button>
                      <StatusChip status={grantStatus(g)} />
                      <span style={{ color: "var(--muted)" }}>
                        {g.terminationDate
                          ? `terminated ${g.terminationDate}`
                          : g.pauseStart
                            ? `paused ${g.pauseStart} → ${g.pauseEnd ?? "open-ended"}`
                            : "vesting"}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className="modal-actions">
                <button className="btn btn-pri" onClick={exitBulk}>
                  Close
                </button>
              </div>
            </div>
          )}

          <div className="tablewrap">
            <table className="ptable">
              <thead>
                <tr>
                  {bulkMode && (
                    <th style={{ width: 34 }}>
                      <input
                        type="checkbox"
                        checked={allSelected}
                        ref={(el) => {
                          if (el)
                            el.indeterminate = sel.size > 0 && !allSelected;
                        }}
                        onChange={() =>
                          setSel(
                            allSelected
                              ? new Set()
                              : new Set(rows.map((g) => g.id)), // filtered rows ONLY
                          )
                        }
                      />
                    </th>
                  )}
                  <th className="tcol-act" />
                  {visible.map((key) => {
                    const col = COLS.find((c) => c.key === key);
                    if (!col) return null;
                    const on = sortKey === key;
                    // first + full-name columns both drive the PERSON filter
                    const fc: FilterCol | null =
                      key === "first" || key === "stakeholder"
                        ? "stakeholder"
                        : key === "pool" || key === "status"
                          ? key
                          : null;
                    return (
                      <th key={key} {...thProps(key)}>
                        {/* funnel BEFORE the name, one non-wrapping row —
                            wrapping changed header height and broke the
                            sticky-header borders */}
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 3,
                            whiteSpace: "nowrap",
                          }}
                        >
                          {fc && (
                            <FilterFunnel
                              values={filterOptions(fc)}
                              selected={filters[fc]}
                              onChange={(sel) => setFilter(fc, sel)}
                            />
                          )}
                          <button
                            className={"th-sort" + (on ? " on" : "")}
                            onClick={() => cycleSort(key)}
                          >
                            {col.label}
                            <span className="th-arrow">
                              {on ? (sortDir === "asc" ? "▲" : "▼") : ""}
                            </span>
                          </button>
                        </span>
                      </th>
                    );
                  })}
                </tr>
              </thead>
            <tbody>
                {rows.map((g) => (
                  <tr
                    key={g.id}
                    className={
                      g.id === flashId || bFlash.has(g.id) ? "flash" : undefined
                    }
                    onClick={() =>
                      bulkMode ? toggleSel(g.id) : setDialog({ grant: g })
                    }
                  >
                    {bulkMode && (
                      <td onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={sel.has(g.id)}
                          onChange={() => toggleSel(g.id)}
                        />
                      </td>
                    )}
                    <td className="tcol-act">
                      <button
                        className="rowbtn"
                        aria-label="Edit grant"
                        title="Edit"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDialog({ grant: g, edit: true });
                        }}
                      >
                        <EditIcon />
                      </button>
                    </td>
                    {visible.map((key) => (
                      <td key={key}>{cell(g, key)}</td>
                    ))}
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td
                      colSpan={visible.length + (bulkMode ? 2 : 1)}
                      style={{
                        textAlign: "center",
                        color: "var(--muted)",
                        padding: 18,
                        fontSize: 13.5,
                      }}
                    >
                      No grants match the filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {dialog && (
        <GrantDialog
          grant={dialog.grant}
          startEdit={dialog.edit}
          onClose={() => setDialog(null)}
        />
      )}
    </div>
  );
}
