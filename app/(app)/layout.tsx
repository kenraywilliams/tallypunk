import AppNav from "./AppNav";
import { SandboxProvider } from "./SandboxProvider";

export default function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <SandboxProvider>
      <div className="app">
        <AppNav />
        {children}
      </div>
    </SandboxProvider>
  );
}
