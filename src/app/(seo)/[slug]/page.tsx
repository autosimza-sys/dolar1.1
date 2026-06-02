import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { Bell, ChevronRight, Clock3 } from "lucide-react";
import { demoRates } from "@/lib/demo-data";
import { formatDateTime, formatMoney, formatPercent } from "@/lib/format";
import { findSeoPage, seoPages, siteUrl } from "@/lib/seo-content";
import type { Rate } from "@/lib/types";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return seoPages.map((page) => ({ slug: page.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const page = findSeoPage(slug);

  if (!page) {
    return {};
  }

  return {
    title: page.title,
    description: page.description,
    keywords: page.keywords,
    alternates: {
      canonical: `${siteUrl}/${page.slug}`
    },
    openGraph: {
      title: page.title,
      description: page.description,
      url: `${siteUrl}/${page.slug}`,
      siteName: "Dolar MZA",
      locale: "es_AR",
      type: "website"
    },
    twitter: {
      card: "summary",
      title: page.title,
      description: page.description
    }
  };
}

async function getRate(rateCode?: string) {
  if (!rateCode) return null;

  const fallback = demoRates.find((rate) => rate.code === rateCode) ?? null;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return fallback;

  const supabase = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const { data } = await supabase.from("rates").select("*").eq("code", rateCode).maybeSingle();
  return (data as Rate | null) ?? fallback;
}

function ctaHref(cta: string) {
  const normalized = cta.toLowerCase();
  if (normalized.includes("alerta")) return "/alerts";
  if (normalized.includes("cuenta")) return "/account";
  if (normalized.includes("inicio")) return "/";
  return "/";
}

export default async function SeoLandingPage({ params }: PageProps) {
  const { slug } = await params;
  const page = findSeoPage(slug);
  if (!page) notFound();

  const rate = await getRate(page.rateCode);
  const relatedPages = seoPages.filter((item) => item.slug !== page.slug).slice(0, 6);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": page.slug === "preguntas-frecuentes" ? "FAQPage" : "WebPage",
    name: page.h1,
    description: page.description,
    url: `${siteUrl}/${page.slug}`,
    publisher: {
      "@type": "Organization",
      name: "Dolar MZA",
      url: siteUrl
    },
    inLanguage: "es-AR",
    about: page.keywords
  };

  return (
    <div className="screen seo-page">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <section className="page-header seo-hero">
        <p className="eyebrow">Dolar MZA</p>
        <h1>{page.h1}</h1>
        <p>{page.intro}</p>
        <Link className="button button--hero" href={ctaHref(page.cta)}>
          <Bell size={18} />
          {page.cta}
        </Link>
      </section>

      {rate ? (
        <section className="rate-card seo-rate-card">
          <div className="rate-card__top">
            <div className="rate-card__identity">
              <span className="rate-card__flag">{rate.flag}</span>
              <div>
                <h2>{rate.name}</h2>
                <p>{rate.country}</p>
              </div>
            </div>
            <span className={rate.variation >= 0 ? "pill pill--green" : "pill pill--red"}>{formatPercent(rate.variation)}</span>
          </div>
          <div className="quote-grid">
            <div>
              <span>Compra</span>
              <strong>{formatMoney(rate.buy_price, true)}</strong>
            </div>
            <div>
              <span>Venta / valor</span>
              <strong>{formatMoney(rate.sell_price, true)}</strong>
            </div>
          </div>
          <span className="muted-line">
            <Clock3 size={14} />
            Actualizado {formatDateTime(rate.updated_at)}
          </span>
        </section>
      ) : null}

      <section className="seo-content-block">
        <h2>Que vas a encontrar</h2>
        <div className="feature-band">
          {page.bullets.map((bullet) => (
            <article key={bullet}>
              <CheckIcon />
              <span>{bullet}</span>
            </article>
          ))}
        </div>
      </section>

      <section className="seo-content-block">
        <h2>Referencias utiles</h2>
        <div className="source-list">
          {relatedPages.map((item) => (
            <Link key={item.slug} href={`/${item.slug}`}>
              <article>
                <div>
                  <strong>{item.h1}</strong>
                  <span>{item.description}</span>
                </div>
                <ChevronRight size={18} />
              </article>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

function CheckIcon() {
  return (
    <span className="education-card__icon" aria-hidden="true">
      <ChevronRight size={18} />
    </span>
  );
}
