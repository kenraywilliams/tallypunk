"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import { useSandbox } from "../../SandboxProvider";
import { fullName, idLabel, typeLabel } from "../util";
import { sortStakeholders, useStakeholderView } from "../view";

export default function StakeholderLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { id } = useParams<{ id: string }>();
  const pathname = usePathname();
  const router = useRouter();
  const { stakeholders, companies, hydrated } = useSandbox();
  const { navField, navDir, setNavSort } = useStakeholderView();
  const activeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest" });
  }, [id]);

  if (!hydrated) return <div className="page" />;

  const sorted = sortStakeholders(stakeholders, companies, navField, navDir);
  const idx = sorted.findIndex((s) => s.id === id);
  if (idx === -1) {
    return (
      <div className="page">
        <p className="muted-note">This stakeholder no longer exists.</p>
        <Link className="btn btn-ghost btn-sm" href="/stakeholders">
          ← Back to list
        </Link>
      </div>
    );
  }

  const s = sorted[idx];
  const count = sorted.length;
  const suffix = pathname.replace(/^\/stakeholders\/[^/]+/, ""); // "" | "/grants" …
  const go = (i: number) =>
    router.push(`/stakeholders/${sorted[i].id}${suffix}`);
  const prevIdx = (idx - 1 + count) % count; // wraps to the end
  const nextIdx = (idx + 1) % count; // wraps to the start

  const arrow = (f: "first" | "last") =>
    navField === f ? (navDir === "asc" ? " ▲" : " ▼") : "";

  return (
    <div className="page">
      <div className="sdetail">
        <aside className="slist">
          <div className="slist-head">
            <span className="slist-title">All stakeholders</span>
            <div className="slist-sort">
              <button
                className={"slsort" + (navField === "first" ? " on" : "")}
                onClick={() => setNavSort("first")}
              >
                First{arrow("first")}
              </button>
              <button
                className={"slsort" + (navField === "last" ? " on" : "")}
                onClick={() => setNavSort("last")}
              >
                Surname{arrow("last")}
              </button>
            </div>
          </div>
          <div className="slist-scroll">
            {sorted.map((p) => (
              <button
                key={p.id}
                ref={p.id === id ? activeRef : undefined}
                className={"slist-item" + (p.id === id ? " on" : "")}
                onClick={() => router.push(`/stakeholders/${p.id}${suffix}`)}
              >
                {fullName(p) || "—"}
              </button>
            ))}
          </div>
        </aside>

        <div className="sbody">
          <div className="sh">
            <div className="sh-id">
              <span className="sh-num">#{idLabel(s.seq)}</span>
              <h1 className="sh-name">{fullName(s) || "—"}</h1>
              <span className="pill-soft">{typeLabel(s.type)}</span>
            </div>
            <div className="sh-nav">
              <button className="snav-b" onClick={() => go(prevIdx)}>
                ‹ Back
              </button>
              <span className="snav-pos">
                {idx + 1} of {count}
              </span>
              <button className="snav-b" onClick={() => go(nextIdx)}>
                Next ›
              </button>
            </div>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
