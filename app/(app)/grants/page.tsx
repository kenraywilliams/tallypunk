"use client";

import { useState, type ReactNode } from "react";
import { useSandbox, type Grant } from "../SandboxProvider";
import EditIcon from "../EditIcon";
import { fullName } from "../stakeholders/util";
import { ColumnsMenu, sortRows, useListView, type ColDef } from "../listview";
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
  | "pool"
  | "quantity"
  | "date"
  | "vested"
  | "fully"
  | "status";
const COLS: ColDef<GrantCol>[] = [
  { key: "id", label: "ID" },
  { key: "stakeholder", label: "Stakeholder" },
  { key: "pool", label: "Pool" },
  { key: "quantity", label: "Quantity" },
  { key: "date", label: "Grant date" },
  { key: "vested", label: "Vested" },
  { key: "fully", label: "Fully vested" },
  { key: "status", label: "Status" },
];
const DEFAULT: GrantCol[] = [
  "id",
  "stakeholder",
  "pool",
  "quantity",
  "date",
  "vested",
  "status",
];

export default function GrantsPage() {
  const { grants, stakeholders, pools, hydrated, flashId } = useSandbox();
  const { visible, sortKey, sortDir, toggleCol, moveCol, cycleSort } =
    useListView<GrantCol>("tallypunk-grants-view", COLS, DEFAULT, "id");
  const [dialog, setDialog] = useState<{
    grant?: Grant;
    edit?: boolean;
  } | null>(null);

  const today = todayISO();
  const shName = (id: string) => {
    const s = stakeholders.find((x) => x.id === id);
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

  const rows = sortRows(grants, sortKey, sortDir, value);

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
        <div className="tablewrap">
          <table className="ptable">
            <thead>
              <tr>
                <th className="tcol-act" />
                {visible.map((key) => {
                  const col = COLS.find((c) => c.key === key);
                  if (!col) return null;
                  const on = sortKey === key;
                  return (
                    <th key={key}>
                      <button
                        className={"th-sort" + (on ? " on" : "")}
                        onClick={() => cycleSort(key)}
                      >
                        {col.label}
                        <span className="th-arrow">
                          {on ? (sortDir === "asc" ? "▲" : "▼") : ""}
                        </span>
                      </button>
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
            </tbody>
          </table>
        </div>
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
