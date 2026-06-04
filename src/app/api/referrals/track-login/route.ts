import { NextResponse } from "next/server";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST() {
  const supabase = await createSupabaseServerClient();
  const admin = createSupabaseAdminClient();

  if (!supabase || !admin) {
    return NextResponse.json({ ok: true, skipped: "Supabase no configurado." });
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ ok: true, skipped: "Sin usuario." });
  }

  const { data: profile } = await admin.from("profiles").select("login_count").eq("id", user.id).maybeSingle();
  const nextLoginCount = Number((profile as { login_count?: number } | null)?.login_count ?? 0) + 1;

  const { error } = await admin
    .from("profiles")
    .update({ login_count: nextLoginCount, last_login_at: new Date().toISOString() })
    .eq("id", user.id);

  if (error) {
    return NextResponse.json({ ok: true, skipped: "Referidos pendiente de SQL comercial." });
  }

  await admin.rpc("validate_referrals");

  return NextResponse.json({ ok: true, login_count: nextLoginCount });
}
