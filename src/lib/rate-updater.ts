import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { getErrorMessage } from "@/lib/error-message";
import type { Rate, RateSource } from "@/lib/types";

type DolarApiRate = {
  moneda?: string;
  casa?: string;
  nombre?: string;
  compra?: number | null;
  venta?: number | null;
  fechaActualizacion?: string;
};

type BcraResult = {
  idVariable: number;
  detalle?: Array<{
    fecha: string;
    valor: number;
  }>;
};

type BcraResponse = {
  results?: BcraResult[];
};

type SourceDefinition = {
  key: string;
  name: string;
  provider: string;
  endpoint: string | null;
  parser_type: string;
  priority: number;
  enabled: boolean;
  rate_codes: string[];
  notes?: string;
};

type RateMetadata = {
  name: string;
  country: string;
  flag: string;
  type: "main" | "travel" | "indicator";
  market: "official" | "parallel" | "indicator";
  min: number;
  max: number;
  maxDeviationPct: number;
  spread: number;
};

type SourceReading = {
  rate_code: string;
  source_key: string;
  source_name: string;
  buy_price: number | null;
  sell_price: number | null;
  midpoint: number | null;
  status: "accepted" | "rejected" | "fallback";
  reason: string | null;
  payload: Record<string, unknown> | null;
  fetched_at: string;
  priority: number;
};

type RateUpdate = {
  code: string;
  name: string;
  country: string;
  flag: string;
  type: "main" | "travel" | "indicator";
  buy_price: number | null;
  sell_price: number | null;
  variation: number;
  source: string;
  is_visible: boolean;
  updated_at: string;
};

const DOLAR_API = "https://dolarapi.com/v1";
const ARGENTINA_DATOS_API = "https://api.argentinadatos.com/v1";
const RATES_ARG_API = "https://ratesarg.com/api";
const BCRA_API = "https://api.bcra.gob.ar/estadisticas/v4.0";
const BCRA_FIXED_TERM_30_ID = 1207;

