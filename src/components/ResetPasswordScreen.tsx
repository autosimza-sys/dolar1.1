"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, Lock } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

function getFriendlyResetError(message: string) {
  const normalized = message.toLowerCase();

  if (normalized.includes("session") || normalized.includes("token") || normalized.includes("expired")) {
    return "El enlace venció o ya fue usado. Pedí uno nuevo desde el login.";
  }

  if (normalized.includes("password")) {
    return "La contraseña debe tener al menos 6 caracteres.";
  }

  return "No pudimos guardar la nueva contraseña. Pedí otro enlace e intentá de nuevo.";
}

export function ResetPasswordScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDone, setIsDone] = useState(false);

  useEffect(() => {
    async function prepareSession() {
      if (!supabase) {
        setMessage("La conexión con Supabase no está configurada.");
        setIsReady(true);
        return;
      }

      const code = searchParams.get("code");

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          setMessage(getFriendlyResetError(error.message));
        }
      } else {
        const { data } = await supabase.auth.getSession();
        if (!data.session) {
          setMessage("Abrí esta pantalla desde el correo de recuperación para cambiar tu contraseña.");
        }
      }

      setIsReady(true);
    }

    void prepareSession();
  }, [searchParams, supabase]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    if (!supabase) {
      setMessage("La conexión con Supabase no está configurada.");
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
    setIsSaving(false);

    if (error) {
      setMessage(getFriendlyResetError(error.message));
      return;
    }

    setIsDone(true);
    setMessage("Contraseña actualizada. Ya podés entrar a tu cuenta.");
    setTimeout(() => router.push("/account"), 1600);
  }

  return (
    <div className="screen">
      <section className="page-header">
        <p className="eyebrow">Cuenta</p>
        <h1>Nueva contraseña</h1>
        <p>Elegí una contraseña segura para volver a ingresar a Dólar MZA.</p>
      </section>

      <form className="panel auth-form" onSubmit={handleSubmit}>
        {isDone ? (
          <div className="auth-state">
            <CheckCircle2 size={34} />
            <h2>Contraseña guardada</h2>
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
                  disabled={!isReady}
                  minLength={6}
                  required
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </div>
            </label>

            <label className="field">
              <span>Confirmar contraseña</span>
              <div className="field__control">
                <Lock size={18} />
                <input
                  autoComplete="new-password"
                  disabled={!isReady}
                  minLength={6}
                  required
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                />
              </div>
            </label>

            {message ? <p className="form-message">{message}</p> : null}

            <button className="button button--full" disabled={!isReady || isSaving} type="submit">
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
