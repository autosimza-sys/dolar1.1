import { NextResponse } from "next/server";
import { pointsToCredit, referralLevel } from "@/lib/commercial";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function appUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

function slugFromEmail(email: string) {
  const base = email
    .split("@")[0]
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24);

  return `${base || "usuario"}-${Math.random().toString(36).slice(2, 6)}`;
}

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const admin = createSupabaseAdminClient();

  if (!supabase || !admin) {
    return NextResponse.json({ error: "Falta configurar Supabase." }, { status: 500 });
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return NextResponse.json({ error: "Iniciá sesión para ver tus referidos." }, { status: 401 });
  }

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("id,email,referral_code")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    return NextResponse.json({ error: "Falta ejecutar el SQL comercial de referidos." }, { status: 500 });
  }

  let referralCode = (profile as { referral_code?: string | null } | null)?.referral_code;

  if (!referralCode) {
    referralCode = slugFromEmail(user.email);
    const { error } = await admin.from("profiles").update({ referral_code: referralCode }).eq("id", user.id);
    if (error) {
      return NextResponse.json({ error: "No se pudo generar tu link de referido." }, { status: 500 });
    }
  }

  const [referrals, ledger] = await Promise.all([
    admin.from("referral_events").select("*").eq("referrer_user_id", user.id).order("created_at", { ascending: false }),
    admin.from("referral_credit_ledger").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(20)
  ]);

  if (referrals.error || ledger.error) {
    return NextResponse.json({ error: "Falta ejecutar el SQL comercial de referidos." }, { status: 500 });
  }

  const referralRows = referrals.data ?? [];
  const ledgerRows =
    (ledger.data as Array<{
      id: string;
      description: string | null;
      points: number | null;
      credit_amount: number | null;
      type?: string | null;
      status: string | null;
      created_at: string;
      expires_at: string | null;
    }> | null) ?? [];
  const now = Date.now();
  const earnedLedger = ledgerRows.filter(
    (row) =>
      row.status === "active" &&
      (!row.expires_at || new Date(row.expires_at).getTime() > now) &&
      (row.type === "earned" || row.type === "manual" || !row.type)
  );
  const usedLedger = ledgerRows.filter((row) => row.type === "used" && row.status === "used");
  const pointsActive = earnedLedger.reduce((total, row) => total + Number(row.points ?? 0), 0);
  const earnedCredit = earnedLedger.reduce((total, row) => total + Number(row.credit_amount ?? 0), 0);
  const usedCredit = usedLedger.reduce((total, row) => total + Number(row.credit_amount ?? 0), 0);
  const creditAvailable = Math.max(earnedCredit - usedCredit, 0);
  const nextExpiration =
    earnedLedger
      .map((row) => row.expires_at)
      .filter(Boolean)
      .sort()[0] ?? null;

  return NextResponse.json({
    referral_code: referralCode,
    referral_link: `${appUrl()}/r/${referralCode}`,
    points_active: pointsActive,
    credit_available: creditAvailable || pointsToCredit(pointsActive),
    referrals_sent: referralRows.length,
    referrals_valid: referralRows.filter((row) => row.status === "valid").length,
    referrals_pending: referralRows.filter((row) => row.status === "pending").length,
    next_expiration: nextExpiration,
    level: referralLevel(pointsActive),
    history: ledgerRows.map((row) => ({
      id: row.id,
      description: row.description ?? "Movimiento de crédito",
      points: Number(row.points ?? 0),
      credit_amount: Number(row.credit_amount ?? 0),
      status: row.status ?? "active",
      created_at: row.created_at,
      expires_at: row.expires_at
    }))
  });
}