const RATE_METADATA: Record<string, RateMetadata> = {
  USD_OFICIAL: {
    name: "Dólar Oficial",
    country: "Argentina / Estados Unidos",
    flag: "🇦🇷🇺🇸",
    type: "main",
    market: "official",
    min: 100,
    max: 5000,
    maxDeviationPct: 0.07,
    spread: 0
  },
  USD_BLUE: {
    name: "Dólar Blue",
    country: "Argentina / Estados Unidos",
    flag: "🇦🇷🇺🇸",
    type: "main",
    market: "parallel",
    min: 100,
    max: 5000,
    maxDeviationPct: 0.1,
    spread: 3
  },
  USD_BLUE_MENDOZA: {
    name: "Dólar Blue Mendoza",
    country: "Mendoza",
    flag: "🇦🇷🇺🇸",
    type: "main",
    market: "parallel",
    min: 100,
    max: 5000,
    maxDeviationPct: 0.12,
    spread: 3
  },
  USD_MEP: {
    name: "Dólar Bolsa / MEP",
    country: "Argentina / Estados Unidos",
    flag: "🇦🇷🇺🇸",
    type: "main",
    market: "official",
    min: 100,
    max: 5000,
    maxDeviationPct: 0.08,
    spread: 0
  },
  USD_CCL: {
    name: "Dólar CCL",
    country: "Argentina / Estados Unidos",
    flag: "🇦🇷🇺🇸",
    type: "main",
    market: "official",
    min: 100,
    max: 5000,
    maxDeviationPct: 0.08,
    spread: 0
  },
  CLP_OFICIAL: {
    name: "Peso chileno oficial",
    country: "Chile",
    flag: "🇨🇱",
    type: "travel",
    market: "official",
    min: 0.1,
    max: 20,
    maxDeviationPct: 0.1,
    spread: 0
  },
  CLP_BLUE: {
    name: "Peso chileno blue",
    country: "Chile",
    flag: "🇨🇱",
    type: "travel",
    market: "parallel",
    min: 0.1,
    max: 20,
    maxDeviationPct: 0.15,
    spread: 0.03
  },
  BRL_OFICIAL: {
    name: "Real oficial",
    country: "Brasil",
    flag: "🇧🇷",
    type: "travel",
    market: "official",
    min: 20,
    max: 1000,
    maxDeviationPct: 0.1,
    spread: 0
  },
  BRL_BLUE: {
    name: "Real blue",
    country: "Brasil",
    flag: "🇧🇷",
    type: "travel",
    market: "parallel",
    min: 20,
    max: 1000,
    maxDeviationPct: 0.15,
    spread: 3
  },
  EUR_OFICIAL: {
    name: "Euro oficial",
    country: "Europa",
    flag: "🇪🇺",
    type: "travel",
    market: "official",
    min: 100,
    max: 7000,
    maxDeviationPct: 0.1,
    spread: 0
  },
  EUR_BLUE: {
    name: "Euro blue",
    country: "Europa",
    flag: "🇪🇺",
    type: "travel",
    market: "parallel",
    min: 100,
    max: 7000,
    maxDeviationPct: 0.15,
    spread: 3
  },
  BCRA_RATE: {
    name: "Tasa BCRA",
    country: "Argentina",
    flag: "🇦🇷",
    type: "indicator",
    market: "indicator",
    min: 0,
    max: 300,
    maxDeviationPct: 0.25,
    spread: 0
  },
  FIXED_TERM_30: {
    name: "Plazo fijo promedio 30 días",
    country: "Argentina",
    flag: "🇦🇷",
    type: "indicator",
    market: "indicator",
    min: 0,
    max: 50,
    maxDeviationPct: 0.25,
    spread: 0
  },
  MONTHLY_YIELD: {
    name: "Rendimiento mensual estimado",
    country: "Argentina",
    flag: "🇦🇷",
    type: "indicator",
    market: "indicator",
    min: 0,
    max: 50,
    maxDeviationPct: 0.25,
    spread: 0
  },
  COUNTRY_RISK: {
    name: "Riesgo país",
    country: "Argentina",
    flag: "🇦🇷",
    type: "indicator",
    market: "indicator",
    min: 0,
    max: 10000,
    maxDeviationPct: 0.35,
    spread: 0
  }
};

const DEFAULT_SOURCES: SourceDefinition[] = [
  {
    key: "dolarapi_dolares",
    name: "DolarAPI Dólares",
    provider: "DolarAPI",
    endpoint: `${DOLAR_API}/dolares`,
    parser_type: "dolarapi_dolares",
    priority: 10,
    enabled: true,
    rate_codes: ["USD_OFICIAL", "USD_BLUE", "USD_MEP", "USD_CCL"]
  },
  {
    key: "dolarapi_cotizaciones",
    name: "DolarAPI Cotizaciones",
    provider: "DolarAPI",
    endpoint: `${DOLAR_API}/cotizaciones`,
    parser_type: "dolarapi_cotizaciones",
    priority: 20,
    enabled: true,
    rate_codes: ["CLP_OFICIAL", "BRL_OFICIAL", "EUR_OFICIAL"]
  },
  {
    key: "argentina_datos_dolares",
    name: "ArgentinaDatos Dólares",
    provider: "ArgentinaDatos",
    endpoint: `${ARGENTINA_DATOS_API}/cotizaciones/dolares`,
    parser_type: "argentina_datos_dolares",
    priority: 30,
    enabled: true,
    rate_codes: ["USD_OFICIAL", "USD_BLUE", "USD_MEP", "USD_CCL"]
  },
  {
    key: "ratesarg_cotizaciones",
    name: "RatesArg Cotizaciones",
    provider: "RatesArg",
    endpoint: `${RATES_ARG_API}/cotizaciones`,
    parser_type: "ratesarg_cotizaciones",
    priority: 40,
    enabled: true,
    rate_codes: ["USD_OFICIAL", "USD_BLUE", "USD_MEP", "USD_CCL", "BRL_OFICIAL", "EUR_OFICIAL"]
  },
  {
    key: "bcra_plazo_fijo",
    name: "BCRA Plazo Fijo 30 días",
    provider: "BCRA",
    endpoint: `${BCRA_API}/monetarias/${BCRA_FIXED_TERM_30_ID}?limit=2`,
    parser_type: "bcra_plazo_fijo",
    priority: 5,
    enabled: true,
    rate_codes: ["BCRA_RATE", "FIXED_TERM_30", "MONTHLY_YIELD"]
  },
  {
    key: "comunidad_mendoza",
    name: "Comunidad anónima Mendoza",
    provider: "Dólar MZA",
    endpoint: null,
    parser_type: "community_blue_mendoza",
    priority: 60,
    enabled: true,
    rate_codes: ["USD_BLUE_MENDOZA"]
  }
];

