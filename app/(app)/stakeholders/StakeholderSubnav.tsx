"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useSandbox } from "../SandboxProvider";
import { sortStakeholders, useStakeholderView } from "./view";
import CreateStakeholderModal from "./CreateStakeholderModal";

export default function StakeholderSubnav() {
  const pathname = usePathname();
  const { stakeholders, companies } = useSandbox();
  const { sortKey, sortDir } = useStakeholderView();
  const [manageOpen, setManageOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const manageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (manageRef.current && !manageRef.current.contains(e.target as Node))
        setManageOpen(false);
    };
    document.addEventListener("click", onDoc);
    return () => document.removeEventListener("click", onDoc);
  }, []);
  useEffect(() => setManageOpen(false), [pathname]);

  const m = pathname.match(/^\/stakeholders\/([^/]+)(?:\/([^/]+))?/);
  const pathId = m?.[1];
  const sub = m?.[2];

  // Selection = the id in the URL, otherwise the first row of the sorted list.
  const sorted = sortStakeholders(stakeholders, companies, sortKey, sortDir);
  const targetId = pathId ?? sorted[0]?.id;

  const tab = (label: string, href: string | null, active: boolean) =>
    href ? (
      <Link href={href} className={"subtab" + (active ? " on" : "")}>
        {label}
      </Link>
    ) : (
      <span className="subtab disabled">{label}</span>
    );

  const manageActive = !!sub && ["audit", "history", "reports"].includes(sub);

  return (
    <div className="subnav">
      <div className="subnav-in">
        {tab("Stakeholders", "/stakeholders", !pathId)}
        {tab(
          "Profile",
          targetId ? `/stakeholders/${targetId}` : null,
          !!pathId && !sub,
        )}
        {tab(
          "Grants",
          targetId ? `/stakeholders/${targetId}/grants` : null,
          sub === "grants",
        )}
        {tab(
          "Vesting",
          targetId ? `/stakeholders/${targetId}/vesting` : null,
          sub === "vesting",
        )}
        {targetId ? (
          <div className={"menu" + (manageOpen ? " open" : "")} ref={manageRef}>
            <button
              className={"subtab" + (manageActive ? " on" : "")}
              onClick={(e) => {
                e.stopPropagation();
                setManageOpen((o) => !o);
              }}
            >
              Manage <span className="caret">▾</span>
            </button>
            <div className="menu-panel">
              <Link
                className="menu-item"
                href={`/stakeholders/${targetId}/audit`}
              >
                <span className="mi">▤</span>Audit log
              </Link>
              <Link
                className="menu-item"
                href={`/stakeholders/${targetId}/history`}
              >
                <span className="mi">◷</span>History
              </Link>
              <Link
                className="menu-item"
                href={`/stakeholders/${targetId}/reports`}
              >
                <span className="mi">▦</span>Reports
              </Link>
            </div>
          </div>
        ) : (
          <span className="subtab disabled">Manage ▾</span>
        )}
        <button
          className="btn btn-pri btn-sm subnav-add"
          onClick={() => setCreating(true)}
        >
          + Add stakeholder
        </button>
      </div>
      {creating && (
        <CreateStakeholderModal
          onClose={() => setCreating(false)}
          onCreated={() => setCreating(false)}
        />
      )}
    </div>
  );
}
