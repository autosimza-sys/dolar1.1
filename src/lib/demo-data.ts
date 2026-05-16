import type { EducationCard, Rate } from "@/lib/types";

const now = new Date().toISOString();

export const demoRates: Rate[] = [
  {
    code: "USD_OFICIAL",
    name: "Dólar Oficial",
    country: "Argentina / Estados Unidos",
    flag: "🇦🇷🇺🇸",
    type: "main",
    buy_price: 1095,
    sell_price: 1135,
    variation: 0.8,
    source: "Demo manual",
    is_visible: true,
    updated_at: now
  },
  {
    code: "USD_BLUE",
    name: "Dólar Blue",
    country: "Argentina / Estados Unidos",
    flag: "🇦🇷🇺🇸",
    type: "main",
    buy_price: 1180,
    sell_price: 1210,
    variation: 1.4,
    source: "Demo manual",
    is_visible: true,
    updated_at: now
  },
  {
    code: "USD_MEP",
    name: "Dólar Bolsa / MEP",
    country: "Argentina / Estados Unidos",
    flag: "🇦🇷🇺🇸",
    type: "main",
    buy_price: 1162,
    sell_price: 1175,
    variation: -0.2,
    source: "Demo manual",
    is_visible: true,
    updated_at: now
  },
  {
    code: "CLP_OFICIAL",
    name: "Peso chileno oficial",
    country: "Chile",
    flag: "🇨🇱",
    type: "travel",
    buy_price: 1.08,
    sell_price: 1.18,
    variation: 0.3,
    source: "Demo manual",
    is_visible: true,
    updated_at: now
  },
  {
    code: "CLP_BLUE",
    name: "Peso chileno blue",
    country: "Chile",
    flag: "🇨🇱",
    type: "travel",
    buy_price: 1.22,
    sell_price: 1.34,
    variation: 1.7,
    source: "Demo manual",
    is_visible: true,
    updated_at: now
  },
  {
    code: "BRL_OFICIAL",
    name: "Real oficial",
    country: "Brasil",
    flag: "🇧🇷",
    type: "travel",
    buy_price: 205,
    sell_price: 224,
    variation: -0.4,
    source: "Demo manual",
    is_visible: true,
    updated_at: now
  },
  {
    code: "BRL_BLUE",
    name: "Real blue",
    country: "Brasil",
    flag: "🇧🇷",
    type: "travel",
    buy_price: 220,
    sell_price: 242,
    variation: 0.9,
    source: "Demo manual",
    is_visible: true,
    updated_at: now
  },
  {
    code: "EUR_OFICIAL",
    name: "Euro oficial",
    country: "Europa",
    flag: "🇪🇺",
    type: "travel",
    buy_price: 1240,
    sell_price: 1320,
    variation: 0.6,
    source: "Demo manual",
    is_visible: true,
    updated_at: now
  },
  {
    code: "EUR_BLUE",
    name: "Euro blue",
    country: "Europa",
    flag: "🇪🇺",
    type: "travel",
    buy_price: 1308,
    sell_price: 1395,
    variation: 1.1,
    source: "Demo manual",
    is_visible: true,
    updated_at: now
  },
  {
    code: "BCRA_RATE",
    name: "Tasa BCRA",
    country: "Argentina",
    flag: "🇦🇷",
    type: "indicator",
    buy_price: null,
    sell_price: 40,
    variation: 0.5,
    source: "Demo manual",
    is_visible: true,
    updated_at: now
  },
  {
    code: "FIXED_TERM_30",
    name: "Plazo fijo promedio 30 días",
    country: "Argentina",
    flag: "🇦🇷",
    type: "indicator",
    buy_price: null,
    sell_price: 3.15,
    variation: 0.1,
    source: "Demo manual",
    is_visible: true,
    updated_at: now
  },
  {
    code: "MONTHLY_YIELD",
    name: "Rendimiento mensual estimado",
    country: "Argentina",
    flag: "🇦🇷",
    type: "indicator",
    buy_price: null,
    sell_price: 3.35,
    variation: 0.2,
    source: "Demo manual",
    is_visible: true,
    updated_at: now
  }
];

export const demoEducationCards: EducationCard[] = [
  {
    id: "demo-1",
    title: "No compres por susto",
    content: "Si el dólar sube fuerte, no siempre conviene comprar desesperado.",
    category: "dolar",
    related_alert_type: "above",
    is_visible: true,
    created_at: now
  },
  {
    id: "demo-2",
    title: "Tasa contra dólar",
    content: "El plazo fijo sirve cuando la tasa le gana al movimiento del dólar.",
    category: "plazo fijo",
    related_alert_type: "dollar_vs_fixed_term",
    is_visible: true,
    created_at: now
  },
  {
    id: "demo-3",
    title: "Mirar tarde sale caro",
    content: "El que mira el dólar una vez por semana llega tarde.",
    category: "errores comunes",
    related_alert_type: "gap_above",
    is_visible: true,
    created_at: now
  },
  {
    id: "demo-4",
    title: "Una alerta vale más",
    content: "Una alerta a tiempo puede ahorrarte más que una suscripción.",
    category: "ahorro",
    related_alert_type: "below",
    is_visible: true,
    created_at: now
  },
  {
    id: "demo-5",
    title: "Viajar también es tipo de cambio",
    content: "Antes de viajar, mirá la moneda. A veces el cambio te come el presupuesto.",
    category: "viajes",
    related_alert_type: "travel_opportunity",
    is_visible: true,
    created_at: now
  },
  {
    id: "demo-6",
    title: "Inflación sin vueltas",
    content: "Si todo sube más rápido que tu rendimiento, estás perdiendo poder de compra.",
    category: "inflacion",
    related_alert_type: "rate_down",
    is_visible: true,
    created_at: now
  }
];
