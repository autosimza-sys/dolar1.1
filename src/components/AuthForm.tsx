"use client";

import { FormEvent, useState } from "react";
import { CheckCircle2, Eye, EyeOff, Lock, Mail, Phone, RotateCw, UserRound } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type AuthFormProps = {
  compact?: boolean;
  initialMode?: AuthMode;
  onSuccess?: () => void;
};

type AuthMode = "login" | "register" | "forgot";
type AuthView = "form" | "check-email" | "reset-sent";

const recoverySessionKey = "dolar_mza_password_recovery";
const recoveryPendingKey = "dolar_mza_password_recovery_pending";

function getAppUrl() {
  const configuredUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");

  if (configuredUrl) {
    return configuredUrl;
  }

  if (typeof window !== "undefined") {
    return window.location.origin;
  }

  return "https://dolarmza.com.ar";
}

function getAuthRedirectUrl(path: "/account" | "/reset-password") {
  return `${getAppUrl()}${path}`;
}

function markPasswordRecoveryPending(email: string) {
  if (typeof window === "undefined") return;

  const payload = {
    email,
    createdAt: Date.now()
  };

  window.sessionStorage.setItem(recoverySessionKey, "1");
  window.localStorage.setItem(recoveryPendingKey, JSON.stringify(payload));
}

function getReferralCodeFromCookie() {
  if (typeof document === "undefined") return null;

  const match = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("dolar_mza_ref="));

  return match ? decodeURIComponent(match.split("=")[1] ?? "").trim().toLowerCase() : null;
}

function isUnconfirmedEmailError(message: string) {
  return message.toLowerCase().includes("email not confirmed") || message.toLowerCase().includes("not confirmed");
}

function getFriendlyAuthError(message: string) {
  const normalized = message.toLowerCase();

  if (isUnconfirmedEmailError(message)) {
    return "Debes confirmar tu email antes de ingresar.";
  }

  if (normalized.includes("invalid login credentials")) {
    return "El email o la contraseña no son correctos.";
  }

  if (normalized.includes("user already registered") || normalized.includes("already registered")) {
    return "Ese email ya tiene una cuenta. Probá entrando o recuperando la contraseña.";
  }

  if (normalized.includes("password")) {
    return "La contraseña debe tener al menos 6 caracteres.";
  }

  if (normalized.includes("rate limit") || normalized.includes("too many")) {
    return "Hiciste varios intentos seguidos. Esperá unos minutos y probá de nuevo.";
  }

  return "No pudimos completar la operación. Revisá los datos e intentá de nuevo.";
}

