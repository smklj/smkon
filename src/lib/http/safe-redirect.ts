/**
 * Aceita apenas caminhos internos ("/x?y"), evitando open redirect
 * ("//dominio", "https://...", "/\\dominio").
 */
export function safeNextPath(value: unknown, fallback = "/"): string {
  if (typeof value !== "string" || value.length === 0 || value.length > 2048) return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return fallback;
  try {
    const url = new URL(value, "http://smkon.local");
    if (url.origin !== "http://smkon.local") return fallback;
    return `${url.pathname}${url.search}`;
  } catch {
    return fallback;
  }
}
