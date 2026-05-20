"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Bell, Check, Crown, Eye, EyeOff, Save, ShieldCheck, Users } from "lucide-react";
import { AuthForm } from "@/components/AuthForm";
import { demoRates } from "@/lib/demo-data";
import { formatDateTime, formatMoney, formatPercent } from "@/lib/format";
import { getAdminEmails, useAccount } from "@/lib/hooks";
import type { EducationCard, NotificationJob, Profile, Rate, SourceUpdateLog, Subscription, UserAlert } from "@/lib/types";

type AdminData = {
  rates: Rate[];
  profiles: Profile[];
  alerts: UserAlert[];
  subscriptions: Subscription[];
  educationCards: EducationCard[];
  notificationJobs: NotificationJob[];
  sourceUpdateLogs: SourceUpdateLog[];
};

const emptyAdminData: AdminData = {
  rates: [],
  profiles: [],
  alerts: [],
  subscriptions: [],
  educationCards: [],
  notificationJobs: [],
  sourceUpdateLogs: []
};

function asNumber(value: FormDataEntryValue | null) {
  if (value === null || value === "") return null;
  return Number(value);
}

function AdminRateCard({
  rate,
  onSave,
  onMarkUnreliable
}: {
  rate: Rate;
  onSave: (rate: Rate, formData: FormData) => Promise<void>;
  onMarkUnreliable: (rate: Rate) => Promise<void>;
}) {
  const [isSaving, setIsSaving] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    await onSave(rate, new FormData(event.currentTarget));
    setIsSaving(false);
  }

  return (
    <form className="admin-rate-card" onSubmit={handleSubmit}>
      <div className="admin-rate-card__head">
        <div>
          <span>
            {rate.flag} {rate.code}
          </span>
          <strong>{rate.name}</strong>
        </div>
        <label className="switch">
          <input defaultChecked={rate.is_visible} name="is_visible" type="checkbox" />
          <span>{rate.is_visible ? <Eye size={16} /> : <EyeOff size={16} />}</span>
        </label>
      </div>

      <div className="admin-fields">
        <label className="field field--tight">
          <span>Compra</span>
          <input defaultValue={rate.buy_price ?? ""} name="buy_price" step="0.01" type="number" />
        </label>
        <label className="field field--tight">
          <span>Venta / valor</span>
          <input defaultValue={rate.sell_price ?? ""} name="sell_price" step="0.01" type="number" />
        </label>
        <label className="field field--tight">
          <span>Variación</span>
          <input defaultValue={rate.variation} name="variation" step="0.01" type="number" />
        </label>
      </div>

      <label className="field field--tight">
        <span>Fuente</span>
        <input defaultValue={rate.source ?? ""} name="source" />
      </label>

      <div className="button-row">
        <button className="button button--ghost" disabled={isSaving} type="submit">
          <Save size={16} />
          {isSaving ? "Guardando..." : "Guardar"}
        </button>
        <button className="button button--danger" type="button" onClick={() => onMarkUnreliable(rate)}>
          <AlertTriangle size={16} />
          Sin fuente
        </button>
      </div>
    </form>
  );
}

