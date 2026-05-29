import { createClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { getErrorMessage } from "@/lib/error-message";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

type StepResult = {
  ok: boolean;
  error?: string;
};

function isAuthorized(request: NextRequest) {
  const secrets = [
    process.env.AUTOMATION_SECRET,
    process.env.CRON_SECRET,
    process.env.RATES_UPDATE_SECRET,
    process.env.ALERTS_CRON_SECRET
  ].filter(Boolean);
  if (!secrets.length) return true;

  const bearer = request.headers.get("authorization")?.replace("Bearer ", "");
  const querySecret = request.nextUrl.searchParams.get("secret");
  return Boolean((bearer && secrets.includes(bearer)) || (querySecret && secrets.includes(querySecret)));
}

function readJwtRole(token: string | undefined) {
  if (!token) return "missing";

  try {
    const [, payload] = token.split(".");
    if (!payload) return "invalid";

    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { role?: string };
    return parsed.role ?? "missing-role";
  } catch {
    return "invalid";
  }
}

function resultFromError(error: unknown): StepResult {
  return {
    ok: false,
    error: getErrorMessage(error, "Error desconocido.")
  };
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const diagnostics = {
    env: {
      supabaseUrl: Boolean(url),
      anonKey: Boolean(anonKey),
      anonRole: readJwtRole(anonKey),
      serviceRoleKey: Boolean(serviceKey),
      serviceRole: readJwtRole(serviceKey)
    },
    steps: {} as Record<string, StepResult>
  };

  if (!url || !serviceKey) {
    return NextResponse.json({
      ok: false,
      ...diagnostics,
      fix: "Falta NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en Vercel."
    });
  }

  const supabase = createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  const ratesRead = await supabase.from("rates").select("id, code").limit(1);
  diagnostics.steps.readRates = ratesRead.error ? resultFromError(ratesRead.error) : { ok: true };

  const adminSettingsRead = await supabase.from("admin_settings").select("id, key").limit(1);
  diagnostics.steps.readAdminSettings = adminSettingsRead.error
    ? resultFromError(adminSettingsRead.error)
    : { ok: true };

  const sourceLogsRead = await supabase.from("source_update_logs").select("id").limit(1);
  diagnostics.steps.readSourceUpdateLogs = sourceLogsRead.error ? resultFromError(sourceLogsRead.error) : { ok: true };

  const testCode = "__DEBUG_AUTOMATION_TEST__";
  const upsertTest = await supabase.from("rates").upsert(
    {
      code: testCode,
      name: "Debug automatizacion",
      country: "test",
      flag: "",
      type: "indicator",
      buy_price: null,
      sell_price: null,
      variation: 0,
      source: "debug",
      is_visible: false,
      updated_at: new Date().toISOString()
    },
    { onConflict: "code" }
  );
  diagnostics.steps.upsertRates = upsertTest.error ? resultFromError(upsertTest.error) : { ok: true };

  if (!upsertTest.error) {
    const cleanup = await supabase.from("rates").delete().eq("code", testCode);
    diagnostics.steps.cleanupRates = cleanup.error ? resultFromError(cleanup.error) : { ok: true };
  }

  const ok =
    diagnostics.env.serviceRole === "service_role" &&
    Object.values(diagnostics.steps).every((step) => step.ok);

  return NextResponse.json({
    ok,
    ...diagnostics,
    next: ok
      ? "Supabase esta listo. Si rates/update falla, revisar fuente externa."
      : "Corregir primero el paso que aparece con ok:false."
  });
}
