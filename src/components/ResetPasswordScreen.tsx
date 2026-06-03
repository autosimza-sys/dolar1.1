"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Eye, EyeOff, Lock } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const recoverySessionKey = "dolar_mza_password_recovery";
const recoveryPendingKey = "dolar_mza_password_recovery_pending";
const recoveryWindowMs = 2 * 60 * 60 * 1000;

function getFriendlyResetError(message: string) {
  const normalized = message.toLowerCase();

  if (normalized.includes("session") || normalized.includes("token") || normalized.includes("expired")) {
    return "El enlace venció o no es válido. Volvé a solicitar la recuperación.";
  }

  if (normalized.includes("password")) {
    return "La contraseña debe tener al menos 6 caracteres.";
  }

  return "No pudimos actualizar la contraseña. Intentá nuevamente.";
}

function hasRecentRecoveryPending() {
  if (typeof window === "undefined") return false;

  try {
    const raw = window.localStorage.getItem(recoveryPendingKey);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as { createdAt?: number };
    return typeof parsed.createdAt === "number" && Date.now() - parsed.createdAt < recoveryWindowMs;
  } catch {
    return false;
  }
}

function hasRecoveryHash() {
  if (typeof window === "undefined") return false;
  const hash = window.location.hash.toLowerCase();
  return hash.includes("type=recovery") || hash.includes("access_token") || hash.includes("refresh_token");
}

function clearRecoveryMarkers() {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(recoverySessionKey);
  window.localStorage.removeItem(recoveryPendingKey);
}

export function ResetPasswordScreen() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [canReset, setCanReset] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDone, setIsDone] = useState(false);

  useEffect(() => {
    async function waitForSession() {
      if (!supabase) return false;

      for (let attempt = 0; attempt < 8; attempt += 1) {
        const { data } = await supabase.auth.getSession();
        if (data.session) return true;
        await new Promise((resolve) => setTimeout(resolve, 250));
      }

      return false;
    }

    async function prepareSession() {
      if (!supabase) {
        setMessage("La conexión con Supabase no está configurada.");
        setIsReady(true);
        return;
      }

      const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
      const code = params.get("code");
      const type = params.get("type");
      const hasSessionMarker = typeof window !== "undefined" && window.sessionStorage.getItem(recoverySessionKey) === "1";
      const hasRecoveryMarker = type === "recovery" || Boolean(code) || hasRecoveryHash() || hasSessionMarker || hasRecentRecoveryPending();

      if (!hasRecoveryMarker) {
        setMessage("Abrí esta pantalla desde el correo de recuperación para cambiar tu contraseña.");
        setCanReset(false);
        setIsReady(true);
        return;
      }

      if (typeof window !== "undefined") {
        window.sessionStorage.setItem(recoverySessionKey, "1");
      }

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          setMessage(getFriendlyResetError(error.message));
          setCanReset(false);
          setIsReady(true);
          return;
        }
      }

      const sessionReady = await waitForSession();

      if (!sessionReady) {
        setMessage("El enlace venció o no es válido. Volvé a solicitar la recuperación.");
        setCanReset(false);
        setIsReady(true);
        return;
      }

      setCanReset(true);
      setMessage(null);
      setIsReady(true);

      if (typeof window !== "undefined" && (window.location.search || window.location.hash)) {
        window.history.replaceState({}, "", "/reset-password");
      }
    }

    void prepareSession();
  }, [supabase]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    if (!supabase) {
      setMessage("La conexión con Supabase no está configurada.");
      return;
    }

    if (!canReset) {
      setMessage("El enlace venció o no es válido. Volvé a solicitar la recuperación.");
      return;
    }

    if (password.length < 6) {
      setMessage("La contraseña debe tener al menos 6 caracteres.");
      return;
    }

    if (password !== confirmPassword) {
      setMessage("Las contraseñas no coinciden.");
      return;
    }

    setIsSaving(true);
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setIsSaving(false);
      setMessage(getFriendlyResetError(error.message));
      return;
    }

    await supabase.auth.signOut();
    clearRecoveryMarkers();
    setIsSaving(false);
    setIsDone(true);
    setMessage("Tu contraseña fue actualizada correctamente.");
  }

  return (
    <div className="screen">
      <section className="page-header">
        <p className="eyebrow">Cuenta</p>
        <h1>Crear nueva contraseña</h1>
        <p>Elegí una nueva contraseña para volver a ingresar a tu cuenta.</p>
      </section>

      <form className="panel auth-form" onSubmit={handleSubmit}>
        {isDone ? (
          <div className="auth-state">
            <CheckCircle2 size={34} />
            <h2>Tu contraseña fue actualizada correctamente.</h2>
            <p>Ya podés iniciar sesión con tu nueva contraseña.</p>
            <Link className="button button--full" href="/account">
              Iniciar sesión
            </Link>
          </div>
        ) : (
          <>
            <label className="field">
              <span>Nueva contraseña</span>
              <div className="field__control">
                <Lock size={18} />
                <input
                  autoComplete="new-password"
                  disabled={!isReady || !canReset}
                  minLength={6}
                  required
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
                <button
                  aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                  className="password-toggle"
                  disabled={!isReady || !canReset}
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </label>

            <label className="field">
              <span>Repetir nueva contraseña</span>
              <div className="field__control">
                <Lock size={18} />
                <input
                  autoComplete="new-password"
                  disabled={!isReady || !canReset}
                  minLength={6}
                  required
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                />
                <button
                  aria-label={showConfirmPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                  className="password-toggle"
                  disabled={!isReady || !canReset}
                  type="button"
                  onClick={() => setShowConfirmPassword((current) => !current)}
                >
                  {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </label>

            {message ? <p className="form-message">{message}</p> : null}

            <button className="button button--full" disabled={!isReady || !canReset || isSaving} type="submit">
              {isSaving ? "Guardando..." : "Guardar nueva contraseña"}
            </button>

            <Link className="auth-link-button auth-link-button--center" href="/account">
              Volver al login
            </Link>
          </>
        )}
      </form>
    </div>
  );
}
