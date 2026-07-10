"use client";

import { useState, type ReactNode } from "react";
import { useSandbox, type Company, type Pool } from "../SandboxProvider";
import CompanyDialog from "../CompanyDialog";
import EditIcon from "../EditIcon";
import PoolDialog from "../pools/PoolDialog";
import {
  ColumnsMenu,
  sortRows,
  useHeaderDrag,
  useListView,
  type ColDef,
} from "../listview";

type CompanyCol = "name" | "pools" | "created";
const COLS: ColDef<CompanyCol>[] = [
  { key: "name", label: "Name" },
  { key: "pools", label: "Pools" },
  { key: "created", label: "Created" },
];
const DEFAULT: CompanyCol[] = ["name", "pools"];

export default function CompaniesPage() {
  const { companies, hydrated, poolsForCompany, flashId } = useSandbox();
  const { visible, sortKey, sortDir, toggleCol, moveCol, reorderCol, cycleSort } =
    useListView<CompanyCol>("tallypunk-companies-view", COLS, DEFAULT, "name");
  // drag the REAL column headers to reorder (arrows in the menu still work)
  const { thProps } = useHeaderDrag(visible, reorderCol);
  const [dialog, setDialog] = useState<{
    company?: Company;
    edit?: boolean;
  } | null>(null);
  const [poolDialog, setPoolDialog] = useState<Pool | null>(null);

  const value = (c: Company, key: CompanyCol): string | number => {
    switch (key) {
      case "name":
        return c.name.toLowerCase();
      case "pools":
        return poolsForCompany(c.id).length;
      case "created":
        return c.createdAt;
      default:
        return "";
    }
  };

  const cell = (c: Company, key: CompanyCol): ReactNode => {
    switch (key) {
      case "name":
        return (
          <span className="ellip" title={c.name}>
            {c.name}
          </span>
        );
      case "pools": {
        const linked = poolsForCompany(c.id);
        return linked.length === 0 ? (
          <span className="muted-cell">—</span>
        ) : (
          <span className="linkwrap-l">
            {linked.map((p) => (
              <button
                key={p.id}
                className="linkbtn"
                onClick={(e) => {
                  e.stopPropagation();
                  setPoolDialog(p);
                }}
              >
                {p.name}
              </button>
            ))}
          </span>
        );
      }
      case "created":
        return new Date(c.createdAt).toLocaleDateString();
      default:
        return null;
    }
  };

  const rows = sortRows(companies, sortKey, sortDir, value);

  return (
    <div className="listpage">
      <div className="page-head">
        <div>
          <h1 className="page-title">Companies</h1>
          <p className="page-sub">Companies you manage</p>
        </div>
        {hydrated && companies.length > 0 && (
          <div className="right">
            <ColumnsMenu
              visible={visible}
              allCols={COLS}
              toggleCol={toggleCol}
              moveCol={moveCol}
            />
            <button className="btn btn-pri btn-sm" onClick={() => setDialog({})}>
              + New company
            </button>
          </div>
        )}
      </div>

      {!hydrated ? null : companies.length === 0 ? (
        <div className="empty">
          <button
            className="plus"
            aria-label="New company"
            onClick={() => setDialog({})}
          >
            +
          </button>
          <div className="empty-title">No companies yet</div>
          <button className="btn btn-pri" onClick={() => setDialog({})}>
            New company
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
              {rows.map((c) => (
                <tr
                  key={c.id}
                  className={c.id === flashId ? "flash" : undefined}
                  onClick={() => setDialog({ company: c })}
                >
                  <td className="tcol-act">
                    <button
                      className="rowbtn"
                      aria-label="Edit company"
                      title="Edit"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDialog({ company: c, edit: true });
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
                      {cell(c, key)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {dialog && (
        <CompanyDialog
          company={dialog.company}
          startEdit={dialog.edit}
          onClose={() => setDialog(null)}
        />
      )}
      {poolDialog && (
        <PoolDialog pool={poolDialog} onClose={() => setPoolDialog(null)} />
      )}
    </div>
  );
}
