import type { Rate } from "@/lib/types";

const flagMap: Record<string, string> = {
  USD_OFICIAL: "🇦🇷 🇺🇸",
  USD_BLUE: "🇦🇷 🇺🇸",
  USD_BLUE_MENDOZA: "🇦🇷 🇺🇸",
  USD_MEP: "🇦🇷 🇺🇸",
  USD_CCL: "🇦🇷 🇺🇸",
  CLP_OFICIAL: "🇨🇱",
  CLP_BLUE: "🇨🇱",
  BRL_OFICIAL: "🇧🇷",
  BRL_BLUE: "🇧🇷",
  EUR_OFICIAL: "🇪🇺",
  EUR_BLUE: "🇪🇺",
  BCRA_RATE: "🇦🇷",
  FIXED_TERM_30: "🇦🇷",
  MONTHLY_YIELD: "🇦🇷",
  COUNTRY_RISK: "🇦🇷"
};

export function FlagBadge({ rate, compact = false }: { rate: Pick<Rate, "code" | "name" | "flag">; compact?: boolean }) {
  const flags = flagMap[rate.code] ?? rate.flag;

  return (
    <span className={`rate-card__flag ${compact ? "rate-card__flag--compact" : ""}`} aria-label={rate.name}>
      {flags}
    </span>
  );
}
