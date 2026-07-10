# TallyPunk — Smoke & Regression Checklist

_Goal: keep cowork-built code safe to commit. Two cheap gates now, a proper one later._

---

## Gate 1 — Build check (run before EVERY commit)

```
npm run build
```

If it compiles clean, you're safe on the big stuff: **no TypeScript errors, no broken imports, no bad edits**. This catches ~90% of what could silently break (it's what would've caught the circular-import / un-scoped-CSS class of issues). If it errors, paste the error to me. (Optional: `npm run lint` for style/unused warnings.)

**Habit:** `npm run build` → if green → `git add -A && git commit && git push`.

## Gate 2 — 2-minute manual smoke (after any UI change)

Quick click-through — the compiler can't catch behaviour, your eyes can:

- **Landing** loads styled; **Try it now** → `/dashboard`.
- **Nav**: every tab + **Manage** menu + account menu route; active tab underlines; sandbox bar + nav stay pinned when you scroll.
- **Pools empty**: big **+** → create dialog; create with defaults → toast + new row + the row **flashes**.
- **Create/Edit dialog**: type toggle + **tooltip shows**; company select + **+ New company**; quantity shows **commas** on blur; **Infinity** tick → ∞, untick → red note; **duplicate name blocked** (red, two spots).
- **Edit**: **Save greyed until a change**; **Cancel resets** the form (re-open Edit = clean); the change appears in **History** as `before → after`.
- **Linking**: row-click opens **view**; pencil opens **edit**; the **Company** button opens the company dialog; a company's **pool buttons** open the pool dialog **on top** (closable, returns underneath).
- **Logs**: scroll is **inside** the panel; title + **Close** always visible.
- **Click-outside** closes a **view** dialog (back to whatever's behind), but an **edit/create** dialog needs Cancel/×.
- **Reset sandbox** clears everything; **refresh** persists what you kept.
- **Terminate vesting** (grant view): panel previews kept/forfeited (+ "returned to {pool}"); confirm → **the open dialog updates IMMEDIATELY** (banner + buttons + dates, no close/reopen), red banner, **Terminated** chip in Grants list + stakeholder Grants tab, pool "left" grows by the forfeited units; **History** logs "vesting terminated from {date}". Same immediate-refresh check for un-terminate and pause.
- **Un-terminate**: warning ("use Pause for a temporary hold"); **blocked with a shortfall count** if the pool was re-granted meanwhile; resume restores schedule + reservation.
- **Pause vesting**: start + optional end; end-before-start blocked; gold banner; with an end date **Fully vested pushes out by the pause length**; open-ended shows "— vesting paused"; **Remove pause… asks a "removal, not un-pause" confirm** before restoring; units stay reserved (pool "left" unchanged).
- **Vesting chart**: terminated grant flat-lines from the date, **flag marker** in the gutter (hover → tag AT the flag, "terminated"); paused grant shows a **shaded band**, flat across it, then resumes shifted; **paused/resumes/terminated rows join the hover tag** on their date when the cursor is within ~40 px (even at 0% — findable, not sticky); a pen/flag hover lists **every coinciding event** (e.g. "granted · paused").
- **Stakeholders list**: **Granted** (total units) + **Vested** (% today, lifecycle-aware) populate and sort; "—" only when the person has no grants.
- **Person-level lifecycle (GRANT-18)**: stakeholder Grants tab shows **Terminate all… / Pause all…** (swapping to **Un-terminate all… / Un-pause all…** when active); previews name skipped grants (own event wins; pause-all skips terminated); confirm → **live summary** — click a grant row, edit it, save, return, the row updates; **un-terminate pre-flight**: two grants on one small pool → second shows ✗ blocked with a shortfall; individually-terminated grants appear unticked (opt-in); "Reinstate all possible" restores ✓ rows only.
- **Stakeholder status (STK-06/GRANT-19)**: Stakeholders list **Status** column + Profile "Vesting status" row — **Vesting (green) · Paused (gold) · Fully vested (blue) · Terminated (red)** pills by vesting reality; a fully-vested person flips back to **Vesting** when a new grant is added; person-level event line on Profile; **creating a grant for a terminated person shows the gold notice**; scheduled/expired pauses read Vesting; the grants-tab chip row hides the default Vesting pill (exceptions only).
- **Deletes (GBL-09)**: grant view → red **Delete…** (warns if vested; units return to the pool; grant vanishes from lists/chart; its entries stay on the stakeholder + pool audit logs with "#ID deleted"); stakeholder Profile → **Delete…** needs typed "delete" + shows the per-grant units→pool list, cascades, **redirects to the list**; company delete detaches children and each affected pool/stakeholder logs "company deleted — set to —"; **new IDs never reuse deleted numbers** (delete the highest grant, create one → next number up).
- **Pool delete wizard**: pool view → **Delete…** → 3 choices (General Pool default / choose pool / delete all grants) + per-grant overrides; a finite target short on room shows the red shortfall with **"+ Add N" / "Make it Infinity ∞"** inline; typed "delete"; summary grouped by stakeholder. **General Pool**: exists from first load, no Edit/Delete buttons, "inherent structure" note.
- **Audit rollups**: pool Audit log shows its grants' entries ("Grant #… —"); moving a grant between pools leaves a handoff entry on the old pool; **Manage ▾ → Audit log** lists everything, deleted objects labelled "(deleted)".
- **Pool size floor**: grant from an infinity pool, then edit it finite below the granted amount → red "minimum size is X" note + Save disabled; sizing at/above the granted amount saves; a pool already in deficit shows the red **"Over-granted"** banner in its view.
- **List filters (GBL-05)**: funnel icons sit **before the column name** (one non-wrapping row — headers keep their borders/height) on Stakeholders (Type/Company/Status) + Grants (First name/Pool/Status; person filter = full names); menu opens with an Excel-style **"(Select all)"** master toggle first (all ↔ none; indeterminate when partial); untick some → rows filter, **funnel fills accent**, "Filtered — showing X of Y" + **Clear filters** appears; untick all → "no match" row; refresh clears filters (transient by design); sorting still works while filtered.
- **Columns menu**: ticking/unticking a column **keeps the menu open** (closes only on outside click); **untick then retick → the column returns to its previous slot** (not the end) and its row **flashes** in the Displayed list; **↑↓ reorders glide** (the two swapping rows visibly slide, ~150ms — fast enough to spam); **table column HEADERS drag-and-drop** (drag a header onto another: dragged one dims, target shows an accent edge on the landing side, order persists) on all four lists — sort clicks and funnels still work on draggable headers; header in the menu reads just "Displayed"; **Grants list defaults now show First/Last name columns** (mirrors Stakeholders; combined "Stakeholder (full name)" available via Columns) with **Status after Quantity** — saved views migrate automatically.
- **Grant audit log**: grant view → **Audit log** (renamed from History everywhere — pools/companies/grants buttons + dialog titles) lists creation, edits, terminate/pause/reinstate; the stakeholder **Audit log** page shows the same entries prefixed **"Grant #…"** (incl. pre-existing sandboxes via load-time backfill); **reassigning a grant** leaves its old entries + a "reassigned to X" line on the previous stakeholder, and new entries follow the new one.

## Gate 3 — later (when we move to Claude Code / set up CI)

- **Playwright** e2e covering the flows above (write once, runs forever).
- **GitHub Actions**: run `build` + `lint` + e2e on every push/PR — a red check blocks a bad merge automatically.

That's the natural home for "real" regression safety; for now Gates 1–2 keep us moving fast without breaking things. Logged as a future task in the tracker.

## Keeping this current

**This checklist is a living doc — it must grow with the app.** Every time we add a page, dialog, or flow, add its smoke line to Gate 2 (and later its e2e test to Gate 3). A checklist that lags the product gives false confidence. Quick rule of thumb when we ship a feature:

- New page/route → add a "loads styled + routes" line.
- New create/edit flow → add a "create with defaults / Save-on-change / Cancel-resets" line.
- New validation rule → add the "blocked when…" line.
- New data relationship (e.g. Grants ↔ Pools) → add a "link works both ways