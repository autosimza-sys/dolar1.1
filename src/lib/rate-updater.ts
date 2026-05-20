import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { getErrorMessage } from "@/lib/error-message";
import type { Rate } from "@/lib/types";

type DolarApiRate = {
  moneda: string;
  casa: string;
  nombre: string;
  compra: number | null;
  venta: number | null;
  fechaActualizacion: string;
};

type BcraResult = {
  idVariable: number;
  fecha: string;
  valor: number;
};

type BcraResponse = {
  results?: BcraResult[];
};

type RateUpdate = {
  code: string;
  name: string;
  country: string;
  flag: string;
  type: string;
  buy_price: number | null;
  sell_price: number | null;
  variation: number;
  source: string;
  is_visible: boolean;
  updated_at: string;
};

type RateMetadata = {
  name: string;
  country: string;
  flag: string;
  type: string;
};

const DOLAR_API = "https://dolarapi.com/v1";
const BCRA_API = "https://api.bcra.gob.ar/estadisticas/v4.0";
const BCRA_FIXED_TERM_30_ID = 9823;

const RATE_METADATA: Record<string, RateMetadata> = {
  USD_OFICIAL: { name: "Dolar Oficial", country: "Argentina", flag: "🇦🇷🇺🇸", type: "main" },
  USD_BLUE: { name: "Dolar Blue", country: "Argentina", flag: "🇦🇷🇺🇸", type: "main" },
  USD_MEP: { name: "Dolar Bolsa / MEP", country: "Argentina", flag: "🇦🇷🇺🇸", type: "main" },
  CLP_OFICIAL: { name: "Peso chileno oficial", country: "Chile", flag: "🇨🇱", type: "travel" },
  BRL_OFICIAL: { name: "Real oficial", country: "Brasil", flag: "🇧🇷", type: "travel" },
  EUR_OFICIAL: { name: "Euro oficial", country: "Europa", flag: "🇪🇺", type: "travel" },
  BCRA_RATE: { name: "Tasa BCRA", country: "Argentina", flag: "🇦🇷", type: "argentina_today" },
  FIXED_TERM_30: { name: "Plazo fijo promedio 30 dias", country: "Argentina", flag: "🇦🇷", type: "argentina_today" },
  MONTHLY_YIELD: { name: "Rendimiento mensual estimado", country: "Argentina", flag: "🇦🇷", type: "argentina_today" }
};

function variation(newValue: number | null, oldValue: number | null | undefined) {
  if (!newValue || !oldValue || oldValue <= 0) return 0;
  return Number((((newValue - oldValue) / oldValue) * 100).toFixed(2));
}

function byCode(rates: Rate[]) {
  return new Map(rates.map((rate) => [rate.code, rate]));
}

function pickDolarApi(rows: DolarApiRate[], casa: string) {
  return rows.find((row) => row.casa.toLowerCase() === casa.toLowerCase());
}

function pickCurrency(rows: DolarApiRate[], moneda: string) {
  return rows.find((row) => row.moneda.toUpperCase() === moneda.toUpperCase() && row.casa === "oficial");
}

function metadataFor(code: string): RateMetadata {
  return RATE_METADATA[code] ?? { name: code, country: "Argentina", flag: "🇦🇷", type: "other" };
}

function makeUpdate(
  mapping: { code: string; source: string },
  row: DolarApiRate,
  oldRates: Map<string, Rate>
): RateUpdate {
  const oldRate = oldRates.get(mapping.code);
  const metadata = metadataFor(mapping.code);

  return {
    code: mapping.code,
    ...metadata,
    buy_price: row.compra,
    sell_price: row.venta,
    variation: variation(row.venta, oldRate?.sell_price),
    source: mapping.source,
    is_visible: true,
    updated_at: row.fechaActualizacion || new Date().toISOString()
  };
}

async function getJson<T>(url: string) {
  const response = await fetch(url, {
    headers: {
      accept: "application/json",
      "user-agent": "Dolar Mendoza updater"
    },
    next: { revalidate: 0 }
  });

  if (!response.ok) {
    throw new Error(`${url} respondió ${response.status}`);
  }

  return (await response.json()) as T;
}

async function fetchBcraFixedTermRate() {
  const data = await getJson<BcraResponse>(`${BCRA_API}/Monetarias/${BCRA_FIXED_TERM_30_ID}?limit=2`);
  const sorted = [...(data.results ?? [])].sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
  return sorted[0] ?? null;
}

