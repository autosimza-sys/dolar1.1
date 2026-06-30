import { NextResponse, type NextRequest } from "next/server";
import { processAlerts, processPendingNotificationJobs } from "@/lib/alert-processor";
import {
  findWinnerByOfficialNumbers,
  parseOfficialNumbers,
  runAutomaticGiveawayFallback,
  syncGiveawayTickets,
  updateGiveawayLegalText,
  updateGiveawayStatus,
  upsertGiveaway
} from "@/lib/giveaways";
import { sendAlertEmail } from "@/lib/notifications";
import { updateRatesFromSources } from "@/lib/rate-updater";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type AdminAction =
  | "save_rate"
  | "mark_rate_unreliable"
  | "toggle_rate_source"
  | "save_blue_mendoza_manual"
  | "toggle_community_filters"
  | "moderate_community_report"
  | "delete_community_report"
  | "create_rate"
  | "run_automation"
  | "update_rates"
  | "check_alerts"
  | "process_notifications"
  | "pause_alert"
  | "reactivate_alert"
  | "delete_alert"
  | "update_user_premium"
  | "validate_referrals"
  | "invalidate_referral"
  | "apply_manual_credit"
  | "test_email"
  | "test_mercado_pago_config"
  | "resolve_support_message"
  | "upsert_giveaway"
  | "update_giveaway_legal"
  | "set_giveaway_status"
  | "sync_giveaway_tickets"
  | "load_giveaway_official_result"
  | "run_giveaway_automatic_fallback";

type AdminActionBody = {
  action?: AdminAction;
  rateCode?: string;
  sourceId?: string;
  reportId?: string;
  alertId?: string;
  referralId?: string;
  giveawayId?: string;
  userId?: string;
  status?: string;
  enabled?: boolean;
  plan?: string;
  officialNumbers?: unknown;
  officialDrawDate?: string | null;
  payload?: Record<string, unknown>;
};

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

