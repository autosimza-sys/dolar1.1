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

export function LearnScreen() {
  const { data: cards, isLoading } = useEducationCards();
  const [activeCategory, setActiveCategory] = useState<(typeof categories)[number]>("todo");

  const visibleCards = useMemo(() => {
    if (activeCategory === "todo") return cards;
    return cards.filter((card) => card.category === activeCategory);
  }, [activeCategory, cards]);

  return (
    <div className="screen">
      <section className="page-header">
        <p className="eyebrow">Aprendé</p>
        <h1>Aprendé a no perder plata</h1>
        <p>Lecturas rápidas, lenguaje común y alertas relacionadas.</p>
      </section>

      <div className="category-scroll" aria-label="Categorías">
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

      {isLoading ? <p className="loading-line">Cargando educación financiera...</p> : null}

      <div className="education-list">
        {visibleCards.map((card) => (
          <article className="education-card" key={card.id}>
            <div className="education-card__icon">
              <BookOpen size={20} />
            </div>
            <div>
              <span>{card.category}</span>
              <h2>{card.title}</h2>
              <p>{card.content}</p>
              <Link className="text-link" href={`/alerts?type=${card.related_alert_type}`}>
                <Bell size={16} />
                Activar alerta relacionada
                <ChevronRight size={16} />
              </Link>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
