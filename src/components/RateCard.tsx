"use client";

import Link from "next/link";
import { Bell, Clock3, Info, Star, TrendingDown, TrendingUp } from "lucide-react";
import { FlagBadge } from "@/components/FlagBadge";
import { formatDateTime, formatMoney, formatPercent } from "@/lib/format";
import type { Rate } from "@/lib/types";

const BLUE_HELPERS: Record<string, string> = {
  USD_BLUE: "Mejor oportunidad detectada entre las fuentes monitoreadas.",
  USD_BLUE_MENDOZA: "Rango amplio del mercado mendocino segun las fuentes monitoreadas.",
  USD_BLUE_PROMEDIO_MENDOZA: "Promedio calculado entre las fuentes mendocinas monitoreadas."
};

export function RateCard({ rate }: { rate: Rate }) {
  const isUp = rate.variation >= 0;
  const TrendIcon = isUp ? TrendingUp : TrendingDown;
  const helper = BLUE_HELPERS[rate.code];
  const spread =
    rate.buy_price !== null && rate.sell_price !== null ? Math.max(0, rate.sell_price - rate.buy_price) : null;

  return (
    <article className="rate-card">
      <div className="rate-card__top">
        <div className="rate-card__identity">
          <FlagBadge rate={rate} />
          <div>
            <h3>{rate.name}</h3>
            <p>{rate.country}</p>
          </div>
        </div>
        <div className="rate-card__tools">
          {helper ? (
            <button className="rate-card__info" type="button" aria-label={helper}>
              <Info size={15} />
              <span role="tooltip">{helper}</span>
            </button>
          ) : null}
          <span className="rate-card__star" aria-hidden="true">
            <Star size={15} />
          </span>
          <span className={`pill ${isUp ? "pill--green" : "pill--red"}`}>
            <TrendIcon size={14} />
            {formatPercent(rate.variation)}
          </span>
        </div>
      </div>

      <div className="quote-grid" aria-label={`${rate.name} compra y venta`}>
        <div>
          <span>Compra</span>
          <strong>{formatMoney(rate.buy_price, true)}</strong>
        </div>
        <div>
          <span>Venta</span>
          <strong>{formatMoney(rate.sell_price, true)}</strong>
        </div>
      </div>

      {spread !== null ? <span className="spread-line rate-card__spread">Spread {formatMoney(spread, true)}</span> : null}

      <div className="rate-card__footer">
        <span className="muted-line">
          <Clock3 size={14} />
          {formatDateTime(rate.updated_at)}
        </span>
        <Link className="button button--small button--alert" href={`/alerts?rate=${rate.code}`}>
          <Bell size={16} />
          Crear alerta
        </Link>
      </div>
    </article>
  );
}
