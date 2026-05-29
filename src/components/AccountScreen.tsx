"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Bell, Crown, LogOut, Pencil, ShieldCheck, Star, Trash2 } from "lucide-react";
import { AuthForm } from "@/components/AuthForm";
import { FlagBadge } from "@/components/FlagBadge";
import { ALERT_TYPES } from "@/lib/constants";
import { formatDateTime, formatMoney } from "@/lib/format";
import { getAdminEmails, useAccount, useRates } from "@/lib/hooks";
import type { AlertLog, UserAlert } from "@/lib/types";

function alertLabel(alert: UserAlert) {
  return ALERT_TYPES.find((type) => type.value === alert.condition_type)?.label ?? alert.condition_type;
}

function spreadLabel(buy: number | null, sell: number | null) {
  if (buy === null || sell === null) return "Spread sin datos";
  return `Spread ${formatMoney(sell - buy, true)}`;
}

function subscriptionLabel(plan?: string, status?: string, isPremium?: boolean) {
  if (status !== "active" && !isPremium) return "Gratis";
  if (plan === "essential_monthly") return "Esencial";
  if (plan === "tracking_monthly") return "Seguimiento";
  if (plan === "premium_monthly" || isPremium) return "Premium";
  return "Gratis";
}

function parseAdminEmails(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item).trim().toLowerCase()).filter(Boolean);
}

