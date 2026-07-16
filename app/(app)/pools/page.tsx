"use client";

import { useState, type ReactNode } from "react";
import { useSandbox, type Company, type Pool } from "../SandboxProvider";
import CompanyDialog from "../CompanyDialog";
import EditIcon from "../EditIcon";
import PoolDialog from "./PoolDialog";
import {
  ColumnsMenu,
  sortRows,
  useHeaderDrag,
  useListView,
  type ColDef,
} from "../listview";

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
  const { visible, sortKey, sortDir, toggleCol, moveCol, reorderCol, cycleSort } =
    useListView<PoolCol>("tallypunk-pools-view", COLS, DEFAULT, "name");
  // drag the REAL column headers to reorder (arrows in the menu still work)
  const { thProps } = useHeaderDrag(visible, reorderCol);
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

  // The General Pool is an inherent structure, not a managed pool — no row
  // in the list (nothing to edit/size/delete). Its holdings + audit stay
  // reachable via the one-liner under the table. Grants-list filters still
  // list it as a pool value, so filter-then-bulk flows are unaffected.
  const managed = pools.filter((p) => !p.isGeneral);
  const general = pools.find((p) => p.isGeneral) ?? null;
  const rows = sortRows(managed, sortKey, sortDir, value);

  return (
    <div className="listpage">
      <div className="page-head">
        <div>
          <h1 className="page-title">Pools</h1>
          <p className="page-sub">Option pools to grant from</p>
        </div>
        {hydrated && managed.length > 0 && (
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

      {!hydrated ? null : managed.length === 0 ? (
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
                    <th key={key} {...thProps(key)}>
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

      {hydrated && general && (
        <p
          style={{
            fontSize: 12.5,
            color: "var(--muted)",
            margin: "10px 2px 0",
          }}
        >
          The <strong>General Pool</strong> (built-in catch-all, ∞) holds{" "}
          {grantedFor(general.id).toLocaleString()} granted units —{" "}
          <button
            className="linkbtn"
            onClick={() => setDialog({ pool: general })}
          >
            open
          </button>
        </p>
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
