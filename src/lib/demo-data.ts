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
    code: "USD_BLUE_MENDOZA",
    name: "Referencia Blue Mendoza",
    country: "Mendoza",
    flag: "ðŸ‡¦ðŸ‡·ðŸ‡ºðŸ‡¸",
    type: "main",
    buy_price: 1177,
    sell_price: 1183,
    variation: 0.9,
    source: "Rango demo",
    is_visible: true,
    updated_at: now
  },
  {
    code: "USD_BLUE_PROMEDIO_MENDOZA",
    name: "Dólar MZA Promedio",
    country: "Mendoza",
    flag: "AR US",
    type: "main",
    buy_price: 1175,
    sell_price: 1185,
    variation: 0.8,
    source: "Dólar MZA Promedio | confidence=medium | reports=8 | sources=3 | method=local_average | center=1180",
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
    code: "USD_CCL",
    name: "Dolar CCL",
    country: "Argentina / Estados Unidos",
    flag: "ðŸ‡¦ðŸ‡·ðŸ‡ºðŸ‡¸",
    type: "main",
    buy_price: 1168,
    sell_price: 1184,
    variation: -0.1,
    source: "Promedio demo",
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
    title: "Que es el dolar",
    content: "Si el dólar sube fuerte, no siempre conviene comprar desesperado.",
    category: "dolar",
    level: "jovenes",
    related_alert_type: "above",
    is_visible: true,
    created_at: now
  },
  {
    id: "demo-2",
    title: "Tasa contra dólar",
    content: "El plazo fijo sirve cuando la tasa le gana al movimiento del dólar.",
    category: "plazo fijo",
    level: "ahorristas",
    related_alert_type: "dollar_vs_fixed_term",
    is_visible: true,
    created_at: now
  },
  {
    id: "demo-3",
    title: "Mirar tarde sale caro",
    content: "El que mira el dólar una vez por semana llega tarde.",
    category: "errores comunes",
    level: "ahorristas",
    related_alert_type: "gap_above",
    is_visible: true,
    created_at: now
  },
  {
    id: "demo-4",
    title: "Una alerta vale más",
    content: "Una alerta a tiempo puede ahorrarte más que una suscripción.",
    category: "ahorro",
    level: "ahorristas",
    related_alert_type: "below",
    is_visible: true,
    created_at: now
  },
  {
    id: "demo-5",
    title: "Viajar también es tipo de cambio",
    content: "Antes de viajar, mirá la moneda. A veces el cambio te come el presupuesto.",
    category: "viajes",
    level: "ahorristas",
    related_alert_type: "travel_opportunity",
    is_visible: true,
    created_at: now
  },
  {
    id: "demo-6",
    title: "Inflación sin vueltas",
    content: "Si todo sube más rápido que tu rendimiento, estás perdiendo poder de compra.",
    category: "inflacion",
    level: "jovenes",
    related_alert_type: "rate_down",
    is_visible: true,
    created_at: now
  },
  {
    id: "demo-7",
    title: "Brecha cambiaria",
    content: "La brecha compara el dolar oficial con otros valores. Si sube mucho, el mercado se pone mas sensible.",
    category: "dolar",
    level: "expertos",
    related_alert_type: "gap_above",
    is_visible: true,
    created_at: now
  },
  {
    id: "demo-8",
    title: "MEP y CCL",
    content: "MEP y CCL son referencias financieras. No son lo mismo que el blue ni que el oficial.",
    category: "dolar",
    level: "expertos",
    related_alert_type: "mep_below",
    is_visible: true,
    created_at: now
  },
  {
    id: "demo-9",
    title: "Spread",
    content: "El spread es la diferencia entre compra y venta. Si es alto, entrar y salir cuesta mas.",
    category: "errores comunes",
    level: "expertos",
    related_alert_type: "above",
    is_visible: true,
    created_at: now
  }
];
