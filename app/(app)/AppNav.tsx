"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import Logo from "../Logo";

export default function AppNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState<"manage" | "acct" | null>(null);
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (barRef.current && !barRef.current.contains(e.target as Node)) {
        setOpen(null);
      }
    };
    document.addEventListener("click", onDoc);
    return () => document.removeEventListener("click", onDoc);
  }, []);

  // close any open menu after navigating
  useEffect(() => setOpen(null), [pathname]);

  const active = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");
  const manageActive = [
    "/pools",
    "/companies",
    "/reports",
    "/audit",
    "/import",
    "/export",
  ].some(active);
  const tabCls = (on: boolean) => "tab" + (on ? " active" : "");
  const toggle = (which: "manage" | "acct") => (e: React.MouseEvent) => {
    e.stopPropagation();
    setOpen((o) => (o === which ? null : which));
  };

  return (
    <div className="bar" ref={barRef}>
      <Link className="brand" href="/dashboard">
        <Logo size={25} className="mark" />
        TallyPunk
      </Link>

      <div className="tabs">
        <Link className={tabCls(active("/dashboard"))} href="/dashboard">
          Dashboard
        </Link>
        <Link className={tabCls(active("/stakeholders"))} href="/stakeholders">
          Stakeholders
        </Link>
        <Link className={tabCls(active("/grants"))} href="/grants">
          Grants
        </Link>

        <div className={"menu" + (open === "manage" ? " open" : "")}>
          <button className={tabCls(manageActive)} onClick={toggle("manage")}>
            Manage <span className="caret">▾</span>
          </button>
          <div className="menu-panel">
            <div className="menu-grp">Workspace</div>
            <Link className="menu-item" href="/pools">
              <span className="mi">▦</span>Pools
            </Link>
            <Link className="menu-item" href="/companies">
              <span className="mi">▣</span>Companies
            </Link>
            <Link className="menu-item" href="/reports">
              <span className="mi">▤</span>Reports
            </Link>
            <Link className="menu-item" href="/audit">
              <span className="mi">▥</span>Audit log
            </Link>
            <div className="menu-sep" />
            <div className="menu-grp">Data</div>
            <Link className="menu-item" href="/import">
              <span className="mi">↧</span>Import CSV <span className="badge">migrate</span>
            </Link>
            <Link className="menu-item" href="/export">
              <span className="mi">↥</span>Export CSV
            </Link>
          </div>
        </div>
      </div>

      <div className="spacer" />

      <Link className="iconbtn" href="/search" title="Search">
        🔍
      </Link>
      <Link className="iconbtn" href="/help" title="Help &amp; docs">
        ?
      </Link>

      <div className={"menu right" + (open === "acct" ? " open" : "")}>
        <div className="acct" onClick={toggle("acct")}>
          <div className="avatar">M</div>
          <span className="nm">Mate · Acme</span>
          <span className="caret">▾</span>
        </div>
        <div className="menu-panel">
          <div className="menu-grp">Acme Inc</div>
          <Link className="menu-item" href="/account">
            <span className="mi">⚙</span>Company settings
          </Link>
          <Link className="menu-item" href="/account">
            <span className="mi">◑</span>Your profile
          </Link>
          <Link className="menu-item" href="/account">
            <span className="mi">⤓</span>Billing &amp; plan
          </Link>
          <div className="menu-sep" />
          <Link className="menu-item" href="/">
            <span className="mi">⎋</span>Log out
          </Link>
        </div>
      </div>
    </div>
  );
}
