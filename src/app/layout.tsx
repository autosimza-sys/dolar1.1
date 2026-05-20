import type { Metadata, Viewport } from "next";
import { AppShell } from "@/components/AppShell";
import "./globals.css";

export const metadata: Metadata = {
  title: "Dólar Mendoza",
  description: "Cotizaciones simples, alertas inteligentes y educación financiera para decidir mejor.",
  applicationName: "Dólar Mendoza",
  manifest: "/manifest.json"
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
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
