"use client";

import StakeholderSubnav from "./StakeholderSubnav";
import { StakeholderViewProvider } from "./view";

export default function StakeholdersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <StakeholderViewProvider>
      <div className="stk-shell">
        <StakeholderSubnav />
        <div className="stk-main">{children}</div>
      </div>
    </StakeholderViewProvider>
  );
}
