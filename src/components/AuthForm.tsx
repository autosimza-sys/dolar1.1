"use client";

import { FormEvent, useState } from "react";
import { Lock, Mail, Phone, UserRound } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type AuthFormProps = {
  compact?: boolean;
  onSuccess?: () => void;
};

export function AuthForm({ compact = false, onSuccess }: AuthFormProps) {
  const supabase = createSupabaseBrowserClient();
  const [mode, setMode] = useState<"login" | "register">("register");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [fullName, setFullName] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    if (!supabase) {
      setMessage("Configurá Supabase para crear cuentas reales.");
      return;
    }

    setIsSubmitting(true);

    if (mode === "register") {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            phone,
            full_name: fullName
          }
        }
      });

      if (error) {
        setMessage(error.message);
      } else {
        if (data.user) {
          await supabase.from("profiles").upsert({
            id: data.user.id,
            email,
            phone: phone || null,
            full_name: fullName || null
          });
        }
        setMessage("Cuenta creada. Si Supabase pide confirmación, revisá tu email.");
        onSuccess?.();
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setMessage(error.message);
      } else {
        setMessage("Entraste correctamente.");
        onSuccess?.();
      }
    }

    setIsSubmitting(false);
  }

  return (
    <form className={`auth-form ${compact ? "auth-form--compact" : ""}`} onSubmit={handleSubmit}>
      <div className="segmented">
        <button className={mode === "register" ? "is-active" : ""} type="button" onClick={() => setMode("register")}>
          Crear cuenta
        </button>
        <button className={mode === "login" ? "is-active" : ""} type="button" onClick={() => setMode("login")}>
          Entrar
        </button>
      </div>

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

      <label className="field">
        <span>Contraseña</span>
        <div className="field__control">
          <Lock size={18} />
          <input
            autoComplete={mode === "register" ? "new-password" : "current-password"}
            minLength={6}
            required
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </div>
      </label>

      {mode === "register" ? (
        <label className="field">
          <span>WhatsApp opcional</span>
          <div className="field__control">
            <Phone size={18} />
            <input autoComplete="tel" value={phone} onChange={(event) => setPhone(event.target.value)} />
          </div>
        </label>
      ) : null}

      {message ? <p className="form-message">{message}</p> : null}

      <button className="button button--full" disabled={isSubmitting} type="submit">
        {isSubmitting ? "Procesando..." : mode === "register" ? "Crear cuenta gratis" : "Entrar"}
      </button>
    </form>
  );
}
