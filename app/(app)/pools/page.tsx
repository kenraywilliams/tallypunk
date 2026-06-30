"use client";

import { useState, type ReactNode } from "react";
import { useSandbox, type Company, type Pool } from "../SandboxProvider";
import CompanyDialog from "../CompanyDialog";
import EditIcon from "../EditIcon";
import PoolDialog from "./PoolDialog";
import { ColumnsMenu, sortRows, useListView, type ColDef } from "../listview";

type PoolCol = "name" | "type" | "company" | "size" | "granted" | "vested";
const COLS: ColDef<PoolCol>[] = [
  { key: "name", label: "Name" },
  { key: "type", label: "Type" },
  { key: "company", label: "Company" },
  { key: "size", label: "Size" },
  { key: "granted", label: "Granted" },
  { key: "vested", label: "Vested" },
];
const DEFAULT: PoolCol[] = [
  "name",
  "type",
  "company",
  "size",
  "granted",
  "vested",
];

export default function PoolsPage() {
  const { pools, companies, hydrated, grantedFor, flashId } = useSandbox();
  const { visible, sortKey, sortDir, toggleCol, moveCol, cycleSort } =
    useListView<PoolCol>("tallypunk-pools-view", COLS, DEFAULT, "name");
  const [dialog, setDialog] = useState<{ pool?: Pool; edit?: boolean } | null>(
    null,
  );
  const [companyDialog, setCompanyDialog] = useState<Company | null>(null);

  const companyOf = (id: string | null) =>
    id ? (companies.find((c) => c.id === id) ?? null) : null;

  const value = (p: Pool, key: PoolCol): string | number => {
    switch (key) {
      case "name":
        return p.name.toLowerCase();
      case "type":
        return p.type === "phantom" ? "phantoms" : "stock options";
      case "company":
        return (companyOf(p.companyId)?.name ?? "").toLowerCase();
      case "size":
        return p.quantity ?? Number.POSITIVE_INFINITY;
      case "granted":
        return grantedFor(p.id);
      case "vested":
        return 0;
      default:
        return "";
    }
  };

  const cell = (p: Pool, key: PoolCol): ReactNode => {
    switch (key) {
      case "name":
        return p.name;
      case "type":
        return p.type === "phantom" ? "Phantoms" : "Stock options";
      case "company": {
        const co = companyOf(p.companyId);
        return co ? (
          <button
            className="linkbtn"
            onClick={(e) => {
              e.stopPropagation();
              setCompanyDialog(co);
            }}
          >
            {co.name}
          </button>
        ) : (
          <span className="muted-cell">—</span>
        );
      }
      case "size":
        return p.quantity == null ? (
          <span className="pill-soft">
            <span className="inf">∞</span> Unlimited
          </span>
        ) : (
          p.quantity.toLocaleString()
        );
      case "granted":
        return grantedFor(p.id).toLocaleString();
      case "vested":
        return <span className="muted-cell">—</span>;
      default:
        return null;
    }
  };

  const rows = sortRows(pools, sortKey, sortDir, value);

  return (
    <div className="listpage">
      <div className="page-head">
        <div>
          <h1 className="page-title">Pools</h1>
          <p className="page-sub">Option pools you grant from</p>
        </div>
        {hydrated && pools.length > 0 && (
          <div className="right">
            <ColumnsMenu
              visible={visible}
              allCols={COLS}
              toggleCol={toggleCol}
              moveCol={moveCol}
            />
            <button className="btn btn-pri btn-sm" onClick={() => setDialog({})}>
              + Create pool
            </button>
          </div>
        )}
      </div>

      {!hydrated ? null : pools.length === 0 ? (
        <div className="empty">
          <button
            className="plus"
            aria-label="Create pool"
            onClick={() => setDialog({})}
          >
            +
          </button>
          <div className="empty-title">No pools yet</div>
          <button className="btn btn-pri" onClick={() => setDialog({})}>
            Create pool
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
              {rows.map((p) => (
                <tr
                  key={p.id}
                  className={p.id === flashId ? "flash" : undefined}
                  onClick={() => setDialog({ pool: p })}
                >
                  <td className="tcol-act">
                    <button
                      className="rowbtn"
                      aria-label="Edit pool"
                      title="Edit"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDialog({ pool: p, edit: true });
                      }}
                    >
                      <EditIcon />
                    </button>
                  </td>
                  {visible.map((key) => (
                    <td
                      key={key}
                      className={key === "name" ? "cell-name" : undefined}
                    >
                      {cell(p, key)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {dialog && (
        <PoolDialog
          pool={dialog.pool}
          startEdit={dialog.edit}
          onClose={() => setDialog(null)}
        />
      )}
      {companyDialog && (
        <CompanyDialog
          company={companyDialog}
          onClose={() => setCompanyDialog(null)}
        />
      )}
    </div>
  );
}
