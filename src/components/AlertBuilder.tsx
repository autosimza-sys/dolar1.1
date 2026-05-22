"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Check, ChevronDown, ChevronRight, DollarSign, Mail, MessageCircle, Percent, SlidersHorizontal } from "lucide-react";
import { AuthModal } from "@/components/AuthModal";
import { FlagBadge } from "@/components/FlagBadge";
import { ALERT_CHANNELS, ALERT_TYPES } from "@/lib/constants";
import { useAccount, useRates } from "@/lib/hooks";
import type { AlertCondition, Channel } from "@/lib/types";

type ValueKind = "price" | "percent";

function getAlertDefinition(value: AlertCondition) {
  return ALERT_TYPES.find((type) => type.value === value) ?? ALERT_TYPES[0];
}

function suggestedValueKind(definition: ReturnType<typeof getAlertDefinition>): ValueKind {
  return definition.targetSuffix === "%" ? "percent" : "price";
}

export function AlertBuilder() {
  const params = useSearchParams();
  const { data: rates } = useRates();
  const account = useAccount();
  const initialType = (params.get("type") as AlertCondition | null) ?? "above";
  const initialRate = params.get("rate");

  const [condition, setCondition] = useState<AlertCondition>(initialType);
  const definition = useMemo(() => getAlertDefinition(condition), [condition]);
  const [rateCode, setRateCode] = useState(initialRate ?? definition.defaultRateCode);
  const selectedRate = useMemo(() => rates.find((rate) => rate.code === rateCode) ?? rates[0], [rateCode, rates]);
  const [targetValue, setTargetValue] = useState("");
  const [valueKind, setValueKind] = useState<ValueKind>(suggestedValueKind(definition));
  const [channel, setChannel] = useState<Channel>("email");
  const [rateOpen, setRateOpen] = useState(false);
  const [conditionOpen, setConditionOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [authOpen, setAuthOpen] = useState(false);

  useEffect(() => {
    if (!initialRate) {
      setRateCode(definition.defaultRateCode);
    }

    setValueKind(suggestedValueKind(definition));
  }, [definition, initialRate]);

  const valueSuffix = valueKind === "percent" ? "%" : "$";
  const valuePlaceholder = valueKind === "percent" ? "Ingresá porcentaje" : "Ingresá precio en pesos";
  const valueExample = valueKind === "percent" ? "Ejemplo: 35" : "Ejemplo: 1400";

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(null);

    if (!account.user) {
      setAuthOpen(true);
      return;
    }

    if (!account.supabase) {
      setNotice("Configurá Supabase para guardar alertas reales.");
      return;
    }

    const activeAlerts = account.alerts.filter((alert) => alert.is_active);
    if (!account.isPremium && activeAlerts.length >= 1) {
      setNotice("El plan gratis incluye 1 alerta activa. Premium libera alertas ilimitadas.");
      return;
    }

    if (!account.isPremium && channel === "whatsapp") {
      setNotice("WhatsApp está incluido en Premium.");
      return;
    }

    setIsSaving(true);
    const { error } = await account.supabase.from("alerts").insert({
      user_id: account.user.id,
      rate_code: rateCode,
      condition_type: condition,
      target_value: Number(targetValue),
      channel,
      is_active: true
    });

    if (error) {
      setNotice(error.message);
    } else {
      setNotice("Alerta guardada. Te avisamos cuando pase algo importante.");
      await account.reload();
    }

    setIsSaving(false);
  }

  return (
    <div className="screen">
      <section className="page-header">
        <p className="eyebrow">Alertas</p>
        <h1>Elegí el precio. Nosotros te avisamos.</h1>
        <p>Crear una alerta lleva menos de 30 segundos.</p>
      </section>

      <form className="builder" onSubmit={handleSave}>
        <div className="builder-step builder-step--rate">
          <div className="step-title">
            <span>1</span>
            <strong>Elegí moneda o indicador</strong>
          </div>

          <div className={`select-popover ${rateOpen ? "is-open" : ""}`}>
            <button className="select-popover__trigger" type="button" onClick={() => setRateOpen((current) => !current)}>
              {selectedRate ? <FlagBadge compact rate={selectedRate} /> : null}
              <span>
                <strong>{selectedRate?.name ?? "Elegí moneda"}</strong>
                <small>{selectedRate?.country ?? "Moneda o indicador"}</small>
              </span>
              <ChevronDown size={18} />
            </button>

            {rateOpen ? (
              <div className="select-popover__menu">
                {rates.map((rate) => (
                  <button
                    className={`select-popover__option ${rateCode === rate.code ? "is-selected" : ""}`}
                    key={rate.code}
                    type="button"
                    onClick={() => {
                      setRateCode(rate.code);
                      setRateOpen(false);
                    }}
                  >
                    <FlagBadge compact rate={rate} />
                    <span>
                      <strong>{rate.name}</strong>
                      <small>{rate.country}</small>
                    </span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        <div className="builder-step builder-step--condition">
          <div className="step-title">
            <span>2</span>
            <strong>Elegí condición</strong>
          </div>

          <div className={`select-popover ${conditionOpen ? "is-open" : ""}`}>
            <button className="select-popover__trigger" type="button" onClick={() => setConditionOpen((current) => !current)}>
              <SlidersHorizontal size={18} />
              <span>
                <strong>{definition.label}</strong>
                <small>{definition.helper}</small>
              </span>
              <ChevronDown size={18} />
            </button>

            {conditionOpen ? (
              <div className="select-popover__menu select-popover__menu--conditions">
                {ALERT_TYPES.map((type) => (
                  <button
                    className={`select-popover__option select-popover__option--condition ${
                      condition === type.value ? "is-selected" : ""
                    }`}
                    key={type.value}
                    type="button"
                    onClick={() => {
                      setCondition(type.value);
                      setConditionOpen(false);
                    }}
                  >
                    <span>
                      <strong>{type.label}</strong>
                      <small>{type.helper}</small>
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
            <strong>Precio o porcentaje</strong>
          </div>

          <div className="value-kind-grid" aria-label="Tipo de valor">
            <button
              className={`value-kind-button ${valueKind === "price" ? "is-selected" : ""}`}
              type="button"
              onClick={() => setValueKind("price")}
            >
              <DollarSign size={17} />
              Precio $
            </button>
            <button
              className={`value-kind-button ${valueKind === "percent" ? "is-selected" : ""}`}
              type="button"
              onClick={() => setValueKind("percent")}
            >
              <Percent size={17} />
              Porcentaje %
            </button>
          </div>

          <label className="target-input">
            <SlidersHorizontal size={18} />
            <input
              inputMode="decimal"
              min="0"
              placeholder={valuePlaceholder}
              required
              step="0.01"
              type="number"
              value={targetValue}
              onChange={(event) => setTargetValue(event.target.value)}
            />
            <em>{valueSuffix}</em>
          </label>
          <small className="input-example">{valueExample}</small>
          <p className="step-helper">
            Usá porcentaje para alertas de tasas de interés. Usá precio en pesos para alertas de monedas o tipos de cambio.
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
              return (
                <button
                  className={`channel-button ${channel === item.value ? "is-selected" : ""}`}
                  key={item.value}
                  type="button"
                  onClick={() => setChannel(item.value)}
                >
                  <Icon size={19} />
                  <span>{item.label}</span>
                  {item.premium ? <small>Premium</small> : null}
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
        <p>“El dólar blue superó el precio que marcaste.”</p>
        <p>“La tasa BCRA cambió. Revisá si te conviene plazo fijo.”</p>
        <p>“Hoy hay movimiento importante. No llegues tarde.”</p>
      </section>

      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
    </div>
  );
}
