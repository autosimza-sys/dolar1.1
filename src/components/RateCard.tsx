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

function maskedMoney(value: number | null) {
  if (value === null) return "$ -.--";

  const rounded = Math.round(value).toLocaleString("es-AR");
  let hiddenDigits = 0;

  return `$ ${rounded
    .split("")
    .reverse()
    .map((character) => {
      if (/\d/.test(character) && hiddenDigits < 2) {
        hiddenDigits += 1;
        return "X";
      }
      return character;
    })
    .reverse()
    .join("")}`;
}

type RateCardProps = {
  rate: Rate;
  preview?: boolean;
  isFavorite?: boolean;
  isFavoriteLoading?: boolean;
  onToggleFavorite?: (rate: Rate) => void;
};

export function RateCard({
  rate,
  preview = false,
  isFavorite = false,
  isFavoriteLoading = false,
  onToggleFavorite
}: RateCardProps) {
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
          <button
            className={`rate-card__star ${isFavorite ? "is-selected" : ""}`}
            aria-label={isFavorite ? `Quitar ${rate.name} de favoritas` : `Agregar ${rate.name} a favoritas`}
            aria-pressed={isFavorite}
            disabled={isFavoriteLoading}
            style={{
              alignItems: "center",
              background: "transparent",
              border: 0,
              cursor: isFavoriteLoading ? "wait" : "pointer",
              height: 28,
              justifyContent: "center",
              opacity: isFavorite ? 1 : 0.68,
              padding: 0,
              width: 28
            }}
            type="button"
            onClick={() => onToggleFavorite?.(rate)}
          >
            <Star fill={isFavorite ? "currentColor" : "none"} size={16} />
          </button>
          <span className={`pill ${isUp ? "pill--green" : "pill--red"}`}>
            <TrendIcon size={14} />
            {formatPercent(rate.variation)}
          </span>
        </div>
      </div>

      <div className="quote-grid" aria-label={`${rate.name} compra y venta`}>
        <div>
          <span>Compra</span>
          <strong>{preview ? maskedMoney(rate.buy_price) : formatMoney(rate.buy_price, true)}</strong>
        </div>
        <div>
          <span>Venta</span>
          <strong>{preview ? maskedMoney(rate.sell_price) : formatMoney(rate.sell_price, true)}</strong>
        </div>
      </div>

      {!preview && spread !== null ? (
        <span className="spread-line rate-card__spread">Spread {formatMoney(spread, true)}</span>
      ) : null}

      <div className="rate-card__footer">
        <span className="muted-line">
          <Clock3 size={14} />
          {preview ? "Vista parcial" : formatDateTime(rate.updated_at)}
        </span>
        {preview ? null : (
          <Link className="button button--small button--alert" href={`/alerts?rate=${rate.code}`}>
            <Bell size={16} />
            Crear alerta
          </Link>
        )}
      </div>
    </article>
  );
}
