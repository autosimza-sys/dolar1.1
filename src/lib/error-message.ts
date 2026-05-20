export function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message;

  if (typeof error === "object" && error !== null) {
    const candidate = error as {
      message?: unknown;
      details?: unknown;
      hint?: unknown;
      code?: unknown;
      error?: unknown;
    };

    const parts = [candidate.message, candidate.details, candidate.hint, candidate.code, candidate.error]
      .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
      .map((item) => item.trim());

    if (parts.length) return parts.join(" | ");
  }

  if (typeof error === "string" && error.trim()) return error;

  return fallback;
}
