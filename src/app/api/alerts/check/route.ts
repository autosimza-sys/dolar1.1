import { NextResponse, type NextRequest } from "next/server";
import { evaluateAlert } from "@/lib/alert-rules";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import type { Rate, UserAlert } from "@/lib/types";

export const dynamic = "force-dynamic";

function isAuthorized(request: NextRequest) {
  const secrets = [process.env.CRON_SECRET, process.env.ALERTS_CRON_SECRET].filter(Boolean);
  if (!secrets.length) return true;

  const bearer = request.headers.get("authorization")?.replace("Bearer ", "");
  const querySecret = request.nextUrl.searchParams.get("secret");
  return Boolean((bearer && secrets.includes(bearer)) || (querySecret && secrets.includes(querySecret)));
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: "Falta SUPABASE_SERVICE_ROLE_KEY." }, { status: 500 });
  }

  const [{ data: rateRows, error: ratesError }, { data: alertRows, error: alertsError }] = await Promise.all([
    supabase.from("rates").select("*").eq("is_visible", true),
    supabase.from("alerts").select("*").eq("is_active", true)
  ]);

  if (ratesError || alertsError) {
    return NextResponse.json({ error: ratesError?.message ?? alertsError?.message }, { status: 500 });
  }

  const rates = (rateRows as Rate[] | null) ?? [];
  const alerts = (alertRows as UserAlert[] | null) ?? [];
  const since = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
  const sent: Array<{ alert_id: string; message: string }> = [];

  for (const alert of alerts) {
    const evaluation = evaluateAlert(alert, rates);
    if (!evaluation.shouldSend) continue;

    const { data: recentLogs } = await supabase
      .from("alert_logs")
      .select("id")
      .eq("alert_id", alert.id)
      .gte("sent_at", since)
      .limit(1);

    if (recentLogs?.length) continue;

    await supabase.from("alert_logs").insert({
      alert_id: alert.id,
      user_id: alert.user_id,
      message: evaluation.message
    });

    sent.push({ alert_id: alert.id, message: evaluation.message });
  }

  return NextResponse.json({ ok: true, checked: alerts.length, sent });
}

export async function GET(request: NextRequest) {
  return POST(request);
}
