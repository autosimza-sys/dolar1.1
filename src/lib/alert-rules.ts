import type { AlertCondition, Rate, UserAlert } from "@/lib/types";

export type AlertEvaluation = {
  shouldSend: boolean;
  message: string;
};

function getRate(rates: Rate[], code: string) {
  return rates.find((rate) => rate.code === code);
}

function sell(rate: Rate | undefined) {
  return rate?.sell_price ?? rate?.buy_price ?? 0;
}

function buy(rate: Rate | undefined) {
  return rate?.buy_price ?? rate?.sell_price ?? 0;
}

function absVariation(rate: Rate | undefined) {
  return Math.abs(rate?.variation ?? 0);
}

function buenosAiresNow() {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "America/Argentina/Buenos_Aires" }));
}

function isWeekday(date: Date) {
  const day = date.getDay();
  return day >= 1 && day <= 5;
}

function isInsideMinuteWindow(hour: number, minute = 0, windowMinutes = 10) {
  const now = buenosAiresNow();
  if (!isWeekday(now)) return false;

  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const targetMinutes = hour * 60 + minute;
  return currentMinutes >= targetMinutes && currentMinutes < targetMinutes + windowMinutes;
}

function money(value: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: value < 10 ? 2 : 0
  }).format(value);
}

function number(value: number) {
  return new Intl.NumberFormat("es-AR", {
    maximumFractionDigits: value < 10 ? 2 : 0
  }).format(value);
}

function signedMoney(value: number) {
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${money(value)}`;
}

function signedPercent(value: number) {
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${number(value)}%`;
}

