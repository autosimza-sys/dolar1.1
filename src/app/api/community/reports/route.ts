import { NextResponse, type NextRequest } from "next/server";
import {
  COMMUNITY_BLOCK_MESSAGE,
  communityReportSchema,
  hasBlockedCommunityContent,
  validateCommunityRate
} from "@/lib/community-moderation";
import { getErrorMessage } from "@/lib/error-message";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import type { Rate } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET() {
  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json({ reports: [] });
  }

  const { data, error } = await supabase
    .from("community_reports")
    .select("id, operation_type, currency, amount, rate, department, comment, status, moderation_reason, include_in_stats, created_at")
    .eq("status", "approved")
    .order("created_at", { ascending: false })
    .limit(12);

  if (error) {
    return NextResponse.json({ reports: [], error: getErrorMessage(error, "No se pudieron leer reportes.") }, { status: 200 });
  }

  return NextResponse.json({ reports: data ?? [] });
}

export async function POST(request: NextRequest) {
  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: "Falta configuración de Supabase." }, { status: 500 });
  }

  const body = await request.json().catch(() => null);
  const parsed = communityReportSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Revisá los datos cargados." }, { status: 400 });
  }

  if (hasBlockedCommunityContent(parsed.data)) {
    return NextResponse.json({ error: COMMUNITY_BLOCK_MESSAGE }, { status: 400 });
  }

  const [{ data: rates }, { data: setting }] = await Promise.all([
    supabase.from("rates").select("*").eq("is_visible", true),
    supabase.from("admin_settings").select("value").eq("key", "community_filters_enabled").maybeSingle()
  ]);

  const filtersEnabled = setting?.value !== false;
  const validation = filtersEnabled
    ? validateCommunityRate(parsed.data.currency, parsed.data.rate, ((rates as Rate[] | null) ?? []) as Rate[])
    : { status: "approved" as const, include_in_stats: true, moderation_reason: null };

  const { data, error } = await supabase
    .from("community_reports")
    .insert({
      operation_type: parsed.data.operation_type,
      currency: parsed.data.currency.toUpperCase(),
      amount: parsed.data.amount,
      rate: parsed.data.rate,
      department: parsed.data.department,
      comment: parsed.data.comment || null,
      status: validation.status,
      moderation_reason: validation.moderation_reason,
      include_in_stats: validation.include_in_stats
    })
    .select("id, status, moderation_reason")
    .single();

  if (error) {
    return NextResponse.json({ error: getErrorMessage(error, "No se pudo guardar el reporte.") }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    report: data,
    message:
      validation.status === "suspicious"
        ? "Gracias. Lo guardamos para revisión porque quedó fuera del rango normal."
        : "Gracias. La operación quedó publicada de forma anónima."
  });
}