export async function updateRatesFromSources() {
  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    throw new Error("Falta SUPABASE_SERVICE_ROLE_KEY para actualizar cotizaciones.");
  }

  const startedAt = new Date().toISOString();
  const { data: currentRates, error: currentRatesError } = await supabase.from("rates").select("*");
  if (currentRatesError) throw new Error(getErrorMessage(currentRatesError, "No se pudieron leer las cotizaciones."));

  const oldRates = byCode((currentRates as Rate[] | null) ?? []);
  const updates: RateUpdate[] = [];
  const errors: string[] = [];

  try {
    const dolarRows = await getJson<DolarApiRate[]>(`${DOLAR_API}/dolares`);
    const mappings = [
      { code: "USD_OFICIAL", casa: "oficial", source: "DolarAPI - dólar oficial" },
      { code: "USD_BLUE", casa: "blue", source: "DolarAPI - dólar blue" },
      { code: "USD_MEP", casa: "bolsa", source: "DolarAPI - dólar bolsa/MEP" }
    ];

    for (const mapping of mappings) {
      const row = pickDolarApi(dolarRows, mapping.casa);
      if (row) updates.push(makeUpdate(mapping, row, oldRates));
    }
  } catch (error) {
    errors.push(error instanceof Error ? error.message : "No se pudo leer DolarAPI dólares.");
  }

  try {
    const currencyRows = await getJson<DolarApiRate[]>(`${DOLAR_API}/cotizaciones`);
    const mappings = [
      { code: "CLP_OFICIAL", moneda: "CLP", source: "DolarAPI - peso chileno oficial" },
      { code: "BRL_OFICIAL", moneda: "BRL", source: "DolarAPI - real oficial" },
      { code: "EUR_OFICIAL", moneda: "EUR", source: "DolarAPI - euro oficial" }
    ];

    for (const mapping of mappings) {
      const row = pickCurrency(currencyRows, mapping.moneda);
      if (row) updates.push(makeUpdate(mapping, row, oldRates));
    }
  } catch (error) {
    errors.push(error instanceof Error ? error.message : "No se pudo leer DolarAPI monedas.");
  }

  try {
    const bcraRate = await fetchBcraFixedTermRate();
    if (bcraRate) {
      const annualRate = Number(bcraRate.valor.toFixed(2));
      const simpleMonthly = Number((annualRate / 12).toFixed(2));
      const effectiveMonthly = Number(((Math.pow(1 + annualRate / 100, 1 / 12) - 1) * 100).toFixed(2));
      const updatedAt = new Date(`${bcraRate.fecha}T15:00:00.000Z`).toISOString();

      updates.push({
        code: "BCRA_RATE",
        ...metadataFor("BCRA_RATE"),
        buy_price: null,
        sell_price: annualRate,
        variation: variation(annualRate, oldRates.get("BCRA_RATE")?.sell_price),
        source: "BCRA API - variable 9823",
        is_visible: true,
        updated_at: updatedAt
      });
      updates.push({
        code: "FIXED_TERM_30",
        ...metadataFor("FIXED_TERM_30"),
        buy_price: null,
        sell_price: simpleMonthly,
        variation: variation(simpleMonthly, oldRates.get("FIXED_TERM_30")?.sell_price),
        source: "BCRA API - estimación mensual simple",
        is_visible: true,
        updated_at: updatedAt
      });
      updates.push({
        code: "MONTHLY_YIELD",
        ...metadataFor("MONTHLY_YIELD"),
        buy_price: null,
        sell_price: effectiveMonthly,
        variation: variation(effectiveMonthly, oldRates.get("MONTHLY_YIELD")?.sell_price),
        source: "BCRA API - estimación mensual efectiva",
        is_visible: true,
        updated_at: updatedAt
      });
    }
  } catch (error) {
    errors.push(error instanceof Error ? error.message : "No se pudo leer BCRA.");
  }

  if (updates.length) {
    const { error } = await supabase.from("rates").upsert(updates, { onConflict: "code" });
    if (error) throw new Error(getErrorMessage(error, "No se pudieron guardar las cotizaciones."));
  }

  const updatedCodes = updates.map((item) => item.code);
  const status = errors.length && updatedCodes.length ? "partial" : errors.length ? "failed" : "success";
  const finishedAt = new Date().toISOString();

  const { error: sourceLogError } = await supabase.from("source_update_logs").insert({
    source: "rates:update",
    status,
    updated_codes: updatedCodes,
    errors,
    started_at: startedAt,
    finished_at: finishedAt
  });

  if (sourceLogError) {
    errors.push(getErrorMessage(sourceLogError, "No se pudo guardar el log de fuentes."));
  }

  const { error: settingsError } = await supabase.from("admin_settings").upsert(
    {
      key: "last_rate_update",
      value: {
        updated_at: finishedAt,
        updated_count: updates.length,
        errors
      }
    },
    { onConflict: "key" }
  );

  if (settingsError) {
    errors.push(getErrorMessage(settingsError, "No se pudo guardar last_rate_update."));
  }

  return {
    updated: updatedCodes,
    errors
  };
}
