import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Dólar Mendoza",
    short_name: "Dólar Mza",
    description: "Cotizaciones simples y alertas inteligentes.",
    start_url: "/",
    display: "standalone",
    background_color: "#050505",
    theme_color: "#00C853",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml"
      }
    ]
  };
}
