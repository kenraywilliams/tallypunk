"use client";

import { useState, type ReactNode } from "react";
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
  { key: "vested", label: "Vested" },
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
  "vested",
];
// saved views predate first/last + status placement → adjust once on load
const migrateCols = (v: GrantCol[]): GrantCol[] => {
  const out = [...v];
  const si = out.indexOf("stakeholder");
  if (si >= 0 && !out.includes("first")) out.splice(si, 1, "first", "last");
  if (!out.includes("status")) {
    const qi = out.indexOf("quantity");
    out.splice(qi >= 0 ? qi + 1 : out.length, 0, "status");
  }
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
  const { grants, stakeholders, pools, hydrated, flashId } = useSandbox();
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
        return vestedFraction(g.vesting, g.grantDate, today, g);
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

  return (
    <div className="listpage">
      <div className="page-head">
        <div>
          <h1 className="page-title">Grants</h1>
          <p className="page-sub">Equity granted to stakeholders</p>
        </div>
        {hydrated && grants.length > 0 && (
          <div className="right">
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
          <div className="tablewrap">
            <table className="ptable">
              <thead>
                <tr>
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
                    className={g.id === flashId ? "flash" : undefined}
                    onClick={() => setDialog({ grant: g })}
                  >
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
                      colSpan={visible.length + 1}
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
