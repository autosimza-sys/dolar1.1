import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type PlanId = "essential_monthly" | "tracking_monthly" | "premium_monthly";

const planCatalog: Record<
  PlanId,
  {
    title: string;
    description: string;
    defaultPrice: number;
    envPrice?: string;
    preapprovalEnv?: string;
  }
> = {
  essential_monthly: {
    title: "Dólar MZA Esencial mensual",
    description: "1 alerta personalizada por email y 7 días gratis cuando la suscripción está configurada.",
    defaultPrice: 500,
    envPrice: process.env.ESSENTIAL_MONTHLY_PRICE,
    preapprovalEnv: process.env.MERCADO_PAGO_PREAPPROVAL_PLAN_ESSENTIAL_ID
  },
  tracking_monthly: {
    title: "Dólar MZA Seguimiento mensual",
    description: "Hasta 4 alertas por email y 7 días gratis cuando la suscripción está configurada.",
    defaultPrice: 1500,
    envPrice: process.env.TRACKING_MONTHLY_PRICE,
    preapprovalEnv: process.env.MERCADO_PAGO_PREAPPROVAL_PLAN_TRACKING_ID
  },
  premium_monthly: {
    title: "Dólar MZA Premium mensual",
    description: "Alertas ilimitadas por email, hasta 6 alertas por WhatsApp y avisos prioritarios.",
    defaultPrice: 35000,
    envPrice: process.env.PREMIUM_MONTHLY_PRICE,
    preapprovalEnv: process.env.MERCADO_PAGO_PREAPPROVAL_PLAN_PREMIUM_ID ?? process.env.MERCADO_PAGO_PREAPPROVAL_PLAN_ID
  }
};

function appUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

function normalizePlan(plan?: string): PlanId {
  if (plan === "essential_monthly" || plan === "tracking_monthly" || plan === "premium_monthly") return plan;
  return "tracking_monthly";
}

function planPrice(plan: PlanId) {
  const config = planCatalog[plan];
  const configuredPrice = Number(config.envPrice);
  return Number.isFinite(configuredPrice) && configuredPrice > 0 ? configuredPrice : config.defaultPrice;
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
    return NextResponse.json({ error: "Iniciá sesión para activar una membresía." }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as { plan?: string };
  const plan = normalizePlan(body.plan);
  const config = planCatalog[plan];
  const preapprovalPlanId = config.preapprovalEnv;

  const endpoint = preapprovalPlanId
    ? "https://api.mercadopago.com/preapproval"
    : "https://api.mercadopago.com/checkout/preferences";

  const payload = preapprovalPlanId
    ? {
        preapproval_plan_id: preapprovalPlanId,
        reason: config.title,
        external_reference: user.id,
        payer_email: user.email,
        metadata: { user_id: user.id, plan },
        back_url: `${appUrl()}/account`,
        status: "pending"
      }
    : {
        items: [
          {
            title: config.title,
            description: config.description,
            quantity: 1,
            currency_id: "ARS",
            unit_price: planPrice(plan)
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