function average(values: number[]) {
  if (!values.length) return null;
  return Number((values.reduce((total, value) => total + value, 0) / values.length).toFixed(4));
}

function midpoint(buy: number | null, sell: number | null) {
  if (buy !== null && sell !== null) return (buy + sell) / 2;
  return buy ?? sell ?? null;
}

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (!sorted.length) return null;
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function variation(newValue: number | null, oldValue: number | null | undefined) {
  if (!newValue || !oldValue || oldValue <= 0) return 0;
  return Number((((newValue - oldValue) / oldValue) * 100).toFixed(2));
}

function metadataFor(code: string): RateMetadata {
  return (
    RATE_METADATA[code] ?? {
      name: code,
      country: "Argentina",
      flag: "🇦🇷",
      type: "indicator",
      market: "indicator",
      min: 0,
      max: 100000,
      maxDeviationPct: 0.25,
      spread: 0
    }
  );
}

function byCode(rates: Rate[]) {
  return new Map(rates.map((rate) => [rate.code, rate]));
}

async function getJson<T>(url: string) {
  const response = await fetch(url, {
    headers: {
      accept: "application/json",
      "user-agent": "Dolar MZA updater"
    },
    next: { revalidate: 0 }
  });

  if (!response.ok) {
    throw new Error(`${url} respondió ${response.status}`);
  }

  return (await response.json()) as T;
}

function normalizeNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const normalized = value.replace(/\./g, "").replace(",", ".").replace(/[^\d.-]/g, "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function makeReading(
  source: SourceDefinition,
  code: string,
  buy: unknown,
  sell: unknown,
  payload: Record<string, unknown> | null,
  fetchedAt = new Date().toISOString()
): SourceReading {
  const buyPrice = normalizeNumber(buy);
  const sellPrice = normalizeNumber(sell);
  const safeFetchedAt = fetchedAt && !Number.isNaN(new Date(fetchedAt).getTime()) ? fetchedAt : new Date().toISOString();

  return {
    rate_code: code,
    source_key: source.key,
    source_name: source.name,
    buy_price: buyPrice,
    sell_price: sellPrice,
    midpoint: midpoint(buyPrice, sellPrice),
    status: "accepted",
    reason: null,
    payload,
    fetched_at: safeFetchedAt,
    priority: source.priority
  };
}

function readingTime(reading: SourceReading) {
  const time = new Date(reading.fetched_at).getTime();
  return Number.isFinite(time) ? time : 0;
}

function latestBySourceAndCode(readings: SourceReading[]) {
  const latest = new Map<string, SourceReading>();

  for (const reading of readings) {
    const key = `${reading.source_key}:${reading.rate_code}`;
    const current = latest.get(key);
    if (!current || readingTime(reading) > readingTime(current)) {
      latest.set(key, reading);
    }
  }

  return Array.from(latest.values());
}

function mapDolarApiCasa(casa: string | undefined) {
  const normalized = casa?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    oficial: "USD_OFICIAL",
    blue: "USD_BLUE",
    bolsa: "USD_MEP",
    mep: "USD_MEP",
    contadoconliqui: "USD_CCL",
    ccl: "USD_CCL"
  };
  return map[normalized] ?? null;
}

