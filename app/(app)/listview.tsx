"use client";

import { useEffect, useRef, useState } from "react";

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
) {
  const [hydrated, setHydrated] = useState(false);
  const [visible, setVisible] = useState<K[]>(defaultVisible);
  const [sortKey, setSortKey] = useState<K>(defaultSortKey);
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const d = JSON.parse(raw);
        const keys = allCols.map((c) => c.key);
        if (Array.isArray(d.visible)) {
          const v = d.visible.filter((k: unknown): k is K =>
            keys.includes(k as K),
          );
          if (v.length) setVisible(v);
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
        JSON.stringify({ visible, sortKey, sortDir }),
      );
  }, [visible, sortKey, sortDir, hydrated, storageKey]);

  const toggleCol = (k: K) =>
    setVisible((cur) =>
      cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k],
    );

  const moveCol = (k: K, dir: "up" | "down") =>
    setVisible((cur) => {
      const i = cur.indexOf(k);
      const j = dir === "up" ? i - 1 : i + 1;
      if (i === -1 || j < 0 || j >= cur.length) return cur;
      const next = [...cur];
      [next[i], next[j]] = [next[j], next[i]];
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
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("click", onDoc);
    return () => document.removeEventListener("click", onDoc);
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
          <div className="colmenu-h">Shown — order with ↑ ↓</div>
          {visible.map((key, i) => {
            const col = allCols.find((c) => c.key === key);
            if (!col) return null;
            return (
              <div key={key} className="colmenu-item">
                <input type="checkbox" checked onChange={() => toggleCol(key)} />
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
  );
}
