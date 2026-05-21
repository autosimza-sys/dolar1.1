import { z } from "zod";
import type { Rate } from "@/lib/types";

export const COMMUNITY_BLOCK_MESSAGE =
  "Tu publicación no puede incluir datos de contacto ni ofrecer compra o venta directa. Este espacio es solo para informar operaciones realizadas de forma anónima.";

export const communityReportSchema = z.object({
  operation_type: z.enum(["buy", "sell"]),
  currency: z.string().trim().min(2).max(24),
  amount: z.coerce.number().positive().max(10000000),
  rate: z.coerce.number().positive().max(10000000),
  department: z.string().trim().min(2).max(80),
  comment: z.string().trim().max(240).optional().nullable()
});

type CommunityValidationResult = {
  status: "approved" | "suspicious";
  include_in_stats: boolean;
  moderation_reason: string | null;
};

const blockedPatterns: RegExp[] = [
  /\b\d{8,}\b/,
  /\b\d{2,4}[-.\s]?\d{3,4}[-.\s]?\d{3,4}\b/,
  /@[\w.]{2,}/i,
  /\b[\w.%+-]+@[\w.-]+\.[a-z]{2,}\b/i,
  /\b(?:https?:\/\/|www\.)\S+/i,
  /\b(?:wa\.me|whatsapp|telegram|instagram|facebook|gmail|hotmail|outlook)\b/i,
  /\b(?:cbu|cvu|alias|mercado\s*pago|mp)\b/i,
  /\b(?:vendo|vender|compro|comprar|cambio|ofrezco|necesito)\s+(?:dolares|dólares|usd|reales|euros|pesos)\b/i,
  /\b(?:escribime|contactame|mandame|llamame|háblame|hablame|te\s+paso|tengo\s+dolares|tengo\s+dólares)\b/i
];

const referenceByCurrency: Record<string, string[]> = {
  USD: ["USD_BLUE_MENDOZA", "USD_BLUE"],
  USD_BLUE: ["USD_BLUE_MENDOZA", "USD_BLUE"],
  USD_BLUE_MENDOZA: ["USD_BLUE_MENDOZA", "USD_BLUE"],
  EUR: ["EUR_BLUE", "EUR_OFICIAL"],
  BRL: ["BRL_BLUE", "BRL_OFICIAL"],
  CLP: ["CLP_BLUE", "CLP_OFICIAL"]
};

export function hasBlockedCommunityContent(input: { comment?: string | null; department?: string }) {
  const text = `${input.comment ?? ""} ${input.department ?? ""}`.toLowerCase();
  return blockedPatterns.some((pattern) => pattern.test(text));
}

export function validateCommunityRate(currency: string, rate: number, rates: Rate[]): CommunityValidationResult {
  const normalized = currency.toUpperCase();
  const referenceCodes = referenceByCurrency[normalized] ?? [normalized];
  const reference = referenceCodes
    .map((code) => rates.find((item) => item.code === code))
    .find((item) => item?.sell_price || item?.buy_price);

  const referenceValue = reference?.sell_price ?? reference?.buy_price ?? null;
  if (!referenceValue) {
    return {
      status: "approved",
      include_in_stats: true,
      moderation_reason: null
    };
  }

  const deviation = Math.abs(rate - referenceValue) / referenceValue;
  if (deviation > 0.18) {
    return {
      status: "suspicious",
      include_in_stats: false,
      moderation_reason: "Operación fuera del rango de referencia"
    };
  }

  return {
    status: "approved",
    include_in_stats: true,
    moderation_reason: null
  };
}
