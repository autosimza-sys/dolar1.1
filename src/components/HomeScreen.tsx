"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BellRing,
  BookOpen,
  Check,
  ChevronRight,
  Heart,
  LockKeyhole,
  Sparkles,
  Star,
  UserRound
} from "lucide-react";
import { AuthModal } from "@/components/AuthModal";
import { RateCard } from "@/components/RateCard";
import { commercialPlans } from "@/lib/commercial";
import { INDICATOR_CODES, MAIN_RATE_CODES, TRAVEL_RATE_CODES } from "@/lib/constants";
import { formatDateTime, formatPercent, shortNumber } from "@/lib/format";
import { useAccount, useRates } from "@/lib/hooks";
import type { Rate } from "@/lib/types";

const learningLevels = [
  {
    eyebrow: "Para empezar",
    topics: ["Qué significa compra y venta", "Por qué el dólar tiene distintos precios", "Qué es la inflación"]
  },
  {
    eyebrow: "Para cuidar tu plata",
    topics: ["Dólar o plazo fijo", "Cómo usar alertas", "Qué mirar antes de comprar moneda"]
  },
  {
    eyebrow: "Para entender el mercado",
    topics: ["Brecha cambiaria", "Riesgo país", "Precio de referencia vs operativo"]
  }
];

const freeBenefits = [
  "Cotizaciones completas",
  "Monedas favoritas",
  "Panel personalizado",
  "Educación financiera",
  "Programa de referidos",
  "Historial básico"
];

function pickRates(rates: Rate[], codes: string[]) {
  return codes.map((code) => rates.find((rate) => rate.code === code)).filter(Boolean) as Rate[];
}

type FavoriteControls = {
  favoriteCodes: Set<string>;
  favoriteLoadingCode: string | null;
  onToggleFavorite: (rate: Rate) => void;
};

