"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export type SortDir = "asc" | "desc";

export interface ColDef<K extends string> {
  key: K;
  label: string;
}

/**
 * Generic list-view state for a power-list: which columns are visible (+ order)
 * and the current sort, persisted to localStorage. Used by Pools, Companies, etc.
 * (Stakeholders has its own provider because its sub-ribbon/left-list share state.)
 */
export function useListView<K extends string>(
  storageKey: string,
  allCols: ColDef<K>[],
  defaultVisible: K[],
  defaultSortKey: K,
  // one-time adjustment of saved column prefs (e.g. new default columns that
  // predate the user's stored view) — applied on load, then persisted
  migrate?: (visible: K[]) => K[],
) {
  const [hydrated, setHydrated] = useState(false);
  // `order` holds EVERY column exactly once — hidden columns keep their slot,
  // so reticking one returns it to where it was, not to the end (GBL-05).
  // `shown` is just membership; the displayed list = order ∩ shown.
  const buildOrder = (vis: K[]): K[] => [
    ...vis,
    ...allCols.map((c) => c.key).filter((k) => !vis.includes(k)),
  ];
  const [order, setOrder] = useState<K[]>(() => buildOrder(defaultVisible));
  const [shown, setShown] = useState<K[]>(defaultVisible);
  const [sortKey, setSortKey] = useState<K>(defaultSortKey);
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const visible = order.filter((k) => shown.includes(k));

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const d = JSON.parse(raw);
        const keys = allCols.map((c) => c.key);
        const valid = (arr: unknown): K[] =>
          Array.isArray(arr)
            ? arr.filter((k: unknown): k is K => keys.includes(k as K))
            : [];
        if (Array.isArray(d.order)) {
          // new shape: order + shown
          const ord = valid(d.order);
          keys.forEach((k) => {
            if (!ord.includes(k)) ord.push(k); // new columns join at the end
          });
          const shn = valid(d.shown);
          if (ord.length) {
            setOrder(ord);
            setShown(migrate ? migrate(shn) : shn);
          }
        } else if (Array.isArray(d.visible)) {
          // old shape: a single visible list — migrate then derive the order
          let v = valid(d.visible);
          if (v.length) {
            if (migrate) v = migrate(v);
            setOrder(buildOrder(v));
            setShown(v);
          }
        }
        if (keys.includes(d.sortKey)) setSortKey(d.sortKey);
        if (d.sortDir === "asc" || d.sortDir === "desc") setSortDir(d.sortDir);
      }
    } catch {
      /* ignore corrupt prefs */
    }
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (hydrated)
      localStorage.setItem(
        storageKey,
        JSON.stringify({ order, shown, sortKey, sortDir }),
      );
  }, [order, shown, sortKey, sortDir, hydrated, storageKey]);

  // visibility only — the column's slot in `order` survives the round-trip
  const toggleCol = (k: K) =>
    setShown((cur) =>
      cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k],
    );

  // arrows move relative to the neighbouring VISIBLE column, but the change
  // is recorded in `order` so hidden columns ride along sensibly
  const moveCol = (k: K, dir: "up" | "down") =>
    setOrder((cur) => {
      const vis = cur.filter((x) => shown.includes(x));
      const i = vis.indexOf(k);
      const j = dir === "up" ? i - 1 : i + 1;
      if (i === -1 || j < 0 || j >= vis.length) return cur;
      const neighbor = vis[j];
      const next = cur.filter((x) => x !== k);
      const ni = next.indexOf(neighbor);
      next.splice(dir === "up" ? ni : ni + 1, 0, k);
      return next;
    });

  const cycleSort = (k: K) => {
    if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(k);
      setSortDir("asc");
    }
  };

  return { hydrated, visible, sortKey, sortDir, toggleCol, moveCol, cycleSort };
}