export function AuthForm({ compact = false, initialMode = "register", onSuccess }: AuthFormProps) {
  const supabase = createSupabaseBrowserClient();
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [view, setView] = useState<AuthView>("form");
  const [email, setEmail] = useState("");
  const [pendingEmail, setPendingEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [fullName, setFullName] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  function changeMode(nextMode: AuthMode) {
    setMode(nextMode);
    setView("form");
    setMessage(null);
    setNeedsConfirmation(false);
    setPassword("");
    setShowPassword(false);
  }

  async function resendConfirmation() {
    if (!supabase) {
      setMessage("La conexión con Supabase no está configurada.");
      return;
    }

    const targetEmail = (pendingEmail || email).trim().toLowerCase();
    if (!targetEmail) {
      setMessage("Ingresá tu email para reenviar la confirmación.");
      return;
    }

    setIsResending(true);
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: targetEmail,
      options: {
        emailRedirectTo: getAuthRedirectUrl("/account")
      }
    });

    setMessage(error ? getFriendlyAuthError(error.message) : "Te reenviamos el email de confirmación. Revisá bandeja de entrada y spam.");
    setIsResending(false);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setNeedsConfirmation(false);

    if (!supabase) {
      setMessage("La conexión con Supabase no está configurada.");
      return;
    }

    const cleanEmail = email.trim().toLowerCase();
    setIsSubmitting(true);

    if (mode === "register") {
      const referralCode = getReferralCodeFromCookie();
      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          emailRedirectTo: getAuthRedirectUrl("/account"),
          data: {
            phone,
            full_name: fullName,
            referred_by_code: referralCode
          }
        }
      });

      if (error) {
        setMessage(getFriendlyAuthError(error.message));
      } else if (data.user && data.session) {
        await supabase.from("profiles").upsert({
          id: data.user.id,
          email: cleanEmail,
          phone: phone || null,
          full_name: fullName || null
        });
        setMessage("Cuenta creada. Ya podés guardar alertas.");
        onSuccess?.();
      } else {
        setPendingEmail(cleanEmail);
        setView("check-email");
      }
    }

    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email: cleanEmail, password });
      if (error) {
        setMessage(getFriendlyAuthError(error.message));
        if (isUnconfirmedEmailError(error.message)) {
          setPendingEmail(cleanEmail);
          setNeedsConfirmation(true);
        }
      } else {
        setMessage("Entraste correctamente.");
        onSuccess?.();
      }
    }

    if (mode === "forgot") {
      const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
        redirectTo: getAuthRedirectUrl("/reset-password")
      });

      if (error) {
        setMessage(getFriendlyAuthError(error.message));
      } else {
        markPasswordRecoveryPending(cleanEmail);
        setPendingEmail(cleanEmail);
        setView("reset-sent");
      }
    }

    setIsSubmitting(false);
  }

  if (view === "check-email") {
    return (
      <div className={`auth-form auth-state ${compact ? "auth-form--compact" : ""}`}>
        <CheckCircle2 size={34} />
        <h2>Revisá tu email</h2>
        <p>
          Te enviamos un correo para confirmar tu cuenta. Revisá tu bandeja de entrada o spam y hacé click en el enlace
          de confirmación para activar tu usuario.
        </p>
        <button className="button button--full" disabled={isResending} type="button" onClick={resendConfirmation}>
          <RotateCw size={17} />
          {isResending ? "Reenviando..." : "Reenviar email de confirmación"}
        </button>
        <small>Si no encontrás el correo, revisá spam o correo no deseado.</small>
        {message ? <p className="form-message">{message}</p> : null}
      </div>
    );
  }

  if (view === "reset-sent") {
    return (
      <div className={`auth-form auth-state ${compact ? "auth-form--compact" : ""}`}>
        <CheckCircle2 size={34} />
        <h2>Revisá tu email</h2>
        <p>Te enviamos un correo para crear una nueva contraseña. Revisá tu bandeja de entrada o spam.</p>
        <button className="button button--full" type="button" onClick={() => changeMode("login")}>
          Volver al login
        </button>
      </div>
    );
  }

  return (
    <form className={`auth-form ${compact ? "auth-form--compact" : ""}`} onSubmit={handleSubmit}>
      {mode === "forgot" ? (
        <div className="auth-copy">
          <h2>Recuperar contraseña</h2>
          <p>Ingresá tu email y te mandamos un enlace para crear una nueva contraseña.</p>
        </div>
      ) : (
        <div className="segmented">
          <button className={mode === "register" ? "is-active" : ""} type="button" onClick={() => changeMode("register")}>
            Crear cuenta
          </button>
          <button className={mode === "login" ? "is-active" : ""} type="button" onClick={() => changeMode("login")}>
            Entrar
          </button>
        </div>
      )}

      {mode === "register" ? (
        <label className="field">
          <span>Nombre</span>
          <div className="field__control">
            <UserRound size={18} />
            <input autoComplete="name" value={fullName} onChange={(event) => setFullName(event.target.value)} />
          </div>
        </label>
      ) : null}

      <label className="field">
        <span>Email</span>
        <div className="field__control">
          <Mail size={18} />
          <input autoComplete="email" required type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
        </div>
      </label>

      {mode !== "forgot" ? (
        <label className="field">
          <span>Contraseña</span>
          <div className="field__control">
            <Lock size={18} />
            <input
              autoComplete={mode === "register" ? "new-password" : "current-password"}
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
      ) : null}

      {mode === "register" ? (
        <label className="field">
          <span>WhatsApp opcional</span>
          <div className="field__control">
            <Phone size={18} />
            <input autoComplete="tel" value={phone} onChange={(event) => setPhone(event.target.value)} />
          </div>
        </label>
      ) : null}

      {mode === "login" ? (
        <button className="auth-link-button" type="button" onClick={() => changeMode("forgot")}>
          ¿Olvidaste tu contraseña?
        </button>
      ) : null}

      {message ? <p className="form-message">{message}</p> : null}

      {needsConfirmation ? (
        <button className="button button--ghost button--full" disabled={isResending} type="button" onClick={resendConfirmation}>
          <RotateCw size={17} />
          {isResending ? "Reenviando..." : "Reenviar email de confirmación"}
        </button>
      ) : null}

      <button className="button button--full" disabled={isSubmitting} type="submit">
        {isSubmitting
          ? "Procesando..."
          : mode === "register"
            ? "Crear cuenta gratis"
            : mode === "forgot"
              ? "Enviar instrucciones"
              : "Entrar"}
      </button>

      {mode === "forgot" ? (
        <button className="auth-link-button auth-link-button--center" type="button" onClick={() => changeMode("login")}>
          Volver al login
        </button>
      ) : null}
    </form>
  );
}
