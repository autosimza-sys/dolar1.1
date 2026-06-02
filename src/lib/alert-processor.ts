import { evaluateAlert } from "@/lib/alert-rules";
import { getErrorMessage } from "@/lib/error-message";
import { sendAlertEmail } from "@/lib/notifications";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import type { NotificationJob, Profile, Rate, UserAlert } from "@/lib/types";

type ProcessAlertsOptions = {
  sendEmails?: boolean;
  dedupeHours?: number;
  maxJobs?: number;
  force?: boolean;
};

type QueuedAlert = {
  alert_id: string;
  message: string;
  job_id?: string;
  email?: string;
  email_status?: string;
};

type AlertDiagnostic = {
  alert_id: string;
  rate_code: string;
  condition_type: string;
  channel: string;
  target_value: number;
  current_value: number | null;
  should_send: boolean;
  status: "not_triggered" | "cooldown" | "missing_recipient" | "queued";
  reason: string;
};

function sellValue(rate: Rate | undefined) {
  return rate?.sell_price ?? rate?.buy_price ?? null;
}

function alertDiagnosticReason(alert: UserAlert, rates: Rate[]) {
  const rate = rates.find((item) => item.code === alert.rate_code);
  const current = sellValue(rate);
  const target = Number(alert.target_value);

  if (!rate) return "No existe una cotizacion visible para esta alerta.";
  if (alert.condition_type === "above" && current !== null) return `Valor actual ${current} menor que objetivo ${target}.`;
  if ((alert.condition_type === "below" || alert.condition_type === "mep_below") && current !== null) {
    return `Valor actual ${current} mayor que objetivo ${target}.`;
  }
  if (alert.condition_type === "rate_up" && current !== null && target > 0) {
    return `Tasa actual ${current}% menor que objetivo ${target}%.`;
  }
  if (alert.condition_type === "rate_down" && current !== null && target > 0) {
    return `Tasa actual ${current}% mayor que objetivo ${target}%.`;
  }
  if (alert.condition_type.includes("market_")) return "Alerta de horario fuera de la ventana actual.";
  return "La condicion todavia no se cumple.";
}

async function enqueueNotificationJobs(
  alerts: UserAlert[],
  rates: Rate[],
  profiles: Map<string, Profile>,
  dedupeHours: number,
  force: boolean
) {
  const supabase = createSupabaseAdminClient();
  if (!supabase) throw new Error("Falta SUPABASE_SERVICE_ROLE_KEY.");

  const since = new Date(Date.now() - dedupeHours * 60 * 60 * 1000).toISOString();
  const queued: QueuedAlert[] = [];
  const diagnostics: AlertDiagnostic[] = [];

  for (const alert of alerts) {
    const evaluation = evaluateAlert(alert, rates);
    const rate = rates.find((item) => item.code === alert.rate_code);
    const baseDiagnostic = {
      alert_id: alert.id,
      rate_code: alert.rate_code,
      condition_type: alert.condition_type,
      channel: alert.channel,
      target_value: Number(alert.target_value),
      current_value: sellValue(rate),
      should_send: evaluation.shouldSend
    };

    if (!evaluation.shouldSend) {
      diagnostics.push({
        ...baseDiagnostic,
        status: "not_triggered",
        reason: alertDiagnosticReason(alert, rates)
      });
      continue;
    }

    if (!force) {
      const { data: recentSentJobs } = await supabase
        .from("notification_jobs")
        .select("id")
        .eq("alert_id", alert.id)
        .eq("status", "sent")
        .gte("processed_at", since)
        .limit(1);

      if (recentSentJobs?.length) {
        diagnostics.push({
          ...baseDiagnostic,
          status: "cooldown",
          reason: `Ya se envio esta alerta recientemente. Se evita repetir durante ${dedupeHours} horas.`
        });
        continue;
      }
    }

    const profile = profiles.get(alert.user_id);
    const recipient = alert.channel === "email" ? profile?.email : profile?.phone;

    if (!recipient) {
      const { data: job } = await supabase
        .from("notification_jobs")
        .insert({
          alert_id: alert.id,
          user_id: alert.user_id,
          channel: alert.channel,
          recipient: "sin-destinatario",
          message: evaluation.message,
          status: "skipped",
          attempts: 0,
          last_error: "El usuario no tiene destinatario configurado.",
          processed_at: new Date().toISOString()
        })
        .select("id")
        .single();

      queued.push({
        alert_id: alert.id,
        message: evaluation.message,
        job_id: job?.id,
        email_status: "sin destinatario"
      });
      diagnostics.push({
        ...baseDiagnostic,
        status: "missing_recipient",
        reason: alert.channel === "email" ? "El usuario no tiene email en profile." : "El usuario no tiene WhatsApp configurado."
      });
      continue;
    }

    const { data: job, error } = await supabase
      .from("notification_jobs")
      .insert({
        alert_id: alert.id,
        user_id: alert.user_id,
        channel: alert.channel,
        recipient,
        message: evaluation.message,
        status: "pending",
        attempts: 0
      })
      .select("id")
      .single();

    if (error) throw error;

    queued.push({
      alert_id: alert.id,
      message: evaluation.message,
      job_id: job?.id,
      email: alert.channel === "email" ? recipient : undefined,
      email_status: alert.channel === "email" ? "pendiente" : undefined
    });
    diagnostics.push({
      ...baseDiagnostic,
      status: "queued",
      reason: alert.channel === "email" ? "Email encolado para enviar." : "WhatsApp encolado, proveedor pendiente."
    });
  }

  return { queued, diagnostics };
}

