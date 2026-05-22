"use client";

import Link from "next/link";
import { Bell, Clock3, TrendingDown, TrendingUp } from "lucide-react";
import { FlagBadge } from "@/components/FlagBadge";
import { formatDateTime, formatMoney, formatPercent } from "@/lib/format";
import type { Rate } from "@/lib/types";

export function RateCard({ rate }: { rate: Rate }) {
  const isUp = rate.variation >= 0;
  const TrendIcon = isUp ? TrendingUp : TrendingDown;

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
        <span className={`pill ${isUp ? "pill--green" : "pill--red"}`}>
          <TrendIcon size={14} />
          {formatPercent(rate.variation)}
        </span>
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

      <div className="rate-card__footer">
        <span className="muted-line">
          <Clock3 size={14} />
          {formatDateTime(rate.updated_at)}
        </span>
        <Link className="button button--small" href={`/alerts?rate=${rate.code}`}>
          <Bell size={16} />
          Crear alerta
        </Link>
      </div>
    </article>
  );
}
