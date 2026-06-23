import type { Rate } from "@/lib/types";

const RATE_DISPLAY_NAMES: Record<string, string> = {
  USD_BLUE_MENDOZA: "Referencia Blue Mendoza",
  USD_BLUE_PROMEDIO_MENDOZA: "Dólar MZA Promedio"
};

export type MzaConfidence = {
  level: "low" | "medium" | "high";
  label: "Confianza baja" | "Confianza media" | "Confianza alta";
  reportCount: number;
  sourceCount: number;
  usedFallback: boolean;
};

export function getRateDisplayName(rate: Pick<Rate, "code" | "name">) {
  return RATE_DISPLAY_NAMES[rate.code] ?? rate.name;
}

export function getMzaConfidence(rate: Pick<Rate, "code" | "source">): MzaConfidence | null {
  if (rate.code !== "USD_BLUE_PROMEDIO_MENDOZA" || !rate.source) return null;

  const values = Object.fromEntries(
    rate.source
      .split("|")
      .map((part) => part.trim().split("="))
      .filter((entry) => entry.length === 2)
  );
  const level = values.confidence;
  if (level !== "low" && level !== "medium" && level !== "high") return null;

  return {
    level,
    label: level === "high" ? "Confianza alta" : level === "medium" ? "Confianza media" : "Confianza baja",
    reportCount: Number(values.reports ?? 0) || 0,
    sourceCount: Number(values.sources ?? 0) || 0,
    usedFallback: values.method === "national_fallback"
  };
}
