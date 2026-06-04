"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Bell, BookOpen, ChevronRight } from "lucide-react";
import { useEducationCards } from "@/lib/hooks";
import type { EducationCard } from "@/lib/types";

const categories: Array<EducationCard["category"] | "todo"> = [
  "todo",
  "dolar",
  "plazo fijo",
  "inflacion",
  "ahorro",
  "viajes",
  "errores comunes"
];

const levels: Array<{ value: EducationCard["level"] | "todo"; label: string }> = [
  { value: "todo", label: "Todos" },
  { value: "jovenes", label: "Nivel 1" },
  { value: "ahorristas", label: "Nivel 2" },
  { value: "expertos", label: "Nivel 3" }
];

const levelLabels: Record<NonNullable<EducationCard["level"]>, string> = {
  jovenes: "Jovenes y adolescentes",
  ahorristas: "Trabajadores y ahorristas",
  expertos: "Expertos"
};

export function LearnScreen() {
  const { data: cards, isLoading } = useEducationCards();
  const [activeCategory, setActiveCategory] = useState<(typeof categories)[number]>("todo");
  const [activeLevel, setActiveLevel] = useState<(typeof levels)[number]["value"]>("todo");

  const visibleCards = useMemo(() => {
    return cards.filter((card) => {
      const matchesCategory = activeCategory === "todo" || card.category === activeCategory;
      const matchesLevel = activeLevel === "todo" || card.level === activeLevel;
      return matchesCategory && matchesLevel;
    });
  }, [activeCategory, activeLevel, cards]);

  return (
    <div className="screen">
      <section className="page-header">
        <p className="eyebrow">Aprende</p>
        <h1>Aprende a no perder plata</h1>
        <p>Educacion financiera gratis, corta y clara para decidir mejor.</p>
      </section>

      <div className="category-scroll" aria-label="Categorias">
        {categories.map((category) => (
          <button
            className={activeCategory === category ? "is-active" : ""}
            key={category}
            type="button"
            onClick={() => setActiveCategory(category)}
          >
            {category}
          </button>
        ))}
      </div>

      <div className="category-scroll category-scroll--levels" aria-label="Niveles">
        {levels.map((level) => (
          <button
            className={activeLevel === level.value ? "is-active" : ""}
            key={level.value}
            type="button"
            onClick={() => setActiveLevel(level.value)}
          >
            {level.label}
          </button>
        ))}
      </div>

      {isLoading ? <p className="loading-line">Cargando educacion financiera...</p> : null}

      <div className="education-list">
        {visibleCards.map((card) => (
          <article className="education-card" key={card.id}>
            <div className="education-card__icon">
              <BookOpen size={20} />
            </div>
            <div>
              <span className="education-card__meta">
                {card.category}
                {card.level ? ` / ${levelLabels[card.level]}` : ""}
              </span>
              <h2>{card.title}</h2>
              <p>{card.content}</p>
              <small>Queres que Dolar MZA te avise cuando esto cambie?</small>
              <Link className="text-link" href={`/alerts?type=${card.related_alert_type}`}>
                <Bell size={16} />
                Activar alertas
                <ChevronRight size={16} />
              </Link>
            </div>
          </article>
        ))}
        {!visibleCards.length ? <div className="empty-state">No hay contenidos para este filtro.</div> : null}
      </div>
    </div>
  );
}
