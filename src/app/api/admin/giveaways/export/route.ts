import { NextResponse, type NextRequest } from "next/server";
import { getGiveawayExportRows, toCsv } from "@/lib/giveaways";
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

export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const admin = createSupabaseAdminClient();

  if (!supabase || !admin) {
    return NextResponse.json({ error: "Falta configurar Supabase." }, { status: 500 });
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user?.email || !(await isAdminEmail(user.email))) {
    return NextResponse.json({ error: "Tu usuario no tiene permiso de administrador." }, { status: 403 });
  }

  const giveawayId = request.nextUrl.searchParams.get("giveawayId");
  if (!giveawayId) {
    return NextResponse.json({ error: "Falta giveawayId." }, { status: 400 });
  }

  try {
    const { giveaway, rows } = await getGiveawayExportRows(admin, giveawayId);
    const csv = toCsv(rows);
    const fileName = `${giveaway?.slug ?? "sorteo"}-tickets.csv`;

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${fileName}"`
      }
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo exportar el sorteo." }, { status: 500 });
  }
}
