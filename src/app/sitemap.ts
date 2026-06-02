import type { MetadataRoute } from "next";
import { seoPages, siteUrl } from "@/lib/seo-content";

const staticRoutes = ["", "alerts", "learn", "premium", "account"];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  return [
    ...staticRoutes.map((route) => ({
      url: route ? `${siteUrl}/${route}` : siteUrl,
      lastModified: now,
      changeFrequency: "daily" as const,
      priority: route ? 0.75 : 1
    })),
    ...seoPages.map((page) => ({
      url: `${siteUrl}/${page.slug}`,
      lastModified: now,
      changeFrequency: "daily" as const,
      priority: 0.86
    }))
  ];
}
