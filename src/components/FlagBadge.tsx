import Image from "next/image";
import type { Rate } from "@/lib/types";

const flagMap: Record<string, string[]> = {
  USD_OFICIAL: ["ar", "us"],
  USD_BLUE: ["ar", "us"],
  USD_BLUE_MENDOZA: ["ar", "us"],
  USD_MEP: ["ar", "us"],
  USD_CCL: ["ar", "us"],
  CLP_OFICIAL: ["cl"],
  CLP_BLUE: ["cl"],
  BRL_OFICIAL: ["br"],
  BRL_BLUE: ["br"],
  EUR_OFICIAL: ["eu"],
  EUR_BLUE: ["eu"],
  BCRA_RATE: ["ar"],
  FIXED_TERM_30: ["ar"],
  MONTHLY_YIELD: ["ar"],
  COUNTRY_RISK: ["ar"]
};

export function FlagBadge({ rate, compact = false }: { rate: Pick<Rate, "code" | "name" | "flag">; compact?: boolean }) {
  const codes = flagMap[rate.code];

  if (!codes?.length) {
    return (
      <span className={`rate-card__flag ${compact ? "rate-card__flag--compact" : ""}`} aria-hidden>
        {rate.flag}
      </span>
    );
  }

  return (
    <span className={`rate-card__flag flag-stack ${compact ? "rate-card__flag--compact" : ""}`} aria-label={rate.name}>
      {codes.map((code) => (
        <Image alt="" height={24} key={code} src={`https://flagcdn.com/w40/${code}.png`} width={40} />
      ))}
    </span>
  );
}
