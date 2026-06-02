"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { Settings } from "lucide-react";

type ConsentState = {
  necessary: true;
  analytics: boolean;
  marketing: boolean;
};

const storageKey = "dolar_mza_cookie_consent";
const defaultConsent: ConsentState = { necessary: true, analytics: false, marketing: false };

function readConsent(): ConsentState | null {
  if (typeof window === "undefined") return null;

  try {
    const saved = window.localStorage.getItem(storageKey);
    if (!saved) return null;
    const parsed = JSON.parse(saved) as Partial<ConsentState>;

    return {
      necessary: true,
      analytics: Boolean(parsed.analytics),
      marketing: Boolean(parsed.marketing)
    };
  } catch {
    return null;
  }
}

function saveConsent(consent: ConsentState) {
  window.localStorage.setItem(storageKey, JSON.stringify(consent));
}

async function trackEvent(eventName: string, consent: ConsentState, extra: Record<string, unknown> = {}) {
  if (!consent.analytics && !consent.marketing) return;

  const url = new URL(window.location.href);
  await fetch("/api/analytics/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      event_name: eventName,
      path: `${url.pathname}${url.search}`,
      referrer: document.referrer || null,
      source: url.searchParams.get("utm_source"),
      campaign: url.searchParams.get("utm_campaign"),
      consent: {
        analytics: consent.analytics,
        marketing: consent.marketing
      },
      ...extra
    })
  }).catch(() => undefined);
}

function isImportantClick(target: EventTarget | null) {
  const element = target instanceof Element ? target.closest("a,button") : null;
  if (!element) return false;

  const text = element.textContent?.toLowerCase() ?? "";
  const href = element instanceof HTMLAnchorElement ? element.href.toLowerCase() : "";

  return (
    text.includes("premium") ||
    text.includes("activar mis alertas") ||
    text.includes("guardar alerta") ||
    text.includes("crear cuenta") ||
    text.includes("mercado pago") ||
    href.includes("/premium") ||
    href.includes("/alerts")
  );
}

export function CookieConsent() {
  const pathname = usePathname();
  const [consent, setConsent] = useState<ConsentState | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [showPreferences, setShowPreferences] = useState(false);
  const [draft, setDraft] = useState<ConsentState>(defaultConsent);
  const routeKey = useMemo(() => pathname, [pathname]);

  useEffect(() => {
    const saved = readConsent();
    setConsent(saved);
    setDraft(saved ?? defaultConsent);
    setIsOpen(!saved);
  }, []);

  useEffect(() => {
    if (!consent) return;
    void trackEvent("page_view", consent);

    if (pathname === "/") {
      void trackEvent("cotizaciones_vistas", consent);
    }
  }, [consent, pathname, routeKey]);

  useEffect(() => {
    if (!consent) return;
    const activeConsent = consent;

    function onClick(event: MouseEvent) {
      if (!isImportantClick(event.target)) return;
      void trackEvent("click_importante", activeConsent);
    }

    function onSubmit() {
      void trackEvent("formulario_enviado", activeConsent);
    }

    document.addEventListener("click", onClick);
    document.addEventListener("submit", onSubmit);

    return () => {
      document.removeEventListener("click", onClick);
      document.removeEventListener("submit", onSubmit);
    };
  }, [consent]);

  function applyConsent(nextConsent: ConsentState, eventName: string) {
    saveConsent(nextConsent);
    setConsent(nextConsent);
    setDraft(nextConsent);
    setIsOpen(false);
    setShowPreferences(false);
    void trackEvent(eventName, nextConsent);
  }

  if (!isOpen) {
    return (
      <button className="cookie-preferences-button" type="button" onClick={() => setIsOpen(true)}>
        <Settings size={15} />
        Cookies
      </button>
    );
  }

  return (
    <section className="cookie-consent" aria-label="Preferencias de cookies">
      <div className="cookie-consent__copy">
        <strong>Preferencias de cookies</strong>
        <p>
          Usamos cookies y datos de navegación para mejorar la experiencia, medir visitas, conocer desde qué zonas se usa
          la plataforma y mejorar nuestras alertas y servicios. No vendemos tus datos ni mostramos información personal
          públicamente.
        </p>
      </div>

      {showPreferences ? (
        <div className="cookie-preferences">
          <label>
            <input checked disabled type="checkbox" />
            <span>
              <strong>Necesarias</strong>
              Siempre activas para que la app funcione.
            </span>
          </label>
          <label>
            <input
              checked={draft.analytics}
              type="checkbox"
              onChange={(event) => setDraft((current) => ({ ...current, analytics: event.target.checked }))}
            />
            <span>
              <strong>Analítica</strong>
              Visitas, páginas, dispositivo y ciudad/provincia aproximada.
            </span>
          </label>
          <label>
            <input
              checked={draft.marketing}
              type="checkbox"
              onChange={(event) => setDraft((current) => ({ ...current, marketing: event.target.checked }))}
            />
            <span>
              <strong>Marketing</strong>
              Conversiones, visitas a Premium y campañas.
            </span>
          </label>
        </div>
      ) : null}

      <div className="cookie-consent__actions">
        <button className="button button--ghost" type="button" onClick={() => setShowPreferences((current) => !current)}>
          Configurar preferencias
        </button>
        <button className="button button--ghost" type="button" onClick={() => applyConsent(defaultConsent, "cookies_rechazadas")}>
          Rechazar no esenciales
        </button>
        {showPreferences ? (
          <button className="button" type="button" onClick={() => applyConsent(draft, "cookies_preferencias_guardadas")}>
            Guardar preferencias
          </button>
        ) : (
          <button
            className="button"
            type="button"
            onClick={() => applyConsent({ necessary: true, analytics: true, marketing: true }, "cookies_aceptadas")}
          >
            Aceptar todo
          </button>
        )}
      </div>
    </section>
  );
}
