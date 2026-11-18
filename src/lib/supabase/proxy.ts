import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseEnv } from "./env";
import { log } from "@/lib/observability/log";

const PUBLIC_PATHS = new Set(["/login", "/favicon.ico", "/robots.txt", "/icon.svg", "/apple-icon.png"]);

function isPublicRoute(pathname: string): boolean {
  return (
    PUBLIC_PATHS.has(pathname) ||
    pathname.startsWith("/auth/") ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/brand/")
  );
}

function isApiRoute(pathname: string): boolean {
  return pathname === "/api" || pathname.startsWith("/api/");
}

export async function updateSession(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const env = getSupabaseEnv();

  // Fail-closed: sem configuração de Auth, nada além das rotas públicas é servido.
  if (!env) {
    if (isPublicRoute(pathname)) return NextResponse.next({ request });
    log("error", "proxy", { code: "auth_not_configured" });
    return isApiRoute(pathname)
      ? NextResponse.json({ error: "Serviço indisponível.", code: "auth_not_configured" }, { status: 503 })
      : new NextResponse("Serviço indisponível: autenticação não configurada.", { status: 503 });
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(env.url, env.publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
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
      return NextResponse.json({ error: "Não autenticado.", code: "not_authenticated" }, { status: 401 });
    }
    const url = request.nextUrl.clone();
    const next = `${pathname}${request.nextUrl.search}`;
    url.pathname = "/login";
    url.search = next !== "/" ? `?next=${encodeURIComponent(next)}` : "";
    return NextResponse.redirect(url);
  }

  if (isAuthenticated && pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}
