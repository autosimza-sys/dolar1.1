"use client";

import { useState } from "react";
import { BellRing, Check, Crown, Mail, MessageCircle, Sparkles } from "lucide-react";
import { AuthModal } from "@/components/AuthModal";
import { commercialPlans, freePlan, type PlanId } from "@/lib/commercial";
import { useAccount } from "@/lib/hooks";

const plans = Object.values(commercialPlans);

export function PremiumScreen() {
  const account = useAccount();
  const [authOpen, setAuthOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function startPlan(plan: PlanId) {
    setMessage(null);

    if (!account.user) {
      setAuthOpen(true);
      return;
    }

    setIsLoading(true);
    const response = await fetch("/api/mercadopago/create-subscription", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan })
    });
    const payload = (await response.json()) as { init_point?: string; message?: string; error?: string };

    if (!response.ok || !payload.init_point) {
      setMessage(payload.error ?? payload.message ?? "No se pudo iniciar Mercado Pago.");
      setIsLoading(false);
      return;
    }

    window.location.href = payload.init_point;
  }

  return (
    <div className="screen">
      <section className="page-header premium-header">
        <div className="hero__badge hero__badge--premium">
          <Crown size={16} />
          Alertas Premium
        </div>
        <h1>Dejá de mirar el dólar todo el día.</h1>
        <p>Nosotros te avisamos cuando pasa algo importante.</p>
      </section>

      <section className="sales-lines">
        <p>No llegues tarde al mercado.</p>
        <p>Elegí qué seguir y Dólar MZA te avisa.</p>
        <p>La información justa cuando la necesitás.</p>
      </section>

      <article className="plan-card plan-card--free">
        <div className="plan-card__top">
          <div>
            <span className="plan-card__label">Gratis</span>
            <h2>{freePlan.name}</h2>
          </div>
          <strong>{freePlan.priceLabel}</strong>
        </div>
        <p className="plan-card__copy">Entrá, aprendé, guardá favoritos e invitá amigos sin pagar.</p>
        <ul>
          {freePlan.includes.map((item) => (
            <li key={item}>
              <Check size={17} />
              {item}
            </li>
          ))}
        </ul>
        <span className="plan-card__note">No incluye alertas, WhatsApp ni beneficios premium</span>
      </article>

      <div className="plans">
        {plans.map((plan) => (
          <article
            className={`plan-card ${
              plan.tone === "featured" ? "plan-card--featured" : plan.tone === "exclusive" ? "plan-card--premium plan-card--exclusive" : ""
            }`}
            key={plan.id}
          >
            <div className="plan-card__top">
              <div>
                <span className="plan-card__label">{plan.tag}</span>
                <h2>{plan.name}</h2>
              </div>
              <strong>{plan.priceLabel}</strong>
            </div>
            <p className="plan-card__copy">{plan.message}</p>
            <ul>
              {plan.bullets.map((item) => (
                <li key={item}>
                  <Check size={17} />
                  {item}
                </li>
              ))}
            </ul>
            {plan.hasTrial ? (
              <span className="plan-card__trial">7 días gratis, una sola vez por usuario</span>
            ) : (
              <span className="plan-card__note">Sin prueba gratis</span>
            )}
            <button
              className={`button button--full ${plan.tone === "exclusive" ? "button--premium" : ""}`}
              disabled={isLoading}
              type="button"
              onClick={() => startPlan(plan.id)}
            >
              {plan.tone === "exclusive" ? <Sparkles size={18} /> : <BellRing size={18} />}
              {isLoading ? "Abriendo..." : plan.cta}
            </button>
          </article>
        ))}
      </div>

      {message ? <p className="form-message">{message}</p> : null}

      <section className="feature-band">
        <article>
          <BellRing size={20} />
          <strong>Anticipación</strong>
          <span>Avisos para no llegar tarde al mercado.</span>
        </article>
        <article>
          <MessageCircle size={20} />
          <strong>WhatsApp</strong>
          <span>Disponible en el plan Premium WhatsApp.</span>
        </article>
        <article>
          <Mail size={20} />
          <strong>Email</strong>
          <span>Alertas claras desde el dominio de Dólar MZA.</span>
        </article>
      </section>

      <AuthModal
        open={authOpen}
        onClose={() => setAuthOpen(false)}
        message="Creá tu cuenta gratis para activar una membresía y guardar tus alertas."
      />
    </div>
  );
}