function mapArgentinaDatosCasa(casa: string | undefined) {
  const normalized = casa?.toLowerCase().replace(/\s|_|-/g, "") ?? "";
  const map: Record<string, string> = {
    oficial: "USD_OFICIAL",
    blue: "USD_BLUE",
    bolsa: "USD_MEP",
    mep: "USD_MEP",
    contadoconliqui: "USD_CCL",
    ccl: "USD_CCL"
  };
  return map[normalized] ?? null;
}

function mapCurrency(moneda: string | undefined) {
  const normalized = moneda?.toUpperCase() ?? "";
  const map: Record<string, string> = {
    CLP: "CLP_OFICIAL",
    BRL: "BRL_OFICIAL",
    EUR: "EUR_OFICIAL"
  };
  return map[normalized] ?? null;
}

async function fetchBcraReadings(source: SourceDefinition) {
  if (!source.endpoint) return [];
  const data = await getJson<BcraResponse>(source.endpoint);
  const rows = (data.results ?? []).flatMap((result) => result.detalle ?? []);
  const sorted = [...rows].sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
  const latest = sorted[0];
  if (!latest) return [];

  const annualRate = Number(latest.valor.toFixed(2));
  const simpleMonthly = Number((annualRate / 12).toFixed(2));
  const effectiveMonthly = Number(((Math.pow(1 + annualRate / 100, 1 / 12) - 1) * 100).toFixed(2));
  const fetchedAt = new Date(`${latest.fecha}T15:00:00.000Z`).toISOString();

  return [
    makeReading(source, "BCRA_RATE", null, annualRate, { idVariable: BCRA_FIXED_TERM_30_ID }, fetchedAt),
    makeReading(source, "FIXED_TERM_30", null, simpleMonthly, { idVariable: BCRA_FIXED_TERM_30_ID }, fetchedAt),
    makeReading(source, "MONTHLY_YIELD", null, effectiveMonthly, { idVariable: BCRA_FIXED_TERM_30_ID }, fetchedAt)
  ];
}

async function fetchCommunityBlueMendoza(source: SourceDefinition, supabase: NonNullable<ReturnType<typeof createSupabaseAdminClient>>) {
  const since = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("community_reports")
    .select("rate, created_at")
    .eq("status", "approved")
    .eq("include_in_stats", true)
    .in("currency", ["USD", "USD_BLUE", "USD_BLUE_MENDOZA"])
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(40);

  if (error) return [];

  const values = ((data as Array<{ rate: number; created_at: string }> | null) ?? [])
    .map((report) => normalizeNumber(report.rate))
    .filter((value): value is number => value !== null);

  const avg = average(values);
  if (!avg) return [];

  return [makeReading(source, "USD_BLUE_MENDOZA", avg - 3, avg + 3, { count: values.length })];
}

async function fetchSourceReadings(source: SourceDefinition, supabase: NonNullable<ReturnType<typeof createSupabaseAdminClient>>) {
  if (!source.enabled) return [];

  if (source.parser_type === "community_blue_mendoza") {
    return fetchCommunityBlueMendoza(source, supabase);
  }

  if (source.parser_type === "bcra_plazo_fijo") {
    return fetchBcraReadings(source);
  }

  if (!source.endpoint) return [];

  const payload = await getJson<unknown>(source.endpoint);
  const rows = Array.isArray(payload) ? payload : Object.values((payload as Record<string, unknown>) ?? {});

  if (source.parser_type === "dolarapi_dolares") {
    return (rows as DolarApiRate[])
      .map((row) => {
        const code = mapDolarApiCasa(row.casa);
        return code ? makeReading(source, code, row.compra ?? null, row.venta ?? null, row as Record<string, unknown>, row.fechaActualizacion) : null;
      })
      .filter((row): row is SourceReading => Boolean(row));
  }

  if (source.parser_type === "dolarapi_cotizaciones") {
    return (rows as DolarApiRate[])
      .map((row) => {
        const code = mapCurrency(row.moneda);
        return code && row.casa === "oficial"
          ? makeReading(source, code, row.compra ?? null, row.venta ?? null, row as Record<string, unknown>, row.fechaActualizacion)
          : null;
      })
      .filter((row): row is SourceReading => Boolean(row));
  }

  if (source.parser_type === "argentina_datos_dolares") {
    const readings = (rows as Array<Record<string, unknown>>)
      .map((row) => {
        const code = mapArgentinaDatosCasa(String(row.casa ?? row.nombre ?? row.tipo ?? ""));
        return code ? makeReading(source, code, row.compra ?? null, row.venta ?? null, row, String(row.fecha ?? row.fechaActualizacion ?? "")) : null;
      })
      .filter((row): row is SourceReading => Boolean(row));

    return latestBySourceAndCode(readings);
  }

  if (source.parser_type === "ratesarg_cotizaciones") {
    const readings = (rows as Array<Record<string, unknown>>)
      .map((row) => {
        const key = String(row.codigo ?? row.code ?? row.nombre ?? row.tipo ?? row.casa ?? "").toLowerCase();
        const code = mapArgentinaDatosCasa(key) ?? mapCurrency(String(row.moneda ?? row.currency ?? ""));
        return code
          ? makeReading(
              source,
              code,
              row.compra ?? row.buy ?? null,
              row.venta ?? row.sell ?? row.valor ?? row.price ?? null,
              row,
              String(row.fecha ?? row.fechaActualizacion ?? row.updated_at ?? "")
            )
          : null;
      })
      .filter((row): row is SourceReading => Boolean(row));

    return latestBySourceAndCode(readings);
  }

  return [];
}

