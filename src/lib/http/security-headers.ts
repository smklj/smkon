/**
 * Headers de segurança aplicados a todas as respostas (via next.config.ts).
 *
 * CSP de base, compatível com os scripts inline do App Router: bloqueia scripts e
 * conexões de terceiros, iframes da aplicação em outros sites, plugins e troca de
 * <base>. Evolução prevista: CSP com nonce (exige renderização dinâmica em todas as rotas).
 */

type Options = { supabaseUrl?: string; isDev?: boolean };

export function contentSecurityPolicy({ supabaseUrl, isDev = false }: Options = {}): string {
  const supabase = supabaseUrl ? new URL(supabaseUrl).origin : "https://*.supabase.co";
  const supabaseWs = supabase.replace(/^https:/, "wss:");
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": ["'self'", "'unsafe-inline'", ...(isDev ? ["'unsafe-eval'"] : []), "https://vercel.live"],
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "data:", "blob:"],
    "font-src": ["'self'", "data:"],
    "connect-src": ["'self'", supabase, supabaseWs, "https://vercel.live", ...(isDev ? ["ws:"] : [])],
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

export function securityHeaders(options: Options = {}): Array<{ key: string; value: string }> {
  return [
    { key: "Content-Security-Policy", value: contentSecurityPolicy(options) },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()" },
    { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
    { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  ];
}
