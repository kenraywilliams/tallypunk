"use client";

import { useState, type CSSProperties } from "react";
import { useParams } from "next/navigation";
import { useSandbox, type Grant } from "../../../SandboxProvider";
import GrantDialog, {
  gid,
  grantStatus,
  StatusChip,
} from "../../../grants/GrantDialog";
import { reservedUnits, todayISO, vestedUnits } from "../../../grants/vesting";

// ---- panel styles (inline on purpose — see Handoff §3 on CSS caching) ----
const boxS: CSSProperties = {
  border: "1px solid var(--line)",
  borderRadius: 10,
  padding: "12px 14px",
  marginTop: 14,
  background: "var(--bg)",
};
const rowS: CSSProperties = {
  display: "flex",
  alignItems: "center",
  flexWrap: "wrap",
  gap: 8,
  padding: "7px 0",
  borderBottom: "1px solid var(--line)",
  fontSize: 13.5,
};
const noteS: CSSProperties = {
  fontSize: 12.5,
  color: "var(--muted)",
  marginTop: 10,
};
const blockS: CSSProperties = {
  background: "#f6e2e0",
  color: "#b23b3b",
  borderRadius: 8,
  padding: "9px 12px",
  fontSize: 13,
  fontWeight: 600,
  marginTop: 10,
};

type Bulk = null | "term" | "pause" | "unterm" | "unpause" | "summary";