function ArgentinaToday({ rates, favoriteCodes, favoriteLoadingCode, onToggleFavorite }: { rates: Rate[] } & FavoriteControls) {
  const indicators = pickRates(rates, INDICATOR_CODES);
  const latest = indicators.reduce<string | null>((current, rate) => {
    if (!current) return rate.updated_at;
    return new Date(rate.updated_at) > new Date(current) ? rate.updated_at : current;
  }, null);

  if (!indicators.length) return null;

  return (
    <div className="today-panel">
      <div className="today-grid">
        {indicators.map((indicator) => (
          <article className="metric-card" key={indicator.code}>
            <div style={{ alignItems: "flex-start", display: "flex", gap: 8, justifyContent: "space-between" }}>
              <span>{indicator.name}</span>
              <button
                className={`rate-card__star ${favoriteCodes.has(indicator.code) ? "is-selected" : ""}`}
                aria-label={
                  favoriteCodes.has(indicator.code)
                    ? `Quitar ${indicator.name} de favoritas`
                    : `Agregar ${indicator.name} a favoritas`
                }
                aria-pressed={favoriteCodes.has(indicator.code)}
                disabled={favoriteLoadingCode === indicator.code}
                style={{
                  alignItems: "center",
                  background: "transparent",
                  border: 0,
                  cursor: favoriteLoadingCode === indicator.code ? "wait" : "pointer",
                  display: "inline-flex",
                  flex: "0 0 auto",
                  height: 28,
                  justifyContent: "center",
                  margin: "-6px -6px 0 0",
                  opacity: favoriteCodes.has(indicator.code) ? 1 : 0.68,
                  padding: 0,
                  width: 28
                }}
                type="button"
                onClick={() => onToggleFavorite(indicator)}
              >
                <Star fill={favoriteCodes.has(indicator.code) ? "currentColor" : "none"} size={16} />
              </button>
            </div>
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
      </div>
    </div>
  );
}

export function HomeScreen() {
  const { data: rates, isLoading, error } = useRates();
  const account = useAccount();
  const [authOpen, setAuthOpen] = useState(false);
  const [favoriteLoadingCode, setFavoriteLoadingCode] = useState<string | null>(null);
  const [favoriteStatus, setFavoriteStatus] = useState<string | null>(null);
  const isRegistered = Boolean(account.user);
  const mainRates = pickRates(rates, MAIN_RATE_CODES);
  const travelRates = pickRates(rates, TRAVEL_RATE_CODES);
  const previewRates = mainRates.filter((rate) => ["USD_BLUE", "USD_BLUE_MENDOZA"].includes(rate.code)).slice(0, 2);
  const hasRates = rates.length > 0;
  const favoriteCodes = new Set(account.favorites.map((favorite) => favorite.rate_code));

  async function toggleFavorite(rate: Rate) {
    if (!account.user || !account.supabase) {
      setAuthOpen(true);
      return;
    }

    setFavoriteLoadingCode(rate.code);
    setFavoriteStatus(null);
    const wasFavorite = favoriteCodes.has(rate.code);

    const result = wasFavorite
      ? await account.supabase
          .from("favorite_rates")
          .delete()
          .eq("user_id", account.user.id)
          .eq("rate_code", rate.code)
      : await account.supabase.from("favorite_rates").insert({
          user_id: account.user.id,
          rate_code: rate.code
        });

    if (!result.error) {
      await account.reload();
      setFavoriteStatus(wasFavorite ? `${rate.name} se quitó de tus favoritas.` : `${rate.name} se agregó a tus favoritas.`);
    } else {
      setFavoriteStatus("No pudimos actualizar tus favoritas. Intentá nuevamente.");
    }

    setFavoriteLoadingCode(null);
  }

  return (
    <div className="screen screen--home screen--home-funnel">
      <section className="hero home-funnel__hero">
        <div className="hero__badge">
          <Sparkles size={16} />
          Estar un paso antes
        </div>
        <h1>Todos los días hay personas que ganan oportunidades y personas que las pierden.</h1>
        <p>
          La diferencia muchas veces no es el dinero.
          <br />
          Es el momento en que se enteran.
        </p>
        <strong className="home-funnel__signature">Dólar MZA. Estar un paso antes.</strong>
        <div className="hero__actions">
          {isRegistered ? (
            <Link className="button button--hero" href="/account">
              Ir a mi panel
              <ArrowRight size={19} />
            </Link>
          ) : (
            <button className="button button--hero" type="button" onClick={() => setAuthOpen(true)}>
              Crear cuenta gratis
              <ArrowRight size={19} />
            </button>
          )}
          <Link className="button button--secondary" href="/learn">
            Aprender primero
          </Link>
        </div>
      </section>

      <section className="section brand-story">
        <p className="eyebrow">Por qué existe Dólar MZA</p>
        <h2>La información sirve cuando llega a tiempo.</h2>
        <div className="brand-story__copy">
          <p>
            Hay personas que parecen llegar siempre antes. Antes de una oportunidad, de un cambio o de una decisión
            importante.
          </p>
          <p>
            No tienen información secreta. Entienden lo que está pasando antes que los demás y pueden pensar, comparar y
            decidir.
          </p>
          <p>
            Dólar MZA transforma datos complejos en información simple, útil y accionable para ahorrar, viajar, invertir,
            comprar o planificar mejor.
          </p>
        </div>
        {!isRegistered ? (
          <button className="text-link home-inline-action" type="button" onClick={() => setAuthOpen(true)}>
            Crear cuenta gratis <ChevronRight size={16} />
          </button>
        ) : null}
      </section>

      <section className="section home-learning">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Educación financiera</p>
            <h2>Entendé antes de decidir</h2>
          </div>
          <Link className="text-link" href="/learn">
            Ver todo <ChevronRight size={16} />
          </Link>
        </div>
        <div className="home-learning__grid">
          {learningLevels.map((level) => (
            <article className="home-learning__level" key={level.eyebrow}>
              <BookOpen size={20} />
              <strong>{level.eyebrow}</strong>
              <ul>
                {level.topics.map((topic) => (
                  <li key={topic}>{topic}</li>
                ))}
              </ul>
              <Link className="text-link" href="/learn">
                Leer <ChevronRight size={15} />
              </Link>
            </article>
          ))}
        </div>
        {!isRegistered ? (
          <p className="home-learning__note">Creá tu cuenta gratis para guardar tus temas y monedas favoritas.</p>
        ) : null}
      </section>

      <section className="section free-account-band">
        <div>
          <p className="eyebrow">Cuenta gratuita</p>
          <h2>Tu puerta de entrada a Dólar MZA</h2>
          <p>Personalizá la plataforma y volvé cada día a lo que realmente te importa.</p>
        </div>
        <div className="free-account-benefits">
          {freeBenefits.map((benefit) => (
            <span key={benefit}>
              <Check size={16} />
              {benefit}
            </span>
          ))}
        </div>
        {!isRegistered ? (
          <button className="button" type="button" onClick={() => setAuthOpen(true)}>
            <UserRound size={18} />
            Crear cuenta gratis
          </button>
        ) : (
          <Link className="button" href="/account">
            Ver mi panel
          </Link>
        )}
      </section>

      <section className="section home-rates" id="cotizaciones">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Cotizaciones</p>
            <h2>{isRegistered ? "Tus datos para decidir mejor" : "Una muestra del mercado"}</h2>
          </div>
        </div>

        {isLoading || !hasRates ? <p className="loading-line">Actualizando cotizaciones...</p> : null}
        {error && !hasRates ? <p className="notice">No pudimos cargar datos reales todavía. Reintentá en unos segundos.</p> : null}
        {favoriteStatus ? <p className="notice">{favoriteStatus}</p> : null}

        {hasRates ? (
          <>
            <div className="card-list home-rates__grid">
              {(isRegistered ? mainRates : previewRates).map((rate) => (
                <RateCard
                  preview={!isRegistered}
                  rate={rate}
                  isFavorite={favoriteCodes.has(rate.code)}
                  isFavoriteLoading={favoriteLoadingCode === rate.code}
                  key={rate.code}
                  onToggleFavorite={toggleFavorite}
                />
              ))}
            </div>

            {isRegistered ? (
              <>
                <div className="home-rates__subhead">
                  <p className="eyebrow">Frontera y viajes</p>
                  <h3>Monedas para moverse mejor</h3>
                </div>
                <div className="card-list home-rates__grid">
                  {travelRates.map((rate) => (
                    <RateCard
                      rate={rate}
                      isFavorite={favoriteCodes.has(rate.code)}
                      isFavoriteLoading={favoriteLoadingCode === rate.code}
                      key={rate.code}
                      onToggleFavorite={toggleFavorite}
                    />
                  ))}
                </div>
                <div className="home-rates__subhead">
                  <p className="eyebrow">Argentina hoy</p>
                  <h3>Tasa, plazo fijo y rendimiento</h3>
                </div>
                <ArgentinaToday
                  rates={rates}
                  favoriteCodes={favoriteCodes}
                  favoriteLoadingCode={favoriteLoadingCode}
                  onToggleFavorite={toggleFavorite}
                />
              </>
            ) : (
              <div className="rates-gate">
                <LockKeyhole size={22} />
                <div>
                  <strong>Las cotizaciones completas son parte de tu cuenta gratuita.</strong>
                  <p>Registrate para ver valores completos y guardar tus favoritas.</p>
                </div>
                <button className="button" type="button" onClick={() => setAuthOpen(true)}>
                  Crear cuenta gratis
                </button>
              </div>
            )}
          </>
        ) : null}
      </section>

      {!isRegistered ? (
        <section className="registration-band">
          <UserRound size={26} />
          <div>
            <p className="eyebrow">Tu panel empieza acá</p>
            <h2>Creá tu cuenta gratis</h2>
            <p>Elegí favoritas, guardá tus temas y construí una experiencia financiera propia.</p>
          </div>
          <button className="button button--hero" type="button" onClick={() => setAuthOpen(true)}>
            Registrarme gratis
          </button>
        </section>
      ) : null}

      <section className="section alert-value-band">
        <BellRing size={25} />
        <div>
          <p className="eyebrow">Cuando quieras dar el siguiente paso</p>
          <h2>Desbloqueá alertas y seguimiento automático</h2>
          <p>No mires el mercado todo el día. Elegí qué seguir y Dólar MZA te avisa.</p>
        </div>
        <Link className="button button--ghost" href={isRegistered ? "/premium" : "/account"}>
          {isRegistered ? "Ver planes" : "Crear cuenta primero"}
        </Link>
      </section>

      <section className="section home-plans">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Planes de alertas</p>
            <h2>Elegí seguimiento cuando ya conozcas la plataforma</h2>
          </div>
        </div>
        <div className="home-plan-grid">
          {Object.values(commercialPlans).map((plan) => (
            <article className={`home-plan-option ${plan.tone === "featured" ? "is-featured" : ""}`} key={plan.id}>
              <span>{plan.tag}</span>
              <strong>{plan.name}</strong>
              <b>{plan.priceLabel}</b>
              <p>{plan.message}</p>
              <Link className={plan.tone === "featured" ? "button" : "button button--ghost"} href="/premium">
                {plan.cta}
              </Link>
            </article>
          ))}
        </div>
      </section>

      <section className="home-closing">
        <Heart size={20} />
        <p>Porque el valor de la información no está en saber más. Está en llegar antes.</p>
      </section>

      <AuthModal
        open={authOpen}
        onClose={() => setAuthOpen(false)}
        message="Creá tu cuenta gratis para ver cotizaciones completas, elegir favoritas y personalizar tu panel."
      />
    </div>
  );
}
