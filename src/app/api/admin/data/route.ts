import { NextResponse } from "next/server";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const DEFAULT_ADMIN_EMAILS = ["autosimza@gmail.com", "admin@dolarmendoza.app"];

function adminEmailsFromEnv() {
  const configured = (process.env.NEXT_PUBLIC_ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

  return configured.length ? configured : DEFAULT_ADMIN_EMAILS;
}

function parseAdminEmails(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item).trim().toLowerCase()).filter(Boolean);
}

async function isAdminEmail(email: string) {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) return false;

  if (adminEmailsFromEnv().includes(normalizedEmail)) return true;

  const supabaseAdmin = createSupabaseAdminClient();
  if (!supabaseAdmin) return false;

  const { data } = await supabaseAdmin
    .from("admin_settings")
    .select("value")
    .eq("key", "admin_emails")
    .maybeSingle();

  return parseAdminEmails(data?.value).includes(normalizedEmail);
}

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const supabaseAdmin = createSupabaseAdminClient();

  if (!supabase || !supabaseAdmin) {
    return NextResponse.json({ error: "Falta configurar Supabase en el servidor." }, { status: 500 });
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user?.email || !(await isAdminEmail(user.email))) {
    return NextResponse.json({ error: "Tu usuario no tiene permiso de administrador." }, { status: 403 });
  }

  const [
    rates,
    profiles,
    alerts,
    subscriptions,
    educationCards,
    notificationJobs,
    sourceUpdateLogs,
    rateSources,
    sourceReadings,
    communityReports,
    blueMendozaManual,
    communityFilters
  ] = await Promise.all([
    supabaseAdmin.from("rates").select("*").order("type", { ascending: true }).order("name", { ascending: true }),
    supabaseAdmin.from("profiles").select("*").order("created_at", { ascending: false }).limit(100),
    supabaseAdmin.from("alerts").select("*").order("created_at", { ascending: false }).limit(200),
    supabaseAdmin.from("subscriptions").select("*").order("started_at", { ascending: false }).limit(100),
    supabaseAdmin.from("education_cards").select("*").order("created_at", { ascending: false }).limit(100),
    supabaseAdmin.from("notification_jobs").select("*").order("created_at", { ascending: false }).limit(20),
    supabaseAdmin.from("source_update_logs").select("*").order("finished_at", { ascending: false }).limit(10),
    supabaseAdmin.from("rate_sources").select("*").order("priority", { ascending: true }),
    supabaseAdmin.from("rate_source_readings").select("*").order("fetched_at", { ascending: false }).limit(40),
    supabaseAdmin.from("community_reports").select("*").order("created_at", { ascending: false }).limit(80),
    supabaseAdmin.from("admin_settings").select("value").eq("key", "blue_mendoza_manual").maybeSingle(),
    supabaseAdmin.from("admin_settings").select("value").eq("key", "community_filters_enabled").maybeSingle()
  ]);

  const analyticsEvents = await supabaseAdmin
    .from("analytics_events")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(300);

  const [paymentEvents, referralEvents, referralCreditLedger] = await Promise.all([
    supabaseAdmin.from("payment_events").select("*").order("created_at", { ascending: false }).limit(120),
    supabaseAdmin.from("referral_events").select("*").order("created_at", { ascending: false }).limit(120),
    supabaseAdmin.from("referral_credit_ledger").select("*").order("created_at", { ascending: false }).limit(120)
  ]);

  const supportMessages = await supabaseAdmin
    .from("support_messages")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(80);

  const firstError =
    rates.error ??
    profiles.error ??
    alerts.error ??
    subscriptions.error ??
    educationCards.error ??
    notificationJobs.error ??
    sourceUpdateLogs.error ??
    rateSources.error ??
    sourceReadings.error ??
    communityReports.error ??
    blueMendozaManual.error ??
    communityFilters.error;

  if (firstError) {
    return NextResponse.json({ error: firstError.message }, { status: 500 });
  }

  return NextResponse.json({
    rates: rates.data ?? [],
    profiles: profiles.data ?? [],
    alerts: alerts.data ?? [],
    subscriptions: subscriptions.data ?? [],
    educationCards: educationCards.data ?? [],
    notificationJobs: notificationJobs.data ?? [],
    sourceUpdateLogs: sourceUpdateLogs.data ?? [],
    rateSources: rateSources.data ?? [],
    sourceReadings: sourceReadings.data ?? [],
    communityReports: communityReports.data ?? [],
    analyticsEvents: analyticsEvents.error ? [] : (analyticsEvents.data ?? []),
    paymentEvents: paymentEvents.error ? [] : (paymentEvents.data ?? []),
    referralEvents: referralEvents.error ? [] : (referralEvents.data ?? []),
    referralCreditLedger: referralCreditLedger.error ? [] : (referralCreditLedger.data ?? []),
    supportMessages: supportMessages.error ? [] : (supportMessages.data ?? []),
    blueMendozaManual: blueMendozaManual.data?.value ?? null,
    communityFiltersEnabled: communityFilters.data?.value !== false,
    systemStatus: {
      supabase: true,
      resend: Boolean(process.env.RESEND_API_KEY && process.env.ALERT_FROM_EMAIL),
      mercadoPago: Boolean(process.env.MERCADO_PAGO_ACCESS_TOKEN),
      mercadoPagoWebhook: Boolean(process.env.MERCADO_PAGO_WEBHOOK_SECRET),
      cron: Boolean(
        process.env.AUTOMATION_SECRET ||
          process.env.CRON_SECRET ||
          process.env.RATES_UPDATE_SECRET ||
          process.env.ALERTS_CRON_SECRET
      ),
      appUrl: Boolean(process.env.NEXT_PUBLIC_APP_URL),
      analytics: !analyticsEvents.error
    }
  });
}