function signedPoints(value: number) {
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${number(value)} puntos`;
}

function rateName(rate: Rate | undefined, fallback: string) {
  return rate?.name ?? fallback;
}

function valueKind(rate: Rate | undefined, condition: AlertCondition) {
  if (rate?.code === "COUNTRY_RISK") return "points";
  if (
    rate?.type === "indicator" ||
    condition === "rate_up" ||
    condition === "rate_down" ||
    condition === "fixed_term_better" ||
    condition === "dollar_vs_fixed_term" ||
    condition === "gap_above" ||
    condition === "travel_opportunity" ||
    condition === "clp_strong_move" ||
    condition === "brl_strong_move" ||
    condition === "eur_strong_move"
  ) {
    return "percent";
  }
  return "money";
}

function formatValue(value: number, kind: "money" | "percent" | "points") {
  if (kind === "money") return money(value);
  if (kind === "points") return `${number(value)} puntos`;
  return `${number(value)}%`;
}

function formatDifference(value: number, kind: "money" | "percent" | "points") {
  if (kind === "money") return signedMoney(value);
  if (kind === "points") return signedPoints(value);
  return signedPoints(value);
}

function nowLabel() {
  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Argentina/Buenos_Aires"
  }).format(new Date());
}

function priceMessage({
  title,
  intro,
  rate,
  fallback,
  current,
  target,
  condition
}: {
  title: string;
  intro: string;
  rate: Rate | undefined;
  fallback: string;
  current: number;
  target: number;
  condition: AlertCondition;
}) {
  const kind = valueKind(rate, condition);
  const diff = current - target;

  return [
    title,
    "",
    "Tu alerta se activo.",
    intro,
    "",
    "Moneda o indicador:",
    rateName(rate, fallback),
    "",
    "Valor actual:",
    formatValue(current, kind),
    "",
    "Tu alerta:",
    formatValue(target, kind),
    "",
    "Diferencia:",
    formatDifference(diff, kind),
    "",
    "Fecha y hora:",
    nowLabel(),
    "",
    "Revisa las cotizaciones antes de decidir."
  ].join("\n");
}

function movementMessage(rate: Rate | undefined, fallback: string, target: number) {
  return [
    `${rateName(rate, fallback)} se movio fuerte`,
    "",
    "Tu alerta se activo.",
    "La moneda que seguis tuvo un movimiento importante.",
    "",
    "Moneda:",
    rateName(rate, fallback),
    "",
    "Valor actual:",
    money(sell(rate)),
    "",
    "Movimiento del dia:",
    signedPercent(rate?.variation ?? 0),
    "",
    "Tu alerta:",
    `${number(target)}%`,
    "",
    "Fecha y hora:",
    nowLabel(),
    "",
    "Revisa las cotizaciones antes de decidir."
  ].join("\n");
}

function rateMessage(title: string, rate: Rate | undefined, target: number) {
  const current = sell(rate);

  return [
    title,
    "",
    "Tu alerta se activo.",
    "La tasa que seguis tuvo un movimiento importante.",
    "",
    "Indicador:",
    rateName(rate, "Tasa"),
    "",
    "Tasa actual:",
    `${number(current)}%`,
    "",
    "Tu alerta:",
    `${number(target)}%`,
    "",
    "Diferencia:",
    signedPoints(current - target),
    "",
    "Fecha y hora:",
    nowLabel(),
    "",
    "Esto puede afectar rendimientos en pesos."
  ].join("\n");
}

function marketLine(label: string, rate: Rate | undefined) {
  return `${label}: Compra ${money(buy(rate))} / Venta ${money(sell(rate))}`;
}

function officialMarketMessage(title: string, rates: Rate[], opening: boolean) {
  return [
    title,
    "",
    opening ? "Buen dia." : "Termino la jornada bancaria.",
    opening ? "Ya abrio el mercado oficial." : "Asi cerro el mercado oficial.",
    "",
    marketLine("Dolar Oficial", getRate(rates, "USD_OFICIAL")),
    marketLine("Real Oficial", getRate(rates, "BRL_OFICIAL")),
    marketLine("Euro Oficial", getRate(rates, "EUR_OFICIAL")),
    marketLine("Peso Chileno", getRate(rates, "CLP_OFICIAL")),
    "",
    "Fecha y hora:",
    nowLabel(),
    "",
    "Revisa las cotizaciones completas."
  ].join("\n");
}

function informalMarketMessage(title: string, rates: Rate[], opening: boolean) {
  return [
    title,
    "",
    opening ? "Ya empezo a moverse el mercado informal." : "Asi cerro el mercado informal.",
    "",
    marketLine("Dolar Blue", getRate(rates, "USD_BLUE")),
    marketLine("Dolar Blue Mendoza", getRate(rates, "USD_BLUE_MENDOZA")),
    marketLine("Euro Blue", getRate(rates, "EUR_BLUE")),
    marketLine("Real Blue", getRate(rates, "BRL_BLUE")),
    "",
    "Fecha y hora:",
    nowLabel(),
    "",
    "Revisa las cotizaciones completas."
  ].join("\n");
}

export function evaluateAlert(alert: UserAlert, rates: Rate[]): AlertEvaluation {
  const rate = getRate(rates, alert.rate_code);
  const blue = getRate(rates, "USD_BLUE");
  const oficial = getRate(rates, "USD_OFICIAL");
  const mep = getRate(rates, "USD_MEP");
  const condition = alert.condition_type as AlertCondition;
  const target = Number(alert.target_value);

  if (condition === "official_market_open") {
    return {
      shouldSend: isInsideMinuteWindow(10),
      message: officialMarketMessage("Abrio el mercado oficial", rates, true)
    };
  }

  if (condition === "official_market_close") {
    return {
      shouldSend: isInsideMinuteWindow(15),
      message: officialMarketMessage("Cerro el mercado oficial", rates, false)
    };
  }

  if (condition === "informal_market_open") {
    return {
      shouldSend: isInsideMinuteWindow(11),
      message: informalMarketMessage("Abrio el mercado informal", rates, true)
    };
  }

  if (condition === "informal_market_close") {
    return {
      shouldSend: isInsideMinuteWindow(16),
      message: informalMarketMessage("Cerro el mercado informal", rates, false)
    };
  }

  if (!rate) {
    return {
      shouldSend: false,
      message: "Hoy hay movimiento importante. Revisa las cotizaciones."
    };
  }

  if (condition === "above") {
    return {
      shouldSend: sell(rate) >= target,
      message: priceMessage({
        title: `${rateName(rate, alert.rate_code)} llego al valor que marcaste`,
        intro: `${rateName(rate, alert.rate_code)} supero el valor que estabas siguiendo.`,
        rate,
        fallback: alert.rate_code,
        current: sell(rate),
        target,
        condition
      })
    };
  }

  if (condition === "below" || condition === "mep_below") {
    return {
      shouldSend: sell(rate) <= target,
      message: priceMessage({
        title: `${rateName(rate, alert.rate_code)} bajo al valor que esperabas`,
        intro: `${rateName(rate, alert.rate_code)} bajo hasta el valor que marcaste.`,
        rate,
        fallback: alert.rate_code,
        current: sell(rate),
        target,
        condition
      })
    };
  }

  if (condition === "mep_above_blue") {
    return {
      shouldSend: sell(mep) > sell(blue),
      message: [
        "Dolar MEP supero al blue",
        "",
        "Tu alerta se activo.",
        "",
        marketLine("Dolar MEP", mep),
        marketLine("Dolar Blue", blue),
        "",
        "Fecha y hora:",
        nowLabel(),
        "",
        "Revisa las cotizaciones antes de decidir."
      ].join("\n")
    };
  }

  if (condition === "gap_above") {
    const base = sell(oficial);
    const gap = base > 0 ? ((sell(blue) - base) / base) * 100 : 0;
    return {
      shouldSend: gap >= target,
      message: priceMessage({
        title: "La diferencia blue/oficial llego al valor que marcaste",
        intro: "La diferencia entre el blue y el oficial tuvo un movimiento importante.",
        rate: blue,
        fallback: "Dolar Blue",
        current: gap,
        target,
        condition
      })
    };
  }

  if (condition === "rate_up") {
    return {
      shouldSend: target > 0 ? sell(rate) >= target : (rate.variation ?? 0) > 0,
      message: rateMessage("Subio la tasa que estabas siguiendo", rate, target)
    };
  }

  if (condition === "rate_down") {
    return {
      shouldSend: target > 0 ? sell(rate) <= target : (rate.variation ?? 0) < 0,
      message: rateMessage("Bajo la tasa que estabas siguiendo", rate, target)
    };
  }

  if (condition === "fixed_term_better") {
    return {
      shouldSend: sell(rate) >= target,
      message: rateMessage("Mejoro el plazo fijo que estabas siguiendo", rate, target)
    };
  }

  if (condition === "dollar_vs_fixed_term") {
    return {
      shouldSend: absVariation(blue) >= target || sell(rate) >= target,
      message: [
        "Cambio la comparacion entre dolar y plazo fijo",
        "",
        "Tu alerta se activo.",
        "Hay un movimiento importante para revisar.",
        "",
        marketLine("Dolar Blue", blue),
        `Rendimiento que seguis: ${number(sell(rate))}%`,
        "",
        "Fecha y hora:",
        nowLabel(),
        "",
        "Revisa las cotizaciones antes de decidir."
      ].join("\n")
    };
  }

  if (
    condition === "travel_opportunity" ||
    condition === "clp_strong_move" ||
    condition === "brl_strong_move" ||
    condition === "eur_strong_move"
  ) {
    return {
      shouldSend: absVariation(rate) >= target,
      message: movementMessage(rate, alert.rate_code, target)
    };
  }

  return {
    shouldSend: false,
    message: "Hoy hay movimiento importante. Revisa las cotizaciones."
  };
}
