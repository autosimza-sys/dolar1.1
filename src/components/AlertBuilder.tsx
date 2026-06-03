"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Check,
  ChevronDown,
  ChevronRight,
  Clock3,
  DollarSign,
  Mail,
  MessageCircle,
  Percent,
  SlidersHorizontal,
  Target,
  TrendingDown,
  TrendingUp,
  Zap
} from "lucide-react";
import { AuthModal } from "@/components/AuthModal";
import { FlagBadge } from "@/components/FlagBadge";
import { ALERT_CHANNELS } from "@/lib/constants";
import { useAccount, useRates } from "@/lib/hooks";
import type { AlertCondition, Channel, Rate } from "@/lib/types";

type ValueKind = "price" | "percent" | "points";
type ActivePlan = "free" | "essential_monthly" | "tracking_monthly" | "premium_monthly";
type TrackKind = "currency" | "rate" | "risk";

type TrackOption = {
  id: string;
  label: string;
  helper: string;
  rateCode: string;
  kind: TrackKind;
};

type ConditionOption = {
  id: string;
  label: string;
  helper: string;
  condition: AlertCondition;
  valueKind: ValueKind;
  placeholder: string;
  example: string;
};

type QuickAlert = {
  id: string;
  title: string;
  description: string;
  icon: "up" | "down" | "target" | "clock" | "rate" | "move" | "daily";
  rateCode: string;
  condition: AlertCondition;
  targetValue: number | "current_plus_10" | "current_minus_10";
  configure?: boolean;
  prefill?: {
    trackId: string;
    conditionId: string;
  };
};

const quickAlerts: QuickAlert[] = [
  {
    id: "blue-up",
    title: "Dolar Blue sube fuerte",
    description: "Te avisamos si el blue tiene una suba importante.",
    icon: "up",
    rateCode: "USD_BLUE",
    condition: "above",
    targetValue: "current_plus_10"
  },
  {
    id: "blue-down",
    title: "Dolar Blue baja fuerte",
    description: "Te avisamos si aparece una posible oportunidad de compra.",
    icon: "down",
    rateCode: "USD_BLUE",
    condition: "below",
    targetValue: "current_minus_10"
  },
  {
    id: "blue-target",
    title: "Dolar Blue llega a un valor",
    description: "Elegi el precio y te avisamos cuando llegue.",
    icon: "target",
    rateCode: "USD_BLUE",
    condition: "above",
    targetValue: 0,
    configure: true,
    prefill: { trackId: "usd-blue", conditionId: "above-price" }
  },
  {
    id: "official-open",
    title: "Apertura del mercado oficial",
    description: "Recibi como abren el dolar oficial, real, euro y peso chileno.",
    icon: "clock",
    rateCode: "USD_OFICIAL",
    condition: "official_market_open",
    targetValue: 0
  },
  {
    id: "official-close",
    title: "Cierre del mercado oficial",
    description: "Recibi el resumen del cierre bancario.",
    icon: "clock",
    rateCode: "USD_OFICIAL",
    condition: "official_market_close",
    targetValue: 0
  },
  {
    id: "informal-open",
    title: "Apertura del mercado informal",
    description: "Recibi como abre el mercado blue e informal.",
    icon: "clock",
    rateCode: "USD_BLUE",
    condition: "informal_market_open",
    targetValue: 0
  },
  {
    id: "informal-close",
    title: "Cierre del mercado informal",
    description: "Recibi el cierre del blue y monedas informales.",
    icon: "clock",
    rateCode: "USD_BLUE",
    condition: "informal_market_close",
    targetValue: 0
  },
  {
    id: "bcra-up",
    title: "Tasa BCRA sube",
    description: "Te avisamos si cambia la tasa de referencia.",
    icon: "rate",
    rateCode: "BCRA_RATE",
    condition: "rate_up",
    targetValue: 0
  },
  {
    id: "bcra-down",
    title: "Tasa BCRA baja",
    description: "Te avisamos si baja la tasa y puede afectar tus rendimientos.",
    icon: "rate",
    rateCode: "BCRA_RATE",
    condition: "rate_down",
    targetValue: 0
  },
  {
    id: "daily-summary",
    title: "Resumen financiero diario",
    description: "Un resumen simple para saber como arranca el dia.",
    icon: "daily",
    rateCode: "USD_OFICIAL",
    condition: "official_market_open",
    targetValue: 0
  },
  {
    id: "real-move",
    title: "Real se mueve fuerte",
    description: "Te avisamos si el real tiene un movimiento importante.",
    icon: "move",
    rateCode: "BRL_BLUE",
    condition: "brl_strong_move",
    targetValue: 2
  },
  {
    id: "clp-move",
    title: "Peso chileno se mueve fuerte",
    description: "Te avisamos si el peso chileno cambia fuerte.",
    icon: "move",
    rateCode: "CLP_BLUE",
    condition: "clp_strong_move",
    targetValue: 2
  }
];