function requireString(value: unknown, field: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Falta ${field}.`);
  }

  return value.trim();
}

function finiteNumber(value: unknown) {
  const numberValue = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
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

function planFromBody(plan: unknown) {
  if (plan === "essential_monthly" || plan === "tracking_monthly" || plan === "premium_monthly") return plan;
  return "premium_monthly";
}

export async function POST(request: NextRequest) {
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

  const body = (await request.json().catch(() => ({}))) as AdminActionBody;

  try {
    if (body.action === "save_rate") {
      const rateCode = requireString(body.rateCode, "rateCode");
      const { error } = await supabaseAdmin.from("rates").update(body.payload ?? {}).eq("code", rateCode);
      if (error) throw error;
      return NextResponse.json({ ok: true, message: "Cotizacion actualizada correctamente." });
    }

    if (body.action === "mark_rate_unreliable") {
      const rateCode = requireString(body.rateCode, "rateCode");
      const { error } = await supabaseAdmin
        .from("rates")
        .update({
          source: "Sin fuente confiable",
          is_visible: false,
          updated_at: new Date().toISOString()
        })
        .eq("code", rateCode);
      if (error) throw error;
      return NextResponse.json({ ok: true, message: "Moneda ocultada por falta de fuente confiable." });
    }

    if (body.action === "toggle_rate_source") {
      const sourceId = requireString(body.sourceId, "sourceId");
      const { error } = await supabaseAdmin.from("rate_sources").update({ enabled: Boolean(body.enabled) }).eq("id", sourceId);
      if (error) throw error;
      return NextResponse.json({ ok: true, message: "Fuente actualizada correctamente." });
    }

    if (body.action === "save_blue_mendoza_manual") {
      const { error } = await supabaseAdmin.from("admin_settings").upsert(
        {
          key: "blue_mendoza_manual",
          value: body.payload ?? {}
        },
        { onConflict: "key" }
      );
      if (error) throw error;

      const payload = body.payload ?? {};
      const manualEnabled = Boolean(payload.enabled);
      const buyPrice = finiteNumber(payload.buy_price);
      const sellPrice = finiteNumber(payload.sell_price);

      if (manualEnabled && (buyPrice !== null || sellPrice !== null)) {
        const { error: rateError } = await supabaseAdmin.from("rates").upsert(
          {
            code: "USD_BLUE_MENDOZA",
            name: "Dolar Blue Mendoza",
            country: "Mendoza",
            flag: "ARUS",
            type: "main",
            buy_price: buyPrice,
            sell_price: sellPrice,
            variation: 0,
            source: "Manual admin",
            is_visible: true,
            updated_at: new Date().toISOString()
          },
          { onConflict: "code" }
        );
        if (rateError) throw rateError;
      }

      return NextResponse.json({ ok: true, message: "Blue Mendoza manual actualizado." });
    }

    if (body.action === "toggle_community_filters") {
      const { error } = await supabaseAdmin.from("admin_settings").upsert(
        {
          key: "community_filters_enabled",
          value: Boolean(body.enabled)
        },
        { onConflict: "key" }
      );
      if (error) throw error;
      return NextResponse.json({ ok: true, message: "Filtro de comunidad actualizado." });
    }

    if (body.action === "moderate_community_report") {
      const reportId = requireString(body.reportId, "reportId");
      const nextStatus = body.status === "approved" ? "approved" : body.status === "suspicious" ? "suspicious" : "rejected";
      const { error } = await supabaseAdmin
        .from("community_reports")
        .update({
          status: nextStatus,
          include_in_stats: nextStatus === "approved",
          moderation_reason:
            nextStatus === "approved" ? null : nextStatus === "suspicious" ? "Marcado como sospechoso por admin" : "Moderado por admin"
        })
        .eq("id", reportId);
      if (error) throw error;
      return NextResponse.json({ ok: true, message: "Reporte actualizado correctamente." });
    }

    if (body.action === "delete_community_report") {
      const reportId = requireString(body.reportId, "reportId");
      const { error } = await supabaseAdmin.from("community_reports").delete().eq("id", reportId);
      if (error) throw error;
      return NextResponse.json({ ok: true, message: "Reporte eliminado correctamente." });
    }

    if (body.action === "create_rate") {
      const { error } = await supabaseAdmin.from("rates").upsert(body.payload ?? {});
      if (error) throw error;
      return NextResponse.json({ ok: true, message: "Cotizacion cargada correctamente." });
    }

    if (body.action === "run_automation") {
      const ratesResult = await updateRatesFromSources();
      const alertsResult = await processAlerts({ sendEmails: true });

      return NextResponse.json({
        ok: true,
        message: `Actualizado correctamente. Cotizaciones: ${ratesResult.updated.length}. Alertas revisadas: ${alertsResult.checked}.`,
        rates: ratesResult,
        alerts: alertsResult
      });
    }

    if (body.action === "update_rates") {
      const result = await updateRatesFromSources();
      return NextResponse.json({
        ok: true,
        message: `Cotizaciones actualizadas: ${result.updated.length}.`,
        result
      });
    }

    if (body.action === "check_alerts") {
      const result = await processAlerts({ sendEmails: true });
      return NextResponse.json({
        ok: true,
        message: `Alertas revisadas: ${result.checked}. Encoladas: ${result.queued.length}.`,
        result
      });
    }

    if (body.action === "process_notifications") {
      const result = await processPendingNotificationJobs();
      return NextResponse.json({
        ok: true,
        message: `Notificaciones procesadas: ${result.length}.`,
        result
      });
    }

    if (body.action === "pause_alert" || body.action === "reactivate_alert") {
      const alertId = requireString(body.alertId, "alertId");
      const { error } = await supabaseAdmin
        .from("alerts")
        .update({ is_active: body.action === "reactivate_alert" })
        .eq("id", alertId);
      if (error) throw error;
      return NextResponse.json({
        ok: true,
        message: body.action === "reactivate_alert" ? "Alerta reactivada." : "Alerta pausada."
      });
    }

    if (body.action === "delete_alert") {
      const alertId = requireString(body.alertId, "alertId");
      const { error } = await supabaseAdmin.from("alerts").delete().eq("id", alertId);
      if (error) throw error;
      return NextResponse.json({ ok: true, message: "Alerta eliminada." });
    }

    if (body.action === "update_user_premium") {
      const userId = requireString(body.userId, "userId");
      const isPremium = Boolean(body.enabled);
      const plan = planFromBody(body.plan);

      const { error: profileError } = await supabaseAdmin.from("profiles").update({ is_premium: isPremium }).eq("id", userId);
      if (profileError) throw profileError;

      if (isPremium) {
        const expiresAt = new Date(Date.now() + 32 * 24 * 60 * 60 * 1000).toISOString();
        const { data: existingSubscription } = await supabaseAdmin
          .from("subscriptions")
          .select("id")
          .eq("user_id", userId)
          .eq("plan", plan)
          .maybeSingle();

        if (existingSubscription?.id) {
          const { error: subscriptionError } = await supabaseAdmin
            .from("subscriptions")
            .update({
              mercado_pago_payment_id: "manual-admin",
              status: "active",
              started_at: new Date().toISOString(),
              expires_at: expiresAt
            })
            .eq("id", existingSubscription.id);
          if (subscriptionError) throw subscriptionError;
        } else {
          const { error: subscriptionError } = await supabaseAdmin.from("subscriptions").insert({
            user_id: userId,
            mercado_pago_payment_id: "manual-admin",
            status: "active",
            plan,
            started_at: new Date().toISOString(),
            expires_at: expiresAt
          });
          if (subscriptionError) throw subscriptionError;
        }
      } else {
        const { error: subscriptionError } = await supabaseAdmin
          .from("subscriptions")
          .update({ status: "cancelled", expires_at: new Date().toISOString() })
          .eq("user_id", userId);
        if (subscriptionError) throw subscriptionError;
      }

      return NextResponse.json({
        ok: true,
        message: isPremium ? "Premium activado manualmente." : "Premium desactivado manualmente."
      });
    }

    if (body.action === "validate_referrals") {
      const { data, error } = await supabaseAdmin.rpc("validate_referrals");
      if (error) {
        throw new Error("Falta ejecutar el SQL comercial de referidos.");
      }

      return NextResponse.json({
        ok: true,
        message: `Referidos validados: ${Number(data ?? 0)}.`
      });
    }

    if (body.action === "invalidate_referral") {
      const referralId = requireString(body.referralId, "referralId");
      const { error } = await supabaseAdmin
        .from("referral_events")
        .update({ status: "rejected", validated_at: new Date().toISOString() })
        .eq("id", referralId);
      if (error) throw error;
      return NextResponse.json({ ok: true, message: "Referido invalidado correctamente." });
    }

    if (body.action === "apply_manual_credit") {
      const userId = requireString(body.userId, "userId");
      const amount = finiteNumber(body.payload?.amount);
      const description = String(body.payload?.description ?? "Credito manual admin");

      if (!amount || amount <= 0) {
        throw new Error("El credito manual debe ser mayor a cero.");
      }

      const { error } = await supabaseAdmin.from("referral_credit_ledger").insert({
        user_id: userId,
        points: Math.floor(amount / 50) * 1000,
        credit_amount: amount,
        type: "manual",
        status: "active",
        description,
        expires_at: new Date(Date.now() + 120 * 24 * 60 * 60 * 1000).toISOString()
      });

      if (error) throw error;
      return NextResponse.json({ ok: true, message: "Credito manual aplicado correctamente." });
    }

    if (body.action === "test_email") {
      const result = await sendAlertEmail({
        to: user.email,
        message: "Email de prueba enviado desde el panel admin de Dolar MZA."
      });

      return NextResponse.json({
        ok: true,
        message: result.skipped ? `No se envio: ${result.reason}` : "Email de prueba enviado correctamente.",
        result
      });
    }

    if (body.action === "resolve_support_message") {
      const supportId = requireString(body.payload?.id, "id de soporte");
      const { error } = await supabaseAdmin
        .from("support_messages")
        .update({ status: "resolved", resolved_at: new Date().toISOString() })
        .eq("id", supportId);

      if (error) throw error;
      return NextResponse.json({ ok: true, message: "Mensaje de soporte resuelto." });
    }

    if (body.action === "test_mercado_pago_config") {
      const missing = [
        ["MERCADO_PAGO_ACCESS_TOKEN", process.env.MERCADO_PAGO_ACCESS_TOKEN],
        ["MERCADO_PAGO_WEBHOOK_SECRET", process.env.MERCADO_PAGO_WEBHOOK_SECRET],
        ["NEXT_PUBLIC_APP_URL", process.env.NEXT_PUBLIC_APP_URL]
      ]
        .filter(([, value]) => !value)
        .map(([key]) => key);

      return NextResponse.json({
        ok: missing.length === 0,
        message: missing.length
          ? `Falta configurar: ${missing.join(", ")}.`
          : "Mercado Pago tiene las variables principales configuradas.",
        missing
      });
    }

    if (body.action === "upsert_giveaway") {
      const giveaway = await upsertGiveaway(supabaseAdmin, body.payload ?? {});
      return NextResponse.json({
        ok: true,
        message: "Sorteo guardado correctamente.",
        giveaway
      });
    }

    if (body.action === "set_giveaway_status") {
      const giveawayId = requireString(body.giveawayId, "giveawayId");
      const status =
        body.status === "draft" ||
        body.status === "active" ||
        body.status === "paused" ||
        body.status === "closed" ||
        body.status === "completed"
          ? body.status
          : "paused";

      await updateGiveawayStatus(supabaseAdmin, giveawayId, status);
      return NextResponse.json({ ok: true, message: "Estado del sorteo actualizado." });
    }

    if (body.action === "update_giveaway_legal") {
      const giveawayId = requireString(body.giveawayId, "giveawayId");
      const legalText = requireString(body.payload?.legal_text, "bases y condiciones");
      const legalVersion = String(body.payload?.legal_version ?? "1.0");
      const giveaway = await updateGiveawayLegalText(supabaseAdmin, giveawayId, legalText, legalVersion);

      return NextResponse.json({
        ok: true,
        message: "Bases y condiciones actualizadas.",
        giveaway
      });
    }

    if (body.action === "sync_giveaway_tickets") {
      const result = await syncGiveawayTickets(supabaseAdmin, body.userId ?? null);
      return NextResponse.json({
        ok: true,
        message: `Tickets sincronizados. Nuevos: ${Number(result?.inserted ?? 0)}.`,
        result
      });
    }

    if (body.action === "load_giveaway_official_result") {
      const giveawayId = requireString(body.giveawayId, "giveawayId");
      const officialNumbers = parseOfficialNumbers(body.officialNumbers ?? body.payload?.official_numbers);
      const result = await findWinnerByOfficialNumbers(supabaseAdmin, giveawayId, officialNumbers, body.officialDrawDate);

      return NextResponse.json({
        ok: true,
        message: result
          ? `Ganador encontrado con el numero ${String(result.winning_number).padStart(4, "0")}.`
          : "Resultado cargado. No hubo coincidencia oficial del premio 1 al 20.",
        result
      });
    }

    if (body.action === "run_giveaway_automatic_fallback") {
      const giveawayId = requireString(body.giveawayId, "giveawayId");
      const result = await runAutomaticGiveawayFallback(supabaseAdmin, giveawayId);

      return NextResponse.json({
        ok: true,
        message: `Sorteo automatico ejecutado. Numero ganador: ${String(result.winning_number).padStart(4, "0")}.`,
        result
      });
    }

    return NextResponse.json({ error: "Accion de admin no reconocida." }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo ejecutar la accion.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
