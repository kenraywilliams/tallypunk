import AppNav from "./AppNav";
import SandboxBar from "./SandboxBar";
import { SandboxProvider } from "./SandboxProvider";

export default function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <SandboxProvider>
      <div className="app">
        <div className="appheader">
          <SandboxBar />
          <AppNav />
        </div>
        {children}
      </div>
    </SandboxProvider>
  );
}
