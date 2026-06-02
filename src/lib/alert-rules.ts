import { ALERT_MESSAGES } from "@/lib/constants";
import type { AlertCondition, Rate, UserAlert } from "@/lib/types";

export type AlertEvaluation = {
  shouldSend: boolean;
  message: string;
};

function getRate(rates: Rate[], code: string) {
  return rates.find((rate) => rate.code === code);
}

function sell(rate: Rate | undefined) {
  return rate?.sell_price ?? 0;
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

export function evaluateAlert(alert: UserAlert, rates: Rate[]): AlertEvaluation {
  const rate = getRate(rates, alert.rate_code);
  const blue = getRate(rates, "USD_BLUE");
  const oficial = getRate(rates, "USD_OFICIAL");
  const mep = getRate(rates, "USD_MEP");
  const condition = alert.condition_type as AlertCondition;
  const target = Number(alert.target_value);
  const message = ALERT_MESSAGES[condition] ?? "Hoy hay movimiento importante. No llegues tarde.";

  if (condition === "official_market_open") return { shouldSend: isInsideMinuteWindow(10), message };
  if (condition === "official_market_close") return { shouldSend: isInsideMinuteWindow(15), message };
  if (condition === "informal_market_open") return { shouldSend: isInsideMinuteWindow(11), message };
  if (condition === "informal_market_close") return { shouldSend: isInsideMinuteWindow(16), message };

  if (!rate) return { shouldSend: false, message };

  if (condition === "above") return { shouldSend: sell(rate) >= target, message };
  if (condition === "below" || condition === "mep_below") return { shouldSend: sell(rate) <= target, message };
  if (condition === "mep_above_blue") return { shouldSend: sell(mep) > sell(blue), message };

  if (condition === "gap_above") {
    const base = sell(oficial);
    const gap = base > 0 ? ((sell(blue) - base) / base) * 100 : 0;
    return { shouldSend: gap >= target, message };
  }

  if (condition === "rate_up") return { shouldSend: target > 0 ? sell(rate) >= target : (rate.variation ?? 0) > 0, message };
  if (condition === "rate_down") return { shouldSend: target > 0 ? sell(rate) <= target : (rate.variation ?? 0) < 0, message };
  if (condition === "fixed_term_better") return { shouldSend: sell(rate) >= target, message };
  if (condition === "dollar_vs_fixed_term") return { shouldSend: absVariation(blue) >= target || sell(rate) >= target, message };
  if (condition === "travel_opportunity") return { shouldSend: absVariation(rate) >= target, message };
  if (condition === "clp_strong_move") return { shouldSend: absVariation(rate) >= target, message };
  if (condition === "brl_strong_move") return { shouldSend: absVariation(rate) >= target, message };
  if (condition === "eur_strong_move") return { shouldSend: absVariation(rate) >= target, message };

  return { shouldSend: false, message };
}
