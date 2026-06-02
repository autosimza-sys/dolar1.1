export type SeoPage = {
  slug: string;
  title: string;
  description: string;
  h1: string;
  rateCode?: string;
  updatedLabel?: string;
  keywords: string[];
  intro: string;
  bullets: string[];
  cta: string;
};

export const siteUrl = process.env.NEXT_PUBLIC_APP_URL || "https://dolarmza.com.ar";

export const seoPages: SeoPage[] = [
  {
    slug: "dolar-blue-mendoza",
    title: "Dolar blue Mendoza hoy",
    description: "Valor de referencia del dolar blue en Mendoza, con cotizaciones simples, datos locales y alertas financieras.",
    h1: "Dolar blue Mendoza",
    rateCode: "USD_BLUE_MENDOZA",
    keywords: ["dolar blue Mendoza", "dolar Mendoza", "precio dolar Mendoza", "dolar informal Mendoza"],
    intro:
      "Dolar MZA muestra un valor de referencia para el dolar blue en Mendoza con foco local, validacion de datos y lectura simple para usuarios comunes.",
    bullets: [
      "Seguimiento del mercado informal con criterio de referencia.",
      "Enfoque local en Mendoza y Argentina.",
      "CTA directo para crear alertas cuando el valor se mueva."
    ],
    cta: "Crear alerta de dolar blue"
  },
  {
    slug: "dolar-hoy-mendoza",
    title: "Dolar hoy Mendoza | Cotizacion y alertas",
    description: "Consulta el dolar hoy en Mendoza con valores de referencia, alertas por email y datos financieros utiles.",
    h1: "Dolar hoy en Mendoza",
    rateCode: "USD_BLUE",
    keywords: ["dolar hoy Mendoza", "cotizacion dolar Mendoza", "dolar MZA", "precio del dolar en Mendoza"],
    intro:
      "La pagina resume las cotizaciones principales para entender rapido que esta pasando con el dolar en Mendoza.",
    bullets: [
      "Valores principales sin tablas gigantes.",
      "Dolar oficial, blue, MEP y referencias locales.",
      "Alertas para no mirar el precio todo el dia."
    ],
    cta: "Ver alertas disponibles"
  },
  {
    slug: "dolar-oficial-mendoza",
    title: "Dolar oficial Mendoza | Referencia diaria",
    description: "Valor del dolar oficial para usuarios de Mendoza, explicado de forma simple y con enlaces a alertas.",
    h1: "Dolar oficial Mendoza",
    rateCode: "USD_OFICIAL",
    keywords: ["dolar oficial Mendoza", "dolar oficial hoy", "dolar Argentina Mendoza"],
    intro:
      "El dolar oficial funciona como referencia base para comparar brechas, viajes, bancos y otras cotizaciones.",
    bullets: [
      "Compra y venta promedio cuando hay fuentes disponibles.",
      "Comparacion natural contra blue y MEP.",
      "Util para entender brecha y movimientos regulados."
    ],
    cta: "Crear alerta de dolar oficial"
  },
  {
    slug: "dolar-mep",
    title: "Dolar MEP hoy",
    description: "Referencia del dolar MEP para comparar contra blue, oficial y oportunidades de mercado.",
    h1: "Dolar MEP",
    rateCode: "USD_MEP",
    keywords: ["dolar MEP", "dolar bolsa", "dolar MEP Mendoza", "dolar MEP hoy"],
    intro:
      "El dolar MEP es una referencia clave para usuarios que comparan precio, brecha y alternativas reguladas.",
    bullets: [
      "Referencia para comparar contra dolar blue.",
      "Puede activar alertas si baja de un precio.",
      "Pensado para decisiones simples, no para lenguaje tecnico."
    ],
    cta: "Crear alerta de MEP"
  },
  {
    slug: "dolar-turista",
    title: "Dolar turista y viajes",
    description: "Referencias para viajes, consumos y monedas como peso chileno, real y euro.",
    h1: "Dolar turista y viajes",
    rateCode: "CLP_BLUE",
    keywords: ["dolar turista", "moneda para viajar", "peso chileno Mendoza", "real Mendoza"],
    intro:
      "Antes de viajar conviene mirar monedas y tipos de cambio: a veces el cambio te come parte del presupuesto.",
    bullets: [
      "Referencias para Chile, Brasil y Europa.",
      "Alertas de movimientos fuertes.",
      "Lectura simple para decidir antes de comprar moneda."
    ],
    cta: "Crear alerta de viaje"
  },
  {
    slug: "dolar-cripto",
    title: "Dolar cripto y USDT | Dolar MZA",
    description: "Pagina preparada para referencias de dolar cripto y USDT dentro del ecosistema Dolar MZA.",
    h1: "Dolar cripto y USDT",
    keywords: ["dolar cripto", "USDT Argentina", "dolar cripto Mendoza", "dolar digital"],
    intro:
      "Dolar MZA deja preparada esta seccion para referencias de dolar cripto cuando existan fuentes estables y confiables.",
    bullets: [
      "No se publica una referencia si no hay fuente confiable.",
      "La prioridad es estabilidad y claridad.",
      "El admin puede activar esta cotizacion cuando este validada."
    ],
    cta: "Ver cotizaciones"
  },
  {
    slug: "euro-blue-mendoza",
    title: "Euro blue Mendoza | Referencia y alertas",
    description: "Referencia del euro blue para Mendoza, viajes y ahorro con alertas de movimientos fuertes.",
    h1: "Euro blue Mendoza",
    rateCode: "EUR_BLUE",
    keywords: ["euro blue Mendoza", "euro Mendoza", "euro blue hoy", "moneda europea Mendoza"],
    intro: "El euro blue sirve como referencia para viajes, ahorro y comparacion contra otros tipos de cambio.",
    bullets: ["Compra y venta simples.", "Alertas de movimiento fuerte.", "Lectura clara para usuarios no tecnicos."],
    cta: "Crear alerta de euro"
  },
  {
    slug: "real-mendoza",
    title: "Real en Mendoza | Cotizacion para viajar",
    description: "Referencia del real para usuarios de Mendoza que viajan a Brasil o comparan moneda extranjera.",
    h1: "Real en Mendoza",
    rateCode: "BRL_BLUE",
    keywords: ["real Mendoza", "real blue Mendoza", "real Brasil Mendoza", "moneda Brasil Mendoza"],
    intro: "El real es una de las monedas mas consultadas para viajes desde Mendoza a Brasil.",
    bullets: ["Referencia oficial y paralela.", "Alertas si se mueve fuerte.", "Enfoque practico para presupuesto de viaje."],
    cta: "Crear alerta de real"
  },
  {
    slug: "peso-chileno-mendoza",
    title: "Peso chileno Mendoza | Cotizacion para viajar a Chile",
    description: "Referencia del peso chileno para Mendoza, ideal para viajes, compras y presupuesto en Chile.",
    h1: "Peso chileno en Mendoza",
    rateCode: "CLP_BLUE",
    keywords: ["peso chileno Mendoza", "chileno blue Mendoza", "viajar a Chile Mendoza", "cotizacion peso chileno"],
    intro: "El peso chileno es una referencia clave para mendocinos que viajan a Chile o calculan gastos de frontera.",
    bullets: ["Valores simples de compra y venta.", "Alertas de movimiento fuerte.", "Pensado para no llegar tarde al cambio."],
    cta: "Crear alerta de peso chileno"
  },
  {
    slug: "tasas-plazo-fijo",
    title: "Tasas plazo fijo Argentina",
    description: "Referencia simple de tasas y plazo fijo para comparar contra dolar y rendimiento mensual estimado.",
    h1: "Tasas y plazo fijo",
    rateCode: "BCRA_RATE",
    keywords: ["tasa plazo fijo", "tasa BCRA", "plazo fijo Argentina", "dolar vs plazo fijo"],
    intro:
      "La tasa importa porque cambia la comparacion entre quedarse en pesos, hacer plazo fijo o mirar dolar.",
    bullets: [
      "Tasa BCRA y plazo fijo promedio.",
      "Rendimiento mensual estimado.",
      "Alertas cuando cambia la conveniencia."
    ],
    cta: "Crear alerta de tasa"
  },
  {
    slug: "riesgo-pais-argentina",
    title: "Riesgo pais Argentina",
    description: "Seccion preparada para seguir riesgo pais argentino junto a otras referencias financieras.",
    h1: "Riesgo pais Argentina",
    rateCode: "COUNTRY_RISK",
    keywords: ["riesgo pais Argentina", "riesgo pais hoy", "mercado argentino", "indicadores Argentina"],
    intro: "El riesgo pais ayuda a leer clima financiero y expectativa del mercado argentino.",
    bullets: ["Indicador complementario.", "Contexto para movimientos del dolar.", "Seguimiento dentro del panel financiero."],
    cta: "Ver indicadores"
  },
  {
    slug: "alertas-dolar-mendoza",
    title: "Alertas de dolar Mendoza | Email y WhatsApp",
    description: "Crea alertas de dolar en Mendoza para recibir avisos cuando el mercado se mueva.",
    h1: "Alertas de dolar en Mendoza",
    keywords: ["alerta dolar Mendoza", "alerta dolar blue", "alerta dolar por email", "alerta dolar por WhatsApp"],
    intro:
      "No vendemos cotizaciones. Te ayudamos a estar un paso antes con alertas claras cuando pasa algo importante.",
    bullets: [
      "Alertas por precio, porcentaje y movimientos relevantes.",
      "Email disponible y WhatsApp preparado para planes premium.",
      "Una alerta a tiempo puede valer mas que una suscripcion."
    ],
    cta: "Activar mis alertas"
  },
  {
    slug: "precio-dolar-mendoza",
    title: "Precio del dolar en Mendoza | Dolar MZA",
    description: "Precio de referencia del dolar en Mendoza, con enfoque local y explicacion simple.",
    h1: "Precio del dolar en Mendoza",
    rateCode: "USD_BLUE",
    keywords: ["precio dolar Mendoza", "precio del dolar en Mendoza", "dolar blue hoy Mendoza", "dolar hoy"],
    intro:
      "Dolar MZA ordena las referencias del dolar para que una persona comun entienda rapido compra, venta y movimiento.",
    bullets: ["Sin tablas eternas.", "Datos pensados primero para celular.", "Alertas para no llegar tarde."],
    cta: "Crear alerta"
  },
  {
    slug: "sobre-dolar-mza",
    title: "Sobre Dolar MZA | Plataforma financiera de Mendoza",
    description: "Que es Dolar MZA, como ayuda a usuarios de Mendoza y por que se enfoca en alertas financieras.",
    h1: "Sobre Dolar MZA",
    keywords: ["Dolar MZA", "dolar Mendoza", "plataforma financiera Mendoza"],
    intro:
      "Dolar MZA es una plataforma financiera digital enfocada en Mendoza y Argentina que muestra cotizaciones, valores de referencia, alertas y datos financieros utiles para usuarios locales.",
    bullets: [
      "Construimos valores de referencia, no una copia aislada.",
      "Validamos datos y priorizamos claridad.",
      "No vendemos cotizaciones. Te ayudamos a estar un paso antes."
    ],
    cta: "Conocer alertas"
  },
  {
    slug: "como-calculamos-cotizaciones",
    title: "Como calculamos las cotizaciones | Dolar MZA",
    description: "Metodologia simple de Dolar MZA: fuentes, validacion, promedios y criterio financiero propio.",
    h1: "Como calculamos las cotizaciones",
    keywords: ["como se calcula dolar Mendoza", "fuentes dolar", "cotizaciones promedio", "Dolar MZA metodologia"],
    intro:
      "La plataforma busca construir valores promedio de referencia usando fuentes, validacion automatica y criterio financiero propio.",
    bullets: [
      "Mercados oficiales: promedio real de compra y venta.",
      "Mercados paralelos: referencia central con spread controlado.",
      "Fuentes fuera de rango pueden quedar descartadas."
    ],
    cta: "Ver cotizaciones"
  },
  {
    slug: "preguntas-frecuentes",
    title: "Preguntas frecuentes | Dolar MZA",
    description: "Respuestas simples sobre cotizaciones, alertas, cuentas, Premium y comunidad en Dolar MZA.",
    h1: "Preguntas frecuentes",
    keywords: ["preguntas Dolar MZA", "ayuda dolar Mendoza", "alertas dolar preguntas"],
    intro: "Estas respuestas ayudan a entender que hace la app, como usar alertas y que significa cada referencia.",
    bullets: [
      "La app no funciona como casa de cambio.",
      "La comunidad es solo informativa y anonima.",
      "Las alertas sirven para enterarte antes de movimientos relevantes."
    ],
    cta: "Crear cuenta"
  },
  {
    slug: "alertas-financieras",
    title: "Alertas financieras | Dolar MZA",
    description: "Alertas financieras simples para dolar, tasas, viajes e indicadores importantes.",
    h1: "Alertas financieras",
    keywords: ["alertas financieras", "alertas dolar", "alertas tasas", "alertas moneda viaje"],
    intro:
      "Las alertas transforman una cotizacion en una decision: elegis una condicion y la app avisa cuando sucede.",
    bullets: [
      "Dolar blue supera o baja de un precio.",
      "MEP, brecha y tasas.",
      "Monedas para viajar y movimientos fuertes."
    ],
    cta: "Activar alertas"
  },
  {
    slug: "metodologia",
    title: "Metodologia | Dolar MZA",
    description: "Criterio de Dolar MZA para fuentes, datos, comunidad y valores de referencia.",
    h1: "Metodologia",
    keywords: ["metodologia Dolar MZA", "fuentes Dolar MZA", "dolar Mendoza referencia"],
    intro:
      "La metodologia prioriza estabilidad, lectura simple y utilidad para el usuario mendocino antes que ruido tecnico.",
    bullets: [
      "Multiples fuentes cuando estan disponibles.",
      "Fallback si una fuente falla.",
      "Reportes comunitarios anonimos solo como informacion estadistica."
    ],
    cta: "Ver como funciona"
  },
  {
    slug: "privacidad",
    title: "Politica de privacidad | Dolar MZA",
    description: "Politica de privacidad, cookies y uso de datos en Dolar MZA.",
    h1: "Politica de privacidad",
    keywords: ["privacidad Dolar MZA", "cookies Dolar MZA", "datos personales Dolar MZA"],
    intro:
      "Usamos datos minimos para operar la plataforma, medir visitas y mejorar alertas. No vendemos datos personales ni mostramos informacion privada publicamente.",
    bullets: [
      "Las cookies necesarias mantienen la app funcionando.",
      "La analitica mide visitas, paginas y dispositivo si aceptas.",
      "No almacenamos ubicacion exacta ni datos sensibles para analitica."
    ],
    cta: "Volver al inicio"
  }
];

export function findSeoPage(slug: string) {
  return seoPages.find((page) => page.slug === slug);
}
