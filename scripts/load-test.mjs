#!/usr/bin/env node
/**
 * S16 · Teste de carga simples, sem dependências nem serviços externos.
 *
 * Dispara requisições HTTP com concorrência fixa contra um alvo configurável e
 * relata, por rota: requisições, erros, status, req/s e latência p50/p95/p99/máx.
 *
 *   node scripts/load-test.mjs --target http://localhost:3000 \
 *     --paths /login,/api/products --concurrency 10 --requests 500
 *
 * Opções (ou variáveis de ambiente):
 *   --target       LOAD_TARGET        URL base (padrão http://localhost:3000)
 *   --paths        LOAD_PATHS         rotas separadas por vírgula (padrão /login)
 *   --concurrency  LOAD_CONCURRENCY   requisições simultâneas por rota (padrão 10)
 *   --requests     LOAD_REQUESTS      total de requisições por rota (padrão 200)
 *   --warmup       LOAD_WARMUP        requisições de aquecimento por rota, fora do relatório (padrão 10)
 *   --timeout      LOAD_TIMEOUT_MS    timeout por requisição em ms (padrão 10000)
 *   --json                            imprime o relatório em JSON em vez de tabela
 *   LOAD_COOKIE    (só ambiente)      cabeçalho Cookie para rotas autenticadas. Nunca é impresso.
 *
 * Segurança: o script recusa alvos de produção conhecidos (domínio próprio e
 * *.vercel.app sem LOAD_ALLOW_REMOTE=1). Use só em ambiente local ou de preview.
 */

const DEFAULTS = { target: "http://localhost:3000", paths: "/login", concurrency: 10, requests: 200, warmup: 10, timeout: 10000 };

/**
 * @param {string[]} argv
 * @param {Record<string, string | undefined>} [env]
 */
export function parseArgs(argv, env = process.env) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--json") args.json = true;
    else if (arg.startsWith("--")) args[arg.slice(2)] = argv[++i];
  }
  const pick = (key, envKey) => args[key] ?? env[envKey] ?? DEFAULTS[key];
  const positive = (value, name) => {
    const number = Number(value);
    if (!Number.isInteger(number) || number < 1) throw new Error(`${name} deve ser inteiro positivo`);
    return number;
  };
  const target = String(pick("target", "LOAD_TARGET")).replace(/\/+$/, "");
  const url = new URL(target);
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("target deve ser http ou https");
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (!local && env.LOAD_ALLOW_REMOTE !== "1") {
    throw new Error("alvo remoto recusado: use LOAD_ALLOW_REMOTE=1 somente para preview/staging, nunca produção");
  }
  const paths = String(pick("paths", "LOAD_PATHS"))
    .split(",")
    .map((path) => path.trim())
    .filter(Boolean);
  if (paths.length === 0 || paths.some((path) => !path.startsWith("/"))) throw new Error("paths devem começar com /");
  return {
    target,
    paths,
    concurrency: positive(pick("concurrency", "LOAD_CONCURRENCY"), "concurrency"),
    requests: positive(pick("requests", "LOAD_REQUESTS"), "requests"),
    warmup: Number(pick("warmup", "LOAD_WARMUP")) || 0,
    timeout: positive(pick("timeout", "LOAD_TIMEOUT_MS"), "timeout"),
    json: Boolean(args.json),
  };
}

/** Percentil pelo método nearest-rank sobre amostras já ordenadas. */
export function percentile(sorted, p) {
  if (sorted.length === 0) return null;
  const rank = Math.ceil((p / 100) * sorted.length);
  return sorted[Math.min(sorted.length, Math.max(1, rank)) - 1];
}

export function summarize(path, samples, wallMs) {
  const durations = samples.map((sample) => sample.ms).sort((a, b) => a - b);
  const statuses = {};
  let errors = 0;
  for (const sample of samples) {
    const key = sample.status ?? sample.error ?? "erro";
    statuses[key] = (statuses[key] ?? 0) + 1;
    if (sample.status === undefined || sample.status >= 500) errors += 1;
  }
  const round = (value) => (value === null ? null : Math.round(value * 10) / 10);
  return {
    path,
    requests: samples.length,
    errors,
    statuses,
    rps: round(samples.length / (wallMs / 1000)),
    p50: round(percentile(durations, 50)),
    p95: round(percentile(durations, 95)),
    p99: round(percentile(durations, 99)),
    max: round(durations.at(-1) ?? null),
  };
}

async function hit(url, timeout, cookie) {
  const started = performance.now();
  try {
    const response = await fetch(url, {
      redirect: "manual",
      headers: cookie ? { cookie } : {},
      signal: AbortSignal.timeout(timeout),
    });
    await response.arrayBuffer(); // mede até o fim do corpo, não só os cabeçalhos
    return { ms: performance.now() - started, status: response.status };
  } catch (error) {
    return { ms: performance.now() - started, error: error?.name === "TimeoutError" ? "timeout" : "falha_rede" };
  }
}

async function run(url, total, concurrency, timeout, cookie) {
  const samples = [];
  let next = 0;
  const worker = async () => {
    while (next < total) {
      next += 1;
      samples.push(await hit(url, timeout, cookie));
    }
  };
  const started = performance.now();
  await Promise.all(Array.from({ length: Math.min(concurrency, total) }, worker));
  return { samples, wallMs: performance.now() - started };
}

function printTable(config, results) {
  console.log(`Alvo: ${config.target} · concorrência ${config.concurrency} · ${config.requests} req/rota · aquecimento ${config.warmup}`);
  console.log("| rota | req | erros | status | req/s | p50 ms | p95 ms | p99 ms | máx ms |");
  console.log("|---|---|---|---|---|---|---|---|---|");
  for (const r of results) {
    const statuses = Object.entries(r.statuses).map(([key, count]) => `${key}×${count}`).join(" ");
    console.log(`| ${r.path} | ${r.requests} | ${r.errors} | ${statuses} | ${r.rps} | ${r.p50} | ${r.p95} | ${r.p99} | ${r.max} |`);
  }
}

async function main() {
  const config = parseArgs(process.argv.slice(2));
  const cookie = process.env.LOAD_COOKIE || "";
  const results = [];
  for (const path of config.paths) {
    const url = config.target + path;
    if (config.warmup > 0) await run(url, config.warmup, Math.min(config.concurrency, config.warmup), config.timeout, cookie);
    const { samples, wallMs } = await run(url, config.requests, config.concurrency, config.timeout, cookie);
    results.push(summarize(path, samples, wallMs));
  }
  if (config.json) console.log(JSON.stringify({ target: config.target, concurrency: config.concurrency, results }, null, 2));
  else printTable(config, results);
  if (results.some((result) => result.errors > 0)) process.exitCode = 1;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(`load-test: ${error.message}`);
    process.exitCode = 2;
  });
}
