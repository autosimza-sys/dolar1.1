import { NextResponse, type NextRequest } from "next/server";
import { updateRatesFromSources } from "@/lib/rate-updater";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

function isAuthorized(request: NextRequest) {
  const secrets = [process.env.CRON_SECRET, process.env.RATES_UPDATE_SECRET, process.env.ALERTS_CRON_SECRET].filter(Boolean);
  if (!secrets.length) return true;

  const bearer = request.headers.get("authorization")?.replace("Bearer ", "");
  const querySecret = request.nextUrl.searchParams.get("secret");
  return Boolean((bearer && secrets.includes(bearer)) || (querySecret && secrets.includes(querySecret)));
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  try {
    const result = await updateRatesFromSources();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudieron actualizar las cotizaciones." },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  return POST(request);
}