export function AccountScreen() {
  const account = useAccount();
  const { data: rates } = useRates();
  const [logs, setLogs] = useState<AlertLog[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const planLabel = subscriptionLabel(account.subscription?.plan, account.subscription?.status, account.isPremium);
  const adminEmails = useMemo(() => getAdminEmails(), []);

  const favoriteCodes = useMemo(() => new Set(account.favorites.map((favorite) => favorite.rate_code)), [account.favorites]);

  useEffect(() => {
    async function loadLogs() {
      if (!account.supabase || !account.user) {
        setLogs([]);
        return;
      }

      const { data } = await account.supabase
        .from("alert_logs")
        .select("*")
        .eq("user_id", account.user.id)
        .order("sent_at", { ascending: false })
        .limit(10);
      setLogs((data as AlertLog[] | null) ?? []);
    }

    void loadLogs();
  }, [account.supabase, account.user]);

  useEffect(() => {
    async function checkAdminAccess() {
      const email = account.user?.email?.toLowerCase() ?? "";

      if (!email) {
        setIsAdmin(false);
        return;
      }

      if (adminEmails.includes(email)) {
        setIsAdmin(true);
        return;
      }

      if (!account.supabase) {
        setIsAdmin(false);
        return;
      }

      const { data } = await account.supabase
        .from("admin_settings")
        .select("value")
        .eq("key", "admin_emails")
        .maybeSingle();

      setIsAdmin(parseAdminEmails(data?.value).includes(email));
    }

    void checkAdminAccess();
  }, [account.supabase, account.user, adminEmails]);

  async function signOut() {
    if (!account.supabase) return;
    await account.supabase.auth.signOut();
    await account.reload();
  }

  async function updateAlert(alert: UserAlert, event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!account.supabase) return;

    const formData = new FormData(event.currentTarget);
    const { error } = await account.supabase
      .from("alerts")
      .update({
        target_value: Number(formData.get("target_value")),
        is_active: formData.get("is_active") === "on"
      })
      .eq("id", alert.id);

    setMessage(error ? error.message : "Alerta actualizada.");
    await account.reload();
  }

  async function deleteAlert(alertId: string) {
    if (!account.supabase) return;
    const { error } = await account.supabase.from("alerts").delete().eq("id", alertId);
    setMessage(error ? error.message : "Alerta eliminada.");
    await account.reload();
  }

  async function toggleFavorite(rateCode: string) {
    if (!account.supabase || !account.user) return;

    const existing = account.favorites.find((favorite) => favorite.rate_code === rateCode);
    if (existing) {
      await account.supabase.from("favorite_rates").delete().eq("id", existing.id);
    } else {
      await account.supabase.from("favorite_rates").insert({ user_id: account.user.id, rate_code: rateCode });
    }
    await account.reload();
  }

  if (account.isLoading) {
    return (
      <div className="screen">
        <p className="loading-line">Cargando cuenta...</p>
      </div>
    );
  }

  if (!account.user) {
    return (
      <div className="screen">
        <section className="page-header">
          <p className="eyebrow">Cuenta</p>
          <h1>Guardá tus alertas</h1>
          <p>Creá tu cuenta gratis para activar una alerta y probar la app.</p>
        </section>
        <div className="panel">
          <AuthForm onSuccess={account.reload} />
        </div>
      </div>
    );
  }

  return (
    <div className="screen">
      <section className="account-top">
        <div>
          <p className="eyebrow">Cuenta</p>
          <h1>{account.profile?.full_name || account.user.email}</h1>
          <span className={planLabel !== "Gratis" ? "status status--premium" : "status"}>{planLabel}</span>
        </div>
        <button className="icon-button" aria-label="Salir" type="button" onClick={signOut}>
          <LogOut size={20} />
        </button>
      </section>

      {message ? <p className="notice">{message}</p> : null}

      {isAdmin ? (
        <section className="admin-access-strip">
          <div>
            <strong>Administracion</strong>
            <span>Panel privado para cotizaciones, fuentes y comunidad.</span>
          </div>
          <Link className="button button--ghost" href="/admin">
            <ShieldCheck size={17} />
            Panel admin
          </Link>
        </section>
      ) : null}

      <section className="section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Mis alertas activas</p>
            <h2>Lo que estamos mirando</h2>
          </div>
          <Link className="text-link" href="/alerts">
            <Bell size={16} />
            Nueva
          </Link>
        </div>

        <div className="card-list">
          {account.alerts.length ? (
            account.alerts.map((alert) => (
              <form className="account-alert" key={alert.id} onSubmit={(event) => updateAlert(alert, event)}>
                <div>
                  <span>{alert.rate_code}</span>
                  <strong>{alertLabel(alert)}</strong>
                  <small>
                    {alert.channel} · {formatDateTime(alert.created_at)}
                  </small>
                </div>
                <label className="field field--tight">
                  <span>Valor</span>
                  <input defaultValue={alert.target_value} name="target_value" type="number" step="0.01" />
                </label>
                <label className="toggle-line">
                  <input defaultChecked={alert.is_active} name="is_active" type="checkbox" />
                  Activa
                </label>
                <div className="button-row">
                  <button className="button button--ghost" type="submit">
                    <Pencil size={16} />
                    Guardar
                  </button>
                  <button className="button button--danger" type="button" onClick={() => deleteAlert(alert.id)}>
                    <Trash2 size={16} />
                    Eliminar
                  </button>
                </div>
              </form>
            ))
          ) : (
            <div className="empty-state">Todavía no tenés alertas activas.</div>
          )}
        </div>
      </section>

      <section className="section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Favoritas</p>
            <h2>Monedas rápidas</h2>
          </div>
        </div>
        <div className="favorites-grid">
          {rates
            .filter((rate) => rate.type !== "indicator")
            .map((rate) => (
              <button
                className={`favorite-button ${favoriteCodes.has(rate.code) ? "is-selected" : ""}`}
                key={rate.code}
                type="button"
                onClick={() => toggleFavorite(rate.code)}
              >
                <span className="favorite-button__top">
                  <FlagBadge compact rate={rate} />
                  <span>
                    <strong>{rate.name}</strong>
                    <small>{rate.country}</small>
                  </span>
                  <Star size={17} />
                </span>
                <span className="favorite-quotes">
                  <span>
                    <em>Compra</em>
                    <b>{formatMoney(rate.buy_price, true)}</b>
                  </span>
                  <span>
                    <em>Venta</em>
                    <b>{formatMoney(rate.sell_price, true)}</b>
                  </span>
                </span>
                <small className="spread-line">{spreadLabel(rate.buy_price, rate.sell_price)}</small>
              </button>
            ))}
        </div>
      </section>

      <section className="section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Historial</p>
            <h2>Alertas recibidas</h2>
          </div>
        </div>
        <div className="timeline">
          {logs.length ? (
            logs.map((log) => (
              <article key={log.id}>
                <strong>{log.message}</strong>
                <span>{formatDateTime(log.sent_at)}</span>
              </article>
            ))
          ) : (
            <div className="empty-state">Cuando se dispare una alerta, aparece acá.</div>
          )}
        </div>
      </section>

      <section className="premium-strip">
        <p>Estado de suscripción: {planLabel}</p>
        <Link className="button button--premium" href="/premium">
          <Crown size={17} />
          Premium
        </Link>
      </section>
    </div>
  );
}
