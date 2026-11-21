import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseEnv } from "./env";
import { log } from "@/lib/observability/log";
import { CSP_HEADER, NONCE_HEADER, contentSecurityPolicy, generateNonce } from "@/lib/http/security-headers";

const PUBLIC_PATHS = new Set(["/login", "/favicon.ico", "/robots.txt", "/icon.svg", "/apple-icon.png"]);

function isPublicRoute(pathname: string): boolean {
  return (
    PUBLIC_PATHS.has(pathname) ||
    pathname.startsWith("/auth/") ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/brand/")
  );
}

import { isMachineRoute } from "./machine-routes";
export { isMachineRoute } from "./machine-routes";

function isApiRoute(pathname: string): boolean {
  return pathname === "/api" || pathname.startsWith("/api/");
}

/**
 * CSP por requisição (S6.1): o nonce vai no cabeçalho da requisição encaminhada ao Next, que o
 * aplica aos seus scripts e estilos inline, e no cabeçalho de toda resposta que sai daqui.
 */
type Csp = { nonce: string; policy: string };

function buildCsp(supabaseUrl?: string): Csp {
  const nonce = generateNonce();
  return {
    nonce,
    policy: contentSecurityPolicy({ nonce, supabaseUrl, isDev: process.env.NODE_ENV === "development" }),
  };
}

function withCsp<T extends NextResponse>(response: T, csp: Csp): T {
  response.headers.set(CSP_HEADER, csp.policy);
  return response;
}

/** Encaminha a requisição ao Next com o nonce. Lê os headers no momento da chamada (inclui cookies renovados). */
function forward(request: NextRequest, csp: Csp): NextResponse {
  const headers = new Headers(request.headers);
  headers.set(NONCE_HEADER, csp.nonce);
  headers.set(CSP_HEADER, csp.policy);
  return withCsp(NextResponse.next({ request: { headers } }), csp);
}

export async function updateSession(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const env = getSupabaseEnv();
  const csp = buildCsp(env?.url ?? process.env.NEXT_PUBLIC_SUPABASE_URL);

  // Fail-closed: sem configuração de Auth, nada além das rotas públicas é servido.
  if (!env) {
    if (isPublicRoute(pathname)) return forward(request, csp);
    log("error", "proxy", { code: "auth_not_configured" });
    return withCsp(
      isApiRoute(pathname)
        ? NextResponse.json({ error: "Serviço indisponível.", code: "auth_not_configured" }, { status: 503 })
        : new NextResponse("Serviço indisponível: autenticação não configurada.", { status: 503 }),
      csp,
    );
  }

  if (isMachineRoute(pathname)) return forward(request, csp);

  let response = forward(request, csp);

  const supabase = createServerClient(env.url, env.publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = forward(request, csp);
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
        Object.entries(headers).forEach(([name, value]) => {
          response.headers.set(name, value);
        });
      },
    },
  });

  // Validate JWT claims on the server; never authorize from getSession().
  const { data, error } = await supabase.auth.getClaims();
  const isAuthenticated = !error && Boolean(data?.claims?.sub);

  if (!isAuthenticated && !isPublicRoute(pathname)) {
    if (isApiRoute(pathname)) {
      return withCsp(NextResponse.json({ error: "Não autenticado.", code: "not_authenticated" }, { status: 401 }), csp);
    }
    const url = request.nextUrl.clone();
    const next = `${pathname}${request.nextUrl.search}`;
    url.pathname = "/login";
    url.search = next !== "/" ? `?next=${encodeURIComponent(next)}` : "";
    return withCsp(NextResponse.redirect(url), csp);
  }

  if (isAuthenticated && pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return withCsp(NextResponse.redirect(url), csp);
  }

  return response;
}