function validateReadings(code: string, readings: SourceReading[]) {
  const metadata = metadataFor(code);
  const staleLimitMs = metadata.market === "indicator" ? 10 * 24 * 60 * 60 * 1000 : 36 * 60 * 60 * 1000;
  const now = Date.now();
  const bounded = readings.map((reading) => {
    const value = reading.midpoint;
    if (!value || value < metadata.min || value > metadata.max) {
      return { ...reading, status: "rejected" as const, reason: "Valor fuera de rango esperado" };
    }

    if (now - readingTime(reading) > staleLimitMs) {
      return { ...reading, status: "rejected" as const, reason: "Dato desactualizado" };
    }

    return reading;
  });

  const accepted = bounded.filter((reading) => reading.status === "accepted" && reading.midpoint !== null);
  const anchor = accepted.sort((a, b) => a.priority - b.priority || readingTime(b) - readingTime(a))[0];
  const center = anchor?.midpoint ?? median(accepted.map((reading) => reading.midpoint as number));
  if (!center || accepted.length <= 1) return bounded;

  return bounded.map((reading) => {
    if (reading.status !== "accepted" || reading.midpoint === null) return reading;
    const deviation = Math.abs(reading.midpoint - center) / center;
    if (deviation > metadata.maxDeviationPct) {
      return { ...reading, status: "rejected" as const, reason: "Dispersión alta contra el grupo de fuentes" };
    }
    return reading;
  });
}

function aggregate(code: string, readings: SourceReading[], oldRate: Rate | undefined): RateUpdate | null {
  const metadata = metadataFor(code);
  const accepted = readings
    .filter((reading) => reading.status === "accepted")
    .sort((a, b) => a.priority - b.priority);

  if (!accepted.length) return null;

  const updatedAt = accepted
    .map((reading) => reading.fetched_at)
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0];

  let buyPrice: number | null = null;
  let sellPrice: number | null = null;

  if (metadata.market === "parallel") {
    const avgMidpoint = average(accepted.map((reading) => reading.midpoint).filter((value): value is number => value !== null));
    if (avgMidpoint === null) return null;
    buyPrice = Number(Math.max(0, avgMidpoint - metadata.spread).toFixed(4));
    sellPrice = Number((avgMidpoint + metadata.spread).toFixed(4));
  } else {
    buyPrice = average(accepted.map((reading) => reading.buy_price).filter((value): value is number => value !== null));
    sellPrice = average(accepted.map((reading) => reading.sell_price).filter((value): value is number => value !== null));
  }

  const comparisonValue = sellPrice ?? buyPrice;

  return {
    code,
    name: metadata.name,
    country: metadata.country,
    flag: metadata.flag,
    type: metadata.type,
    buy_price: buyPrice,
    sell_price: sellPrice,
    variation: variation(comparisonValue, oldRate?.sell_price ?? oldRate?.buy_price),
    source: `Promedio validado (${accepted.length} fuente${accepted.length === 1 ? "" : "s"})`,
    is_visible: true,
    updated_at: updatedAt
  };
}

