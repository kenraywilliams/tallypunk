"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useSandbox, type Company, type Stakeholder } from "../SandboxProvider";
import CompanyDialog from "../CompanyDialog";
import EditIcon from "../EditIcon";
import CreateStakeholderModal from "./CreateStakeholderModal";
import { idLabel, stakeholderStatus, typeLabel } from "./util";
import { StatusChip } from "../grants/GrantDialog";
import {
  FilterFunnel,
  useColumnFilters,
  useHeaderDrag,
  useRowFlip,
} from "../listview";
import { todayISO, vestedUnits } from "../grants/vesting";

const STATUS_ORDER = ["Vesting", "Paused", "Fully vested", "Terminated", "—"];
// columns that carry a funnel filter (GBL-05 filters)
type FilterCol = "type" | "company" | "status";
const FILTER_COLS: FilterCol[] = ["type", "company", "status"];
import {
  ALL_COLS,
  sortStakeholders,
  useStakeholderView,
  type ColKey,
  type StakeholderMetrics,
} from "./view";

export default function StakeholdersPage() {
  const {
    stakeholders,
    companies,
    grantsForStakeholder,
    terminateAllFor,
    pauseAllFor,
    notify,
    hydrated,
    flashId,
  } = useSandbox();
  const { visible, sortKey, sortDir, toggleCol, moveCol, reorderCol, cycleSort } =
    useStakeholderView();
  // drag the REAL column headers to reorder (arrows in the menu still work)
  const { thProps } = useHeaderDrag(visible, reorderCol);
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [companyDialog, setCompanyDialog] = useState<Company | null>(null);
  const [colsOpen, setColsOpen] = useState(false);
  const colsRef = useRef<HTMLDivElement>(null);
  // reticking a hidden column returns it to its remembered slot — flash the
  // row so the eye lands on WHERE it went
  const [colFlash, setColFlash] = useState<ColKey | null>(null);
  const colFlashTimer = useRef<number | undefined>(undefined);
  const flashCol = (k: ColKey) => {
    setColFlash(k);
    if (colFlashTimer.current) window.clearTimeout(colFlashTimer.current);
    colFlashTimer.current = window.setTimeout(() => setColFlash(null), 1600);
  };
  const { register, snap } = useRowFlip(visible); // rows glide on reorder

  useEffect(() => {
    // mousedown, NOT click: toggling a column moves its row between the
    // Displayed/Hidden lists — by click-time the node is detached and a click
    // listener wrongly reads it as "outside" and closes the menu
    const onDoc = (e: MouseEvent) => {
      if (colsRef.current && !colsRef.current.contains(e.target as Node))
        setColsOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  // Granted = total units across their grants; Vested = % of that vested
  // today (lifecycle-aware — terminate/pause included).
  const today = todayISO();
  const metric = (s: Stakeholder): StakeholderMetrics => {
    const gs = grantsForStakeholder(s.id);
    const granted = gs.reduce((sum, g) => sum + (g.quantity || 0), 0);
    const vested = gs.reduce(
      (sum, g) => sum + vestedUnits(g.quantity, g.vesting, g.grantDate, today, g),
      0,
    );
    const status = stakeholderStatus(gs, today);
    return {
      granted,
      vestedPct: granted > 0 ? vested / granted : 0,
      statusRank:
        status === "vesting"
          ? 0
          : status === "paused"
            ? 1
            : status === "fully"
              ? 2
              : status === "terminated"
                ? 3
                : 4,
    };
  };

  // ---- funnel filters ----
  const { filters, setFilter, clearAll, active, passes } =
    useColumnFilters<FilterCol>();
  const filterValue = (s: Stakeholder, col: FilterCol): string => {
    if (col === "type") return typeLabel(s.type);
    if (col === "company")
      return s.companyId
        ? (companies.find((c) => c.id === s.companyId)?.name ?? "—")
        : "—";
    const st = stakeholderStatus(grantsForStakeholder(s.id), today);
    return st === null
      ? "—"
      : st === "vesting"
        ? "Vesting"
        : st === "paused"
          ? "Paused"
          : st === "fully"
            ? "Fully vested"
            : "Terminated";
  };
  const filterOptions = (col: FilterCol): string[] => {
    const present = new Set(stakeholders.map((s) => filterValue(s, col)));
    if (col === "status") return STATUS_ORDER.filter((v) => present.has(v));
    return [...present].sort((a, b) =>
      a.toLowerCase().localeCompare(b.toLowerCase()),
    );
  };
  const shown = stakeholders.filter((s) =>
    FILTER_COLS.every((c) => passes(c, filterValue(s, c))),
  );

  const rows = sortStakeholders(shown, companies, sortKey, sortDir, metric);
  const hidden = ALL_COLS.filter((c) => !visible.includes(c.key));

  // ---- bulk actions v1: terminate / pause (GBL-10) ----
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
  // RULE: nothing can stay selected that the filters no longer show —
  // otherwise invisible people get actioned. Prune whenever filters change.
  const shownIdsKey = shown
    .map((s) => s.id)
    .sort()
    .join("|");
  useEffect(() => {
    setSel((cur) => {
      const visibleIds = new Set(shown.map((s) => s.id));
      const next = new Set([...cur].filter((id) => visibleIds.has(id)));
      return next.size === cur.size ? cur : next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shownIdsKey]);
  const allSelected = rows.length > 0 && rows.every((s) => sel.has(s.id));
  const toggleSel = (id: string) =>
    setSel((cur) => {
      const n = new Set(cur);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const selPeople = rows.filter((s) => sel.has(s.id));
  const exitBulk = () => {
    setBulkMode(false);
    setSel(new Set());
    setBulkPanel(null);
  };
  // after a batch: selection clears, acted rows flash (the usual highlight)
  const [bFlash, setBFlash] = useState<Set<string>>(new Set());
  const bFlashTimer = useRef<number | undefined>(undefined);
  const flashMany = (ids: string[]) => {
    setBFlash(new Set(ids));
    if (bFlashTimer.current) window.clearTimeout(bFlashTimer.current);
    bFlashTimer.current = window.setTimeout(() => setBFlash(new Set()), 4200);
  };

  const doBulkTerm = () => {
    let acted = 0;
    const actedIds: string[] = [];
    selPeople.forEach((s) => {
      if (!s.terminationDate) {
        terminateAllFor(s.id, bDate);
        acted++;
        actedIds.push(s.id);
      }
    });
    setSel(new Set());
    flashMany(actedIds);
    const skipped = selPeople.length - acted;
    notify(
      `Terminated vesting for ${acted} stakeholder${acted === 1 ? "" : "s"}${skipped ? ` — ${skipped} skipped (already terminated; un-terminate from their Grants tab first)` : ""}`,
    );
    setBSummary({
      title: `Terminated vesting from ${bDate}`,
      ids: selPeople.map((s) => s.id),
    });
    setBulkPanel("summary");
  };
  const bulkPauseInvalid = !bPs || (!!bPe && bPe < bPs);
  const doBulkPause = () => {
    if (bulkPauseInvalid) return;
    let acted = 0;
    const actedIds: string[] = [];
    selPeople.forEach((s) => {
      if (!s.pauseStart) {
        pauseAllFor(s.id, bPs, bPe || null);
        acted++;
        actedIds.push(s.id);
      }
    });
    setSel(new Set());
    flashMany(actedIds);
    const skipped = selPeople.length - acted;
    notify(
      `Paused vesting for ${acted} stakeholder${acted === 1 ? "" : "s"}${skipped ? ` — ${skipped} skipped (already paused; manage it from their Grants tab)` : ""}`,
    );
    setBSummary({
      title: `Paused vesting ${bPs} → ${bPe || "open-ended"}`,
      ids: selPeople.map((s) => s.id),
    });
    setBulkPanel("summary");
  };

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
      case "granted": {
        const m = metric(s);
        return m.granted > 0 ? (
          m.granted.toLocaleString()
        ) : (
          <span className="muted-cell">—</span>
        );
      }
      case "vested": {
        const m = metric(s);
        return m.granted > 0 ? (
          `${Math.round(m.vestedPct * 100)}%`
        ) : (
          <span className="muted-cell">—</span>
        );
      }
      case "status": {
        const status = stakeholderStatus(grantsForStakeholder(s.id), today);
        if (status === null) return <span className="muted-cell">—</span>;
        return <StatusChip status={status} />;
      }
      case "created":
        return new Date(s.createdAt).toLocaleDateString();
      default:
        return null;
    }
  };

  return (
    <div className="stk-page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Stakeholders</h1>
          <p className="page-sub">People who hold or will hold equity</p>
        </div>
        {hydrated && stakeholders.length > 0 && (
          <div className="right">
            <button
              className={"btn btn-sm " + (bulkMode ? "btn-pri" : "btn-ghost")}
              onClick={() => (bulkMode ? exitBulk() : setBulkMode(true))}
            >
              {bulkMode ? "Done" : "Bulk actions"}
            </button>
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
                  <div className="colmenu-h">Displayed</div>
                  {visible.map((key, i) => {
                    const col = ALL_COLS.find((c) => c.key === key);
                    if (!col) return null;
                    return (
                      <div
                        key={key}
                        ref={register(key)}
                        className="colmenu-item"
                        style={{
                          background:
                            colFlash === key ? "var(--accent-soft)" : undefined,
                          borderRadius: 6,
                        }}
                      >
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
                          onClick={() => {
                            snap(); // measure first — then the swap glides
                            moveCol(key, "up");
                          }}
                        >
                          ↑
                        </button>
                        <button
                          className="colmove"
                          aria-label="Move down"
                          disabled={i === visible.length - 1}
                          onClick={() => {
                            snap();
                            moveCol(key, "down");
                          }}
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
                            onChange={() => {
                              toggleCol(col.key);
                              flashCol(col.key); // show where it re-slotted
                            }}
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
                {stakeholders.length}
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
                  Select the stakeholders to act on — tick rows or the header
                  box (filtered rows only)
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
                Terminate ALL grants of {sel.size} stakeholder
                {sel.size === 1 ? "" : "s"} from
              </label>
              <input
                className="inp"
                type="date"
                style={{ maxWidth: 220 }}
                value={bDate}
                onChange={(e) => setBDate(e.target.value)}
              />
              <div style={{ marginTop: 8, maxHeight: 220, overflowY: "auto" }}>
                {selPeople.map((s) => {
                  const gs = grantsForStakeholder(s.id);
                  const affected = gs.filter((g) => !g.terminationDate).length;
                  return (
                    <div
                      key={s.id}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 10,
                        padding: "5px 0",
                        borderBottom: "1px solid var(--line)",
                        fontSize: 13,
                      }}
                    >
                      <span>
                        <strong>
                          {`${s.firstName} ${s.lastName}`.trim() || "—"}
                        </strong>
                      </span>
                      <span style={{ color: "var(--muted)" }}>
                        {s.terminationDate
                          ? `skipped — already terminated ${s.terminationDate}`
                          : `${affected} of ${gs.length} grant${gs.length === 1 ? "" : "s"} will terminate (own events win)`}
                      </span>
                    </div>
                  );
                })}
              </div>
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
                {selPeople.map((s) => {
                  const gs = grantsForStakeholder(s.id);
                  const affected = gs.filter(
                    (g) => !g.pauseStart && !g.terminationDate,
                  ).length;
                  return (
                    <div
                      key={s.id}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 10,
                        padding: "5px 0",
                        borderBottom: "1px solid var(--line)",
                        fontSize: 13,
                      }}
                    >
                      <span>
                        <strong>
                          {`${s.firstName} ${s.lastName}`.trim() || "—"}
                        </strong>
                      </span>
                      <span style={{ color: "var(--muted)" }}>
                        {s.pauseStart
                          ? `skipped — already paused ${s.pauseStart} → ${s.pauseEnd ?? "open-ended"}`
                          : `${affected} of ${gs.length} grant${gs.length === 1 ? "" : "s"} will pause (own events + terminated skip)`}
                      </span>
                    </div>
                  );
                })}
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
              <div style={{ marginTop: 6, maxHeight: 220, overflowY: "auto" }}>
                {bSummary.ids.map((sid) => {
                  const s = stakeholders.find((x) => x.id === sid);
                  if (!s) return null;
                  const status = stakeholderStatus(
                    grantsForStakeholder(s.id),
                    today,
                  );
                  return (
                    <div
                      key={sid}
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
                        onClick={() => router.push(`/stakeholders/${s.id}`)}
                      >
                        {`${s.firstName} ${s.lastName}`.trim() || "—"}
                      </button>
                      {status !== null && <StatusChip status={status} />}
                      <span style={{ color: "var(--muted)" }}>
                        {s.terminationDate
                          ? `person-level termination ${s.terminationDate}`
                          : s.pauseStart
                            ? `person-level pause ${s.pauseStart} → ${s.pauseEnd ?? "open-ended"}`
                            : "no person-level event"}
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

          <div className="stk-tablewrap">
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
                          : new Set(rows.map((s) => s.id)), // filtered rows ONLY
                      )
                    }
                  />
                </th>
              )}
              <th className="tcol-act" />
              {visible.map((key) => {
                const col = ALL_COLS.find((c) => c.key === key);
                if (!col) return null;
                const on = sortKey === key;
                const fc = (FILTER_COLS as string[]).includes(key)
                  ? (key as FilterCol)
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
            {rows.map((s) => (
              <tr
                key={s.id}
                className={
                  s.id === flashId || bFlash.has(s.id) ? "flash" : undefined
                }
                onClick={() =>
                  bulkMode
                    ? toggleSel(s.id)
                    : router.push(`/stakeholders/${s.id}`)
                }
              >
                {bulkMode && (
                  <td onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={sel.has(s.id)}
                      onChange={() => toggleSel(s.id)}
                    />
                  </td>
                )}
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
                  No stakeholders match the filters.
                </td>
              </tr>
            )}
          </tbody>
          </table>
          </div>
        </>
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