export async function processPendingNotificationJobs(maxJobs = 25) {
  const supabase = createSupabaseAdminClient();
  if (!supabase) throw new Error("Falta SUPABASE_SERVICE_ROLE_KEY.");

  const { data: jobRows, error } = await supabase
    .from("notification_jobs")
    .select("*")
    .in("status", ["pending", "failed"])
    .lt("attempts", 5)
    .order("created_at", { ascending: true })
    .limit(maxJobs);

  if (error) throw new Error(getErrorMessage(error, "No se pudieron leer notification_jobs."));

  const jobs = (jobRows as NotificationJob[] | null) ?? [];
  const processed: Array<{ job_id: string; status: string; error?: string }> = [];

  for (const job of jobs) {
    await supabase
      .from("notification_jobs")
      .update({ status: "processing", attempts: job.attempts + 1, last_error: null })
      .eq("id", job.id);

    try {
      if (job.channel === "email") {
        const result = await sendAlertEmail({ to: job.recipient, message: job.message });
        const status = result.skipped ? "skipped" : "sent";
        const lastError = result.skipped ? (result.reason ?? "Envío omitido.") : null;

        await supabase
          .from("notification_jobs")
          .update({
            status,
            last_error: lastError,
            processed_at: new Date().toISOString()
          })
          .eq("id", job.id);

        if (status === "sent") {
          await supabase.from("alert_logs").insert({
            alert_id: job.alert_id,
            user_id: job.user_id,
            message: job.message
          });
        }

        processed.push({ job_id: job.id, status, error: lastError ?? undefined });
        continue;
      }

      await supabase
        .from("notification_jobs")
        .update({
          status: "skipped",
          last_error: "WhatsApp todavía no está configurado.",
          processed_at: new Date().toISOString()
        })
        .eq("id", job.id);

      processed.push({ job_id: job.id, status: "skipped", error: "WhatsApp todavía no está configurado." });
    } catch (sendError) {
      const message = sendError instanceof Error ? sendError.message : "Falló el envío.";

      await supabase
        .from("notification_jobs")
        .update({
          status: "failed",
          last_error: message,
          processed_at: new Date().toISOString()
        })
        .eq("id", job.id);

      processed.push({ job_id: job.id, status: "failed", error: message });
    }
  }

  return processed;
}

export async function processAlerts(options: ProcessAlertsOptions = {}) {
  const supabase = createSupabaseAdminClient();
  if (!supabase) throw new Error("Falta SUPABASE_SERVICE_ROLE_KEY.");

  const dedupeHours = options.dedupeHours ?? 6;
  const sendEmails = options.sendEmails ?? true;
  const maxJobs = options.maxJobs ?? 25;
  const force = options.force ?? false;

  const [{ data: rateRows, error: ratesError }, { data: alertRows, error: alertsError }] = await Promise.all([
    supabase.from("rates").select("*").eq("is_visible", true),
    supabase.from("alerts").select("*").eq("is_active", true)
  ]);

  if (ratesError || alertsError) {
    throw new Error(getErrorMessage(ratesError ?? alertsError, "No se pudieron leer cotizaciones o alertas."));
  }

  const rates = (rateRows as Rate[] | null) ?? [];
  const alerts = (alertRows as UserAlert[] | null) ?? [];
  const profileIds = Array.from(new Set(alerts.map((alert) => alert.user_id)));
  const { data: profileRows } = profileIds.length
    ? await supabase.from("profiles").select("*").in("id", profileIds)
    : { data: [] };
  const profiles = new Map(((profileRows as Profile[] | null) ?? []).map((profile) => [profile.id, profile]));

  const { queued, diagnostics } = await enqueueNotificationJobs(alerts, rates, profiles, dedupeHours, force);
  const processed = sendEmails ? await processPendingNotificationJobs(maxJobs) : [];

  return {
    checked: alerts.length,
    queued,
    processed,
    diagnostics
  };
}
