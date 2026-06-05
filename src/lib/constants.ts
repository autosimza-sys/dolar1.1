import type { AlertCondition, Channel } from "@/lib/types";

export const APP_NAME = "Dólar Mendoza";

export const MAIN_RATE_CODES = [
  "USD_OFICIAL",
  "USD_BLUE",
  "USD_BLUE_MENDOZA",
  "USD_BLUE_PROMEDIO_MENDOZA",
  "USD_MEP",
  "USD_CCL"
];

export const TRAVEL_RATE_CODES = [
  "CLP_OFICIAL",
  "CLP_BLUE",
  "BRL_OFICIAL",
  "BRL_BLUE",
  "EUR_OFICIAL",
  "EUR_BLUE"
];

export const INDICATOR_CODES = ["BCRA_RATE", "FIXED_TERM_30", "MONTHLY_YIELD"];

export const ALERT_CHANNELS: Array<{ value: Channel; label: string; premium: boolean }> = [
  { value: "email", label: "Email", premium: false },
  { value: "whatsapp", label: "WhatsApp", premium: true }
];

export const ALERT_TYPES: Array<{
  value: AlertCondition;
  label: string;
  helper: string;
  defaultRateCode: string;
  targetSuffix: string;
}> = [
  {
    value: "above",
    label: "Dólar blue supera un precio",
    helper: "Te avisamos cuando el blue pase el valor que marcaste.",
    defaultRateCode: "USD_BLUE",
    targetSuffix: "$"
  },
  {
    value: "below",
    label: "Dólar blue baja de un precio",
    helper: "Para detectar una posible oportunidad de compra.",
    defaultRateCode: "USD_BLUE",
    targetSuffix: "$"
  },
  {
    value: "mep_below",
    label: "Dólar MEP baja de un precio",
    helper: "Ideal si esperás una entrada más barata.",
    defaultRateCode: "USD_MEP",
    targetSuffix: "$"
  },
  {
    value: "mep_above_blue",
    label: "Dólar MEP supera al blue",
    helper: "Alerta rara, útil para revisar el mercado.",
    defaultRateCode: "USD_MEP",
    targetSuffix: "$"
  },
  {
    value: "gap_above",
    label: "Brecha blue/oficial supera un porcentaje",
    helper: "Cuando la diferencia empieza a hacer ruido.",
    defaultRateCode: "USD_BLUE",
    targetSuffix: "%"
  },
  {
    value: "rate_up",
    label: "Tasa BCRA sube",
    helper: "Revisá plazo fijo y rendimientos.",
    defaultRateCode: "BCRA_RATE",
    targetSuffix: "%"
  },
  {
    value: "rate_down",
    label: "Tasa BCRA baja",
    helper: "Puede cambiar tu estrategia de ahorro.",
    defaultRateCode: "BCRA_RATE",
    targetSuffix: "%"
  },
  {
    value: "fixed_term_better",
    label: "Plazo fijo mejora",
    helper: "Cuando la tasa promedio se vuelve más atractiva.",
    defaultRateCode: "FIXED_TERM_30",
    targetSuffix: "%"
  },
  {
    value: "dollar_vs_fixed_term",
    label: "Conviene dólar o plazo fijo",
    helper: "Te avisamos si el movimiento cambia la comparación.",
    defaultRateCode: "MONTHLY_YIELD",
    targetSuffix: "%"
  },
  {
    value: "travel_opportunity",
    label: "Conviene comprar moneda para viajar",
    helper: "Pensado para Chile, Brasil y Europa.",
    defaultRateCode: "CLP_BLUE",
    targetSuffix: "%"
  },
  {
    value: "clp_strong_move",
    label: "Peso chileno se mueve fuerte",
    helper: "Revisalo antes de comprar para viajar.",
    defaultRateCode: "CLP_BLUE",
    targetSuffix: "%"
  },
  {
    value: "brl_strong_move",
    label: "Real se mueve fuerte",
    helper: "Evitá llegar tarde al cambio.",
    defaultRateCode: "BRL_BLUE",
    targetSuffix: "%"
  },
  {
    value: "eur_strong_move",
    label: "Euro se mueve fuerte",
    helper: "Para viajes o ahorro en euros.",
    defaultRateCode: "EUR_BLUE",
    targetSuffix: "%"
  },
  {
    value: "official_market_open",
    label: "Apertura mercado oficial",
    helper: "Aviso al inicio del horario bancario.",
    defaultRateCode: "USD_OFICIAL",
    targetSuffix: "hora"
  },
  {
    value: "official_market_close",
    label: "Cierre mercado oficial",
    helper: "Aviso cerca del cierre del horario bancario.",
    defaultRateCode: "USD_OFICIAL",
    targetSuffix: "hora"
  },
  {
    value: "informal_market_open",
    label: "Apertura mercado informal",
    helper: "Aviso cuando empieza a moverse el mercado blue.",
    defaultRateCode: "USD_BLUE",
    targetSuffix: "hora"
  },
  {
    value: "informal_market_close",
    label: "Cierre mercado informal",
    helper: "Aviso para revisar precios antes del cierre.",
    defaultRateCode: "USD_BLUE",
    targetSuffix: "hora"
  }
];

export const ALERT_MESSAGES: Record<AlertCondition, string> = {
  above: "El dólar blue superó el precio que marcaste.",
  below: "El dólar blue bajó del precio que marcaste.",
  mep_below: "El MEP bajó y puede ser una oportunidad.",
  mep_above_blue: "El MEP superó al blue. Revisá antes de operar.",
  gap_above: "La brecha blue/oficial superó el porcentaje que marcaste.",
  rate_up: "La tasa BCRA cambió. Revisá si te conviene plazo fijo.",
  rate_down: "La tasa BCRA bajó. Revisá tu estrategia.",
  fixed_term_better: "El plazo fijo mejoró frente a tu referencia.",
  dollar_vs_fixed_term: "Hoy cambió la comparación entre dólar y plazo fijo.",
  travel_opportunity: "Hay movimiento para moneda de viaje. Revisalo antes de comprar.",
  clp_strong_move: "El peso chileno se movió fuerte. Revisalo antes de comprar.",
  brl_strong_move: "El real se movió fuerte. Revisalo antes de comprar.",
  eur_strong_move: "El euro se movió fuerte. Revisalo antes de comprar.",
  official_market_open: "Abrió el mercado oficial. Revisá los primeros precios del día.",
  official_market_close: "Cierra el mercado oficial. Revisá el valor antes del cierre.",
  informal_market_open: "Empieza a moverse el mercado informal. Mirá el blue temprano.",
  informal_market_close: "Cierra el mercado informal. Revisá el precio antes de decidir."
};

export const PREMIUM_BULLETS = [
  "Alertas ilimitadas",
  "WhatsApp",
  "Resumen diario",
  "Señales de oportunidad",
  "Comparador dólar/plazo fijo",
  "Historial",
  "Educación financiera completa"
];

export const FREE_BULLETS = ["Cotizaciones", "Argentina hoy", "1 alerta activa", "Educación básica"];
