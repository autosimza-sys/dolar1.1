"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Bell, BookOpen, Crown, Gift, LifeBuoy, LogOut, MessageCircle, Send, ShieldCheck, Star } from "lucide-react";
import { AuthForm } from "@/components/AuthForm";
import { FlagBadge } from "@/components/FlagBadge";
import { commercialPlans } from "@/lib/commercial";
import { ALERT_TYPES } from "@/lib/constants";
import { formatDateTime, formatMoney } from "@/lib/format";
import { getAdminEmails, useAccount, useEducationCards, useRates } from "@/lib/hooks";
import type { Rate, ReferralSummary, UserAlert } from "@/lib/types";

const supportReasons = ["Problema con mi cuenta", "Problema con contrasena", "Problema con alertas", "Problema con pago", "Otro"];

function alertLabel(alert: UserAlert) {
  return ALERT_TYPES.find((type) => type.value === alert.condition_type)?.label ?? alert.condition_type;
}

function alertTargetLabel(alert: UserAlert) {
  const type = ALERT_TYPES.find((item) => item.value === alert.condition_type);

  if (type?.targetSuffix === "hora") return "";
  if (type?.targetSuffix === "%") return `${alert.target_value}%`;
  return formatMoney(alert.target_value, true);
}

function accountAlertTitle(alert: UserAlert, rate?: Rate) {
  const name = rate?.name ?? alert.rate_code;
  const target = alertTargetLabel(alert);

  if (alert.condition_type === "above") return `${name} > ${target}`;
  if (alert.condition_type === "below" || alert.condition_type === "mep_below") return `${name} < ${target}`;
  if (target) return `${alertLabel(alert)} ${target}`;
  return alertLabel(alert);
}

function subscriptionLabel(plan?: string, status?: string, isPremium?: boolean) {
  if (status === "trial") return "Prueba gratis";
  if (status === "grace") return "Periodo de gracia";
  if (status !== "active" && !isPremium) return "Gratis";
  if (plan === "essential_monthly") return "Esencial";
  if (plan === "tracking_monthly") return "Seguimiento";
  if (plan === "premium_monthly" || isPremium) return "Premium WhatsApp";
  return "Gratis";
}

function accountStatusLabel(emailConfirmedAt?: string | null) {
  return emailConfirmedAt ? "Email confirmado" : "Email pendiente";
}

function nextExpirationLabel(expiresAt?: string | null) {
  return expiresAt ? formatDateTime(expiresAt) : "Sin vencimiento";
}

function parseAdminEmails(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item).trim().toLowerCase()).filter(Boolean);
}

