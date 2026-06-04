"use client";

import { useEffect } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const recoverySessionKey = "dolar_mza_password_recovery";
const recoveryPendingKey = "dolar_mza_password_recovery_pending";
const recoveryPendingWindowMs = 2 * 60 * 60 * 1000;

function hasRecentPasswordRecoveryPending() {
  try {
    const raw = window.localStorage.getItem(recoveryPendingKey);
    if (!raw) return false;

    const parsed = JSON.parse(raw) as { createdAt?: number };
    return typeof parsed.createdAt === "number" && Date.now() - parsed.createdAt < recoveryPendingWindowMs;
  } catch {
    return false;
  }
}

function isPasswordRecoveryUrl() {
  const hash = window.location.hash.toLowerCase();
  const search = window.location.search.toLowerCase();
  const hasRecoveryType = hash.includes("type=recovery") || search.includes("type=recovery");
  const hasRecoveryToken = hash.includes("access_token") || hash.includes("refresh_token") || search.includes("code=");
  const hasRecoveryMarker =
    window.sessionStorage.getItem(recoverySessionKey) === "1" || hasRecentPasswordRecoveryPending();

  return hasRecoveryType || (hasRecoveryMarker && hasRecoveryToken);
}

function redirectToResetPassword() {
  if (window.location.pathname.startsWith("/reset-password")) return;

  const recoveryParams = `${window.location.search || ""}${window.location.hash || ""}`;
  window.sessionStorage.setItem(recoverySessionKey, "1");
  window.location.replace(`/reset-password${recoveryParams}`);
}

export function AuthRecoveryRedirect() {
  useEffect(() => {
    const supabase = createSupabaseBrowserClient();

    if (isPasswordRecoveryUrl()) {
      redirectToResetPassword();
      return;
    }

    if (!supabase) return;

    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "PASSWORD_RECOVERY") return;
      redirectToResetPassword();
    });

    return () => data.subscription.unsubscribe();
  }, []);

  return null;
}
