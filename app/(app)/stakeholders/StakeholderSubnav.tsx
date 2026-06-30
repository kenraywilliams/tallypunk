"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSandbox } from "../SandboxProvider";
import { sortStakeholders, useStakeholderView } from "./view";

export default function StakeholderSubnav() {
  const pathname = usePathname();
  const { stakeholders, companies } = useSandbox();
  const { sortKey, sortDir } = useStakeholderView();

  const m = pathname.match(/^\/stakeholders\/([^/]+)(?:\/([^/]+))?/);
  const pathId = m?.[1];
  const sub = m?.[2]; // grants | vesting | history | undefined (= detail)

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

  return (
    <div className="subnav">
      <div className="subnav-in">
        {tab("List", "/stakeholders", !pathId)}
        {tab(
          "Detail",
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
        {tab(
          "History",
          targetId ? `/stakeholders/${targetId}/history` : null,
          sub === "history",
        )}
      </div>
    </div>
  );
}
