import Image from "next/image";
import type { Rate } from "@/lib/types";

const AR = "/flags/ar.svg";
const US = "/flags/us.svg";
const CL = "/flags/cl.svg";
const BR = "/flags/br.svg";
const EU = "/flags/eu.svg";

const flagMap: Record<string, string[]> = {
  USD_OFICIAL: [AR, US],
  USD_BLUE: [AR, US],
  USD_BLUE_MENDOZA: [AR, US],
  USD_BLUE_PROMEDIO_MENDOZA: [AR, US],
  USD_MEP: [AR, US],
  USD_CCL: [AR, US],
  CLP_OFICIAL: [CL],
  CLP_BLUE: [CL],
  BRL_OFICIAL: [BR],
  BRL_BLUE: [BR],
  EUR_OFICIAL: [EU],
  EUR_BLUE: [EU],
  BCRA_RATE: [AR],
  FIXED_TERM_30: [AR],
  MONTHLY_YIELD: [AR],
  COUNTRY_RISK: [AR]
};

export function FlagBadge({ rate, compact = false }: { rate: Pick<Rate, "code" | "name" | "flag">; compact?: boolean }) {
  const flags = flagMap[rate.code] ?? [AR];

  return (
    <span className={`rate-card__flag ${compact ? "rate-card__flag--compact" : ""}`} aria-label={rate.name}>
      {flags.map((flag) => (
        <Image aria-hidden alt="" height={16} key={flag} src={flag} width={24} />
      ))}
    </span>
  );
}
