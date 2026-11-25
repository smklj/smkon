/**
 * Headers de segurança.
 *
 * - `securityHeaders()`: headers fixos, aplicados a todas as respostas via next.config.ts.
 * - `contentSecurityPolicy({ nonce })`: CSP por requisição, montada no Proxy (src/proxy.ts)
 *   com um nonce novo a cada requisição. O Next.js lê o nonce do cabeçalho
 *   `Content-Security-Policy` da requisição e o aplica aos seus scripts e estilos inline.
 *
 * Decisões (docs/S6_1_PROGRESS.md):
 * - script-src sem 'unsafe-inline' e sem 'strict-dynamic': os chunks do Next vêm de 'self';
 *   'strict-dynamic' desligaria a allowlist de host (https://vercel.live, barra dos Previews).
 * - style-src: elementos <style> só com nonce; atributos style="" liberados em style-src-attr
 *   (usados em gráficos e acentos; não executam código e não aceitam nonce).
 */

type CspOptions = { nonce: string; supabaseUrl?: string; isDev?: boolean };

export const NONCE_HEADER = "x-nonce";
export const CSP_HEADER = "Content-Security-Policy";

const NONCE_PATTERN = /^[A-Za-z0-9+/]{16,}={0,2}$/;

/** Nonce imprevisível de 128 bits em base64 (Web Crypto: funciona no Proxy e no Node). */
export function generateNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function supabaseOrigins(supabaseUrl?: string): { http: string; ws: string } {
  let http = "https://*.supabase.co";
  if (supabaseUrl) {
    try {
      http = new URL(supabaseUrl).origin;
    } catch {
      // URL inválida: mantém o curinga do Supabase em vez de derrubar a requisição.
    }
  }
  return { http, ws: http.replace(/^https:/, "wss:").replace(/^http:/, "ws:") };
}

export function contentSecurityPolicy({ nonce, supabaseUrl, isDev = false }: CspOptions): string {
  if (!NONCE_PATTERN.test(nonce)) throw new Error("CSP nonce inválido.");
  const supabase = supabaseOrigins(supabaseUrl);
  const nonceSource = `'nonce-${nonce}'`;
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": ["'self'", nonceSource, ...(isDev ? ["'unsafe-eval'"] : []), "https://vercel.live"],
    "style-src": ["'self'", nonceSource],
    "style-src-attr": ["'unsafe-inline'"],
    // Mídia do workspace vem do Storage por URL assinada; imagens de catálogo externo (ex.: Shopee) usam HTTPS.
    "img-src": ["'self'", "data:", "blob:", supabase.http, "https:"],
    "media-src": ["'self'", "blob:", supabase.http],
    "font-src": ["'self'", "data:"],
    "connect-src": ["'self'", supabase.http, supabase.ws, "https://vercel.live", ...(isDev ? ["ws:"] : [])],
    "frame-src": ["https://vercel.live"],
    "frame-ancestors": ["'none'"],
    "form-action": ["'self'"],
    "base-uri": ["'self'"],
    "object-src": ["'none'"],
    "worker-src": ["'self'", "blob:"],
  };
  return Object.entries(directives)
    .map(([name, values]) => `${name} ${values.join(" ")}`)
    .join("; ");
}

export function securityHeaders(): Array<{ key: string; value: string }> {
  return [
    { key: "X-Frame-Options", value: "DENY" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()" },
    { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
    { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  ];
}