export function AdminScreen() {
  const account = useAccount();
  const [data, setData] = useState<AdminData>(emptyAdminData);
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const adminEmails = getAdminEmails();
  const email = account.user?.email?.toLowerCase() ?? "";
  const isAdmin = adminEmails.length ? adminEmails.includes(email) : email === "admin@dolarmendoza.app";

  const visibleRates = useMemo(() => data.rates.filter((rate) => rate.is_visible).length, [data.rates]);
  const unreliableSources = useMemo(
    () => data.rates.filter((rate) => !rate.source || rate.source.toLowerCase().includes("sin fuente")).length,
    [data.rates]
  );

  const reload = useCallback(async () => {
    if (!account.supabase || !account.user || !isAdmin) {
      setData({ ...emptyAdminData, rates: demoRates });
      return;
    }

    setIsLoading(true);
    const [rates, profiles, alerts, subscriptions, educationCards, notificationJobs, sourceUpdateLogs] = await Promise.all([
      account.supabase.from("rates").select("*").order("type", { ascending: true }).order("name", { ascending: true }),
      account.supabase.from("profiles").select("*").order("created_at", { ascending: false }).limit(100),
      account.supabase.from("alerts").select("*").order("created_at", { ascending: false }).limit(200),
      account.supabase.from("subscriptions").select("*").order("started_at", { ascending: false }).limit(100),
      account.supabase.from("education_cards").select("*").order("created_at", { ascending: false }).limit(100),
      account.supabase.from("notification_jobs").select("*").order("created_at", { ascending: false }).limit(20),
      account.supabase.from("source_update_logs").select("*").order("finished_at", { ascending: false }).limit(10)
    ]);

    const firstError =
      rates.error ??
      profiles.error ??
      alerts.error ??
      subscriptions.error ??
      educationCards.error ??
      notificationJobs.error ??
      sourceUpdateLogs.error;
    if (firstError) {
      setMessage(firstError.message);
    }

    setData({
      rates: ((rates.data as Rate[] | null) ?? demoRates) as Rate[],
      profiles: (profiles.data as Profile[] | null) ?? [],
      alerts: (alerts.data as UserAlert[] | null) ?? [],
      subscriptions: (subscriptions.data as Subscription[] | null) ?? [],
      educationCards: (educationCards.data as EducationCard[] | null) ?? [],
      notificationJobs: (notificationJobs.data as NotificationJob[] | null) ?? [],
      sourceUpdateLogs: (sourceUpdateLogs.data as SourceUpdateLog[] | null) ?? []
    });
    setIsLoading(false);
  }, [account.supabase, account.user, isAdmin]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function saveRate(rate: Rate, formData: FormData) {
    if (!account.supabase) return;

    const payload = {
      buy_price: asNumber(formData.get("buy_price")),
      sell_price: asNumber(formData.get("sell_price")),
      variation: Number(formData.get("variation") ?? 0),
      source: String(formData.get("source") ?? ""),
      is_visible: formData.get("is_visible") === "on",
      updated_at: new Date().toISOString()
    };

    const { error } = await account.supabase.from("rates").update(payload).eq("code", rate.code);
    setMessage(error ? error.message : `${rate.name} actualizada.`);
    await reload();
  }

  async function markUnreliable(rate: Rate) {
    if (!account.supabase) return;

    const { error } = await account.supabase
      .from("rates")
      .update({
        source: "Sin fuente confiable",
        is_visible: false,
        updated_at: new Date().toISOString()
      })
      .eq("code", rate.code);

    setMessage(error ? error.message : `${rate.name} se ocultó por falta de fuente confiable.`);
    await reload();
  }

  async function createRate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!account.supabase) return;

    const formData = new FormData(event.currentTarget);
    const { error } = await account.supabase.from("rates").upsert({
      code: String(formData.get("code") ?? "").trim().toUpperCase(),
      name: String(formData.get("name") ?? "").trim(),
      country: String(formData.get("country") ?? "").trim(),
      flag: String(formData.get("flag") ?? "🏳️"),
      type: String(formData.get("type") ?? "travel"),
      buy_price: asNumber(formData.get("buy_price")),
      sell_price: asNumber(formData.get("sell_price")),
      variation: Number(formData.get("variation") ?? 0),
      source: String(formData.get("source") ?? "Carga manual"),
      is_visible: true,
      updated_at: new Date().toISOString()
    });

    setMessage(error ? error.message : "Cotización cargada.");
    event.currentTarget.reset();
    await reload();
  }

  if (account.isLoading) {
    return (
      <div className="screen">
        <p className="loading-line">Cargando admin...</p>
      </div>
    );
  }

  if (!account.user) {
    return (
      <div className="screen">
        <section className="page-header">
          <p className="eyebrow">Admin</p>
          <h1>Panel privado</h1>
          <p>Entrá con el email admin configurado en Supabase.</p>
        </section>
        <div className="panel">
          <AuthForm onSuccess={account.reload} />
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="screen">
        <section className="page-header">
          <p className="eyebrow">Admin</p>
          <h1>Sin acceso</h1>
          <p>Tu email no está habilitado como administrador.</p>
        </section>
      </div>
    );
  }

  return (
    <div className="screen">
      <section className="page-header">
        <div className="hero__badge">
          <ShieldCheck size={16} />
          Admin
        </div>
        <h1>Panel de control</h1>
        <p>Cargá cotizaciones, fuentes, usuarios, alertas y suscripciones.</p>
      </section>

      {message ? <p className="notice">{message}</p> : null}
      {isLoading ? <p className="loading-line">Actualizando panel...</p> : null}

      <section className="admin-stats">
        <article>
          <strong>{data.rates.length}</strong>
          <span>Cotizaciones</span>
        </article>
        <article>
          <strong>{visibleRates}</strong>
          <span>Visibles</span>
        </article>
        <article>
          <strong>{data.alerts.length}</strong>
          <span>Alertas</span>
        </article>
        <article>
          <strong>{unreliableSources}</strong>
          <span>Sin fuente</span>
        </article>
      </section>

      <section className="section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Carga manual</p>
            <h2>Nueva cotización</h2>
          </div>
        </div>
        <form className="admin-create" onSubmit={createRate}>
          <div className="admin-fields">
            <label className="field field--tight">
              <span>Código</span>
              <input name="code" placeholder="USD_BLUE" required />
            </label>
            <label className="field field--tight">
              <span>Nombre</span>
              <input name="name" placeholder="Dólar Blue" required />
            </label>
            <label className="field field--tight">
              <span>Bandera</span>
              <input name="flag" placeholder="🇦🇷🇺🇸" required />
            </label>
          </div>
          <div className="admin-fields">
            <label className="field field--tight">
              <span>Tipo</span>
              <select name="type">
                <option value="main">Principal</option>
                <option value="travel">Viajes</option>
                <option value="indicator">Indicador</option>
              </select>
            </label>
            <label className="field field--tight">
              <span>País</span>
              <input name="country" placeholder="Argentina" />
            </label>
            <label className="field field--tight">
              <span>Fuente</span>
              <input name="source" placeholder="Carga manual" />
            </label>
          </div>
          <div className="admin-fields">
            <label className="field field--tight">
              <span>Compra</span>
              <input name="buy_price" step="0.01" type="number" />
            </label>
            <label className="field field--tight">
              <span>Venta / valor</span>
              <input name="sell_price" step="0.01" type="number" />
            </label>
            <label className="field field--tight">
              <span>Variación</span>
              <input defaultValue="0" name="variation" step="0.01" type="number" />
            </label>
          </div>
          <button className="button button--full" type="submit">
            <Check size={17} />
            Cargar cotización
          </button>
        </form>
      </section>

      <section className="section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Cotizaciones</p>
            <h2>Editar y ocultar monedas</h2>
          </div>
        </div>
        <div className="card-list">
          {data.rates.map((rate) => (
            <AdminRateCard key={rate.code} rate={rate} onSave={saveRate} onMarkUnreliable={markUnreliable} />
          ))}
        </div>
      </section>

      <section className="section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Usuarios</p>
            <h2>Actividad</h2>
          </div>
        </div>
        <div className="admin-list">
          {data.profiles.map((profile) => (
            <article key={profile.id}>
              <Users size={18} />
              <div>
                <strong>{profile.email}</strong>
                <span>
                  {profile.is_premium ? "Premium" : "Gratis"} · {formatDateTime(profile.created_at)}
                </span>
              </div>
            </article>
          ))}
          {!data.profiles.length ? <div className="empty-state">Sin usuarios para mostrar.</div> : null}
        </div>
      </section>

      <section className="admin-two-columns">
        <div>
          <div className="section-heading">
            <div>
              <p className="eyebrow">Alertas</p>
              <h2>Últimas creadas</h2>
            </div>
          </div>
          <div className="admin-list">
            {data.alerts.slice(0, 12).map((alert) => (
              <article key={alert.id}>
                <Bell size={18} />
                <div>
                  <strong>
                    {alert.rate_code} · {alert.condition_type}
                  </strong>
                  <span>
                    {alert.channel} · {alert.is_active ? "activa" : "pausada"}
                  </span>
                </div>
              </article>
            ))}
          </div>
        </div>

        <div>
          <div className="section-heading">
            <div>
              <p className="eyebrow">Pagos</p>
              <h2>Suscripciones</h2>
            </div>
          </div>
          <div className="admin-list">
            {data.subscriptions.slice(0, 12).map((subscription) => (
              <article key={subscription.id}>
                <Crown size={18} />
                <div>
                  <strong>{subscription.plan}</strong>
                  <span>
                    {subscription.status} · {subscription.mercado_pago_payment_id ?? "sin pago"}
                  </span>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="admin-two-columns">
        <div>
          <div className="section-heading">
            <div>
              <p className="eyebrow">Automatización</p>
              <h2>Fuentes</h2>
            </div>
          </div>
          <div className="admin-list">
            {data.sourceUpdateLogs.map((log) => (
              <article key={log.id}>
                <Check size={18} />
                <div>
                  <strong>
                    {log.status} · {log.updated_codes.length} datos
                  </strong>
                  <span>
                    {formatDateTime(log.finished_at)} · {log.errors.length ? `${log.errors.length} errores` : "sin errores"}
                  </span>
                </div>
              </article>
            ))}
            {!data.sourceUpdateLogs.length ? <div className="empty-state">Sin actualizaciones automáticas todavía.</div> : null}
          </div>
        </div>

        <div>
          <div className="section-heading">
            <div>
              <p className="eyebrow">Notificaciones</p>
              <h2>Últimos envíos</h2>
            </div>
          </div>
          <div className="admin-list">
            {data.notificationJobs.map((job) => (
              <article key={job.id}>
                <Bell size={18} />
                <div>
                  <strong>
                    {job.channel} · {job.status}
                  </strong>
                  <span>
                    {formatDateTime(job.created_at)} · intentos {job.attempts}
                  </span>
                </div>
              </article>
            ))}
            {!data.notificationJobs.length ? <div className="empty-state">Sin trabajos de notificación todavía.</div> : null}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Fuentes</p>
            <h2>Estado de datos</h2>
          </div>
        </div>
        <div className="source-list">
          {data.rates.map((rate) => (
            <article key={rate.code}>
              <div>
                <strong>{rate.name}</strong>
                <span>{rate.source || "Sin fuente"}</span>
              </div>
              <small>
                {formatMoney(rate.sell_price, true)} · {formatPercent(rate.variation)}
              </small>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