export default function StakeholderGrantsPage() {
  const { id } = useParams<{ id: string }>();
  const {
    grantsForStakeholder,
    stakeholders,
    pools,
    terminateAllFor,
    pauseAllFor,
    reinstatePreflight,
    reinstateAllFor,
    unPauseAllFor,
    notify,
  } = useSandbox();
  const [dialog, setDialog] = useState<{
    grant?: Grant;
    edit?: boolean;
  } | null>(null);

  // ---- person-level lifecycle panels (GRANT-18) ----
  const [bulk, setBulk] = useState<Bulk>(null);
  const [termDate, setTermDate] = useState(todayISO());
  const [ps, setPs] = useState(todayISO());
  const [pe, setPe] = useState("");
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [summary, setSummary] = useState<{ title: string; ids: string[] }>({
    title: "",
    ids: [],
  });

  const grants = grantsForStakeholder(id);
  const st = stakeholders.find((x) => x.id === id);
  const today = todayISO();
  const totalGranted = grants.reduce((s, g) => s + g.quantity, 0);
  const totalVested = grants.reduce(
    (s, g) => s + vestedUnits(g.quantity, g.vesting, g.grantDate, today, g),
    0,
  );
  const poolName = (pid: string | null) =>
    pid ? (pools.find((p) => p.id === pid)?.name ?? "—") : "None";

  // Live per-grant summary line — the summary panel re-reads CURRENT state,
  // so editing a grant from it updates the row on return.
  const statusText = (g: Grant) => {
    if (grantStatus(g) === "fully") return "fully vested";
    if (g.terminationDate)
      return `terminated ${g.terminationDate}${g.terminationInherited ? " (person-level)" : ""}`;
    if (g.pauseStart)
      return `paused ${g.pauseStart} → ${g.pauseEnd ?? "open-ended"}${g.pauseInherited ? " (person-level)" : ""}`;
    return "vesting normally";
  };
  // "Grant 3 (#0000017)" — the position label people actually use, married
  // to the stable ID (apples next to apples with the chips row above).
  const glabel = (g: Grant) => {
    const i = grants.findIndex((x) => x.id === g.id);
    return `${i >= 0 ? `Grant ${i + 1} ` : ""}(#${gid(g.seq)})`;
  };
  const grantLink = (g: Grant) => (
    <button
      className="linkbtn"
      onClick={() => setDialog({ grant: g })}
      title="Open this grant — edit it and you'll come back here"
    >
      {glabel(g)}
    </button>
  );

  // ---- actions ----
  const doTermAll = () => {
    if (!termDate) return;
    const res = terminateAllFor(id, termDate);
    notify(
      `Terminated vesting on ${res.affected.length} grant${res.affected.length === 1 ? "" : "s"}`,
    );
    setSummary({
      title: `Terminated vesting from ${termDate}`,
      ids: [...res.affected, ...res.skipped],
    });
    setBulk("summary");
  };

  const pauseInvalid = !ps || (!!pe && pe < ps);
  const doPauseAll = () => {
    if (pauseInvalid) return;
    const res = pauseAllFor(id, ps, pe || null);
    notify(
      `Paused vesting on ${res.affected.length} grant${res.affected.length === 1 ? "" : "s"} — units stay reserved`,
    );
    setSummary({
      title: `Paused vesting ${ps} → ${pe || "open-ended"}`,
      ids: [...res.affected, ...res.skipped],
    });
    setBulk("summary");
  };

  const openUnterm = () => {
    const rows = reinstatePreflight(id, []);
    setSel(new Set(rows.filter((r) => r.inherited).map((r) => r.grantId)));
    setBulk("unterm");
  };
  const doReinstate = () => {
    const rows = reinstatePreflight(id, [...sel]);
    const res = reinstateAllFor(id, [...sel]);
    notify(
      `Reinstated ${res.restored.length} grant${res.restored.length === 1 ? "" : "s"}${res.blocked.length ? ` — ${res.blocked.length} blocked by pool capacity` : ""}`,
    );
    setSummary({
      title: "Reinstated vesting (person-level)",
      ids: rows.map((r) => r.grantId),
    });
    setBulk("summary");
  };

  const doUnpauseAll = () => {
    const res = unPauseAllFor(id);
    notify(
      `Removed the person-level pause — ${res.affected.length} grant${res.affected.length === 1 ? "" : "s"} resumed`,
    );
    setSummary({
      title: "Removed the person-level pause",
      ids: [...res.affected, ...res.skipped],
    });
    setBulk("summary");
  };

  // pre-flight rows for the un-terminate panel (recomputed live as ticks change)
  const preRows = bulk === "unterm" ? reinstatePreflight(id, [...sel]) : [];
  const anyOk = preRows.some((r) => r.selected && r.ok);
  const blockedRows = preRows.filter((r) => r.selected && !r.ok);

  return (
    <div className="panel">
      <div className="vrow">
        <span className="vlab">Total granted</span>
        <span className="vval">{totalGranted.toLocaleString()}</span>
      </div>
      <div className="vrow">
        <span className="vlab">Total vested (today)</span>
        <span className="vval">{totalVested.toLocaleString()}</span>
      </div>

      {grants.length === 0 ? (
        <p className="muted-note">
          No grants yet. Use <strong>+ Create grant</strong> to add one.
        </p>
      ) : (
        <div className="linkwrap-l" style={{ marginTop: 14 }}>
          {grants.map((g, i) => (
            <button
              key={g.id}
              className="linkbtn"
              onClick={() => setDialog({ grant: g })}
              title={`#${gid(g.seq)} · ${g.quantity.toLocaleString()} · ${poolName(
                g.poolId,
              )}`}
              style={{ display: "inline-flex", alignItems: "center", gap: 7 }}
            >
              Grant {i + 1}
              {/* default state unmarked here — exceptions only, or 14 green
                  pills drown the row; the lists always show the full pill */}
              {grantStatus(g) !== "vesting" && (
                <StatusChip status={grantStatus(g)} />
              )}
            </button>
          ))}
        </div>
      )}

      {/* ---- person-level lifecycle panels (GRANT-18) ---- */}
      {bulk === "term" && (
        <div style={boxS}>
          <label className="lab">Terminate ALL grants from</label>
          <input
            className="inp"
            type="date"
            value={termDate}
            onChange={(e) => setTermDate(e.target.value)}
            style={{ maxWidth: 220 }}
          />
          <div style={{ marginTop: 10 }}>
            {grants.map((g) => {
              if (g.terminationDate)
                return (
                  <div style={rowS} key={g.id}>
                    {grantLink(g)}
                    <span style={{ color: "var(--muted)" }}>
                      skipped — already terminated {g.terminationDate} (its own
                      date wins; open it to change)
                    </span>
                  </div>
                );
              const keep = reservedUnits(g.quantity, g.vesting, g.grantDate, {
                terminationDate: termDate,
                pauseStart: g.pauseStart,
                pauseEnd: g.pauseEnd,
              });
              const forfeit = g.quantity - keep;
              return (
                <div style={rowS} key={g.id}>
                  {grantLink(g)}
                  <span>
                    keeps <strong>{keep.toLocaleString()}</strong> vested ·
                    forfeits <strong>{forfeit.toLocaleString()}</strong>
                    {g.poolId ? ` → returned to ${poolName(g.poolId)}` : ""}
                  </span>
                  {g.pauseStart && (
                    <span style={{ color: "#8a6a33", fontWeight: 600 }}>
                      paused {g.pauseStart} → {g.pauseEnd ?? "open-ended"} —
                      will still be terminated
                    </span>
                  )}
                </div>
              );
            })}
          </div>
          <p style={noteS}>
            A tranche exactly on the date does <strong>not</strong> vest.
            Reversible via <strong>Un-terminate all</strong>.
          </p>
          <div className="modal-actions">
            <button className="btn btn-ghost" onClick={() => setBulk(null)}>
              Cancel
            </button>
            <button className="btn btn-pri" disabled={!termDate} onClick={doTermAll}>
              Terminate all grants
            </button>
          </div>
        </div>
      )}

      {bulk === "pause" && (
        <div style={boxS}>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <div>
              <label className="lab">Pause ALL grants from</label>
              <input
                className="inp"
                type="date"
                value={ps}
                onChange={(e) => setPs(e.target.value)}
              />
            </div>
            <div>
              <label className="lab">Until (optional)</label>
              <input
                className="inp"
                type="date"
                value={pe}
                onChange={(e) => setPe(e.target.value)}
              />
            </div>
          </div>
          <div style={{ marginTop: 10 }}>
            {grants.map((g) => (
              <div style={rowS} key={g.id}>
                {grantLink(g)}
                <span
                  style={
                    g.pauseStart || g.terminationDate
                      ? { color: "var(--muted)" }
                      : undefined
                  }
                >
                  {g.terminationDate
                    ? `skipped — terminated ${g.terminationDate} (pausing it could change what was forfeited)`
                    : g.pauseStart
                      ? `skipped — has its own pause ${g.pauseStart} → ${g.pauseEnd ?? "open-ended"}`
                      : pe
                        ? "will pause — schedule shifts by the pause length"
                        : "will pause — frozen until resumed"}
                </span>
              </div>
            ))}
          </div>
          <p style={noteS}>
            Units <strong>stay reserved</strong> in their pools — pausing
            returns nothing (unlike Terminate).
            {pe && pe < ps && (
              <strong style={{ color: "#b23b3b" }}>
                {" "}
                End date is before the start.
              </strong>
            )}
          </p>
          <div className="modal-actions">
            <button className="btn btn-ghost" onClick={() => setBulk(null)}>
              Cancel
            </button>
            <button
              className="btn btn-pri"
              disabled={pauseInvalid}
              onClick={doPauseAll}
            >
              Pause all grants
            </button>
          </div>
        </div>
      )}

      {bulk === "unterm" && (
        <div style={boxS}>
          <p style={{ fontSize: 12.5, color: "var(--muted)", margin: 0 }}>
            <strong>All previously-scheduled vesting resumes</strong> for the
            ticked grants — pools must re-supply the units they took back
            (checked cumulatively, in grant order). Grants terminated
            individually are listed unticked — opt them in if you want.
          </p>
          <div style={{ marginTop: 10 }}>
            {preRows.map((r) => {
              const g = grants.find((x) => x.id === r.grantId);
              if (!g) return null;
              return (
                <div style={rowS} key={r.grantId}>
                  <input
                    type="checkbox"
                    checked={r.selected}
                    onChange={() =>
                      setSel((cur) => {
                        const n = new Set(cur);
                        if (n.has(r.grantId)) n.delete(r.grantId);
                        else n.add(r.grantId);
                        return n;
                      })
                    }
                  />
                  {grantLink(g)}
                  <span style={{ color: "var(--muted)" }}>
                    {r.inherited ? "person-level" : "terminated individually"} ·
                    needs {r.needed.toLocaleString()}
                    {r.poolId ? ` from ${poolName(r.poolId)}` : " (no pool)"}
                  </span>
                  <span style={{ marginLeft: "auto", fontWeight: 600 }}>
                    {!r.selected ? (
                      <span style={{ color: "var(--muted)" }}>
                        stays terminated
                      </span>
                    ) : r.ok ? (
                      <span style={{ color: "#2f7d4f" }}>✓ will restore</span>
                    ) : (
                      <span style={{ color: "#b23b3b" }}>
                        ✗ blocked — short {r.shortfall.toLocaleString()}
                      </span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
          {blockedRows.length > 0 && (
            <div style={blockS}>
              {blockedRows.length} grant
              {blockedRows.length === 1 ? "" : "s"} can't be restored — free up
              pool capacity or expand the pool(s), or proceed and restore the
              rest.
            </div>
          )}
          <div className="modal-actions">
            <button className="btn btn-ghost" onClick={() => setBulk(null)}>
              Cancel
            </button>
            <button className="btn btn-pri" disabled={!anyOk} onClick={doReinstate}>
              Reinstate all possible
            </button>
          </div>
        </div>
      )}

      {bulk === "unpause" && (
        <div style={boxS}>
          <p style={{ fontSize: 12.5, color: "var(--muted)", margin: 0 }}>
            <strong>This removes the person-level pause entirely</strong> — the
            schedules recompute as if it never happened. Grants with their own
            individual pause keep it. The pause stays visible in the audit log.
          </p>
          <div className="modal-actions">
            <button className="btn btn-ghost" onClick={() => setBulk(null)}>
              Cancel
            </button>
            <button className="btn btn-pri" onClick={doUnpauseAll}>
              Un-pause all grants
            </button>
          </div>
        </div>
      )}

      {bulk === "summary" && (
        <div style={boxS}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>
            Done — {summary.title}
          </div>
          <p style={noteS}>
            This list is <strong>live</strong>: click any grant to open and
            adjust it (e.g. give it a different date), save, and you'll land
            back here with the row updated.
          </p>
          <div style={{ marginTop: 6 }}>
            {summary.ids.map((gidStr) => {
              const g = grants.find((x) => x.id === gidStr);
              if (!g) return null;
              return (
                <div style={rowS} key={gidStr}>
                  {grantLink(g)}
                  <StatusChip status={grantStatus(g)} />
                  <span style={{ color: "var(--muted)" }}>{statusText(g)}</span>
                </div>
              );
            })}
          </div>
          <div className="modal-actions">
            <button className="btn btn-pri" onClick={() => setBulk(null)}>
              Close
            </button>
          </div>
        </div>
      )}

      <div className="modal-actions">
        {grants.length > 0 && st && bulk === null && (
          <>
            {st.terminationDate ? (
              <button className="btn btn-ghost btn-sm" onClick={openUnterm}>
                Un-terminate all…
              </button>
            ) : (
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  setTermDate(todayISO());
                  setBulk("term");
                }}
              >
                Terminate all…
              </button>
            )}
            {st.pauseStart ? (
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setBulk("unpause")}
              >
                Un-pause all…
              </button>
            ) : (
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  setPs(todayISO());
                  setPe("");
                  setBulk("pause");
                }}
              >
                Pause all…
              </button>
            )}
          </>
        )}
        <span style={{ flex: 1 }} />
        <button className="btn btn-pri btn-sm" onClick={() => setDialog({})}>
          + Create grant
        </button>
      </div>

      {dialog && (
        <GrantDialog
          grant={dialog.grant}
          startEdit={dialog.edit}
          presetStakeholderId={id}
          onClose={() => setDialog(null)}
        />
      )}
    </div>
  );
}
