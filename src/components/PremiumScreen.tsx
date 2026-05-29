"use client";

import { useState } from "react";
import { BellRing, Check, Crown, Mail, MessageCircle, Sparkles } from "lucide-react";
import { AuthModal } from "@/components/AuthModal";
import { useAccount } from "@/lib/hooks";

type PlanId = "essential_monthly" | "tracking_monthly" | "premium_monthly";

const plans: Array<{
  id: PlanId;
  name: string;
  price: string;
  tag: string;
  copy: string;
  bullets: string[];
  cta: string;
  tone?: "featured" | "exclusive";
  trial?: string;
}> = [
  {
    id: "essential_monthly",
    name: "Esencial",
    price: "$500/mes",
    tag: "Plan base",
    copy: "Seguí el valor que más te importa.",
    bullets: ["1 alerta personalizada", "Alertas por email", "7 días gratis"],
    cta: "Probar Esencial",
    trial: "7 días gratis"
  },
  {
    id: "tracking_monthly",
    name: "Seguimiento",
    price: "$1.500/mes",
    tag: "Recomendado",
    copy: "No llegues tarde a los movimientos del mercado.",
    bullets: ["Hasta 4 alertas", "Alertas por email", "7 días gratis"],
    cta: "Probar Seguimiento",
    tone: "featured",
    trial: "7 días gratis"
  },
  {
    id: "premium_monthly",
    name: "Premium",
    price: "$35.000/mes",
    tag: "Exclusivo",
    copy: "Alertas inmediatas para decisiones importantes.",
    bullets: ["Alertas ilimitadas por email", "Hasta 6 alertas por WhatsApp", "Avisos prioritarios", "Alertas más rápidas"],
    cta: "Activar Premium",
    tone: "exclusive"
  }
];

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
    const payload = (await response.json()) as { init_point?: string; error?: string };

    if (!response.ok || !payload.init_point) {
      setMessage(payload.error ?? "No se pudo iniciar Mercado Pago.");
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
        <p>No pagás por ver números. Pagás por estar un paso antes.</p>
        <p>Una alerta a tiempo puede ahorrarte más que una suscripción.</p>
        <p>Tu plata no espera. Tus alertas tampoco.</p>
      </section>

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
              <strong>{plan.price}</strong>
            </div>
            <p className="plan-card__copy">{plan.copy}</p>
            <ul>
              {plan.bullets.map((item) => (
                <li key={item}>
                  <Check size={17} />
                  {item}
                </li>
              ))}
            </ul>
            {plan.trial ? <span className="plan-card__trial">{plan.trial}</span> : <span className="plan-card__note">Sin prueba gratis</span>}
            <button
              className={`button button--full ${plan.tone === "exclusive" ? "button--premium" : ""}`}
              disabled={isLoading}
              type="button"
              onClick={() => startPlan(plan.id)}
            >
              {plan.tone === "exclusive" ? <Sparkles size={18} /> : <BellRing size={18} />}
              {isLoading ? "Abriendo Mercado Pago..." : plan.cta}
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
          <span>Disponible en el plan Premium al activarlo.</span>
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
