import { evaluateAlert } from "@/lib/alert-rules";
import { getErrorMessage } from "@/lib/error-message";
import { sendAlertEmail } from "@/lib/notifications";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import type { NotificationJob, Profile, Rate, UserAlert } from "@/lib/types";

type ProcessAlertsOptions = {
  sendEmails?: boolean;
  dedupeHours?: number;
  maxJobs?: number;
};

type QueuedAlert = {
  alert_id: string;
  message: string;
  job_id?: string;
  email?: string;
  email_status?: string;
};

async function enqueueNotificationJobs(
  alerts: UserAlert[],
  rates: Rate[],
  profiles: Map<string, Profile>,
  dedupeHours: number
) {
  const supabase = createSupabaseAdminClient();
  if (!supabase) throw new Error("Falta SUPABASE_SERVICE_ROLE_KEY.");

  const since = new Date(Date.now() - dedupeHours * 60 * 60 * 1000).toISOString();
  const queued: QueuedAlert[] = [];

  for (const alert of alerts) {
    const evaluation = evaluateAlert(alert, rates);
    if (!evaluation.shouldSend) continue;

    const { data: recentJobs } = await supabase
      .from("notification_jobs")
      .select("id")
      .eq("alert_id", alert.id)
      .in("status", ["pending", "processing", "sent", "skipped"])
      .gte("created_at", since)
      .limit(1);

    if (recentJobs?.length) continue;

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
  }

  return queued;
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

  const queued = await enqueueNotificationJobs(alerts, rates, profiles, dedupeHours);
  const processed = sendEmails ? await processPendingNotificationJobs(maxJobs) : [];

  return {
    checked: alerts.length,
    queued,
    processed
  };
}
