"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Script from "next/script";

const pixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID || "2041512306793918";
const consentStorageKey = "dolar_mza_cookie_consent";
const consentEventName = "dolar_mza_cookie_consent_changed";

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
    _fbq?: unknown;
  }
}

function hasMarketingConsent() {
  if (typeof window === "undefined") return false;

  try {
    const saved = window.localStorage.getItem(consentStorageKey);
    if (!saved) return false;

    const parsed = JSON.parse(saved) as { marketing?: boolean };
    return Boolean(parsed.marketing);
  } catch {
    return false;
  }
}

export function MetaPixel() {
  const pathname = usePathname();
  const lastTrackedPath = useRef<string | null>(null);
  const [canTrack, setCanTrack] = useState(false);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    function syncConsent() {
      setCanTrack(hasMarketingConsent());
    }

    syncConsent();
    window.addEventListener(consentEventName, syncConsent);
    window.addEventListener("storage", syncConsent);

    return () => {
      window.removeEventListener(consentEventName, syncConsent);
      window.removeEventListener("storage", syncConsent);
    };
  }, []);

  useEffect(() => {
    if (!canTrack || !isReady || !window.fbq) return;

    const currentPath = `${pathname}${window.location.search}`;
    if (lastTrackedPath.current === currentPath) return;

    lastTrackedPath.current = currentPath;
    window.fbq("track", "PageView");
  }, [canTrack, isReady, pathname]);

  if (!canTrack || !pixelId) return null;

  return (
    <Script
      id="meta-pixel"
      strategy="afterInteractive"
      onLoad={() => setIsReady(true)}
      onReady={() => setIsReady(true)}
    >
      {`
        !function(f,b,e,v,n,t,s)
        {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
        n.callMethod.apply(n,arguments):n.queue.push(arguments)};
        if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
        n.queue=[];t=b.createElement(e);t.async=!0;
        t.src=v;s=b.getElementsByTagName(e)[0];
        s.parentNode.insertBefore(t,s)}(window, document,'script',
        'https://connect.facebook.net/en_US/fbevents.js');
        fbq('init', '${pixelId}');
      `}
    </Script>
  );
}
