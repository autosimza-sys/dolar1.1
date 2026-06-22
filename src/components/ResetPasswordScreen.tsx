"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Eye, EyeOff, LoaderCircle, Lock, Mail, RotateCw } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const recoverySessionKey = "dolar_mza_password_recovery";
const recoveryPendingKey = "dolar_mza_password_recovery_pending";
const recoveryWindowMs = 2 * 60 * 60 * 1000;

type ResetView = "checking" | "form" | "new-link" | "done";

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

function getResetRedirectUrl() {
  const configuredUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");

  if (configuredUrl) return `${configuredUrl}/reset-password`;
  if (typeof window !== "undefined") return `${window.location.origin}/reset-password`;
  return "https://dolarmza.com.ar/reset-password";
}

function expiredLinkMessage() {
  return "El enlace de recuperación venció o ya fue usado. Volvé a solicitar un nuevo correo para cambiar tu contraseña.";
}

function hasResetLinkError(params: URLSearchParams) {
  const error = `${params.get("error") ?? ""} ${params.get("error_code") ?? ""} ${params.get("error_description") ?? ""}`.toLowerCase();
  return Boolean(error.trim()) && (error.includes("expired") || error.includes("invalid") || error.includes("access_denied"));
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
  const [view, setView] = useState<ResetView>("checking");
  const [recoveryEmail, setRecoveryEmail] = useState("");
  const [isRequestingLink, setIsRequestingLink] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!supabase) {
      setMessage("La conexión con Supabase no está configurada.");
      setView("new-link");
      return;
    }

    const client = supabase;
    let cancelled = false;
    let recoveryActivated = false;

    function showResetForm() {
      if (cancelled) return;
      recoveryActivated = true;
      window.sessionStorage.setItem(recoverySessionKey, "1");
      setMessage(null);
      setView("form");

      if (window.location.search || window.location.hash) {
        window.history.replaceState({}, "", "/reset-password");
      }
    }

    function showNewLink(nextMessage: string) {
      if (cancelled || recoveryActivated) return;
      setMessage(nextMessage);
      setView("new-link");
    }

    const { data } = client.auth.onAuthStateChange((event, session) => {
      if ((event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") && session) {
        showResetForm();
      }
    });

    async function prepareSession() {
      const params = new URLSearchParams(window.location.search);
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const code = params.get("code");
      const type = params.get("type") ?? hashParams.get("type");
      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");
      const hasCallbackData = type === "recovery" || Boolean(code) || Boolean(accessToken && refreshToken);
      const hasSessionMarker = window.sessionStorage.getItem(recoverySessionKey) === "1";
      const hasRecoveryMarker = hasCallbackData || hasSessionMarker || hasRecentRecoveryPending();

      if (hasResetLinkError(params) || hasResetLinkError(hashParams)) {
        showNewLink(expiredLinkMessage());
        return;
      }

      if (hasRecoveryMarker) {
        window.sessionStorage.setItem(recoverySessionKey, "1");
      }

      // Supabase puede haber creado la sesión antes de que esta pantalla cargue.
      const initialSession = await client.auth.getSession();
      if (initialSession.data.session) {
        showResetForm();
        return;
      }

      if (code) {
        const exchanged = await client.auth.exchangeCodeForSession(code);
        if (!exchanged.error && exchanged.data.session) {
          showResetForm();
          return;
        }

        // Evita rechazar un código que otro cliente de Supabase canjeó en paralelo.
        const sessionAfterExchange = await client.auth.getSession();
        if (sessionAfterExchange.data.session) {
          showResetForm();
          return;
        }
      }

      if (accessToken && refreshToken) {
        const sessionFromHash = await client.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken
        });

        if (!sessionFromHash.error && sessionFromHash.data.session) {
          showResetForm();
          return;
        }
      }

      // Da tiempo al evento PASSWORD_RECOVERY para completar la sesión.
      for (let attempt = 0; attempt < 12; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 250));
        if (cancelled || recoveryActivated) return;

        const sessionResult = await client.auth.getSession();
        if (sessionResult.data.session) {
          showResetForm();
          return;
        }
      }

      showNewLink(
        hasRecoveryMarker
          ? expiredLinkMessage()
          : "Abrí esta pantalla desde el correo de recuperación para cambiar tu contraseña."
      );
    }

    void prepareSession();

    return () => {
      cancelled = true;
      data.subscription.unsubscribe();
    };
  }, [supabase]);

  async function requestNewRecoveryLink() {
    setMessage(null);

    if (!supabase) {
      setMessage("La conexión con Supabase no está configurada.");
      return;
    }

    const cleanEmail = recoveryEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setMessage("Ingresá el email de tu cuenta.");
      return;
    }

    setIsRequestingLink(true);
    const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
      redirectTo: getResetRedirectUrl()
    });
    setIsRequestingLink(false);

    if (error) {
      setMessage(getFriendlyResetError(error.message));
      return;
    }

    window.sessionStorage.setItem(recoverySessionKey, "1");
    window.localStorage.setItem(
      recoveryPendingKey,
      JSON.stringify({
        email: cleanEmail,
        createdAt: Date.now()
      })
    );

    setMessage("Te enviamos un nuevo correo para restablecer tu contraseña. Revisá tu bandeja de entrada o spam.");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    if (!supabase) {
      setMessage("La conexión con Supabase no está configurada.");
      return;
    }

    if (view !== "form") {
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
    setView("done");
    setMessage("Tu contraseña fue actualizada correctamente.");
  }

  return (
    <div className="screen">
      <section className="page-header">
        <p className="eyebrow">Cuenta</p>
        <h1>Crear nueva contraseña</h1>
        <p>Elegí una contraseña segura para volver a ingresar a Dólar MZA.</p>
      </section>

      <form className="panel auth-form" onSubmit={handleSubmit}>
        {view === "checking" ? (
          <div className="auth-state">
            <LoaderCircle size={34} />
            <h2>Verificando el enlace...</h2>
            <p>Esperá un momento mientras preparamos el cambio de contraseña.</p>
          </div>
        ) : view === "done" ? (
          <div className="auth-state">
            <CheckCircle2 size={34} />
            <h2>Tu contraseña fue actualizada correctamente.</h2>
            <p>Ya podés iniciar sesión con tu nueva contraseña.</p>
            <Link className="button button--full" href="/account">
              Iniciar sesión
            </Link>
          </div>
        ) : view === "new-link" ? (
          <div className="auth-state">
            <RotateCw size={34} />
            <h2>Solicitar nuevo enlace</h2>
            {message ? <p className="form-message">{message}</p> : null}
            <label className="field">
              <span>Email de tu cuenta</span>
              <div className="field__control">
                <Mail size={18} />
                <input
                  autoComplete="email"
                  type="email"
                  value={recoveryEmail}
                  onChange={(event) => setRecoveryEmail(event.target.value)}
                />
              </div>
            </label>
            <button className="button button--full" disabled={isRequestingLink} type="button" onClick={requestNewRecoveryLink}>
              <RotateCw size={17} />
              {isRequestingLink ? "Enviando..." : "Solicitar nuevo enlace"}
            </button>
            <Link className="auth-link-button auth-link-button--center" href="/account">
              Volver al login
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
                  minLength={6}
                  required
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
                <button
                  aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                  className="password-toggle"
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
                  minLength={6}
                  required
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                />
                <button
                  aria-label={showConfirmPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                  className="password-toggle"
                  type="button"
                  onClick={() => setShowConfirmPassword((current) => !current)}
                >
                  {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </label>

            {message ? <p className="form-message">{message}</p> : null}

            <button className="button button--full" disabled={isSaving} type="submit">
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