export function AccountScreen() {
  const account = useAccount();
  const { data: rates } = useRates();
  const education = useEducationCards();
  const [message, setMessage] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [referralSummary, setReferralSummary] = useState<ReferralSummary | null>(null);
  const [referralError, setReferralError] = useState<string | null>(null);
  const [supportOpen, setSupportOpen] = useState(false);
  const [isSendingSupport, setIsSendingSupport] = useState(false);
  const [supportStatus, setSupportStatus] = useState<string | null>(null);
  const [supportForm, setSupportForm] = useState({
    name: "",
    email: "",
    reason: supportReasons[0],
    message: ""
  });
  const planLabel = subscriptionLabel(account.subscription?.plan, account.subscription?.status, account.isPremium);
  const hasAlertPlan = Boolean(account.isPremium || account.subscription?.status === "active");
  const adminEmails = useMemo(() => getAdminEmails(), []);

  const rateByCode = useMemo(() => new Map(rates.map((rate) => [rate.code, rate])), [rates]);
  const activeAlerts = useMemo(() => account.alerts.filter((alert) => alert.is_active), [account.alerts]);
  const latestAlerts = useMemo(() => account.alerts.slice(0, 3), [account.alerts]);
  const favoriteRates = useMemo(
    () =>
      account.favorites
        .map((favorite) => rateByCode.get(favorite.rate_code))
        .filter((rate): rate is Rate => Boolean(rate))
        .slice(0, 4),
    [account.favorites, rateByCode]
  );
  const recommendedArticle = education.data[0];

  useEffect(() => {
    if (!account.user || typeof window === "undefined") return;

    const key = `dolar_mza_login_tracked_${account.user.id}`;
    if (window.sessionStorage.getItem(key) === "1") return;

    window.sessionStorage.setItem(key, "1");
    void fetch("/api/referrals/track-login", { method: "POST" });
  }, [account.user]);

  useEffect(() => {
    async function loadReferralSummary() {
      if (!account.user) {
        setReferralSummary(null);
        return;
      }

      const response = await fetch("/api/referrals/summary");
      const payload = (await response.json().catch(() => ({}))) as ReferralSummary & { error?: string };

      if (!response.ok) {
        setReferralSummary(null);
        setReferralError(payload.error ?? "Referidos pendiente de configuracion.");
        return;
      }

      setReferralError(null);
      setReferralSummary(payload);
    }

    void loadReferralSummary();
  }, [account.user]);

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

  useEffect(() => {
    if (!account.user) return;

    setSupportForm((current) => ({
      ...current,
      name: current.name || account.profile?.full_name || "",
      email: current.email || account.user?.email || ""
    }));
  }, [account.profile?.full_name, account.user]);

  async function signOut() {
    if (!account.supabase) return;
    await account.supabase.auth.signOut();
    await account.reload();
  }

  async function copyReferralLink() {
    if (!referralSummary?.referral_link) return;

    await navigator.clipboard.writeText(referralSummary.referral_link);
    setMessage("Link de referido copiado.");
  }

  function whatsappReferralLink() {
    const link = referralSummary?.referral_link ?? "";
    const text = `Te invito a Dolar MZA. Cotizaciones, educacion financiera y alertas para estar un paso antes: ${link}`;
    return `https://wa.me/?text=${encodeURIComponent(text)}`;
  }

  async function sendSupportMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSupportStatus(null);

    if (!supportForm.name.trim()) {
      setSupportStatus("Ingresa tu nombre.");
      return;
    }

    if (!supportForm.email.trim()) {
      setSupportStatus("Ingresa tu email.");
      return;
    }

    if (supportForm.message.trim().length < 8) {
      setSupportStatus("Contanos un poco mas para poder ayudarte.");
      return;
    }

    setIsSendingSupport(true);
    const response = await fetch("/api/support/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(supportForm)
    });
    const payload = (await response.json().catch(() => ({}))) as { error?: string };

    setIsSendingSupport(false);

    if (!response.ok) {
      setSupportStatus(payload.error ?? "No se pudo enviar el mensaje. Proba nuevamente.");
      return;
    }

    setSupportStatus("Mensaje enviado correctamente.");
    setSupportForm((current) => ({ ...current, message: "" }));
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
          <h1>Creá tu panel financiero</h1>
          <p>Registrate gratis para ver cotizaciones completas, guardar favoritas y personalizar tu experiencia.</p>
        </section>
        <div className="panel">
          <AuthForm onSuccess={account.reload} />
        </div>
      </div>
    );
  }

  return (
    <div className="screen screen--account">
      <section className="account-panel account-profile-card">
        <div className="account-panel__head">
          <div>
            <p className="eyebrow">Mi panel financiero</p>
            <h1>{account.profile?.full_name || "Mi cuenta"}</h1>
            <span className="account-profile-email">{account.user.email}</span>
          </div>
          <button className="icon-button" aria-label="Salir" type="button" onClick={signOut}>
            <LogOut size={20} />
          </button>
        </div>

        <div className="account-meta-grid">
          <article>
            <span>Plan actual</span>
            <strong>{planLabel}</strong>
          </article>
          <article>
            <span>Estado</span>
            <strong>{accountStatusLabel(account.user.email_confirmed_at)}</strong>
          </article>
          <article>
            <span>Proximo vencimiento</span>
            <strong>{nextExpirationLabel(account.subscription?.expires_at)}</strong>
          </article>
        </div>

      </section>

      {message ? <p className="notice account-notice">{message}</p> : null}

      {isAdmin ? (
        <section className="admin-access-strip account-admin-strip">
          <div>
            <strong>Administracion</strong>
            <span>Panel privado para gestionar la app.</span>
          </div>
          <Link className="button button--ghost" href="/admin">
            <ShieldCheck size={17} />
            Panel admin
          </Link>
        </section>
      ) : null}

      <section className="account-panel account-alerts-panel">
        <div className="account-panel__head">
          <div>
            <p className="eyebrow">Mis alertas</p>
            <h2>{hasAlertPlan ? `${activeAlerts.length} activas` : "Seguimiento automático"}</h2>
          </div>
          <Bell size={22} />
        </div>

        {hasAlertPlan ? (
          <>
            <div className="account-summary-list">
              {latestAlerts.length ? (
                latestAlerts.map((alert) => (
                  <article key={alert.id}>
                    <Bell size={16} />
                    <div>
                      <strong>{accountAlertTitle(alert, rateByCode.get(alert.rate_code))}</strong>
                      <span>{alert.is_active ? "Activa" : "Pausada"}</span>
                    </div>
                  </article>
                ))
              ) : (
                <div className="empty-state">Todavía no tenés alertas configuradas.</div>
              )}
            </div>

            <div className="account-actions">
              <Link className="button" href="/alerts">
                Nueva alerta
              </Link>
              <Link className="button button--ghost" href="/alerts">
                Ver todas
              </Link>
            </div>
          </>
        ) : (
          <div className="account-alert-upgrade">
            <p>Activá alertas para que Dólar MZA te avise cuando el mercado se mueva.</p>
            <Link className="button" href="/premium">
              Ver planes
            </Link>
          </div>
        )}
      </section>

      <section className="account-panel account-favorites-panel">
        <div className="account-panel__head">
          <div>
            <p className="eyebrow">Mis favoritos</p>
            <h2>Mis cotizaciones favoritas</h2>
          </div>
          <Star size={22} />
        </div>

        <div className="account-favorites-list">
          {favoriteRates.length ? (
            favoriteRates.map((rate) => (
              <article className="account-favorite-row" key={rate.code}>
                <FlagBadge compact rate={rate} />
                <div>
                  <strong>{rate.name}</strong>
                  <span>
                    {formatMoney(rate.buy_price, true)} / {formatMoney(rate.sell_price, true)}
                  </span>
                </div>
              </article>
            ))
          ) : (
            <div className="empty-state">Todavia no elegiste monedas favoritas.</div>
          )}
        </div>

        <div className="account-actions">
          <Link className="button" href="/#cotizaciones">
            Agregar favoritas
          </Link>
          <Link className="button button--ghost" href="/#cotizaciones">
            Ver cotizaciones
          </Link>
        </div>
      </section>

      <section className="account-panel account-education-panel">
        <div className="account-panel__head">
          <div>
            <p className="eyebrow">Aprender</p>
            <h2>Artículos recomendados</h2>
          </div>
          <BookOpen size={22} />
        </div>

        <article className="account-education-card">
          <strong>{recommendedArticle?.title ?? "Que es la brecha cambiaria"}</strong>
          <span>{recommendedArticle?.content ?? "Una guia simple para entender la diferencia entre el dolar oficial y el blue."}</span>
          <Link className="button button--ghost" href="/learn">
            Seguir aprendiendo
          </Link>
        </article>
      </section>

      <section className="account-panel account-referral-compact">
        <div className="account-panel__head">
          <div>
            <p className="eyebrow">Referidos y beneficios</p>
            <h2>Compartí Dólar MZA</h2>
          </div>
          <Gift size={22} />
        </div>

        {referralSummary ? (
          <>
            <div className="account-referral-link">
              <span>Tu link personal</span>
              <strong>{referralSummary.referral_link}</strong>
            </div>
            <div className="account-meta-grid account-meta-grid--two">
              <article>
                <span>Descuento acumulado</span>
                <strong>{formatMoney(referralSummary.credit_available, true)}</strong>
              </article>
              <article>
                <span>Puntos acumulados</span>
                <strong>{referralSummary.points_active}</strong>
              </article>
            </div>
            <div className="account-actions account-actions--single">
              <button className="button button--ghost" type="button" onClick={copyReferralLink}>
                Copiar link
              </button>
              <a className="button" href={whatsappReferralLink()} target="_blank" rel="noreferrer">
                <MessageCircle size={17} />
                Compartir
              </a>
            </div>
          </>
        ) : (
          <div className="empty-state">{referralError ?? "Preparando tu link de referido..."}</div>
        )}
      </section>

      <section className="account-panel account-upgrade-panel">
        <div className="account-panel__head">
          <div>
            <p className="eyebrow">Desbloqueá seguimiento</p>
            <h2>Alertas y planes</h2>
          </div>
          <Crown size={22} />
        </div>
        <p className="account-upgrade-copy">Elegí un plan cuando quieras que Dólar MZA siga el mercado por vos.</p>
        <div className="account-plan-grid">
          {Object.values(commercialPlans).map((plan) => (
            <article className={plan.tone === "featured" ? "is-featured" : ""} key={plan.id}>
              <span>{plan.tag}</span>
              <strong>{plan.name}</strong>
              <b>{plan.priceLabel}</b>
            </article>
          ))}
        </div>
        <Link className="button button--ghost button--full" href="/premium">
          Ver detalle de planes
        </Link>
      </section>

      <section className="account-panel support-panel account-support-panel">
        <div className="account-panel__head">
          <div>
            <p className="eyebrow">Soporte</p>
            <h2>Necesitas ayuda?</h2>
          </div>
          <LifeBuoy size={22} />
        </div>

        <button className="button button--ghost button--full" type="button" onClick={() => setSupportOpen((current) => !current)}>
          <LifeBuoy size={17} />
          {supportOpen ? "Cerrar soporte" : "Contactar soporte"}
        </button>

        {supportOpen ? (
          <form className="support-form" onSubmit={sendSupportMessage}>
            <label className="field">
              <span>Nombre</span>
              <input
                value={supportForm.name}
                onChange={(event) => setSupportForm((current) => ({ ...current, name: event.target.value }))}
              />
            </label>
            <label className="field">
              <span>Email</span>
              <input
                autoComplete="email"
                type="email"
                value={supportForm.email}
                onChange={(event) => setSupportForm((current) => ({ ...current, email: event.target.value }))}
              />
            </label>
            <label className="field">
              <span>Motivo</span>
              <select
                value={supportForm.reason}
                onChange={(event) => setSupportForm((current) => ({ ...current, reason: event.target.value }))}
              >
                {supportReasons.map((reason) => (
                  <option key={reason} value={reason}>
                    {reason}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Mensaje</span>
              <textarea
                rows={4}
                value={supportForm.message}
                onChange={(event) => setSupportForm((current) => ({ ...current, message: event.target.value }))}
              />
            </label>
            {supportStatus ? <p className="form-message">{supportStatus}</p> : null}
            <button className="button button--full" disabled={isSendingSupport} type="submit">
              <Send size={17} />
              {isSendingSupport ? "Enviando..." : "Enviar mensaje"}
            </button>
          </form>
        ) : null}
      </section>
    </div>
  );
}
