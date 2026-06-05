"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  Bell,
  Check,
  Clock3,
  CreditCard,
  Database,
  Eye,
  EyeOff,
  FileText,
  LifeBuoy,
  Mail,
  Pause,
  Play,
  RefreshCw,
  Save,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Trash2,
  Users,
  WalletCards
} from "lucide-react";
import { AuthForm } from "@/components/AuthForm";
import { FlagBadge } from "@/components/FlagBadge";
import { ALERT_TYPES } from "@/lib/constants";
import { demoRates } from "@/lib/demo-data";
import { formatDateTime, formatMoney } from "@/lib/format";
import { getAdminEmails, useAccount } from "@/lib/hooks";
import type {
  AnalyticsEvent,
  CommunityReport,
  EducationCard,
  NotificationJob,
  PaymentEvent,
  Profile,
  Rate,
  RateSource,
  RateSourceReading,
  ReferralCreditLedger,
  ReferralEvent,
  SourceUpdateLog,
  Subscription,
  SupportMessage,
  UserAlert
} from "@/lib/types";

type SystemStatus = {
  supabase: boolean;
  resend: boolean;
  mercadoPago: boolean;
  mercadoPagoWebhook: boolean;
  cron: boolean;
  appUrl: boolean;
  analytics: boolean;
};

type AdminData = {
  rates: Rate[];
  profiles: Profile[];
  alerts: UserAlert[];
  subscriptions: Subscription[];
  educationCards: EducationCard[];
  notificationJobs: NotificationJob[];
  sourceUpdateLogs: SourceUpdateLog[];
  rateSources: RateSource[];
  sourceReadings: RateSourceReading[];
  communityReports: CommunityReport[];
  analyticsEvents: AnalyticsEvent[];
  paymentEvents: PaymentEvent[];
  referralEvents: ReferralEvent[];
  referralCreditLedger: ReferralCreditLedger[];
  supportMessages: SupportMessage[];
  systemStatus: SystemStatus;
  blueMendozaManual: {
    enabled?: boolean;
    buy_price?: number | null;
    sell_price?: number | null;
    note?: string;
  } | null;
  communityFiltersEnabled: boolean;
};

type AdminTab =
  | "dashboard"
  | "market"
  | "users"
  | "memberships"
  | "alerts"
  | "community"
  | "analytics"
  | "content"
  | "support"
  | "automation"
  | "system";

const emptySystemStatus: SystemStatus = {
  supabase: false,
  resend: false,
  mercadoPago: false,
  mercadoPagoWebhook: false,
  cron: false,
  appUrl: false,
  analytics: false
};

const emptyAdminData: AdminData = {
  rates: [],
  profiles: [],
  alerts: [],
  subscriptions: [],
  educationCards: [],
  notificationJobs: [],
  sourceUpdateLogs: [],
  rateSources: [],
  sourceReadings: [],
  communityReports: [],
  analyticsEvents: [],
  paymentEvents: [],
  referralEvents: [],
  referralCreditLedger: [],
  supportMessages: [],
  systemStatus: emptySystemStatus,
  blueMendozaManual: null,
  communityFiltersEnabled: true
};

const adminTabs: Array<{ id: AdminTab; label: string; helper: string }> = [
  { id: "dashboard", label: "Dashboard", helper: "Resumen general" },
  { id: "market", label: "Mercado", helper: "Cotizaciones" },
  { id: "users", label: "Usuarios", helper: "Leads y cuentas" },
  { id: "memberships", label: "Membresias", helper: "Cobros" },
  { id: "alerts", label: "Alertas", helper: "Envios" },
  { id: "community", label: "Comunidad", helper: "Reportes" },
  { id: "analytics", label: "Analytics", helper: "Uso real" },
  { id: "content", label: "Contenido", helper: "SEO y textos" },
  { id: "support", label: "Soporte", helper: "Problemas" },
  { id: "automation", label: "Automatizaciones", helper: "Cron" },
  { id: "system", label: "Sistema", helper: "Config" }
];

const planPrices: Record<Subscription["plan"], number> = {
  free: 0,
  essential_monthly: 999,
  tracking_monthly: 3999,
  premium_monthly: 149999
};

const planLabels: Record<Subscription["plan"], string> = {
  free: "Gratis",
  essential_monthly: "Esencial",
  tracking_monthly: "Seguimiento",
  premium_monthly: "Premium WhatsApp"
};

function asNumber(value: FormDataEntryValue | null) {
  if (value === null || value === "") return null;
  return Number(value);
}

function parseAdminEmails(value: unknown) {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => String(item).trim().toLowerCase())
    .filter(Boolean);
}

function isAfter(value: string | null | undefined, startIso: string) {
  if (!value) return false;
  return new Date(value).getTime() >= new Date(startIso).getTime();
}

function startOfTodayIso() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date.toISOString();
}

function startOfMonthIso() {
  const date = new Date();
  date.setDate(1);
  date.setHours(0, 0, 0, 0);
  return date.toISOString();
}

