"use client";

import Link from "next/link";
import { ArrowRight, Bell, ChevronRight, CircleDollarSign, Sparkles } from "lucide-react";
import { CommunityReports } from "@/components/CommunityReports";
import { RateCard } from "@/components/RateCard";
import { INDICATOR_CODES, MAIN_RATE_CODES, TRAVEL_RATE_CODES } from "@/lib/constants";
import { formatDateTime, formatPercent, shortNumber } from "@/lib/format";
import { useRates } from "@/lib/hooks";
import type { Rate } from "@/lib/types";

function pickRates(rates: Rate[], codes: string[]) {
  return codes.map((code) => rates.find((rate) => rate.code === code)).filter(Boolean) as Rate[];
}

function ArgentinaToday({ rates }: { rates: Rate[] }) {
  const indicators = pickRates(rates, INDICATOR_CODES);
  const latest = indicators.reduce<string | null>((current, rate) => {
    if (!current) return rate.updated_at;
    return new Date(rate.updated_at) > new Date(current) ? rate.updated_at : current;
  }, null);

  return (
    <section className="section argentina-section">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Argentina hoy</p>
          <h2>Tasa, plazo fijo y rendimiento</h2>
        </div>
      </div>

      <div className="today-panel">
        <div className="today-grid">
          {indicators.map((indicator) => (
            <article className="metric-card" key={indicator.code}>
              <span>{indicator.name}</span>
              <strong>
                {shortNumber(indicator.sell_price)}
                <small>%</small>
              </strong>
              <em className={indicator.variation >= 0 ? "positive" : "negative"}>{formatPercent(indicator.variation)}</em>
            </article>
          ))}
        </div>
        <div className="today-panel__footer">
          <span>Última actualización: {formatDateTime(latest)}</span>
          <div className="button-row">
            <Link className="button button--alert" href="/alerts?rate=BCRA_RATE">
              <Bell size={17} />
              Crear alerta de tasa
            </Link>
            <Link className="button button--ghost" href="/alerts?type=dollar_vs_fixed_term">
              <CircleDollarSign size={17} />
              ¿Plazo fijo o dólar?
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

export function HomeScreen() {
  const { data: rates, isLoading, error } = useRates();
  const mainRates = pickRates(rates, MAIN_RATE_CODES);
  const travelRates = pickRates(rates, TRAVEL_RATE_CODES);
  const hasRates = rates.length > 0;

  return (
    <div className="screen screen--home">
      <section className="hero">
        <div className="hero__badge">
          <Sparkles size={16} />
          Estar un paso antes
        </div>
        <h1>Dólar Mendoza</h1>
        <p>Cotizaciones simples, alertas inteligentes y educación financiera para decidir mejor.</p>
        <div className="hero__actions">
          <Link className="button button--hero" href="/alerts">
            Activar mis alertas
            <ArrowRight size={19} />
          </Link>
          <Link className="button button--secondary" href="/learn">
            Ver cómo funciona
          </Link>
        </div>
      </section>

      {isLoading || !hasRates ? <p className="loading-line">Actualizando cotizaciones...</p> : null}
      {error && !hasRates ? <p className="notice">No pudimos cargar datos reales todavÃ­a. ReintentÃ¡ en unos segundos.</p> : null}

      {hasRates ? (
        <section className="section section--main-rates">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Principales</p>
            <h2>Lo que se mira primero</h2>
          </div>
          <Link className="text-link" href="/alerts">
            Alertas <ChevronRight size={16} />
          </Link>
        </div>
        <div className="card-list">
          {mainRates.map((rate) => (
            <RateCard rate={rate} key={rate.code} />
          ))}
        </div>
        </section>
      ) : null}

      {hasRates ? (
        <section className="section section--travel-rates">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Frontera y viajes</p>
            <h2>Monedas para moverse mejor</h2>
          </div>
        </div>
        <div className="card-list">
          {travelRates.map((rate) => (
            <RateCard rate={rate} key={rate.code} />
          ))}
        </div>
        </section>
      ) : null}

      {hasRates ? <ArgentinaToday rates={rates} /> : null}

      <CommunityReports />

      <section className="premium-strip">
        <p>No pagás por ver números. Pagás por enterarte antes.</p>
        <Link className="button button--premium" href="/premium">
          Ver Premium
        </Link>
      </section>
    </div>
  );
}