export function sortRows<T, K extends string>(
  rows: T[],
  key: K,
  dir: SortDir,
  getValue: (row: T, key: K) => string | number,
): T[] {
  return [...rows].sort((a, b) => {
    const va = getValue(a, key);
    const vb = getValue(b, key);
    const c = va < vb ? -1 : va > vb ? 1 : 0;
    return dir === "asc" ? c : -c;
  });
}

// FLIP micro-animation for the columns menu: call `snap()` right before a
// reorder, and rows that changed position glide there (~150ms — fast enough
// to spam the arrows, visible enough that the eye follows the swap).
export function useRowFlip(dep: unknown) {
  const rows = useRef(new Map<string, HTMLElement>());
  const prev = useRef<Map<string, number> | null>(null);
  const register = (k: string) => (el: HTMLElement | null) => {
    if (el) rows.current.set(k, el);
    else rows.current.delete(k);
  };
  const snap = () => {
    const m = new Map<string, number>();
    rows.current.forEach((el, k) => m.set(k, el.getBoundingClientRect().top));
    prev.current = m;
  };
  useLayoutEffect(() => {
    if (!prev.current) return;
    const before = prev.current;
    prev.current = null;
    rows.current.forEach((el, k) => {
      const old = before.get(k);
      if (old == null) return;
      const d = old - el.getBoundingClientRect().top;
      if (!d) return;
      el.style.transition = "none";
      el.style.transform = `translateY(${d}px)`;
      requestAnimationFrame(() => {
        el.style.transition = "transform .15s ease";
        el.style.transform = "";
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dep]);
  return { register, snap };
}

// ---- per-column value filters (GBL-05 filters, 9 Jul 2026) ----
// A little funnel in the column header; click → checkbox list of the column's
// distinct values. An applied filter fills the funnel in accent colour —
// obvious at a glance. Filters are deliberately TRANSIENT (not persisted):
// a saved filter that silently empties a list days later is worse than
// re-picking one.

export function useColumnFilters<K extends string>() {
  const [filters, setFilters] = useState<Partial<Record<K, Set<string>>>>({});
  const setFilter = (col: K, sel: Set<string> | null) =>
    setFilters((cur) => {
      const next = { ...cur };
      if (sel === null) delete next[col];
      else next[col] = sel;
      return next;
    });
  const clearAll = () => setFilters({});
  const active = Object.keys(filters).length > 0;
  const passes = (col: K, value: string) => {
    const f = filters[col];
    return !f || f.has(value);
  };
  return { filters, setFilter, clearAll, active, passes };
}

export function FilterFunnel({
  values,
  selected,
  onChange,
}: {
  values: string[]; // distinct values, in display order
  selected: Set<string> | undefined; // undefined = no filter (all shown)
  onChange: (sel: Set<string> | null) => void; // null clears the filter
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (
        btnRef.current &&
        !btnRef.current.contains(t) &&
        menuRef.current &&
        !menuRef.current.contains(t)
      )
        setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const on = !!selected;
  return (
    <>
      <button
        ref={btnRef}
        type="button"
        aria-label="Filter column"
        title={on ? "Filter applied — click to edit" : "Filter this column"}
        onClick={(e) => {
          e.stopPropagation();
          if (!open && btnRef.current) {
            const r = btnRef.current.getBoundingClientRect();
            setPos({
              x: Math.min(r.left, window.innerWidth - 210),
              y: r.bottom + 4,
            });
          }
          setOpen((o) => !o);
        }}
        style={{
          border: 0,
          background: "transparent",
          cursor: "pointer",
          padding: "0 3px",
          display: "inline-flex",
          alignItems: "center",
          color: on ? "var(--accent)" : "var(--muted)",
          opacity: on ? 1 : 0.55,
        }}
      >
        <svg width="11" height="11" viewBox="0 0 16 16" aria-hidden>
          <path
            d="M1.5 2h13L9.6 8.2v4.6L6.4 15V8.2L1.5 2Z"
            fill={on ? "currentColor" : "none"}
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      {open &&
        pos &&
        typeof document !== "undefined" &&
        createPortal(
          // portal to body: the table wrap scrolls/clips, headers are
          // uppercase — the menu must escape both (inline styles only,
          // NOT .app-scoped — same rule as modals)
          <div
            ref={menuRef}
            style={{
              position: "fixed",
              left: pos.x,
              top: pos.y,
              zIndex: 140,
              minWidth: 190,
              maxHeight: 280,
              overflowY: "auto",
              background: "var(--bg2)",
              border: "1px solid var(--line)",
              borderRadius: 8,
              boxShadow: "var(--shadow)",
              padding: 6,
              textAlign: "left",
              textTransform: "none",
              letterSpacing: "normal",
              fontWeight: 400,
              fontFamily: "var(--fb)",
            }}
          >
            {/* Excel-style master toggle — first row: all ↔ none (a third
                click-state, indeterminate, shows when partially filtered) */}
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "5px 6px",
                borderRadius: 6,
                cursor: "pointer",
                fontSize: 13,
                fontWeight: 600,
                color: "var(--ink)",
                borderBottom: "1px solid var(--line)",
                marginBottom: 4,
              }}
            >
              <input
                type="checkbox"
                checked={!selected}
                ref={(el) => {
                  if (el)
                    el.indeterminate = !!selected && selected.size > 0;
                }}
                onChange={() => onChange(selected ? null : new Set())}
              />
              (Select all)
            </label>
            {values.map((v) => (
              <label
                key={v}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "5px 6px",
                  borderRadius: 6,
                  cursor: "pointer",
                  fontSize: 13,
                  color: "var(--ink)",
                }}
              >
                <input
                  type="checkbox"
                  checked={selected ? selected.has(v) : true}
                  onChange={() => {
                    const base = selected ? new Set(selected) : new Set(values);
                    if (base.has(v)) base.delete(v);
                    else base.add(v);
                    onChange(base.size === values.length ? null : base);
                  }}
                />
                {v}
              </label>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}

export function ColumnsMenu<K extends string>({
  visible,
  allCols,
  toggleCol,
  moveCol,
}: {
  visible: K[];
  allCols: ColDef<K>[];
  toggleCol: (k: K) => void;
  moveCol: (k: K, dir: "up" | "down") => void;
}) {
  const [open, setOpen] = useState(false);
  // reticking a hidden column returns it to its remembered slot — flash that
  // row so the eye lands on WHERE it went
  const [flash, setFlash] = useState<K | null>(null);
  const flashTimer = useRef<number | undefined>(undefined);
  const flashKey = (k: K) => {
    setFlash(k);
    if (flashTimer.current) window.clearTimeout(flashTimer.current);
    flashTimer.current = window.setTimeout(() => setFlash(null), 1600);
  };
  const { register, snap } = useRowFlip(visible); // rows glide on reorder
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // mousedown, NOT click: toggling a column moves its row between the
    // Shown/Hidden lists, so by click-time the pressed node is detached and
    // a click listener would wrongly read it as "outside" and close the menu
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const hidden = allCols.filter((c) => !visible.includes(c.key));

  return (
    <div className="colwrap" ref={ref}>
      <button
        className="btn btn-ghost btn-sm"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
      >
        Columns ▾
      </button>
      {open && (
        <div className="colmenu">
          <div className="colmenu-h">Displayed</div>
          {visible.map((key, i) => {
            const col = allCols.find((c) => c.key === key);
            if (!col) return null;
            return (
              <div
                key={key}
                ref={register(key)}
                className="colmenu-item"
                style={{
                  background: flash === key ? "var(--accent-soft)" : undefined,
                  borderRadius: 6,
                }}
              >
                <input type="checkbox" checked onChange={() => toggleCol(key)} />
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
                      flashKey(col.key); // show where it re-slotted
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
  );
}
