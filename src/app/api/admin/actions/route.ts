import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type AdminAction =
  | "save_rate"
  | "mark_rate_unreliable"
  | "toggle_rate_source"
  | "save_blue_mendoza_manual"
  | "toggle_community_filters"
  | "moderate_community_report"
  | "create_rate";

type AdminActionBody = {
  action?: AdminAction;
  rateCode?: string;
  sourceId?: string;
  reportId?: string;
  status?: string;
  enabled?: boolean;
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
      return NextResponse.json({ ok: true });
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
      return NextResponse.json({ ok: true });
    }

    if (body.action === "toggle_rate_source") {
      const sourceId = requireString(body.sourceId, "sourceId");
      const { error } = await supabaseAdmin.from("rate_sources").update({ enabled: Boolean(body.enabled) }).eq("id", sourceId);
      if (error) throw error;
      return NextResponse.json({ ok: true });
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
      return NextResponse.json({ ok: true });
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
      return NextResponse.json({ ok: true });
    }

    if (body.action === "moderate_community_report") {
      const reportId = requireString(body.reportId, "reportId");
      const nextStatus = body.status === "approved" ? "approved" : "rejected";
      const { error } = await supabaseAdmin
        .from("community_reports")
        .update({
          status: nextStatus,
          include_in_stats: nextStatus === "approved",
          moderation_reason: nextStatus === "approved" ? null : "Moderado por admin"
        })
        .eq("id", reportId);
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }

    if (body.action === "create_rate") {
      const { error } = await supabaseAdmin.from("rates").upsert(body.payload ?? {});
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Acción de admin no reconocida." }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo ejecutar la acción.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
