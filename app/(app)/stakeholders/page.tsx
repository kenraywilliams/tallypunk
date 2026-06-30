"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useSandbox, type Company, type Stakeholder } from "../SandboxProvider";
import CompanyDialog from "../CompanyDialog";
import EditIcon from "../EditIcon";
import CreateStakeholderModal from "./CreateStakeholderModal";
import { idLabel, typeLabel } from "./util";
import {
  ALL_COLS,
  sortStakeholders,
  useStakeholderView,
  type ColKey,
} from "./view";

export default function StakeholdersPage() {
  const { stakeholders, companies, hydrated, flashId } = useSandbox();
  const { visible, sortKey, sortDir, toggleCol, moveCol, cycleSort } =
    useStakeholderView();
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [companyDialog, setCompanyDialog] = useState<Company | null>(null);
  const [colsOpen, setColsOpen] = useState(false);
  const colsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (colsRef.current && !colsRef.current.contains(e.target as Node))
        setColsOpen(false);
    };
    document.addEventListener("click", onDoc);
    return () => document.removeEventListener("click", onDoc);
  }, []);

  const rows = sortStakeholders(stakeholders, companies, sortKey, sortDir);
  const hidden = ALL_COLS.filter((c) => !visible.includes(c.key));

  const cell = (s: Stakeholder, key: ColKey): ReactNode => {
    switch (key) {
      case "id":
        return <span className="muted-cell">{idLabel(s.seq)}</span>;
      case "first":
        return s.firstName;
      case "last":
        return s.lastName || <span className="muted-cell">—</span>;
      case "type":
        return typeLabel(s.type);
      case "company": {
        const co = s.companyId
          ? (companies.find((c) => c.id === s.companyId) ?? null)
          : null;
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
      case "email":
        return s.email || <span className="muted-cell">—</span>;
      case "granted":
        return <span className="muted-cell">—</span>;
      case "vested":
        return <span className="muted-cell">—</span>;
      case "created":
        return new Date(s.createdAt).toLocaleDateString();
      default:
        return null;
    }
  };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Stakeholders</h1>
          <p className="page-sub">People who hold or will hold equity</p>
        </div>
        {hydrated && stakeholders.length > 0 && (
          <div className="right">
            <div className="colwrap" ref={colsRef}>
              <button
                className="btn btn-ghost btn-sm"
                onClick={(e) => {
                  e.stopPropagation();
                  setColsOpen((o) => !o);
                }}
              >
                Columns ▾
              </button>
              {colsOpen && (
                <div className="colmenu">
                  <div className="colmenu-h">Shown — drag order with ↑ ↓</div>
                  {visible.map((key, i) => {
                    const col = ALL_COLS.find((c) => c.key === key);
                    if (!col) return null;
                    return (
                      <div key={key} className="colmenu-item">
                        <input
                          type="checkbox"
                          checked
                          onChange={() => toggleCol(key)}
                        />
                        <span className="colmenu-lbl">{col.label}</span>
                        <button
                          className="colmove"
                          aria-label="Move up"
                          disabled={i === 0}
                          onClick={() => moveCol(key, "up")}
                        >
                          ↑
                        </button>
                        <button
                          className="colmove"
                          aria-label="Move down"
                          disabled={i === visible.length - 1}
                          onClick={() => moveCol(key, "down")}
                        >
                          ↓
                        </button>
                      </div>
                    );
                  })}
                  {hidden.length > 0 && (
                    <>
                      <div className="colmenu-sep" />
                      <div className="colmenu-h">Hidden</div>
                      {hidden.map((col) => (
                        <label key={col.key} className="colmenu-item">
                          <input
                            type="checkbox"
                            checked={false}
                            onChange={() => toggleCol(col.key)}
                          />
                          <span className="colmenu-lbl">{col.label}</span>
                        </label>
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>
            <button
              className="btn btn-pri btn-sm"
              onClick={() => setCreating(true)}
            >
              + Add stakeholder
            </button>
          </div>
        )}
      </div>

      {!hydrated ? null : stakeholders.length === 0 ? (
        <div className="empty">
          <button
            className="plus"
            aria-label="Add stakeholder"
            onClick={() => setCreating(true)}
          >
            +
          </button>
          <div className="empty-title">No stakeholders yet</div>
          <button className="btn btn-pri" onClick={() => setCreating(true)}>
            Add stakeholder
          </button>
        </div>
      ) : (
        <table className="ptable">
          <thead>
            <tr>
              <th className="tcol-act" />
              {visible.map((key) => {
                const col = ALL_COLS.find((c) => c.key === key);
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
            {rows.map((s) => (
              <tr
                key={s.id}
                className={s.id === flashId ? "flash" : undefined}
                onClick={() => router.push(`/stakeholders/${s.id}`)}
              >
                <td className="tcol-act">
                  <button
                    className="rowbtn"
                    aria-label="Edit stakeholder"
                    title="Edit"
                    onClick={(e) => {
                      e.stopPropagation();
                      router.push(`/stakeholders/${s.id}`);
                    }}
                  >
                    <EditIcon />
                  </button>
                </td>
                {visible.map((key) => (
                  <td
                    key={key}
                    className={
                      key === "first" || key === "last" ? "cell-name" : undefined
                    }
                  >
                    {cell(s, key)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {creating && (
        <CreateStakeholderModal
          onClose={() => setCreating(false)}
          onCreated={() => setCreating(false)}
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
