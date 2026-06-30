export function formatTicketNumber(value: number | string) {
  return String(value).padStart(4, "0").slice(-4);
}
