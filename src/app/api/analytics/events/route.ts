import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type AnalyticsBody = {
  event_name?: string;
  path?: string;
  referrer?: string | null;
  source?: string | null;
  campaign?: string | null;
  consent?: {
    analytics?: boolean;
    marketing?: boolean;
  };
};

function detectDevice(userAgent: string) {
  const ua = userAgent.toLowerCase();
  if (ua.includes("ipad") || ua.includes("tablet")) return "tablet";
  if (ua.includes("mobile") || ua.includes("android") || ua.includes("iphone")) return "mobile";
  return "desktop";
}

function detectBrowser(userAgent: string) {
  const ua = userAgent.toLowerCase();
  if (ua.includes("edg/")) return "Edge";
  if (ua.includes("chrome/")) return "Chrome";
  if (ua.includes("safari/") && !ua.includes("chrome/")) return "Safari";
  if (ua.includes("firefox/")) return "Firefox";
  return "Otro";
}

function safeString(value: unknown, fallback = "") {
  return typeof value === "string" ? value.slice(0, 240) : fallback;
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as AnalyticsBody;

  if (!body.consent?.analytics && !body.consent?.marketing) {
    return NextResponse.json({ ok: true, skipped: "Sin consentimiento analitico." });
  }

  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json({ ok: true, skipped: "Falta SUPABASE_SERVICE_ROLE_KEY." });
  }

  const userAgent = request.headers.get("user-agent") ?? "";
  const country = request.headers.get("x-vercel-ip-country") ?? null;
  const region = request.headers.get("x-vercel-ip-country-region") ?? null;
  const city = request.headers.get("x-vercel-ip-city") ?? null;

  const { error } = await supabase.from("analytics_events").insert({
    event_name: safeString(body.event_name, "page_view"),
    path: safeString(body.path, "/"),
    referrer: body.referrer ? safeString(body.referrer) : null,
    device: detectDevice(userAgent),
    browser: detectBrowser(userAgent),
    country,
    region,
    city,
    source: body.source ? safeString(body.source) : null,
    campaign: body.campaign ? safeString(body.campaign) : null
  });

  if (error) {
    return NextResponse.json({ ok: true, skipped: "Analytics pendiente de migracion SQL." });
  }

  return NextResponse.json({ ok: true });
}
