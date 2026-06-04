import type { ReactNode } from "react";
import { AuthRecoveryRedirect } from "@/components/AuthRecoveryRedirect";
import { BottomNav } from "@/components/BottomNav";
import { CookieConsent } from "@/components/CookieConsent";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="app-shell">
      <AuthRecoveryRedirect />
      <main className="app-main">{children}</main>
      <BottomNav />
      <CookieConsent />
    </div>
  );
}