function currentValue(rate: Rate | undefined) {
  return rate?.sell_price ?? rate?.buy_price ?? 0;
}

function quickIcon(type: QuickAlert["icon"]) {
  if (type === "up") return <TrendingUp size={18} />;
  if (type === "down") return <TrendingDown size={18} />;
  if (type === "target") return <Target size={18} />;
  if (type === "clock") return <Clock3 size={18} />;
  if (type === "rate") return <Percent size={18} />;
  if (type === "daily") return <Zap size={18} />;
  return <SlidersHorizontal size={18} />;
}

function quickTargetValue(alert: QuickAlert, rates: Rate[]) {
  if (typeof alert.targetValue === "number") return alert.targetValue;

  const value = currentValue(rates.find((rate) => rate.code === alert.rateCode));
  if (alert.targetValue === "current_plus_10") return value > 0 ? Math.round(value + 10) : 1;
  if (alert.targetValue === "current_minus_10") return value > 10 ? Math.round(value - 10) : 1;
  return 0;
}

function firstAvailableRate(codes: string[], rates: Rate[]) {
  return codes.map((code) => rates.find((rate) => rate.code === code)).find(Boolean);
}

function buildTrackOptions(rates: Rate[]): TrackOption[] {
  const options = [
    { id: "usd-blue", label: "Dolar Blue", helper: "Precio informal principal.", codes: ["USD_BLUE"], kind: "currency" as const },
    { id: "usd-oficial", label: "Dolar Oficial", helper: "Referencia bancaria.", codes: ["USD_OFICIAL"], kind: "currency" as const },
    { id: "usd-mep", label: "Dolar MEP", helper: "Dolar bolsa.", codes: ["USD_MEP"], kind: "currency" as const },
    { id: "usd-ccl", label: "Dolar CCL", helper: "Referencia de mercado.", codes: ["USD_CCL"], kind: "currency" as const },
    { id: "euro", label: "Euro", helper: "Euro oficial o blue.", codes: ["EUR_BLUE", "EUR_OFICIAL"], kind: "currency" as const },
    { id: "real", label: "Real", helper: "Real para viajes y ahorro.", codes: ["BRL_BLUE", "BRL_OFICIAL"], kind: "currency" as const },
    { id: "clp", label: "Peso Chileno", helper: "Clave para viajar a Chile.", codes: ["CLP_BLUE", "CLP_OFICIAL"], kind: "currency" as const },
    { id: "bcra", label: "Tasa BCRA", helper: "Tasa de referencia.", codes: ["BCRA_RATE"], kind: "rate" as const },
    { id: "fixed-term", label: "Plazo fijo", helper: "Rendimiento promedio.", codes: ["FIXED_TERM_30"], kind: "rate" as const },
    { id: "country-risk", label: "Riesgo Pais", helper: "Puntos de riesgo argentino.", codes: ["COUNTRY_RISK"], kind: "risk" as const }
  ];

  return options.flatMap((option) => {
    const rate = firstAvailableRate(option.codes, rates);
    return rate ? [{ id: option.id, label: option.label, helper: option.helper, rateCode: rate.code, kind: option.kind }] : [];
  });
}

function percentConditionForRate(rateCode: string): AlertCondition {
  if (rateCode.startsWith("CLP")) return "clp_strong_move";
  if (rateCode.startsWith("BRL")) return "brl_strong_move";
  if (rateCode.startsWith("EUR")) return "eur_strong_move";
  return "travel_opportunity";
}

