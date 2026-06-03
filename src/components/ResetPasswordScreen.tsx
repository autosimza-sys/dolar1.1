"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, Lock } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const recoveryStorageKey = "dolar_mza_password_recovery";

function getFriendlyResetError(message: string) {
  const normalized = message.toLowerCase();

  if (normalized.includes("session") || normalized.includes("token") || normalized.includes("expired")) {
    return "El enlace vencio o no es valido. Volve a solicitar la recuperacion de contrasenia.";
  }

  if (normalized.includes("password")) {
    return "La contrasenia debe tener al menos 6 caracteres.";
  }

  return "No pudimos guardar la nueva contrasenia. Pedi otro enlace e intenta de nuevo.";
}

function hasRecoveryHash() {
  if (typeof window === "undefined") return false;
  const hash = window.location.hash.toLowerCase();
  return hash.includes("type=recovery") || hash.includes("access_token") || hash.includes("refresh_token");
}

export function ResetPasswordScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [canReset, setCanReset] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDone, setIsDone] = useState(false);

  useEffect(() => {
    async function waitForSession() {
      if (!supabase) return false;

      for (let attempt = 0; attempt < 6; attempt += 1) {
        const { data } = await supabase.auth.getSession();
        if (data.session) return true;
        await new Promise((resolve) => setTimeout(resolve, 250));
      }

      return false;
    }

    async function prepareSession() {
      if (!supabase) {
        setMessage("La conexion con Supabase no esta configurada.");
        setIsReady(true);
        return;
      }

      const code = searchParams.get("code");
      const type = searchParams.get("type");
      const hasRecoveryMarker =
        type === "recovery" ||
        Boolean(code) ||
        hasRecoveryHash() ||
        (typeof window !== "undefined" && window.sessionStorage.getItem(recoveryStorageKey) === "1");

      if (hasRecoveryMarker && typeof window !== "undefined") {
        window.sessionStorage.setItem(recoveryStorageKey, "1");
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
        setMessage(
          hasRecoveryMarker
            ? "El enlace vencio o no es valido. Volve a solicitar la recuperacion de contrasenia."
            : "Abri esta pantalla desde el correo de recuperacion para cambiar tu contrasenia."
        );
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
  }, [searchParams, supabase]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    if (!supabase) {
      setMessage("La conexion con Supabase no esta configurada.");
      return;
    }

    if (!canReset) {
      setMessage("El enlace vencio o no es valido. Volve a solicitar la recuperacion de contrasenia.");
      return;
    }

    if (password.length < 6) {
      setMessage("La contrasenia debe tener al menos 6 caracteres.");
      return;
    }

    if (password !== confirmPassword) {
      setMessage("Las contrasenias no coinciden.");
      return;
    }

    setIsSaving(true);
    const { error } = await supabase.auth.updateUser({ password });
    setIsSaving(false);

    if (error) {
      setMessage(getFriendlyResetError(error.message));
      return;
    }

    if (typeof window !== "undefined") {
      window.sessionStorage.removeItem(recoveryStorageKey);
    }

    setIsDone(true);
    setMessage("Tu contrasenia fue actualizada correctamente.");
    setTimeout(() => router.push("/account"), 1600);
  }

  return (
    <div className="screen">
      <section className="page-header">
        <p className="eyebrow">Cuenta</p>
        <h1>Crear nueva contraseña</h1>
        <p>Elegí una contraseña segura para volver a ingresar a Dólar MZA.</p>
      </section>

      <form className="panel auth-form" onSubmit={handleSubmit}>
        {isDone ? (
          <div className="auth-state">
            <CheckCircle2 size={34} />
            <h2>Tu contraseña fue actualizada correctamente.</h2>
            <p>Te estamos llevando a tu cuenta.</p>
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
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
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
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                />
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
