import { NextResponse, type NextRequest } from "next/server";
import { processAlerts } from "@/lib/alert-processor";
import { getErrorMessage } from "@/lib/error-message";
import { updateRatesFromSources } from "@/lib/rate-updater";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

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

function shouldForceProcessing(request: NextRequest) {
  const value = request.nextUrl.searchParams.get("force")?.toLowerCase();
  return value === "1" || value === "true" || value === "yes";
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  try {
    const rates = await updateRatesFromSources();
    const alerts = await processAlerts({ force: shouldForceProcessing(request) });

    return NextResponse.json({
      ok: true,
      rates,
      alerts
    });
  } catch (error) {
    return NextResponse.json(
      { error: getErrorMessage(error, "No se pudo ejecutar la automatización.") },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  return POST(request);
}