function getConditionOptions(track: TrackOption | undefined): ConditionOption[] {
  if (!track) return [];

  if (track.kind === "risk") {
    return [
      {
        id: "above-points",
        label: "Supera una cantidad de puntos",
        helper: "Te avisamos si pasa el valor que marcaste.",
        condition: "above",
        valueKind: "points",
        placeholder: "Ejemplo: 1200",
        example: "1200"
      },
      {
        id: "below-points",
        label: "Baja una cantidad de puntos",
        helper: "Te avisamos si baja al valor que esperabas.",
        condition: "below",
        valueKind: "points",
        placeholder: "Ejemplo: 900",
        example: "900"
      }
    ];
  }

  if (track.kind === "rate") {
    const upCondition: AlertCondition = track.rateCode === "FIXED_TERM_30" ? "fixed_term_better" : "rate_up";

    return [
      {
        id: "above-percent",
        label: "Supera un porcentaje",
        helper: "Te avisamos si la tasa pasa ese valor.",
        condition: upCondition,
        valueKind: "percent",
        placeholder: "Ejemplo: 35",
        example: "35"
      },
      {
        id: "below-percent",
        label: "Baja de un porcentaje",
        helper: "Te avisamos si la tasa baja al valor indicado.",
        condition: "rate_down",
        valueKind: "percent",
        placeholder: "Ejemplo: 30",
        example: "30"
      },
      {
        id: "moves-percent",
        label: "Cambia un porcentaje",
        helper: "Te avisamos si detectamos un cambio en la tasa.",
        condition: upCondition,
        valueKind: "percent",
        placeholder: "Ejemplo: 1",
        example: "1"
      }
    ];
  }

  return [
    {
      id: "above-price",
      label: "Supera un precio",
      helper: "Te avisamos si pasa el precio que marcaste.",
      condition: "above",
      valueKind: "price",
      placeholder: "Ejemplo: 1450",
      example: "1450"
    },
    {
      id: "below-price",
      label: "Baja de un precio",
      helper: "Te avisamos si baja al precio que esperabas.",
      condition: "below",
      valueKind: "price",
      placeholder: "Ejemplo: 1400",
      example: "1400"
    },
    {
      id: "moves-percent",
      label: "Cambia mas de un porcentaje",
      helper: "Te avisamos si se mueve fuerte.",
      condition: percentConditionForRate(track.rateCode),
      valueKind: "percent",
      placeholder: "Ejemplo: 3",
      example: "3"
    }
  ];
}

function alertLimitForPlan(plan: ActivePlan) {
  if (plan === "tracking_monthly") return 4;
  if (plan === "premium_monthly") return Infinity;
  return 1;
}

function valueSuffix(kind: ValueKind) {
  if (kind === "percent") return "%";
  if (kind === "points") return "puntos";
  return "$";
}

