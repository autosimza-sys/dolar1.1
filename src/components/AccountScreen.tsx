"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity,
  Bell,
  BookOpen,
  Briefcase,
  Check,
  DollarSign,
  Gift,
  LifeBuoy,
  LogOut,
  MessageCircle,
  Plane,
  Send,
  Settings,
  ShieldCheck,
  Star,
  TrendingUp,
  X
} from "lucide-react";
import { AuthForm } from "@/components/AuthForm";
import { FlagBadge } from "@/components/FlagBadge";
import { ALERT_TYPES } from "@/lib/constants";
import { formatDateTime, formatMoney, formatPercent, shortNumber } from "@/lib/format";
import { getAdminEmails, useAccount, useEducationCards, useRates } from "@/lib/hooks";
import { getRateDisplayName } from "@/lib/rate-presentation";
import type { Rate, ReferralSummary, UserAlert } from "@/lib/types";

const supportReasons = ["Problema con mi cuenta", "Problema con contrasena", "Problema con alertas", "Problema con pago", "Otro"];

const favoriteProfiles = [
  {
    id: "save",
    label: "Ahorrar dólares",
    description: "Referencias útiles para ahorro y compra de dólares.",
    codes: ["USD_BLUE_PROMEDIO_MENDOZA", "USD_BLUE_MENDOZA", "USD_MEP"],
    icon: DollarSign
  },
  {
    id: "travel",
    label: "Viajar",
    description: "Monedas para planificar viajes y gastos afuera.",
    codes: ["USD_BLUE", "EUR_BLUE", "BRL_BLUE", "CLP_BLUE"],
    icon: Plane
  },
  {
    id: "invest",
    label: "Invertir",
    description: "Mercados financieros e indicadores para comparar.",
    codes: ["USD_MEP", "USD_CCL", "COUNTRY_RISK", "USD_BLUE_PROMEDIO_MENDOZA"],
    icon: TrendingUp
  },
  {
    id: "trade",
    label: "Comercio exterior",
    description: "Referencias oficiales y financieras para operar.",
    codes: ["USD_OFICIAL", "USD_CCL", "USD_MEP", "EUR_OFICIAL"],
    icon: Briefcase
  },
  {
    id: "market",
    label: "Solo seguir el mercado",
    description: "Una vista equilibrada del mercado nacional y mendocino.",
    codes: ["USD_BLUE", "USD_BLUE_MENDOZA", "USD_BLUE_PROMEDIO_MENDOZA", "USD_OFICIAL"],
    icon: Activity
  }
] as const;

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
  const name = rate ? getRateDisplayName(rate) : alert.rate_code;
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
  const [isAdmin, setIsAdmin] = useState(false);
  const [accountDetailsOpen, setAccountDetailsOpen] = useState(false);
  const [favoritesOpen, setFavoritesOpen] = useState(false);
  const [favoriteStep, setFavoriteStep] = useState<"interest" | "rates">("interest");
  const [selectedFavoriteProfile, setSelectedFavoriteProfile] = useState<string | null>(null);
  const [selectedFavoriteCodes, setSelectedFavoriteCodes] = useState<string[]>([]);
  const [favoritesStatus, setFavoritesStatus] = useState<string | null>(null);
  const [isSavingFavorites, setIsSavingFavorites] = useState(false);
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
  const displayName = account.profile?.full_name?.trim() || account.user?.email?.split("@")[0] || "Usuario";

  const rateByCode = useMemo(() => new Map(rates.map((rate) => [rate.code, rate])), [rates]);
  const activeAlerts = useMemo(() => account.alerts.filter((alert) => alert.is_active), [account.alerts]);
  const latestAlerts = useMemo(() => activeAlerts.slice(0, 3), [activeAlerts]);
  const favoriteRates = useMemo(
    () =>
      account.favorites
        .map((favorite) => rateByCode.get(favorite.rate_code))
        .filter((rate): rate is Rate => Boolean(rate)),
    [account.favorites, rateByCode]
  );
  const favoriteOptions = useMemo(
    () =>
      [...rates].sort((a, b) => {
        const typeOrder = { main: 0, travel: 1, indicator: 2 };
        const featuredOrder: Record<string, number> = {
          USD_BLUE_PROMEDIO_MENDOZA: 0,
          USD_BLUE_MENDOZA: 1,
          USD_BLUE: 2
        };
        return (
          typeOrder[a.type] - typeOrder[b.type] ||
          (featuredOrder[a.code] ?? 99) - (featuredOrder[b.code] ?? 99) ||
          getRateDisplayName(a).localeCompare(getRateDisplayName(b), "es")
        );
      }),
    [rates]
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

  function openFavoritesSelector() {
    setSelectedFavoriteCodes(account.favorites.map((favorite) => favorite.rate_code));
    setSelectedFavoriteProfile(null);
    setFavoriteStep(account.favorites.length ? "rates" : "interest");
    setFavoritesStatus(null);
    setFavoritesOpen(true);
  }

  function chooseFavoriteProfile(profile: (typeof favoriteProfiles)[number]) {
    const availableCodes = new Set(rates.map((rate) => rate.code));
    setSelectedFavoriteProfile(profile.id);
    setSelectedFavoriteCodes(profile.codes.filter((code) => availableCodes.has(code)));
    setFavoriteStep("rates");
  }

  function toggleFavorite(code: string) {
    setSelectedFavoriteCodes((current) =>
      current.includes(code) ? current.filter((favoriteCode) => favoriteCode !== code) : [...current, code]
    );
  }

  async function saveFavorites() {
    if (!account.supabase || !account.user) {
      setFavoritesStatus("No pudimos guardar tus favoritas. Volvé a iniciar sesión.");
      return;
    }

    const currentCodes = account.favorites.map((favorite) => favorite.rate_code);
    const codesToAdd = selectedFavoriteCodes.filter((code) => !currentCodes.includes(code));
    const codesToRemove = currentCodes.filter((code) => !selectedFavoriteCodes.includes(code));

    setIsSavingFavorites(true);
    setFavoritesStatus(null);

    if (codesToAdd.length) {
      const { error } = await account.supabase.from("favorite_rates").insert(
        codesToAdd.map((rateCode) => ({
          user_id: account.user?.id,
          rate_code: rateCode
        }))
      );

      if (error) {
        setIsSavingFavorites(false);
        setFavoritesStatus("No pudimos guardar tus favoritas. Intentá nuevamente.");
        return;
      }
    }

    if (codesToRemove.length) {
      const { error } = await account.supabase
        .from("favorite_rates")
        .delete()
        .eq("user_id", account.user.id)
        .in("rate_code", codesToRemove);

      if (error) {
        await account.reload();
        setIsSavingFavorites(false);
        setFavoritesStatus("No pudimos actualizar tus favoritas. Intentá nuevamente.");
        return;
      }
    }

    await account.reload();
    setIsSavingFavorites(false);
    setFavoritesOpen(false);
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
            <h1>Hola {displayName}</h1>
            <p>Tu panel financiero personal.</p>
          </div>
          <button
            className="icon-button"
            aria-expanded={accountDetailsOpen}
            aria-label="Mi cuenta"
            type="button"
            onClick={() => setAccountDetailsOpen((current) => !current)}
          >
            <Settings size={20} />
          </button>
        </div>

        {accountDetailsOpen ? (
          <div className="account-details">
            <span className="account-profile-email">{account.user.email}</span>
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
                <span>Próximo vencimiento</span>
                <strong>{nextExpirationLabel(account.subscription?.expires_at)}</strong>
              </article>
            </div>
            <button className="button button--ghost button--full" type="button" onClick={signOut}>
              <LogOut size={17} />
              Cerrar sesión
            </button>
          </div>
        ) : null}
      </section>

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
            <strong>¿Querés que Dólar MZA te avise cuando el mercado se mueva?</strong>
            <p>Activá alertas y no tengas que mirar cotizaciones todo el día.</p>
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
                <div className="account-favorite-content">
                  <strong>{getRateDisplayName(rate)}</strong>
                  {rate.type === "indicator" ? (
                    <div className="account-favorite-quotes">
                      <span>
                        <small>Valor</small>
                        <b>{shortNumber(rate.sell_price)}%</b>
                      </span>
                      <span>
                        <small>Variación</small>
                        <b>{formatPercent(rate.variation)}</b>
                      </span>
                    </div>
                  ) : (
                    <div className="account-favorite-quotes">
                      <span>
                        <small>Compra</small>
                        <b>{formatMoney(rate.buy_price, true)}</b>
                      </span>
                      <span>
                        <small>Venta</small>
                        <b>{formatMoney(rate.sell_price, true)}</b>
                      </span>
                    </div>
                  )}
                  <small className="account-favorite-meta">
                    {rate.type !== "indicator" && rate.buy_price !== null && rate.sell_price !== null
                      ? `Spread ${formatMoney(Math.max(0, rate.sell_price - rate.buy_price), true)} · `
                      : ""}
                    {formatDateTime(rate.updated_at)}
                  </small>
                </div>
              </article>
            ))
          ) : (
            <div className="empty-state account-onboarding">
              <strong>Bienvenido a Dólar MZA.</strong>
              <span>Elegí las cotizaciones que querés seguir y armá tu panel personal.</span>
            </div>
          )}
        </div>

        <div className="account-actions account-actions--single">
          <button className="button" type="button" onClick={openFavoritesSelector}>
            {favoriteRates.length ? "Editar favoritas" : "Elegir mis cotizaciones"}
          </button>
        </div>
      </section>

      <section className="account-panel account-market-panel">
        <div className="account-panel__head">
          <div>
            <p className="eyebrow">Mercado</p>
            <h2>Todas las cotizaciones</h2>
          </div>
        </div>
        <p className="account-upgrade-copy">Consultá el mercado completo después de revisar tus favoritas.</p>
        <Link className="button button--ghost button--full" href="/#cotizaciones">
          Ver todas las cotizaciones
        </Link>
      </section>

      <section className="account-panel account-education-panel">
        <div className="account-panel__head">
          <div>
            <p className="eyebrow">Aprender</p>
            <h2>Recomendado para vos</h2>
          </div>
          <BookOpen size={22} />
        </div>

        <article className="account-education-card">
          <strong>{recommendedArticle?.title ?? "Dólar o plazo fijo"}</strong>
          <small>Lectura de 2 minutos</small>
          <span>{recommendedArticle?.content ?? "Una guia simple para entender la diferencia entre el dolar oficial y el blue."}</span>
          <div className="account-actions">
            <Link className="button button--ghost" href="/learn">
              Leer ahora
            </Link>
            <Link className="button button--ghost" href="/alerts">
              Activar alerta
            </Link>
          </div>
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
            <div className="account-meta-grid">
              <article>
                <span>Descuento acumulado</span>
                <strong>{formatMoney(referralSummary.credit_available, true)}</strong>
              </article>
              <article>
                <span>Puntos acumulados</span>
                <strong>{referralSummary.points_active}</strong>
              </article>
              <article>
                <span>Referidos</span>
                <strong>{referralSummary.referrals_valid}</strong>
              </article>
            </div>
            <div className="account-actions account-actions--single">
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

      {favoritesOpen ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="favorites-title">
          <div className="modal account-favorites-modal">
            <button className="icon-button modal__close" aria-label="Cerrar" type="button" onClick={() => setFavoritesOpen(false)}>
              <X size={20} />
            </button>
            {favoriteStep === "interest" ? (
              <>
                <h2 id="favorites-title">¿Qué te interesa?</h2>
                <p>Elegí una opción y preparamos una selección inicial. Después podés cambiarla como quieras.</p>
                <div className="favorite-profile-list">
                  {favoriteProfiles.map((profile) => {
                    const Icon = profile.icon;

                    return (
                      <button
                        className="favorite-profile-option"
                        key={profile.id}
                        type="button"
                        onClick={() => chooseFavoriteProfile(profile)}
                      >
                        <Icon size={20} />
                        <span>
                          <strong>{profile.label}</strong>
                          <small>{profile.description}</small>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </>
            ) : (
              <>
                <div className="favorite-picker-heading">
                  <div>
                    <h2 id="favorites-title">Elegí tus cotizaciones</h2>
                    <p>
                      {selectedFavoriteProfile
                        ? "Ya marcamos una selección recomendada. Podés sumar o quitar opciones."
                        : "Seleccioná las monedas e indicadores que querés ver primero en tu panel."}
                    </p>
                  </div>
                  {!account.favorites.length ? (
                    <button className="text-link" type="button" onClick={() => setFavoriteStep("interest")}>
                      Cambiar interés
                    </button>
                  ) : null}
                </div>

                <div className="favorite-picker-list">
                  {favoriteOptions.length ? (
                    favoriteOptions.map((rate) => {
                      const isSelected = selectedFavoriteCodes.includes(rate.code);

                      return (
                        <button
                          className={`favorite-picker-option ${isSelected ? "is-selected" : ""}`}
                          aria-pressed={isSelected}
                          key={rate.code}
                          type="button"
                          onClick={() => toggleFavorite(rate.code)}
                        >
                          <FlagBadge compact rate={rate} />
                          <span>{getRateDisplayName(rate)}</span>
                          <span className="favorite-picker-check" aria-hidden="true">
                            {isSelected ? <Check size={16} /> : null}
                          </span>
                        </button>
                      );
                    })
                  ) : (
                    <div className="empty-state">Actualizando cotizaciones disponibles...</div>
                  )}
                </div>

                {favoritesStatus ? <p className="form-message">{favoritesStatus}</p> : null}

                <button className="button button--full" disabled={isSavingFavorites} type="button" onClick={saveFavorites}>
                  {isSavingFavorites ? "Guardando..." : "Guardar favoritas"}
                </button>
              </>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
