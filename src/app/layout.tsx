import type { Metadata, Viewport } from "next";
import { AppShell } from "@/components/AppShell";
import { siteUrl } from "@/lib/seo-content";
import "./globals.css";

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Dolar MZA",
  url: siteUrl,
  description:
    "Dolar MZA es una plataforma financiera digital enfocada en Mendoza y Argentina con cotizaciones, valores de referencia y alertas.",
  areaServed: ["Mendoza", "Argentina"],
  slogan: "No vendemos cotizaciones. Te ayudamos a estar un paso antes."
};

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Dolar MZA | Dolar Mendoza, cotizaciones y alertas",
    template: "%s | Dolar MZA"
  },
  description: "Cotizaciones simples, alertas inteligentes y educacion financiera para decidir mejor en Mendoza.",
  applicationName: "Dolar MZA",
  manifest: "/manifest.webmanifest",
  keywords: [
    "dolar Mendoza",
    "dolar blue Mendoza",
    "precio dolar Mendoza",
    "dolar hoy Mendoza",
    "cotizacion dolar Mendoza",
    "alerta dolar blue",
    "alertas dolar Mendoza",
    "peso chileno Mendoza",
    "real Mendoza",
    "euro blue Mendoza",
    "tasas plazo fijo Argentina"
  ],
  alternates: {
    canonical: siteUrl
  },
  openGraph: {
    title: "Dolar MZA",
    description: "Cotizaciones simples, alertas inteligentes y educacion financiera para decidir mejor en Mendoza.",
    url: siteUrl,
    siteName: "Dolar MZA",
    locale: "es_AR",
    type: "website"
  },
  twitter: {
    card: "summary",
    title: "Dolar MZA",
    description: "Dolar Mendoza, cotizaciones y alertas financieras simples."
  },
  robots: {
    index: true,
    follow: true
  }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#050505"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-AR">
      <body>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }} />
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
