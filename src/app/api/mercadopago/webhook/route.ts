import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type MercadoPagoPayment = {
  id: number | string;
  status?: string;
  external_reference?: string;
  metadata?: {
    user_id?: string;
    plan?: string;
  };
};

type MercadoPagoPreapproval = {
  id: string;
  status?: string;
  external_reference?: string;
  payer_email?: string;
  preapproval_plan_id?: string;
  metadata?: {
    user_id?: string;
    plan?: string;
  };
};

function mapStatus(status?: string) {
  if (status === "approved" || status === "authorized") return "active";
  if (status === "pending" || status === "in_process") return "pending";
  if (status === "cancelled" || status === "rejected") return "cancelled";
  if (status === "paused") return "paused";
  return "pending";
}

function planFromPreapprovalPlanId(preapprovalPlanId?: string) {
  if (!preapprovalPlanId) return null;
  if (preapprovalPlanId === process.env.MERCADO_PAGO_PREAPPROVAL_PLAN_ESSENTIAL_ID) return "essential_monthly";
  if (preapprovalPlanId === process.env.MERCADO_PAGO_PREAPPROVAL_PLAN_TRACKING_ID) return "tracking_monthly";
  if (
    preapprovalPlanId === process.env.MERCADO_PAGO_PREAPPROVAL_PLAN_PREMIUM_ID ||
    preapprovalPlanId === process.env.MERCADO_PAGO_PREAPPROVAL_PLAN_ID
  ) {
    return "premium_monthly";
  }
  return null;
}

async function fetchMercadoPago<T>(path: string, token: string) {
  const response = await fetch(`https://api.mercadopago.com${path}`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!response.ok) return null;
  return (await response.json()) as T;
}

export async function POST(request: NextRequest) {
  const configuredSecret = process.env.MERCADO_PAGO_WEBHOOK_SECRET;
  const receivedSecret = request.nextUrl.searchParams.get("secret") ?? request.headers.get("x-dolar-mendoza-secret");

  if (configuredSecret && receivedSecret !== configuredSecret) {
    return NextResponse.json({ error: "Webhook no autorizado." }, { status: 401 });
  }

  const token = process.env.MERCADO_PAGO_ACCESS_TOKEN;
  const supabase = createSupabaseAdminClient();
  if (!token || !supabase) {
    return NextResponse.json({ ok: true, skipped: "Falta token de Mercado Pago o Service Role de Supabase." });
  }

  const body = (await request.json().catch(() => ({}))) as {
    type?: string;
    topic?: string;
    data?: { id?: string };
    id?: string;
  };

  const topic = request.nextUrl.searchParams.get("topic") ?? body.topic ?? body.type;
  const id = request.nextUrl.searchParams.get("id") ?? body.data?.id ?? body.id;

  if (!topic || !id) {
    return NextResponse.json({ ok: true, skipped: "Notificación sin topic o id." });
  }

  let userId: string | undefined;
  let mercadoPagoPaymentId = id;
  let status = "pending";
  let plan = "premium_monthly";

  if (topic.includes("payment")) {
    const payment = await fetchMercadoPago<MercadoPagoPayment>(`/v1/payments/${id}`, token);
    userId = payment?.metadata?.user_id ?? payment?.external_reference;
    mercadoPagoPaymentId = String(payment?.id ?? id);
    status = mapStatus(payment?.status);
    plan = payment?.metadata?.plan ?? plan;
  } else if (topic.includes("preapproval")) {
    const preapproval = await fetchMercadoPago<MercadoPagoPreapproval>(`/preapproval/${id}`, token);
    userId = preapproval?.metadata?.user_id ?? preapproval?.external_reference;
    mercadoPagoPaymentId = preapproval?.id ?? id;
    status = mapStatus(preapproval?.status);
    plan = preapproval?.metadata?.plan ?? planFromPreapprovalPlanId(preapproval?.preapproval_plan_id) ?? plan;
  }

  if (!userId) {
    return NextResponse.json({ ok: true, skipped: "No se pudo resolver user_id." });
  }

  const now = new Date();
  const expiresAt = new Date(now);
  expiresAt.setDate(expiresAt.getDate() + 32);

  await supabase.from("subscriptions").upsert(
    {
      user_id: userId,
      mercado_pago_payment_id: mercadoPagoPaymentId,
      status,
      plan,
      started_at: status === "active" ? now.toISOString() : null,
      expires_at: status === "active" ? expiresAt.toISOString() : null
    },
    { onConflict: "user_id,plan" }
  );

  await supabase.from("profiles").update({ is_premium: status === "active" }).eq("id", userId);

  return NextResponse.json({ ok: true, user_id: userId, status });
}

export async function GET(request: NextRequest) {
  return POST(request);
}
