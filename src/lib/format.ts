export function formatMoney(value: number | null | undefined, compact = false) {
  if (value === null || value === undefined) return "-";

  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: value < 10 ? 2 : compact ? 0 : 2
  }).format(value);
}

export function formatPercent(value: number | null | undefined) {
  if (value === null || value === undefined) return "-";
  return `${value > 0 ? "+" : ""}${value.toLocaleString("es-AR", {
    maximumFractionDigits: 2
  })}%`;
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) return "Sin actualizar";

  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

export function shortNumber(value: number | null | undefined) {
  if (value === null || value === undefined) return "-";
  return value.toLocaleString("es-AR", {
    maximumFractionDigits: value < 10 ? 2 : 0
  });
}
