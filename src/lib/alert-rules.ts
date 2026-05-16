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

export function evaluateAlert(alert: UserAlert, rates: Rate[]): AlertEvaluation {
  const rate = getRate(rates, alert.rate_code);
  const blue = getRate(rates, "USD_BLUE");
  const oficial = getRate(rates, "USD_OFICIAL");
  const mep = getRate(rates, "USD_MEP");
  const condition = alert.condition_type as AlertCondition;
  const target = Number(alert.target_value);
  const message = ALERT_MESSAGES[condition] ?? "Hoy hay movimiento importante. No llegues tarde.";

  if (!rate) return { shouldSend: false, message };

  if (condition === "above") return { shouldSend: sell(rate) >= target, message };
  if (condition === "below" || condition === "mep_below") return { shouldSend: sell(rate) <= target, message };
  if (condition === "mep_above_blue") return { shouldSend: sell(mep) > sell(blue), message };

  if (condition === "gap_above") {
    const base = sell(oficial);
    const gap = base > 0 ? ((sell(blue) - base) / base) * 100 : 0;
    return { shouldSend: gap >= target, message };
  }

  if (condition === "rate_up") return { shouldSend: (rate.variation ?? 0) > 0, message };
  if (condition === "rate_down") return { shouldSend: (rate.variation ?? 0) < 0, message };
  if (condition === "fixed_term_better") return { shouldSend: sell(rate) >= target, message };
  if (condition === "dollar_vs_fixed_term") return { shouldSend: absVariation(blue) >= target || sell(rate) >= target, message };
  if (condition === "travel_opportunity") return { shouldSend: absVariation(rate) >= target, message };
  if (condition === "clp_strong_move") return { shouldSend: absVariation(rate) >= target, message };
  if (condition === "brl_strong_move") return { shouldSend: absVariation(rate) >= target, message };
  if (condition === "eur_strong_move") return { shouldSend: absVariation(rate) >= target, message };

  return { shouldSend: false, message };
}