export function AlertBuilder() {
  const params = useSearchParams();
  const { data: rates } = useRates();
  const account = useAccount();
  const initialRate = params.get("rate");

  const trackOptions = useMemo(() => buildTrackOptions(rates), [rates]);
  const initialTrack = useMemo(
    () => trackOptions.find((option) => option.rateCode === initialRate) ?? trackOptions[0],
    [initialRate, trackOptions]
  );

  const [selectedTrackId, setSelectedTrackId] = useState("usd-blue");
  const selectedTrack = useMemo(
    () => trackOptions.find((option) => option.id === selectedTrackId) ?? initialTrack,
    [initialTrack, selectedTrackId, trackOptions]
  );
  const selectedRate = useMemo(
    () => rates.find((rate) => rate.code === selectedTrack?.rateCode) ?? rates[0],
    [rates, selectedTrack]
  );
  const conditionOptions = useMemo(() => getConditionOptions(selectedTrack), [selectedTrack]);
  const [conditionId, setConditionId] = useState("above-price");
  const selectedCondition = useMemo(
    () => conditionOptions.find((option) => option.id === conditionId) ?? conditionOptions[0],
    [conditionId, conditionOptions]
  );
  const [targetValue, setTargetValue] = useState("");
  const [channel, setChannel] = useState<Channel>("email");
  const [trackOpen, setTrackOpen] = useState(false);
  const [conditionOpen, setConditionOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [savingQuickId, setSavingQuickId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const activePlan: ActivePlan =
    account.subscription?.status === "active" ? account.subscription.plan : account.isPremium ? "premium_monthly" : "free";

  useEffect(() => {
    if (initialTrack?.id) {
      setSelectedTrackId(initialTrack.id);
    }
  }, [initialTrack?.id]);

  useEffect(() => {
    const nextCondition = getConditionOptions(selectedTrack)[0];
    if (nextCondition) {
      setConditionId(nextCondition.id);
      setTargetValue("");
    }
  }, [selectedTrack]);

  async function saveAlert(input: { rateCode: string; condition: AlertCondition; targetValue: number; channel: Channel }) {
    setNotice(null);

    if (!account.user) {
      setAuthOpen(true);
      return false;
    }

    if (!account.supabase) {
      setNotice("Configura Supabase para guardar alertas reales.");
      return false;
    }

    const activeAlerts = account.alerts.filter((alert) => alert.is_active);
    const activeAlertLimit = alertLimitForPlan(activePlan);
    if (activeAlerts.length >= activeAlertLimit) {
      setNotice("Alcanzaste el limite de alertas activas de tu plan.");
      return false;
    }

    if (activePlan !== "premium_monthly" && input.channel === "whatsapp") {
      setNotice("WhatsApp estara disponible para planes Premium.");
      return false;
    }

    const { error } = await account.supabase.from("alerts").insert({
      user_id: account.user.id,
      rate_code: input.rateCode,
      condition_type: input.condition,
      target_value: input.targetValue,
      channel: input.channel,
      is_active: true
    });

    if (error) {
      setNotice(error.message);
      return false;
    }

    setNotice("Alerta guardada. Te avisamos cuando pase algo importante.");
    await account.reload();
    return true;
  }

  async function handleQuickAlert(alert: QuickAlert) {
    if (alert.configure && alert.prefill) {
      setSelectedTrackId(alert.prefill.trackId);
      setConditionId(alert.prefill.conditionId);
      setTargetValue("");
      setNotice("Listo. Carga el precio y guarda tu alerta.");
      return;
    }

    setSavingQuickId(alert.id);
    await saveAlert({
      rateCode: alert.rateCode,
      condition: alert.condition,
      targetValue: quickTargetValue(alert, rates),
      channel: "email"
    });
    setSavingQuickId(null);
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedTrack || !selectedCondition) {
      setNotice("Elegi que queres seguir y que te tenemos que avisar.");
      return;
    }

    setIsSaving(true);
    await saveAlert({
      rateCode: selectedTrack.rateCode,
      condition: selectedCondition.condition,
      targetValue: Number(targetValue),
      channel
    });
    setIsSaving(false);
  }

  return (
    <div className="screen">
      <section className="page-header">
        <p className="eyebrow">Alertas</p>
        <h1>Crea alertas para no llegar tarde</h1>
        <p>Elegi que queres seguir y Dolar MZA te avisa cuando haya un movimiento importante.</p>
        <small className="page-header__note">No necesitas saber de mercados. Solo elegi que te importa y nosotros te avisamos.</small>
      </section>

      <section className="quick-alerts">
        <div className="builder-section-head">
          <div>
            <p className="eyebrow">Alertas rapidas</p>
            <h2>Listas para usar</h2>
          </div>
          <span>En pocos segundos</span>
        </div>
        <p className="builder-section-copy">Elegi una alerta lista para usar. La configuras en pocos segundos.</p>

        <div className="quick-alert-grid">
          {quickAlerts.map((alert) => (
            <article className="quick-alert-card" key={alert.id}>
              <div className="quick-alert-card__icon">{quickIcon(alert.icon)}</div>
              <div>
                <h3>{alert.title}</h3>
                <p>{alert.description}</p>
              </div>
              <button className="button button--ghost" disabled={savingQuickId === alert.id} type="button" onClick={() => handleQuickAlert(alert)}>
                {savingQuickId === alert.id ? "Guardando..." : alert.configure ? "Configurar" : "Activar alerta"}
              </button>
            </article>
          ))}
        </div>
      </section>

      <form className="builder builder--custom" onSubmit={handleSave}>
        <div className="builder-section-head builder-section-head--full">
          <div>
            <p className="eyebrow">Alerta personalizada</p>
            <h2>Crea una alerta a tu medida</h2>
          </div>
          <span>Para elegir moneda, tasa o indicador</span>
        </div>

        <div className="builder-step builder-step--rate">
          <div className="step-title">
            <span>1</span>
            <strong>Que queres seguir?</strong>
          </div>

          <div className={`select-popover ${trackOpen ? "is-open" : ""}`}>
            <button className="select-popover__trigger" type="button" onClick={() => setTrackOpen((current) => !current)}>
              {selectedRate ? <FlagBadge compact rate={selectedRate} /> : <DollarSign size={18} />}
              <span>
                <strong>{selectedTrack?.label ?? "Elegi una opcion"}</strong>
                <small>{selectedTrack?.helper ?? "Moneda, tasa o indicador"}</small>
              </span>
              <ChevronDown size={18} />
            </button>

            {trackOpen ? (
              <div className="select-popover__menu">
                {trackOptions.map((option) => {
                  const rate = rates.find((item) => item.code === option.rateCode);
                  return (
                    <button
                      className={`select-popover__option ${selectedTrack?.id === option.id ? "is-selected" : ""}`}
                      key={option.id}
                      type="button"
                      onClick={() => {
                        setSelectedTrackId(option.id);
                        setTrackOpen(false);
                      }}
                    >
                      {rate ? <FlagBadge compact rate={rate} /> : <DollarSign size={18} />}
                      <span>
                        <strong>{option.label}</strong>
                        <small>{option.helper}</small>
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>
        </div>

        <div className="builder-step builder-step--condition">
          <div className="step-title">
            <span>2</span>
            <strong>Que queres que te avise?</strong>
          </div>

          <div className={`select-popover ${conditionOpen ? "is-open" : ""}`}>
            <button className="select-popover__trigger" type="button" onClick={() => setConditionOpen((current) => !current)}>
              <SlidersHorizontal size={18} />
              <span>
                <strong>{selectedCondition?.label ?? "Elegi condicion"}</strong>
                <small>{selectedCondition?.helper ?? "Solo mostramos opciones que corresponden."}</small>
              </span>
              <ChevronDown size={18} />
            </button>

            {conditionOpen ? (
              <div className="select-popover__menu select-popover__menu--conditions">
                {conditionOptions.map((option) => (
                  <button
                    className={`select-popover__option select-popover__option--condition ${
                      selectedCondition?.id === option.id ? "is-selected" : ""
                    }`}
                    key={option.id}
                    type="button"
                    onClick={() => {
                      setConditionId(option.id);
                      setTargetValue("");
                      setConditionOpen(false);
                    }}
                  >
                    <span>
                      <strong>{option.label}</strong>
                      <small>{option.helper}</small>
                    </span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        <div className="builder-step builder-step--inline">
          <div className="step-title">
            <span>3</span>
            <strong>Valor</strong>
          </div>

          <label className="target-input">
            {selectedCondition?.valueKind === "percent" ? <Percent size={18} /> : <SlidersHorizontal size={18} />}
            <input
              inputMode="decimal"
              min="0"
              placeholder={selectedCondition?.placeholder ?? "Ejemplo: 1450"}
              required
              step="0.01"
              type="number"
              value={targetValue}
              onChange={(event) => setTargetValue(event.target.value)}
            />
            <em>{valueSuffix(selectedCondition?.valueKind ?? "price")}</em>
          </label>
          <small className="input-example">Ejemplo: {selectedCondition?.example ?? "1450"}</small>
          <p className="step-helper">
            La app elige sola si corresponde pesos, porcentaje o puntos segun la alerta que armaste.
          </p>
        </div>

        <div className="builder-step builder-step--channel">
          <div className="step-title">
            <span>4</span>
            <strong>Canal</strong>
          </div>
          <div className="channel-grid">
            {ALERT_CHANNELS.map((item) => {
              const Icon = item.value === "email" ? Mail : MessageCircle;
              const disabled = item.value === "whatsapp";
              return (
                <button
                  className={`channel-button ${channel === item.value ? "is-selected" : ""}`}
                  disabled={disabled}
                  key={item.value}
                  type="button"
                  onClick={() => setChannel(item.value)}
                >
                  <Icon size={19} />
                  <span>{item.label}</span>
                  {disabled ? <small>Proximamente</small> : null}
                </button>
              );
            })}
          </div>
        </div>

        {notice ? (
          <div className="notice">
            {notice}
            {notice.includes("Premium") ? (
              <Link href="/premium">
                Ver Premium <ChevronRight size={15} />
              </Link>
            ) : null}
          </div>
        ) : null}

        <button className="button button--full button--hero" disabled={isSaving} type="submit">
          {isSaving ? "Guardando..." : "Guardar alerta"}
          {isSaving ? null : <Check size={19} />}
        </button>
      </form>

      <section className="message-list">
        <h2>Mensajes simples</h2>
        <p>El Dolar Blue llego al valor que marcaste.</p>
        <p>La tasa que seguis tuvo un movimiento importante.</p>
        <p>Ya abrio el mercado. Revisa las cotizaciones.</p>
      </section>

      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
    </div>
  );
}
