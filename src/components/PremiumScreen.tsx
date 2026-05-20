"use client";

import { useState } from "react";
import { BellRing, Check, Crown, Mail, MessageCircle, Sparkles } from "lucide-react";
import { AuthModal } from "@/components/AuthModal";
import { FREE_BULLETS, PREMIUM_BULLETS } from "@/lib/constants";
import { useAccount } from "@/lib/hooks";

export function PremiumScreen() {
  const account = useAccount();
  const [authOpen, setAuthOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function startPremium() {
    setMessage(null);

    if (!account.user) {
      setAuthOpen(true);
      return;
    }

    setIsLoading(true);
    const response = await fetch("/api/mercadopago/create-subscription", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan: "premium_monthly" })
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
        <p>No pagás por ver números. Pagás por enterarte antes.</p>
        <p>Una alerta a tiempo puede ahorrarte más que una suscripción.</p>
        <p>Tu plata no espera. Tus alertas tampoco.</p>
      </section>

      <div className="plans">
        <article className="plan-card">
          <div className="plan-card__top">
            <h2>Gratis</h2>
            <strong>$0</strong>
          </div>
          <ul>
            {FREE_BULLETS.map((item) => (
              <li key={item}>
                <Check size={17} />
                {item}
              </li>
            ))}
          </ul>
        </article>

        <article className="plan-card plan-card--premium">
          <div className="plan-card__top">
            <h2>Premium</h2>
            <strong>Mensual</strong>
          </div>
          <ul>
            {PREMIUM_BULLETS.map((item) => (
              <li key={item}>
                <Check size={17} />
                {item}
              </li>
            ))}
          </ul>
          {message ? <p className="form-message">{message}</p> : null}
          <button className="button button--full button--premium" disabled={isLoading} type="button" onClick={startPremium}>
            <Sparkles size={18} />
            {isLoading ? "Abriendo Mercado Pago..." : "Probar Premium"}
          </button>
        </article>
      </div>

      <section className="feature-band">
        <article>
          <BellRing size={20} />
          <strong>Señales</strong>
          <span>Movimientos que valen una decisión.</span>
        </article>
        <article>
          <MessageCircle size={20} />
          <strong>WhatsApp</strong>
          <span>Alertas donde las ves rápido.</span>
        </article>
        <article>
          <Mail size={20} />
          <strong>Resumen</strong>
          <span>Lo importante del día, sin ruido.</span>
        </article>
      </section>

      <AuthModal
        open={authOpen}
        onClose={() => setAuthOpen(false)}
        message="Creá tu cuenta gratis para activar Premium y guardar tus alertas."
      />
    </div>
  );
}
