"use client";

import Link from "next/link";
import { Bell, Clock3, Info, Star, TrendingDown, TrendingUp } from "lucide-react";
import { FlagBadge } from "@/components/FlagBadge";
import { formatDateTime, formatMoney, formatPercent } from "@/lib/format";
import { getMzaConfidence, getRateDisplayName } from "@/lib/rate-presentation";
import type { Rate } from "@/lib/types";

const BLUE_HELPERS: Record<string, string> = {
  USD_BLUE: "Mejor oportunidad detectada entre las fuentes monitoreadas.",
  USD_BLUE_MENDOZA: "Rango de referencia entre los valores mendocinos validados.",
  USD_BLUE_PROMEDIO_MENDOZA: "Promedio central propio de Dólar MZA con spread corto de $10."
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
  const displayName = getRateDisplayName(rate);
  const confidence = getMzaConfidence(rate);
  const isMzaAverage = rate.code === "USD_BLUE_PROMEDIO_MENDOZA";
  const spread =
    rate.buy_price !== null && rate.sell_price !== null ? Math.max(0, rate.sell_price - rate.buy_price) : null;

  return (
    <article className={`rate-card ${isMzaAverage ? "rate-card--mza-index" : ""}`}>
      <div className="rate-card__top">
        <div className="rate-card__identity">
          <FlagBadge rate={rate} />
          <div>
            {isMzaAverage ? <span className="rate-card__index-label">Índice propio Mendoza</span> : null}
            <h3>{displayName}</h3>
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
            aria-label={isFavorite ? `Quitar ${displayName} de favoritas` : `Agregar ${displayName} a favoritas`}
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

      <div className="quote-grid" aria-label={`${displayName} compra y venta`}>
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

      {!preview && confidence ? (
        <div className={`rate-card__confidence rate-card__confidence--${confidence.level}`}>
          <span aria-hidden />
          <strong>{confidence.label}</strong>
          <small>
            {confidence.reportCount
              ? `Basado en ${confidence.reportCount} reportes y ${confidence.sourceCount} fuentes validadas.`
              : `Basado en ${confidence.sourceCount} fuentes validadas.`}
            {confidence.usedFallback ? " Referencia nacional de respaldo." : ""}
          </small>
        </div>
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
