import type { ReactNode } from "react";
import { BottomNav } from "@/components/BottomNav";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="app-shell">
      <main className="app-main">{children}</main>
      <BottomNav />
    </div>
  );
}
