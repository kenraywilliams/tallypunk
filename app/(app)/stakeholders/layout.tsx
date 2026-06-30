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
      <StakeholderSubnav />
      {children}
    </StakeholderViewProvider>
  );
}