async function loadSources(supabase: NonNullable<ReturnType<typeof createSupabaseAdminClient>>) {
  const { data, error } = await supabase.from("rate_sources").select("*").order("priority", { ascending: true });
  if (error) return DEFAULT_SOURCES;

  const configured = ((data as RateSource[] | null) ?? []).map<SourceDefinition>((source) => ({
    key: source.key,
    name: source.name,
    provider: source.provider,
    endpoint: source.endpoint,
    parser_type: source.parser_type,
    priority: source.priority,
    enabled: source.enabled,
    rate_codes: source.rate_codes,
    notes: source.notes ?? undefined
  }));

  return configured.length ? configured : DEFAULT_SOURCES;
}

async function readBlueMendozaManual(supabase: NonNullable<ReturnType<typeof createSupabaseAdminClient>>) {
  const { data } = await supabase.from("admin_settings").select("value").eq("key", "blue_mendoza_manual").maybeSingle();
  const value = data?.value as { enabled?: boolean; buy_price?: unknown; sell_price?: unknown; note?: string } | undefined;
  if (!value?.enabled) return null;

  const buyPrice = normalizeNumber(value.buy_price);
  const sellPrice = normalizeNumber(value.sell_price);
  if (buyPrice === null && sellPrice === null) return null;

  return {
    buyPrice,
    sellPrice,
    note: value.note
  };
}

