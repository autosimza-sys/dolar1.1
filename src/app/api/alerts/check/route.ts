import { NextResponse, type NextRequest } from "next/server";
import { processAlerts } from "@/lib/alert-processor";
import { getErrorMessage } from "@/lib/error-message";

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

  try {
    const result = await processAlerts();
    return NextResponse.json({
      ok: true,
      checked: result.checked,
      queued: result.queued,
      processed: result.processed
    });
  } catch (error) {
    return NextResponse.json(
      { error: getErrorMessage(error, "No se pudieron procesar las alertas.") },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  return POST(request);
}
