import type { Rate } from "@/lib/types";

const AR = "\u{1F1E6}\u{1F1F7}";
const US = "\u{1F1FA}\u{1F1F8}";
const CL = "\u{1F1E8}\u{1F1F1}";
const BR = "\u{1F1E7}\u{1F1F7}";
const EU = "\u{1F1EA}\u{1F1FA}";

const flagMap: Record<string, string> = {
  USD_OFICIAL: `${AR} ${US}`,
  USD_BLUE: `${AR} ${US}`,
  USD_BLUE_MENDOZA: `${AR} ${US}`,
  USD_BLUE_PROMEDIO_MENDOZA: `${AR} ${US}`,
  USD_MEP: `${AR} ${US}`,
  USD_CCL: `${AR} ${US}`,
  CLP_OFICIAL: CL,
  CLP_BLUE: CL,
  BRL_OFICIAL: BR,
  BRL_BLUE: BR,
  EUR_OFICIAL: EU,
  EUR_BLUE: EU,
  BCRA_RATE: AR,
  FIXED_TERM_30: AR,
  MONTHLY_YIELD: AR,
  COUNTRY_RISK: AR
};

export function FlagBadge({ rate, compact = false }: { rate: Pick<Rate, "code" | "name" | "flag">; compact?: boolean }) {
  const flags = flagMap[rate.code] ?? rate.flag;

  return (
    <span className={`rate-card__flag ${compact ? "rate-card__flag--compact" : ""}`} aria-label={rate.name}>
      {flags}
    </span>
  );
}