async function insertOptional<T extends Record<string, unknown>>(
  supabase: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
  table: string,
  rows: T | T[]
) {
  const { error } = await supabase.from(table).insert(rows as never);
  return error ? getErrorMessage(error, `No se pudo guardar ${table}.`) : null;
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
  const sources = await loadSources(supabase);
  const errors: string[] = [];
  const rawReadings: SourceReading[] = [];

  for (const source of sources) {
    try {
      rawReadings.push(...(await fetchSourceReadings(source, supabase)));
    } catch (error) {
      errors.push(`${source.name}: ${error instanceof Error ? error.message : "fuente no disponible"}`);
    }
  }

  const blue = rawReadings.filter((reading) => reading.rate_code === "USD_BLUE");
  rawReadings.push(
    ...blue.map((reading) => ({
      ...reading,
      rate_code: "USD_BLUE_MENDOZA",
      source_key: `${reading.source_key}_mendoza_ref`,
      source_name: `${reading.source_name} referencia Mendoza`,
      priority: reading.priority + 5
    }))
  );

  const officialUsd = rawReadings.find((reading) => reading.rate_code === "USD_OFICIAL" && reading.midpoint);
  const blueUsd = rawReadings.find((reading) => reading.rate_code === "USD_BLUE" && reading.midpoint);
  if (officialUsd?.midpoint && blueUsd?.midpoint) {
    const ratio = blueUsd.midpoint / officialUsd.midpoint;
    for (const code of ["CLP_OFICIAL", "BRL_OFICIAL", "EUR_OFICIAL"]) {
      for (const reading of rawReadings.filter((item) => item.rate_code === code && item.midpoint)) {
        const parallelCode = code.replace("_OFICIAL", "_BLUE");
        const buy = reading.buy_price === null ? null : Number((reading.buy_price * ratio).toFixed(4));
        const sell = reading.sell_price === null ? null : Number((reading.sell_price * ratio).toFixed(4));
        rawReadings.push({
          ...reading,
          rate_code: parallelCode,
          source_key: `${reading.source_key}_parallel_ref`,
          source_name: `${reading.source_name} referencia blue`,
          buy_price: buy,
          sell_price: sell,
          midpoint: midpoint(buy, sell),
          priority: reading.priority + 15,
          payload: { derived_from: reading.rate_code, ratio }
        });
      }
    }
  }

  const normalizedReadings = latestBySourceAndCode(rawReadings);
  const codes = Array.from(new Set([...normalizedReadings.map((reading) => reading.rate_code), ...Object.keys(RATE_METADATA)]));
  const validatedReadings = codes.flatMap((code) => validateReadings(code, normalizedReadings.filter((reading) => reading.rate_code === code)));
  const updates = codes
    .map((code) => aggregate(code, validatedReadings.filter((reading) => reading.rate_code === code), oldRates.get(code)))
    .filter((update): update is RateUpdate => Boolean(update));

  const manualBlueMendoza = await readBlueMendozaManual(supabase);
  if (manualBlueMendoza) {
    const metadata = metadataFor("USD_BLUE_MENDOZA");
    const oldRate = oldRates.get("USD_BLUE_MENDOZA");
    const buyPrice = manualBlueMendoza.buyPrice;
    const sellPrice = manualBlueMendoza.sellPrice;
    const comparisonValue = sellPrice ?? buyPrice;
    const manualUpdate: RateUpdate = {
      code: "USD_BLUE_MENDOZA",
      name: metadata.name,
      country: metadata.country,
      flag: metadata.flag,
      type: metadata.type,
      buy_price: buyPrice,
      sell_price: sellPrice,
      variation: variation(comparisonValue, oldRate?.sell_price ?? oldRate?.buy_price),
      source: "Manual admin",
      is_visible: true,
      updated_at: new Date().toISOString()
    };
    const index = updates.findIndex((update) => update.code === "USD_BLUE_MENDOZA");
    if (index >= 0) updates[index] = manualUpdate;
    else updates.push(manualUpdate);
  }

  if (updates.length) {
    const { error } = await supabase.from("rates").upsert(updates, { onConflict: "code" });
    if (error) throw new Error(getErrorMessage(error, "No se pudieron guardar las cotizaciones."));
  }

  const readingRows = validatedReadings.map((reading) => ({
    rate_code: reading.rate_code,
    source_key: reading.source_key,
    source_name: reading.source_name,
    buy_price: reading.buy_price,
    sell_price: reading.sell_price,
    midpoint: reading.midpoint,
    status: reading.status,
    reason: reading.reason,
    payload: reading.payload,
    fetched_at: reading.fetched_at
  }));
  if (readingRows.length) {
    const optionalError = await insertOptional(supabase, "rate_source_readings", readingRows);
    if (optionalError) errors.push(optionalError);
  }

  const historyRows = updates.map((update) => ({
    rate_code: update.code,
    buy_price: update.buy_price,
    sell_price: update.sell_price,
    variation: update.variation,
    source_count: validatedReadings.filter((reading) => reading.rate_code === update.code && reading.status === "accepted").length,
    confidence_score: Math.min(
      100,
      Math.max(35, validatedReadings.filter((reading) => reading.rate_code === update.code && reading.status === "accepted").length * 32)
    )
  }));
  if (historyRows.length) {
    const optionalError = await insertOptional(supabase, "rate_history", historyRows);
    if (optionalError) errors.push(optionalError);
  }

  const updatedCodes = updates.map((item) => item.code);
  const status = errors.length && updatedCodes.length ? "partial" : errors.length ? "failed" : "success";
  const finishedAt = new Date().toISOString();

  const sourceLogError = await insertOptional(supabase, "source_update_logs", {
    source: "rates:update",
    status,
    updated_codes: updatedCodes,
    errors,
    started_at: startedAt,
    finished_at: finishedAt
  });
  if (sourceLogError) errors.push(sourceLogError);

  const { error: settingsError } = await supabase.from("admin_settings").upsert(
    {
      key: "last_rate_update",
      value: {
        updated_at: finishedAt,
        updated_count: updates.length,
        reading_count: validatedReadings.length,
        rejected_count: validatedReadings.filter((reading) => reading.status === "rejected").length,
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
    readings: validatedReadings.length,
    rejected: validatedReadings.filter((reading) => reading.status === "rejected").length,
    errors
  };
}
