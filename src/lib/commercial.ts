export type PlanId = "essential_monthly" | "tracking_monthly" | "premium_monthly";

export type CommercialStatus = "free" | "trial" | "active" | "grace" | "suspended" | "cancelled";

export type PlanConfig = {
  id: PlanId;
  name: string;
  tag: string;
  price: number;
  priceLabel: string;
  message: string;
  cta: string;
  bullets: string[];
  alertLimit: number | "unlimited";
  hasTrial: boolean;
  trialDays: number;
  whatsappLimit: number;
  tone?: "featured" | "exclusive";
};

export const commercialPlans: Record<PlanId, PlanConfig> = {
  essential_monthly: {
    id: "essential_monthly",
    name: "Básico",
    tag: "Para empezar",
    price: 999,
    priceLabel: "$999/mes",
    message: "Empezá a seguir los movimientos que más te importan.",
    cta: "Activar Plan Básico",
    bullets: ["2 alertas por email", "Seguimiento simple", "Cotizaciones completas", "Educación financiera gratis"],
    alertLimit: 2,
    hasTrial: false,
    trialDays: 0,
    whatsappLimit: 0
  },
  tracking_monthly: {
    id: "tracking_monthly",
    name: "Seguimiento",
    tag: "Recomendado",
    price: 3999,
    priceLabel: "$3.999/mes",
    message: "No llegues tarde a los movimientos del mercado.",
    cta: "Probar gratis 7 días",
    bullets: ["Seguimiento ampliado", "Más alertas por email", "Apertura y cierre de mercado", "Alertas personalizadas"],
    alertLimit: 4,
    hasTrial: true,
    trialDays: 7,
    whatsappLimit: 0,
    tone: "featured"
  },
  premium_monthly: {
    id: "premium_monthly",
    name: "Premium",
    tag: "WhatsApp",
    price: 149999,
    priceLabel: "$149.999/mes",
    message: "Alertas inmediatas para decisiones importantes.",
    cta: "Pasar a Premium",
    bullets: ["Todo lo del Plan Seguimiento", "Alertas por WhatsApp", "Funciones premium", "Máxima prioridad"],
    alertLimit: "unlimited",
    hasTrial: false,
    trialDays: 0,
    whatsappLimit: 6,
    tone: "exclusive"
  }
};

export const freePlan = {
  name: "Cuenta gratuita",
  priceLabel: "$0",
  includes: ["Cotizaciones completas", "Educación financiera", "Favoritos", "Comunidad", "Programa de referidos"],
  excludes: ["Alertas", "WhatsApp", "Beneficios premium"]
};

export function planPrice(plan: PlanId) {
  const envMap: Record<PlanId, string | undefined> = {
    essential_monthly: process.env.ESSENTIAL_MONTHLY_PRICE,
    tracking_monthly: process.env.TRACKING_MONTHLY_PRICE,
    premium_monthly: process.env.PREMIUM_MONTHLY_PRICE
  };
  const configuredPrice = Number(envMap[plan]);
  return Number.isFinite(configuredPrice) && configuredPrice > 0 ? configuredPrice : commercialPlans[plan].price;
}

export function normalizePlan(plan?: string): PlanId {
  if (plan === "essential_monthly" || plan === "tracking_monthly" || plan === "premium_monthly") return plan;
  return "tracking_monthly";
}

export function planLabel(plan?: string) {
  if (plan === "essential_monthly" || plan === "tracking_monthly" || plan === "premium_monthly") {
    return commercialPlans[plan].name;
  }
  return "Gratis";
}

export function referralLevel(points: number) {
  if (points >= 50000) return "Embajador";
  if (points >= 25000) return "Experto";
  if (points >= 10000) return "Analista";
  return "Explorador";
}

export function pointsToCredit(points: number) {
  return Math.floor(points / 1000) * 50;
}
