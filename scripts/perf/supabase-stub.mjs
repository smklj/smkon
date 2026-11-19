#!/usr/bin/env node
/**
 * S16 · Supabase falso, local e sem dados reais, para medir o servidor Next autenticado
 * sem serviços externos: conta as chamadas que cada página faz à API de Auth e ao
 * PostgREST e responde com um usuário fixo, um workspace e listas vazias.
 *
 *   node scripts/perf/supabase-stub.mjs --port 54400
 *   NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54400 NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=stub npx next start
 *   LOAD_COOKIE="$(node scripts/perf/supabase-stub.mjs --print-cookie --port 54400)" node scripts/load-test.mjs ...
 *
 * GET /__stats devolve as contagens por rota (método + caminho); POST /__reset zera.
 * Só escuta em 127.0.0.1. O token é um JWT de teste sem assinatura válida: nunca é aceito
 * por um Supabase real.
 */
import http from "node:http";

const USER_ID = "00000000-0000-4000-8000-0000000000b1";
const ORG_ID = "10000000-0000-4000-8000-0000000000b1";

function arg(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  return index > -1 ? process.argv[index + 1] : fallback;
}

const b64url = (value) => Buffer.from(value).toString("base64url");

export function stubAccessToken(now = Math.floor(Date.now() / 1000)) {
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = b64url(JSON.stringify({ sub: USER_ID, role: "authenticated", aud: "authenticated", iat: now, exp: now + 24 * 3600, email: "bench@example.test" }));
  return `${header}.${payload}.${b64url("assinatura-de-teste")}`;
}

/** Cookie de sessão no formato do @supabase/ssr ("base64-" + JSON da sessão). */
export function stubSessionCookie() {
  const now = Math.floor(Date.now() / 1000);
  const session = {
    access_token: stubAccessToken(now),
    refresh_token: "stub-refresh",
    token_type: "bearer",
    expires_in: 24 * 3600,
    expires_at: now + 24 * 3600,
    user: { id: USER_ID, aud: "authenticated", role: "authenticated", email: "bench@example.test" },
  };
  // A chave do cookie usa o primeiro rótulo do host da URL do Supabase (127.0.0.1 → "127").
  return `sb-127-auth-token=base64-${b64url(JSON.stringify(session))}`;
}

const USER = { id: USER_ID, aud: "authenticated", role: "authenticated", email: "bench@example.test", app_metadata: {}, user_metadata: {}, created_at: "2026-11-01T00:00:00Z" };
const MEMBERSHIP = [{ organization_id: ORG_ID, role: "owner", created_at: "2026-11-01T00:00:00Z", organizations: { name: "Bench" } }];

function startServer(port) {
  const counts = new Map();
  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://stub");
    if (url.pathname === "/__stats") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(Object.fromEntries([...counts].sort())));
      return;
    }
    if (url.pathname === "/__reset") {
      counts.clear();
      res.writeHead(204).end();
      return;
    }
    const key = `${req.method} ${url.pathname}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
    req.resume();
    req.on("end", () => {
      const json = (status, body, headers = {}) => {
        res.writeHead(status, { "content-type": "application/json", ...headers });
        res.end(body === undefined ? "" : JSON.stringify(body));
      };
      if (url.pathname === "/auth/v1/user") return json(200, USER);
      if (url.pathname.startsWith("/auth/v1/")) return json(404, { error: "not_found" });
      if (url.pathname === "/rest/v1/organization_members") return json(200, MEMBERSHIP, { "content-range": "0-0/1" });
      if (url.pathname.startsWith("/rest/v1/")) {
        const wantsObject = (req.headers.accept ?? "").includes("vnd.pgrst.object");
        if (wantsObject) return json(406, { code: "PGRST116", message: "JSON object requested, multiple (or no) rows returned", details: "0 rows", hint: null });
        if (req.method === "HEAD") return json(200, undefined, { "content-range": "*/0" });
        if (url.pathname.startsWith("/rest/v1/rpc/")) return json(200, null);
        return json(200, [], { "content-range": "*/0" });
      }
      return json(404, { error: "not_found" });
    });
  });
  server.listen(port, "127.0.0.1", () => process.stderr.write(`supabase-stub em http://127.0.0.1:${port}\n`));
  return server;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const port = Number(arg("port", "54400"));
  if (process.argv.includes("--print-cookie")) process.stdout.write(stubSessionCookie());
  else startServer(port);
}
