import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function appUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

export async function POST(request: NextRequest) {
  const token = process.env.MERCADO_PAGO_ACCESS_TOKEN;
  if (!token) {
    return NextResponse.json({ error: "Falta MERCADO_PAGO_ACCESS_TOKEN." }, { status: 500 });
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Falta configurar Supabase." }, { status: 500 });
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return NextResponse.json({ error: "Iniciá sesión para activar Premium." }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as { plan?: string };
  const plan = body.plan === "premium_monthly" ? "premium_monthly" : "premium_monthly";
  const price = Number(process.env.PREMIUM_MONTHLY_PRICE ?? 3500);
  const preapprovalPlanId = process.env.MERCADO_PAGO_PREAPPROVAL_PLAN_ID;

  const endpoint = preapprovalPlanId
    ? "https://api.mercadopago.com/preapproval"
    : "https://api.mercadopago.com/checkout/preferences";

  const payload = preapprovalPlanId
    ? {
        preapproval_plan_id: preapprovalPlanId,
        reason: "Dólar Mendoza Premium",
        external_reference: user.id,
        payer_email: user.email,
        back_url: `${appUrl()}/account`,
        status: "pending"
      }
    : {
        items: [
          {
            title: "Dólar Mendoza Premium mensual",
            description: "Alertas ilimitadas, WhatsApp, resumen diario y señales de oportunidad.",
            quantity: 1,
            currency_id: "ARS",
            unit_price: price
          }
        ],
        payer: { email: user.email },
        external_reference: user.id,
        metadata: { user_id: user.id, plan },
        back_urls: {
          success: `${appUrl()}/account`,
          failure: `${appUrl()}/premium`,
          pending: `${appUrl()}/premium`
        },
        auto_return: "approved",
        notification_url: `${appUrl()}/api/mercadopago/webhook${
          process.env.MERCADO_PAGO_WEBHOOK_SECRET ? `?secret=${process.env.MERCADO_PAGO_WEBHOOK_SECRET}` : ""
        }`
      };

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const mercadoPagoPayload = (await response.json().catch(() => ({}))) as {
    init_point?: string;
    sandbox_init_point?: string;
    message?: string;
    error?: string;
  };

  if (!response.ok) {
    return NextResponse.json(
      { error: mercadoPagoPayload.message ?? mercadoPagoPayload.error ?? "Mercado Pago rechazó la solicitud." },
      { status: response.status }
    );
  }

  return NextResponse.json({
    init_point: mercadoPagoPayload.init_point ?? mercadoPagoPayload.sandbox_init_point
  });
}