function countBy<T>(items: T[], getKey: (item: T) => string | null | undefined) {
  return items.reduce<Record<string, number>>((acc, item) => {
    const key = getKey(item) || "sin dato";
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
}

function topEntries(record: Record<string, number>, limit = 6) {
  return Object.entries(record)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);
}

function alertLabel(alert: UserAlert) {
  return ALERT_TYPES.find((type) => type.value === alert.condition_type)?.label ?? alert.condition_type;
}

async function fetchAdminData() {
  const response = await fetch("/api/admin/data", { cache: "no-store" });
  const payload = (await response.json().catch(() => ({}))) as AdminData & { error?: string };

  if (!response.ok) {
    throw new Error(payload.error ?? "No se pudo cargar el panel admin.");
  }

  return payload;
}

async function runAdminAction<T extends { error?: string; message?: string } = { error?: string; message?: string }>(
  body: Record<string, unknown>
) {
  const response = await fetch("/api/admin/actions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const payload = (await response.json().catch(() => ({}))) as T;

  if (!response.ok) {
    throw new Error(payload.error ?? "No se pudo ejecutar la accion.");
  }

  return payload;
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
    try {
      await onSave(rate, new FormData(event.currentTarget));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form className="admin-rate-card" onSubmit={handleSubmit}>
      <div className="admin-rate-card__head">
        <div>
          <span className="admin-rate-card__code">
            <FlagBadge compact rate={rate} />
            {rate.code}
          </span>
          <strong>{rate.name}</strong>
        </div>
        <label className="switch" title="Mostrar u ocultar">
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
          <span>Variacion</span>
          <input defaultValue={rate.variation} name="variation" step="0.01" type="number" />
        </label>
      </div>

      <label className="field field--tight">
        <span>Fuente visible interna</span>
        <input defaultValue={rate.source ?? ""} name="source" />
      </label>

      <div className="button-row">
        <button className="button button--ghost" disabled={isSaving} type="submit">
          <Save size={16} />
          {isSaving ? "Guardando..." : "Guardar"}
        </button>
        <button className="button button--danger" disabled={isSaving} type="button" onClick={() => onMarkUnreliable(rate)}>
          <AlertTriangle size={16} />
          Sin fuente
        </button>
      </div>
    </form>
  );
}

function StatCard({ label, value, helper }: { label: string; value: string | number; helper?: string }) {
  return (
    <article>
      <strong>{value}</strong>
      <span>{label}</span>
      {helper ? <small>{helper}</small> : null}
    </article>
  );
}

function HealthPill({ ok, label }: { ok: boolean; label: string }) {
  return <span className={`admin-health ${ok ? "admin-health--ok" : "admin-health--warn"}`}>{ok ? `${label}: OK` : `${label}: falta`}</span>;
}

export function AdminScreen() {
  const account = useAccount();
  const [data, setData] = useState<AdminData>(emptyAdminData);
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [dbAdminEmails, setDbAdminEmails] = useState<string[]>([]);
  const [adminCheckDone, setAdminCheckDone] = useState(false);
  const [activeTab, setActiveTab] = useState<AdminTab>("dashboard");
  const [userQuery, setUserQuery] = useState("");

  const adminEmails = useMemo(() => getAdminEmails(), []);
  const email = account.user?.email?.toLowerCase() ?? "";
  const isAdmin =
    dbAdminEmails.includes(email) ||
    adminEmails.includes(email) ||
    (!adminEmails.length && email === "admin@dolarmendoza.app") ||
    email === "autosimza@gmail.com";
  const isCheckingAdmin = Boolean(account.supabase && account.user && !adminCheckDone && !isAdmin);

  const todayIso = useMemo(() => startOfTodayIso(), []);
  const monthIso = useMemo(() => startOfMonthIso(), []);

  const profileById = useMemo(() => new Map(data.profiles.map((profile) => [profile.id, profile])), [data.profiles]);
  const alertsByUser = useMemo(() => countBy(data.alerts, (alert) => alert.user_id), [data.alerts]);
  const analyticsByEvent = useMemo(() => countBy(data.analyticsEvents, (event) => event.event_name), [data.analyticsEvents]);
  const analyticsByPage = useMemo(() => topEntries(countBy(data.analyticsEvents, (event) => event.path), 8), [data.analyticsEvents]);
  const analyticsByDevice = useMemo(() => topEntries(countBy(data.analyticsEvents, (event) => event.device), 5), [data.analyticsEvents]);
  const analyticsBySource = useMemo(() => topEntries(countBy(data.analyticsEvents, (event) => event.source || "directo"), 5), [data.analyticsEvents]);

  const visibleRates = useMemo(() => data.rates.filter((rate) => rate.is_visible).length, [data.rates]);
  const premiumUsers = useMemo(() => data.profiles.filter((profile) => profile.is_premium).length, [data.profiles]);
  const usersToday = useMemo(() => data.profiles.filter((profile) => isAfter(profile.created_at, todayIso)).length, [data.profiles, todayIso]);
  const activeAlerts = useMemo(() => data.alerts.filter((alert) => alert.is_active).length, [data.alerts]);
  const pausedAlerts = useMemo(() => data.alerts.filter((alert) => !alert.is_active).length, [data.alerts]);
  const sentJobsToday = useMemo(
    () => data.notificationJobs.filter((job) => job.status === "sent" && isAfter(job.processed_at ?? job.created_at, todayIso)).length,
    [data.notificationJobs, todayIso]
  );
  const failedJobs = useMemo(() => data.notificationJobs.filter((job) => job.status === "failed").length, [data.notificationJobs]);
  const communityToday = useMemo(
    () => data.communityReports.filter((report) => isAfter(report.created_at, todayIso)).length,
    [data.communityReports, todayIso]
  );
  const paymentsPending = useMemo(() => data.subscriptions.filter((subscription) => subscription.status === "pending").length, [data.subscriptions]);
  const activeSubscriptions = useMemo(() => data.subscriptions.filter((subscription) => subscription.status === "active").length, [data.subscriptions]);
  const validReferrals = useMemo(() => data.referralEvents.filter((event) => event.status === "valid").length, [data.referralEvents]);
  const pendingReferrals = useMemo(() => data.referralEvents.filter((event) => event.status === "pending").length, [data.referralEvents]);
  const creditsApplied = useMemo(
    () =>
      data.referralCreditLedger
        .filter((item) => item.type === "used" && item.status === "used")
        .reduce((total, item) => total + Number(item.credit_amount ?? 0), 0),
    [data.referralCreditLedger]
  );
  const expiringSubscriptions = useMemo(
    () =>
      data.subscriptions.filter((subscription) => {
        if (!subscription.expires_at || subscription.status !== "active") return false;
        const expires = new Date(subscription.expires_at).getTime();
        return expires < Date.now() + 7 * 24 * 60 * 60 * 1000;
      }).length,
    [data.subscriptions]
  );
  const incomeMonth = useMemo(
    () =>
      data.subscriptions
        .filter((subscription) => subscription.status === "active" && isAfter(subscription.started_at, monthIso))
        .reduce((total, subscription) => total + planPrices[subscription.plan], 0),
    [data.subscriptions, monthIso]
  );
  const latestRateUpdate = useMemo(
    () =>
      data.rates
        .map((rate) => rate.updated_at)
        .filter(Boolean)
        .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0],
    [data.rates]
  );
  const latestCronLog = data.sourceUpdateLogs[0];

  const filteredProfiles = useMemo(() => {
    const query = userQuery.trim().toLowerCase();
    if (!query) return data.profiles;
    return data.profiles.filter((profile) => {
      return (
        profile.email.toLowerCase().includes(query) ||
        (profile.phone ?? "").toLowerCase().includes(query) ||
        (profile.full_name ?? "").toLowerCase().includes(query)
      );
    });
  }, [data.profiles, userQuery]);

  useEffect(() => {
    if (!account.supabase || !account.user) {
      setDbAdminEmails([]);
      setAdminCheckDone(true);
      return;
    }

    const supabase = account.supabase;
    let ignore = false;

    async function loadAdminEmails() {
      setAdminCheckDone(false);
      const { data: settings } = await supabase
        .from("admin_settings")
        .select("value")
        .eq("key", "admin_emails")
        .maybeSingle();

      if (ignore) return;

      setDbAdminEmails(parseAdminEmails(settings?.value));
      setAdminCheckDone(true);
    }

    void loadAdminEmails();

    return () => {
      ignore = true;
    };
  }, [account.supabase, account.user]);

  const reload = useCallback(async () => {
    if (!account.user || !isAdmin) {
      setData({ ...emptyAdminData, rates: demoRates });
      return;
    }

    setIsLoading(true);
    try {
      const adminData = await fetchAdminData();
      setData({
        ...adminData,
        rates: adminData.rates.length ? adminData.rates : demoRates,
        analyticsEvents: adminData.analyticsEvents ?? [],
        paymentEvents: adminData.paymentEvents ?? [],
        referralEvents: adminData.referralEvents ?? [],
        referralCreditLedger: adminData.referralCreditLedger ?? [],
        supportMessages: adminData.supportMessages ?? [],
        systemStatus: adminData.systemStatus ?? emptySystemStatus,
        blueMendozaManual: adminData.blueMendozaManual ?? null,
        communityFiltersEnabled: adminData.communityFiltersEnabled !== false
      });
    } catch (error) {
      setData({ ...emptyAdminData, rates: demoRates });
      setMessage(error instanceof Error ? error.message : "No se pudo cargar el panel admin.");
    } finally {
      setIsLoading(false);
    }
  }, [account.user, isAdmin]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const runPanelAction = useCallback(
    async (key: string, body: Record<string, unknown>, fallback: string, shouldReload = true) => {
      setActionLoading(key);
      setMessage("Guardando...");
      try {
        const result = await runAdminAction(body);
        setMessage(result.message ?? fallback);
        if (shouldReload) await reload();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "No se pudo actualizar.");
      } finally {
        setActionLoading(null);
      }
    },
    [reload]
  );

  async function saveRate(rate: Rate, formData: FormData) {
    const payload = {
      buy_price: asNumber(formData.get("buy_price")),
      sell_price: asNumber(formData.get("sell_price")),
      variation: Number(formData.get("variation") ?? 0),
      source: String(formData.get("source") ?? ""),
      is_visible: formData.get("is_visible") === "on",
      updated_at: new Date().toISOString()
    };

    await runPanelAction(`save_rate:${rate.code}`, { action: "save_rate", rateCode: rate.code, payload }, `${rate.name} actualizada.`);
  }

  async function markUnreliable(rate: Rate) {
    await runPanelAction(
      `mark_unreliable:${rate.code}`,
      { action: "mark_rate_unreliable", rateCode: rate.code },
      `${rate.name} se oculto por falta de fuente confiable.`
    );
  }

  async function toggleRateSource(source: RateSource) {
    await runPanelAction(
      `source:${source.id}`,
      { action: "toggle_rate_source", sourceId: source.id, enabled: !source.enabled },
      `${source.name} ${source.enabled ? "desactivada" : "activada"}.`
    );
  }

  async function saveBlueMendozaManual(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const payload = {
      enabled: formData.get("enabled") === "on",
      buy_price: asNumber(formData.get("buy_price")),
      sell_price: asNumber(formData.get("sell_price")),
      note: String(formData.get("note") ?? "")
    };

    await runPanelAction("blue_mendoza", { action: "save_blue_mendoza_manual", payload }, "Blue Mendoza manual actualizado.");
  }

  async function toggleCommunityFilters() {
    await runPanelAction(
      "community_filters",
      { action: "toggle_community_filters", enabled: !data.communityFiltersEnabled },
      "Filtro de comunidad actualizado."
    );
  }

  async function moderateCommunityReport(report: CommunityReport, status: CommunityReport["status"]) {
    await runPanelAction(
      `community:${report.id}:${status}`,
      { action: "moderate_community_report", reportId: report.id, status },
      "Reporte comunitario actualizado."
    );
  }

  async function deleteCommunityReport(report: CommunityReport) {
    await runPanelAction(
      `community-delete:${report.id}`,
      { action: "delete_community_report", reportId: report.id },
      "Reporte comunitario eliminado."
    );
  }

  async function createRate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = event.currentTarget;
    const formData = new FormData(form);
    const payload = {
      code: String(formData.get("code") ?? "").trim().toUpperCase(),
      name: String(formData.get("name") ?? "").trim(),
      country: String(formData.get("country") ?? "").trim(),
      flag: String(formData.get("flag") ?? "AR"),
      type: String(formData.get("type") ?? "travel"),
      buy_price: asNumber(formData.get("buy_price")),
      sell_price: asNumber(formData.get("sell_price")),
      variation: Number(formData.get("variation") ?? 0),
      source: String(formData.get("source") ?? "Carga manual"),
      is_visible: true,
      updated_at: new Date().toISOString()
    };

    await runPanelAction("create_rate", { action: "create_rate", payload }, "Cotizacion cargada.");
    form.reset();
  }

  async function setUserPremium(profile: Profile, enabled: boolean, plan: Subscription["plan"] = "premium_monthly") {
    await runPanelAction(
      `premium:${profile.id}:${enabled}`,
      { action: "update_user_premium", userId: profile.id, enabled, plan },
      enabled ? "Premium activado manualmente." : "Premium desactivado manualmente."
    );
  }

  async function setAlertState(alert: UserAlert, enabled: boolean) {
    await runPanelAction(
      `alert:${alert.id}:${enabled}`,
      { action: enabled ? "reactivate_alert" : "pause_alert", alertId: alert.id },
      enabled ? "Alerta reactivada." : "Alerta pausada."
    );
  }

  async function deleteAlert(alert: UserAlert) {
    await runPanelAction(`alert-delete:${alert.id}`, { action: "delete_alert", alertId: alert.id }, "Alerta eliminada.");
  }

  async function invalidateReferral(referral: ReferralEvent) {
    await runPanelAction(
      `referral-invalid:${referral.id}`,
      { action: "invalidate_referral", referralId: referral.id },
      "Referido invalidado."
    );
  }

  async function applyManualCredit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = event.currentTarget;
    const formData = new FormData(form);
    const emailValue = String(formData.get("email") ?? "").trim().toLowerCase();
    const amount = Number(formData.get("amount") ?? 0);
    const description = String(formData.get("description") ?? "Credito manual admin");
    const profile = data.profiles.find((item) => item.email.toLowerCase() === emailValue);

    if (!profile) {
      setMessage("No encontre un usuario con ese email.");
      return;
    }

    await runPanelAction(
      "manual_credit",
      { action: "apply_manual_credit", userId: profile.id, payload: { amount, description } },
      "Credito manual aplicado."
    );
    form.reset();
  }

  async function resolveSupportMessage(message: SupportMessage) {
    await runPanelAction(
      `support:${message.id}`,
      { action: "resolve_support_message", payload: { id: message.id } },
      "Mensaje de soporte resuelto."
    );
  }

  const isActionLoading = (key: string) => actionLoading === key;

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
          <p>Entra con autosimza@gmail.com o con un email admin configurado en Supabase.</p>
        </section>
        <div className="panel">
          <AuthForm initialMode="login" onSuccess={account.reload} />
        </div>
      </div>
    );
  }

  if (isCheckingAdmin) {
    return (
      <div className="screen">
        <p className="loading-line">Verificando acceso admin...</p>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="screen">
        <section className="page-header">
          <p className="eyebrow">Admin</p>
          <h1>Sin acceso</h1>
          <p>Tu email no esta habilitado como administrador.</p>
        </section>
      </div>
    );
  }

  return (
    <div className="screen screen--admin">
      <section className="page-header admin-page-header">
        <div>
          <div className="hero__badge">
            <ShieldCheck size={16} />
            Admin
          </div>
          <h1>Panel de control</h1>
          <p>Gestion del negocio: mercado, alertas, usuarios, pagos, comunidad, analytics y sistema.</p>
        </div>
        <Link className="button button--ghost" href="/">
          <ArrowLeft size={17} />
          Volver al sitio
        </Link>
      </section>

      {message ? <p className="notice">{message}</p> : null}
      {isLoading ? <p className="loading-line">Actualizando panel...</p> : null}

      <nav className="admin-tabs" aria-label="Secciones del panel admin">
        {adminTabs.map((tab) => (
          <button
            className={activeTab === tab.id ? "is-active" : ""}
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
          >
            <strong>{tab.label}</strong>
            <span>{tab.helper}</span>
          </button>
        ))}
      </nav>

      {activeTab === "dashboard" ? (
        <>
          <section className="admin-stats admin-stats--wide">
            <StatCard helper={`${usersToday} nuevos hoy`} label="Usuarios registrados" value={data.profiles.length} />
            <StatCard label="Usuarios premium" value={premiumUsers} />
            <StatCard helper={`${pausedAlerts} pausadas`} label="Alertas activas" value={activeAlerts} />
            <StatCard label="Alertas disparadas hoy" value={sentJobsToday} />
            <StatCard label="Reportes comunidad hoy" value={communityToday} />
            <StatCard label="Pagos pendientes" value={paymentsPending} />
            <StatCard label="Ingresos del mes" value={formatMoney(incomeMonth, true)} />
            <StatCard helper={latestRateUpdate ? formatDateTime(latestRateUpdate) : "Sin datos"} label="Ultima actualizacion" value={visibleRates} />
          </section>

          <section className="admin-command-panel">
            <div>
              <p className="eyebrow">Operacion diaria</p>
              <h2>Actualizar todo</h2>
              <p>Ejecuta cotizaciones, validacion de fuentes, alertas y notificaciones pendientes.</p>
            </div>
            <button
              className="button"
              disabled={Boolean(actionLoading)}
              type="button"
              onClick={() => runPanelAction("run_automation", { action: "run_automation" }, "Actualizado correctamente.")}
            >
              <RefreshCw size={18} />
              {isActionLoading("run_automation") ? "Actualizando..." : "Actualizar todo"}
            </button>
          </section>

          <section className="admin-two-columns">
            <div className="admin-panel">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Estado</p>
                  <h2>Servicios principales</h2>
                </div>
              </div>
              <div className="admin-health-grid">
                <HealthPill label="Supabase" ok={data.systemStatus.supabase} />
                <HealthPill label="Resend" ok={data.systemStatus.resend} />
                <HealthPill label="Mercado Pago" ok={data.systemStatus.mercadoPago} />
                <HealthPill label="Webhook MP" ok={data.systemStatus.mercadoPagoWebhook} />
                <HealthPill label="Cron" ok={data.systemStatus.cron} />
                <HealthPill label="Analytics" ok={data.systemStatus.analytics} />
              </div>
            </div>

            <div className="admin-panel">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Cron</p>
                  <h2>Ultima ejecucion</h2>
                </div>
              </div>
              {latestCronLog ? (
                <div className="admin-mini-log">
                  <strong>{latestCronLog.status}</strong>
                  <span>{formatDateTime(latestCronLog.finished_at)}</span>
                  <small>
                    {(latestCronLog.updated_codes ?? []).length} datos, {(latestCronLog.errors ?? []).length} errores.
                  </small>
                </div>
              ) : (
                <div className="empty-state">Todavia no hay ejecuciones registradas.</div>
              )}
            </div>
          </section>
        </>
      ) : null}

      {activeTab === "market" ? (
        <>
          <section className="admin-two-columns">
            <div className="admin-panel">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Blue Mendoza</p>
                  <h2>Manual / automatico</h2>
                </div>
              </div>
              <form className="admin-create" onSubmit={saveBlueMendozaManual}>
                <label className="toggle-line">
                  <input defaultChecked={Boolean(data.blueMendozaManual?.enabled)} name="enabled" type="checkbox" />
                  Usar valor manual
                </label>
                <div className="admin-fields">
                  <label className="field field--tight">
                    <span>Compra manual</span>
                    <input defaultValue={data.blueMendozaManual?.buy_price ?? ""} name="buy_price" step="0.01" type="number" />
                  </label>
                  <label className="field field--tight">
                    <span>Venta manual</span>
                    <input defaultValue={data.blueMendozaManual?.sell_price ?? ""} name="sell_price" step="0.01" type="number" />
                  </label>
                  <label className="field field--tight">
                    <span>Nota interna</span>
                    <input defaultValue={data.blueMendozaManual?.note ?? ""} name="note" />
                  </label>
                </div>
                <button className="button button--full" disabled={isActionLoading("blue_mendoza")} type="submit">
                  <Save size={17} />
                  {isActionLoading("blue_mendoza") ? "Guardando..." : "Guardar Blue Mendoza"}
                </button>
              </form>
            </div>

            <div className="admin-panel">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Fuentes</p>
                  <h2>Activar y auditar</h2>
                </div>
                <button
                  className="button button--small button--ghost"
                  disabled={Boolean(actionLoading)}
                  type="button"
                  onClick={() => runPanelAction("update_rates", { action: "update_rates" }, "Cotizaciones actualizadas.")}
                >
                  <RefreshCw size={15} />
                  Forzar actualizacion
                </button>
              </div>
              <div className="admin-list">
                {data.rateSources.map((source) => (
                  <article key={source.id}>
                    <Database size={18} />
                    <div>
                      <strong>{source.name}</strong>
                      <span>
                        {source.provider} / prioridad {source.priority} / {source.enabled ? "activa" : "apagada"}
                      </span>
                    </div>
                    <button
                      className="button button--small button--ghost"
                      disabled={isActionLoading(`source:${source.id}`)}
                      type="button"
                      onClick={() => toggleRateSource(source)}
                    >
                      {source.enabled ? "Apagar" : "Activar"}
                    </button>
                  </article>
                ))}
                {!data.rateSources.length ? <div className="empty-state">Ejecuta el SQL financiero para cargar fuentes configurables.</div> : null}
              </div>
            </div>
          </section>

          <section className="section">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Carga manual</p>
                <h2>Nueva cotizacion</h2>
              </div>
            </div>
            <form className="admin-create" onSubmit={createRate}>
              <div className="admin-fields">
                <label className="field field--tight">
                  <span>Codigo</span>
                  <input name="code" placeholder="USD_BLUE" required />
                </label>
                <label className="field field--tight">
                  <span>Nombre</span>
                  <input name="name" placeholder="Dolar Blue" required />
                </label>
                <label className="field field--tight">
                  <span>Banderas</span>
                  <input name="flag" placeholder="AR US" required />
                </label>
              </div>
              <div className="admin-fields">
                <label className="field field--tight">
                  <span>Tipo</span>
                  <select name="type">
                    <option value="main">Dolar / principal</option>
                    <option value="travel">Viajes</option>
                    <option value="indicator">Indicador</option>
                  </select>
                </label>
                <label className="field field--tight">
                  <span>Pais / zona</span>
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
                  <span>Variacion</span>
                  <input defaultValue="0" name="variation" step="0.01" type="number" />
                </label>
              </div>
              <button className="button button--full" disabled={isActionLoading("create_rate")} type="submit">
                <Check size={17} />
                {isActionLoading("create_rate") ? "Cargando..." : "Cargar cotizacion"}
              </button>
            </form>
          </section>

          <section className="section">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Cotizaciones</p>
                <h2>Editar, ocultar y revisar</h2>
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
                <p className="eyebrow">Validacion</p>
                <h2>Lecturas recientes</h2>
              </div>
            </div>
            <div className="admin-list">
              {data.sourceReadings.slice(0, 28).map((reading) => (
                <article key={reading.id}>
                  <AlertTriangle size={18} />
                  <div>
                    <strong>
                      {reading.rate_code} / {reading.status}
                    </strong>
                    <span>
                      {reading.source_name} / {reading.reason ?? "coherente"} / {formatDateTime(reading.fetched_at)}
                    </span>
                  </div>
                </article>
              ))}
              {!data.sourceReadings.length ? <div className="empty-state">Sin lecturas internas todavia.</div> : null}
            </div>
          </section>
        </>
      ) : null}

      {activeTab === "users" ? (
        <section className="section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Usuarios / leads</p>
              <h2>Cuentas registradas</h2>
            </div>
          </div>
          <label className="admin-search">
            <Search size={17} />
            <input value={userQuery} placeholder="Buscar por email, telefono o nombre" onChange={(event) => setUserQuery(event.target.value)} />
          </label>
          <div className="admin-list">
            {filteredProfiles.map((profile) => (
              <article key={profile.id}>
                <Users size={18} />
                <div>
                  <strong>{profile.email}</strong>
                  <span>
                    {profile.phone || "sin telefono"} / {profile.is_premium ? "Premium" : "Gratis"} / {alertsByUser[profile.id] ?? 0} alertas /
                    alta {formatDateTime(profile.created_at)}
                  </span>
                </div>
                <div className="admin-actions-inline">
                  <button
                    className="button button--small button--ghost"
                    disabled={isActionLoading(`premium:${profile.id}:true`)}
                    type="button"
                    onClick={() => setUserPremium(profile, true, "premium_monthly")}
                  >
                    Activar premium
                  </button>
                  <button
                    className="button button--small button--danger"
                    disabled={isActionLoading(`premium:${profile.id}:false`)}
                    type="button"
                    onClick={() => setUserPremium(profile, false)}
                  >
                    Quitar
                  </button>
                </div>
              </article>
            ))}
            {!filteredProfiles.length ? <div className="empty-state">No hay usuarios con esa busqueda.</div> : null}
          </div>
        </section>
      ) : null}

      {activeTab === "memberships" ? (
        <>
          <section className="admin-stats admin-stats--wide">
            <StatCard label="Suscripciones activas" value={activeSubscriptions} />
            <StatCard label="Pruebas / pagos pendientes" value={paymentsPending} />
            <StatCard label="Premium por vencer" value={expiringSubscriptions} />
            <StatCard label="Ingresos estimados mes" value={formatMoney(incomeMonth, true)} />
            <StatCard label="Referidos validos" value={validReferrals} />
            <StatCard label="Referidos pendientes" value={pendingReferrals} />
            <StatCard label="Credito aplicado" value={formatMoney(creditsApplied, true)} />
          </section>
          <section className="plans">
            <article className="plan-card">
              <span className="plan-card__label">Plan Esencial</span>
              <h2>$999/mes</h2>
              <p className="plan-card__copy">Lo basico para seguir el mercado sin complicarte.</p>
              <span className="plan-card__note">Sin prueba gratis / 2 alertas por email</span>
            </article>
            <article className="plan-card plan-card--featured">
              <span className="plan-card__label">Plan Seguimiento</span>
              <h2>$3.999/mes</h2>
              <p className="plan-card__copy">No llegues tarde a los movimientos del mercado.</p>
              <span className="plan-card__trial">7 dias gratis / hasta 4 alertas</span>
            </article>
            <article className="plan-card plan-card--premium plan-card--exclusive">
              <span className="plan-card__label">Plan Premium WhatsApp</span>
              <h2>$149.999/mes</h2>
              <p className="plan-card__copy">Pensado para quienes necesitan reaccionar primero.</p>
              <span className="plan-card__note">Sin prueba gratis / hasta 6 WhatsApp</span>
            </article>
          </section>
          <section className="admin-two-columns">
            <div className="admin-panel">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Mercado Pago</p>
                  <h2>Control de cobros</h2>
                </div>
              </div>
              <div className="admin-health-grid">
                <HealthPill label="Access token" ok={data.systemStatus.mercadoPago} />
                <HealthPill label="Webhook secret" ok={data.systemStatus.mercadoPagoWebhook} />
                <HealthPill label="App URL" ok={data.systemStatus.appUrl} />
              </div>
              <div className="button-row">
                <button
                  className="button button--ghost"
                  disabled={Boolean(actionLoading)}
                  type="button"
                  onClick={() =>
                    runPanelAction("test_mp", { action: "test_mercado_pago_config" }, "Mercado Pago revisado.", false)
                  }
                >
                  <CreditCard size={17} />
                  Revisar configuracion
                </button>
                <button className="button button--ghost" type="button" onClick={() => setMessage("Sincronizacion avanzada pendiente del webhook real de Mercado Pago.")}>
                  <RefreshCw size={17} />
                  Sincronizar pagos
                </button>
              </div>
            </div>
            <div className="admin-panel">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Suscripciones</p>
                  <h2>Ultimos estados</h2>
                </div>
              </div>
              <div className="admin-list">
                {data.subscriptions.slice(0, 24).map((subscription) => (
                  <article key={subscription.id}>
                    <WalletCards size={18} />
                    <div>
                      <strong>{planLabels[subscription.plan]}</strong>
                      <span>
                        {subscription.status} / {profileById.get(subscription.user_id)?.email ?? subscription.user_id} /
                        vence {formatDateTime(subscription.expires_at)}
                      </span>
                    </div>
                  </article>
                ))}
                {!data.subscriptions.length ? <div className="empty-state">Todavia no hay suscripciones registradas.</div> : null}
              </div>
            </div>
          </section>
          <section className="admin-two-columns">
            <div className="admin-panel">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Referidos</p>
                  <h2>Actividad reciente</h2>
                </div>
              </div>
              <div className="admin-list">
                {data.referralEvents.slice(0, 12).map((event) => (
                  <article key={event.id}>
                    <Users size={18} />
                    <div>
                      <strong>{event.referral_code}</strong>
                      <span>
                        {event.status} / referido {event.referred_user_id ?? "sin usuario"} / {formatDateTime(event.created_at)}
                      </span>
                    </div>
                    <button
                      className="button button--small button--danger"
                      disabled={event.status === "rejected" || isActionLoading(`referral-invalid:${event.id}`)}
                      type="button"
                      onClick={() => invalidateReferral(event)}
                    >
                      Invalidar
                    </button>
                  </article>
                ))}
                {!data.referralEvents.length ? <div className="empty-state">Ejecuta el SQL comercial para ver referidos.</div> : null}
              </div>
              <button
                className="button button--full"
                disabled={Boolean(actionLoading)}
                type="button"
                onClick={() => runPanelAction("validate_referrals", { action: "validate_referrals" }, "Referidos revisados.")}
              >
                <RefreshCw size={17} />
                Validar referidos
              </button>
            </div>
            <div className="admin-panel">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Creditos</p>
                  <h2>Historial comercial</h2>
                </div>
              </div>
              <div className="admin-list">
                <form className="admin-create" onSubmit={applyManualCredit}>
                  <div className="admin-fields">
                    <label className="field field--tight">
                      <span>Email usuario</span>
                      <input name="email" placeholder="usuario@email.com" required type="email" />
                    </label>
                    <label className="field field--tight">
                      <span>Credito $</span>
                      <input min="1" name="amount" required step="1" type="number" />
                    </label>
                    <label className="field field--tight">
                      <span>Motivo</span>
                      <input name="description" placeholder="Credito manual admin" />
                    </label>
                  </div>
                  <button className="button button--full" disabled={isActionLoading("manual_credit")} type="submit">
                    <WalletCards size={17} />
                    Aplicar credito manual
                  </button>
                </form>
                {data.referralCreditLedger.slice(0, 12).map((credit) => (
                  <article key={credit.id}>
                    <WalletCards size={18} />
                    <div>
                      <strong>{formatMoney(credit.credit_amount, true)}</strong>
                      <span>
                        {credit.type} / {credit.status} / {profileById.get(credit.user_id)?.email ?? credit.user_id} /
                        {credit.expires_at ? ` vence ${formatDateTime(credit.expires_at)}` : " sin vencimiento"}
                      </span>
                    </div>
                  </article>
                ))}
                {!data.referralCreditLedger.length ? <div className="empty-state">Sin creditos de referidos todavia.</div> : null}
              </div>
            </div>
          </section>
        </>
      ) : null}

      {activeTab === "alerts" ? (
        <>
          <section className="admin-stats admin-stats--wide">
            <StatCard label="Activas" value={activeAlerts} />
            <StatCard label="Pausadas" value={pausedAlerts} />
            <StatCard label="Email" value={data.alerts.filter((alert) => alert.channel === "email").length} />
            <StatCard label="WhatsApp" value={data.alerts.filter((alert) => alert.channel === "whatsapp").length} />
          </section>
          <section className="admin-command-panel">
            <div>
              <p className="eyebrow">Alertas predefinidas</p>
              <h2>Horarios de mercado</h2>
              <p>Apertura/cierre del mercado oficial y del mercado informal ya estan disponibles como condiciones del sistema.</p>
            </div>
            <button
              className="button"
              disabled={Boolean(actionLoading)}
              type="button"
              onClick={() => runPanelAction("check_alerts", { action: "check_alerts" }, "Alertas revisadas.")}
            >
              <Bell size={18} />
              Revisar alertas ahora
            </button>
          </section>
          <section className="admin-list">
            {data.alerts.map((alert) => (
              <article key={alert.id}>
                <Bell size={18} />
                <div>
                  <strong>
                    {alert.rate_code} / {alertLabel(alert)}
                  </strong>
                  <span>
                    {profileById.get(alert.user_id)?.email ?? alert.user_id} / {alert.channel} / objetivo {alert.target_value} /
                    {alert.is_active ? " activa" : " pausada"}
                  </span>
                </div>
                <div className="admin-actions-inline">
                  <button className="button button--small button--ghost" type="button" onClick={() => setAlertState(alert, !alert.is_active)}>
                    {alert.is_active ? <Pause size={14} /> : <Play size={14} />}
                    {alert.is_active ? "Pausar" : "Reactivar"}
                  </button>
                  <button className="button button--small button--danger" type="button" onClick={() => deleteAlert(alert)}>
                    <Trash2 size={14} />
                    Eliminar
                  </button>
                </div>
              </article>
            ))}
            {!data.alerts.length ? <div className="empty-state">Sin alertas creadas.</div> : null}
          </section>
        </>
      ) : null}

      {activeTab === "community" ? (
        <>
          <section className="community-panel">
            <p className="legal-note">
              Los valores publicados por usuarios corresponden a operaciones informadas de manera independiente y no representan una cotizacion
              oficial ni fijan precios de mercado.
            </p>
            <button className="button button--ghost" type="button" onClick={toggleCommunityFilters}>
              <Settings size={17} />
              Filtro automatico {data.communityFiltersEnabled ? "activo" : "apagado"}
            </button>
          </section>
          <section className="admin-stats admin-stats--wide">
            <StatCard label="Nuevos" value={data.communityReports.filter((report) => report.status === "pending").length} />
            <StatCard label="Aprobados" value={data.communityReports.filter((report) => report.status === "approved").length} />
            <StatCard label="Sospechosos" value={data.communityReports.filter((report) => report.status === "suspicious").length} />
            <StatCard label="Ocultos" value={data.communityReports.filter((report) => report.status === "rejected").length} />
          </section>
          <section className="admin-list">
            {data.communityReports.map((report) => (
              <article key={report.id}>
                <Users size={18} />
                <div>
                  <strong>
                    {report.operation_type === "buy" ? "Compra" : "Venta"} {report.currency} {report.amount} a ${report.rate}
                  </strong>
                  <span>
                    {report.department} / {report.status} / {report.comment || "sin comentario"} / {report.moderation_reason ?? "sin observacion"}
                  </span>
                </div>
                <div className="admin-actions-inline">
                  <button className="button button--small button--ghost" type="button" onClick={() => moderateCommunityReport(report, "approved")}>
                    OK
                  </button>
                  <button className="button button--small button--ghost" type="button" onClick={() => moderateCommunityReport(report, "suspicious")}>
                    Sospechoso
                  </button>
                  <button className="button button--small button--danger" type="button" onClick={() => moderateCommunityReport(report, "rejected")}>
                    Ocultar
                  </button>
                  <button className="button button--small button--danger" type="button" onClick={() => deleteCommunityReport(report)}>
                    Borrar
                  </button>
                </div>
              </article>
            ))}
            {!data.communityReports.length ? <div className="empty-state">Sin reportes comunitarios.</div> : null}
          </section>
        </>
      ) : null}

      {activeTab === "analytics" ? (
        <>
          <section className="admin-stats admin-stats--wide">
            <StatCard label="Visitas registradas" value={analyticsByEvent.page_view ?? 0} />
            <StatCard label="Clicks importantes" value={analyticsByEvent.click_importante ?? 0} />
            <StatCard label="Formularios enviados" value={analyticsByEvent.formulario_enviado ?? 0} />
            <StatCard label="Cookies aceptadas" value={analyticsByEvent.cookies_aceptadas ?? 0} />
          </section>
          <section className="admin-two-columns">
            <div className="admin-panel">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Paginas</p>
                  <h2>Mas visitadas</h2>
                </div>
              </div>
              <div className="admin-list">
                {analyticsByPage.map(([path, count]) => (
                  <article key={path}>
                    <BarChart3 size={18} />
                    <div>
                      <strong>{path}</strong>
                      <span>{count} eventos</span>
                    </div>
                  </article>
                ))}
              </div>
            </div>
            <div className="admin-panel">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Origen</p>
                  <h2>Dispositivo y trafico</h2>
                </div>
              </div>
              <div className="admin-list">
                {analyticsByDevice.map(([device, count]) => (
                  <article key={device}>
                    <BarChart3 size={18} />
                    <div>
                      <strong>{device}</strong>
                      <span>{count} eventos por dispositivo</span>
                    </div>
                  </article>
                ))}
                {analyticsBySource.map(([source, count]) => (
                  <article key={source}>
                    <Sparkles size={18} />
                    <div>
                      <strong>{source}</strong>
                      <span>{count} eventos por origen</span>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </section>
        </>
      ) : null}

      {activeTab === "content" ? (
        <section className="admin-two-columns">
          <div className="admin-panel">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Contenido</p>
                <h2>Educacion y textos</h2>
              </div>
            </div>
            <div className="admin-list">
              {data.educationCards.map((card) => (
                <article key={card.id}>
                  <FileText size={18} />
                  <div>
                    <strong>{card.title}</strong>
                    <span>
                      {card.category} / {card.is_visible ? "visible" : "oculto"}
                    </span>
                  </div>
                </article>
              ))}
              {!data.educationCards.length ? <div className="empty-state">Sin tarjetas educativas cargadas.</div> : null}
            </div>
          </div>
          <div className="admin-panel">
            <div className="section-heading">
              <div>
                <p className="eyebrow">SEO / legales</p>
                <h2>Bloques preparados</h2>
              </div>
            </div>
            <div className="source-list">
              <article>
                <div>
                  <strong>Membresias</strong>
                  <span>Textos comerciales version Esencial, Seguimiento y Premium.</span>
                </div>
              </article>
              <article>
                <div>
                  <strong>Emails</strong>
                  <span>Confirmacion y recuperacion quedan en Supabase Auth.</span>
                </div>
              </article>
              <article>
                <div>
                  <strong>Legal comunidad</strong>
                  <span>Texto visible y moderacion automatica conservada.</span>
                </div>
              </article>
            </div>
          </div>
        </section>
      ) : null}

      {activeTab === "support" ? (
        <section className="admin-two-columns">
          <div className="admin-panel">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Soporte</p>
                <h2>Mensajes de usuarios</h2>
              </div>
            </div>
            <div className="admin-list">
              {data.supportMessages.map((item) => (
                <article key={item.id}>
                  <LifeBuoy size={18} />
                  <div>
                    <strong>
                      {item.reason} / {item.status === "resolved" ? "resuelto" : "nuevo"}
                    </strong>
                    <span>
                      {item.email} / {formatDateTime(item.created_at)}
                    </span>
                    <small>{item.message}</small>
                  </div>
                  {item.status !== "resolved" ? (
                    <div className="admin-actions-inline">
                      <button
                        className="button button--ghost"
                        disabled={isActionLoading(`support:${item.id}`)}
                        type="button"
                        onClick={() => resolveSupportMessage(item)}
                      >
                        <Check size={15} />
                        Resolver
                      </button>
                    </div>
                  ) : null}
                </article>
              ))}
              {!data.supportMessages.length ? <div className="empty-state">Todavia no hay mensajes de soporte.</div> : null}
            </div>
          </div>
          <div className="admin-panel">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Errores</p>
                <h2>Alertas fallidas</h2>
              </div>
            </div>
            <div className="admin-list">
              {data.notificationJobs
                .filter((job) => job.status === "failed")
                .map((job) => (
                  <article key={job.id}>
                    <LifeBuoy size={18} />
                    <div>
                      <strong>Email/alerta fallida</strong>
                      <span>
                        {job.recipient} / {job.last_error ?? "sin detalle"} / {formatDateTime(job.processed_at ?? job.created_at)}
                      </span>
                    </div>
                  </article>
                ))}
              {failedJobs === 0 ? <div className="empty-state">No hay alertas con error en los ultimos trabajos cargados.</div> : null}
            </div>
            <div className="section-heading section-heading--stacked">
              <div>
                <p className="eyebrow">Cuentas</p>
                <h2>Atencion comercial</h2>
              </div>
            </div>
            <div className="admin-list">
              {data.subscriptions
                .filter((subscription) => subscription.status === "pending" || subscription.status === "expired")
                .map((subscription) => (
                  <article key={subscription.id}>
                    <LifeBuoy size={18} />
                    <div>
                      <strong>{profileById.get(subscription.user_id)?.email ?? subscription.user_id}</strong>
                      <span>
                        {planLabels[subscription.plan]} / {subscription.status}
                      </span>
                    </div>
                  </article>
                ))}
            </div>
          </div>
        </section>
      ) : null}

      {activeTab === "automation" ? (
        <section className="admin-two-columns">
          <div className="admin-panel">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Automatizaciones</p>
                <h2>Acciones manuales</h2>
              </div>
            </div>
            <div className="admin-action-grid">
              <button className="button" disabled={Boolean(actionLoading)} type="button" onClick={() => runPanelAction("run_automation", { action: "run_automation" }, "Actualizado correctamente.")}>
                <RefreshCw size={17} />
                Ejecutar cron manual
              </button>
              <button className="button button--ghost" disabled={Boolean(actionLoading)} type="button" onClick={() => runPanelAction("update_rates", { action: "update_rates" }, "Cotizaciones actualizadas.")}>
                <Database size={17} />
                Probar cotizaciones
              </button>
              <button className="button button--ghost" disabled={Boolean(actionLoading)} type="button" onClick={() => runPanelAction("check_alerts", { action: "check_alerts" }, "Alertas revisadas.")}>
                <Bell size={17} />
                Probar alertas
              </button>
              <button className="button button--ghost" disabled={Boolean(actionLoading)} type="button" onClick={() => runPanelAction("process_notifications", { action: "process_notifications" }, "Pendientes procesados.")}>
                <Mail size={17} />
                Procesar pendientes
              </button>
            </div>
          </div>
          <div className="admin-panel">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Logs</p>
                <h2>Ultimas ejecuciones</h2>
              </div>
            </div>
            <div className="admin-list">
              {data.sourceUpdateLogs.map((log) => (
                <article key={log.id}>
                  <Clock3 size={18} />
                  <div>
                    <strong>
                      {log.status} / {(log.updated_codes ?? []).length} datos
                    </strong>
                    <span>
                      {formatDateTime(log.finished_at)} / {(log.errors ?? []).length ? `${log.errors.length} errores` : "sin errores"}
                    </span>
                  </div>
                </article>
              ))}
              {!data.sourceUpdateLogs.length ? <div className="empty-state">Sin ejecuciones registradas todavia.</div> : null}
            </div>
          </div>
        </section>
      ) : null}

      {activeTab === "system" ? (
        <section className="admin-two-columns">
          <div className="admin-panel">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Sistema</p>
                <h2>Variables y servicios</h2>
              </div>
            </div>
            <div className="admin-health-grid">
              <HealthPill label="NEXT_PUBLIC_APP_URL" ok={data.systemStatus.appUrl} />
              <HealthPill label="SUPABASE" ok={data.systemStatus.supabase} />
              <HealthPill label="RESEND_API_KEY + ALERT_FROM_EMAIL" ok={data.systemStatus.resend} />
              <HealthPill label="MERCADO_PAGO_ACCESS_TOKEN" ok={data.systemStatus.mercadoPago} />
              <HealthPill label="MERCADO_PAGO_WEBHOOK_SECRET" ok={data.systemStatus.mercadoPagoWebhook} />
              <HealthPill label="CRON / AUTOMATION secret" ok={data.systemStatus.cron} />
            </div>
          </div>
          <div className="admin-panel">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Pruebas</p>
                <h2>Chequeos rapidos</h2>
              </div>
            </div>
            <div className="admin-action-grid">
              <button className="button button--ghost" disabled={Boolean(actionLoading)} type="button" onClick={() => runPanelAction("test_email", { action: "test_email" }, "Email revisado.", false)}>
                <Mail size={17} />
                Probar email
              </button>
              <button className="button button--ghost" disabled={Boolean(actionLoading)} type="button" onClick={() => runPanelAction("update_rates", { action: "update_rates" }, "Cotizaciones revisadas.")}>
                <Database size={17} />
                Probar cotizaciones
              </button>
              <button className="button button--ghost" disabled={Boolean(actionLoading)} type="button" onClick={() => runPanelAction("check_alerts", { action: "check_alerts" }, "Alertas revisadas.")}>
                <Bell size={17} />
                Probar alertas
              </button>
              <button className="button button--ghost" disabled={Boolean(actionLoading)} type="button" onClick={() => runPanelAction("test_mp", { action: "test_mercado_pago_config" }, "Mercado Pago revisado.", false)}>
                <CreditCard size={17} />
                Probar Mercado Pago
              </button>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}
