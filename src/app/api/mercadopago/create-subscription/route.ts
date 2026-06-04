import { NextResponse, type NextRequest } from "next/server";
import { commercialPlans, normalizePlan, planPrice, type PlanId } from "@/lib/commercial";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function appUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL || "https://dolarmza.com.ar").replace(/\/$/, "");
}

function preapprovalPlanId(plan: PlanId) {
  if (plan === "essential_monthly") return process.env.MERCADO_PAGO_PREAPPROVAL_PLAN_ESSENTIAL_ID;
  if (plan === "tracking_monthly") return process.env.MERCADO_PAGO_PREAPPROVAL_PLAN_TRACKING_ID;
  return process.env.MERCADO_PAGO_PREAPPROVAL_PLAN_PREMIUM_ID ?? process.env.MERCADO_PAGO_PREAPPROVAL_PLAN_ID;
}

export async function POST(request: NextRequest) {
  const token = process.env.MERCADO_PAGO_ACCESS_TOKEN;
  if (!token) {
    return NextResponse.json({ error: "Falta MERCADO_PAGO_ACCESS_TOKEN." }, { status: 500 });
  }

  const supabase = await createSupabaseServerClient();
  const supabaseAdmin = createSupabaseAdminClient();
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
  const config = commercialPlans[plan];

  const { data: profile } = await supabase.from("profiles").select("trial_used").eq("id", user.id).maybeSingle();
  const trialUsed = Boolean((profile as { trial_used?: boolean } | null)?.trial_used);

  if (plan === "tracking_monthly" && config.hasTrial && !trialUsed) {
    const now = new Date();
    const expiresAt = new Date(now);
    expiresAt.setDate(expiresAt.getDate() + config.trialDays);

    const { error: profileError } = await supabase.from("profiles").update({ trial_used: true, is_premium: true }).eq("id", user.id);
    const { error: subscriptionError } = await supabase.from("subscriptions").upsert(
      {
        user_id: user.id,
        mercado_pago_payment_id: "trial",
        status: "trial",
        plan,
        started_at: now.toISOString(),
        expires_at: expiresAt.toISOString()
      },
      { onConflict: "user_id,plan" }
    );

    if (profileError || subscriptionError) {
      return NextResponse.json(
        { error: "Falta ejecutar el SQL comercial en Supabase para activar pruebas gratis." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      init_point: "/account?trial=tracking",
      message: "Prueba de 7 días activada."
    });
  }

  const preapprovalId = preapprovalPlanId(plan);
  const endpoint = preapprovalId ? "https://api.mercadopago.com/preapproval" : "https://api.mercadopago.com/checkout/preferences";
  const originalPrice = planPrice(plan);
  let discountApplied = 0;
  let finalPrice = originalPrice;

  if (!preapprovalId && supabaseAdmin) {
    const { data: appliedCredit } = await supabaseAdmin.rpc("apply_referral_credit", {
      p_user_id: user.id,
      p_amount: originalPrice,
      p_description: `Credito usado en ${config.name}`
    });

    discountApplied = Number(appliedCredit ?? 0);
    finalPrice = Math.max(originalPrice - discountApplied, 0);
  }

  if (!preapprovalId && finalPrice <= 0) {
    const now = new Date();
    const expiresAt = new Date(now);
    expiresAt.setDate(expiresAt.getDate() + 32);

    const { error: subscriptionError } = await supabase.from("subscriptions").upsert(
      {
        user_id: user.id,
        mercado_pago_payment_id: "credit-covered",
        status: "active",
        plan,
        started_at: now.toISOString(),
        expires_at: expiresAt.toISOString()
      },
      { onConflict: "user_id,plan" }
    );

    await supabase.from("profiles").update({ is_premium: true }).eq("id", user.id);

    if (supabaseAdmin) {
      await supabaseAdmin.from("payment_events").insert({
        user_id: user.id,
        mercado_pago_id: "credit-covered",
        plan,
        status: "active",
        payload: {
          source: "referral_credit",
          original_price: originalPrice,
          discount_applied: discountApplied,
          final_price: 0
        }
      });
    }

    if (subscriptionError) {
      return NextResponse.json({ error: "No se pudo activar la membresia con credito." }, { status: 500 });
    }

    return NextResponse.json({
      init_point: "/account?credit=applied",
      message: "Tu credito cubrio este periodo."
    });
  }

  const payload = preapprovalId
    ? {
        preapproval_plan_id: preapprovalId,
        reason: `Dólar MZA ${config.name}`,
        external_reference: user.id,
        payer_email: user.email,
        metadata: { user_id: user.id, plan },
        back_url: `${appUrl()}/account`,
        status: "pending"
      }
    : {
        items: [
          {
            title: `Dólar MZA ${config.name}`,
            description: config.message,
            quantity: 1,
            currency_id: "ARS",
            unit_price: finalPrice
          }
        ],
        payer: { email: user.email },
        external_reference: user.id,
        metadata: { user_id: user.id, plan, original_price: originalPrice, discount_applied: discountApplied, final_price: finalPrice },
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
