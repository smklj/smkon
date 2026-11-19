# S6.1 — CSP com nonce e destino externo de logs · Handoff

PR #45 (`feature/s6-1-csp-nonce-log-sink` → `feature/smkon-production-readiness`). Sem migrations e sem testes SQL (a frente não toca no banco). Plano e histórico de diagnóstico: `docs/S6_1_PROGRESS.md`.

## O que mudou

### CSP com nonce por requisição
- O Proxy (`src/proxy.ts` → `updateSession` em `src/lib/supabase/proxy.ts`) gera um nonce de 128 bits (Web Crypto, base64) a cada requisição.
- A política vai no cabeçalho **da requisição** encaminhada ao Next (o Next 16 extrai o `'nonce-…'` e o aplica aos seus scripts e `<style>`), junto com `x-nonce`, e no cabeçalho **de toda resposta** que sai do Proxy: páginas, rotas públicas, rota de máquina, redirects para `/login`, 401 JSON e 503 (Auth não configurado).
- Política (`contentSecurityPolicy` em `src/lib/http/security-headers.ts`):
  - `script-src 'self' 'nonce-…' https://vercel.live`: **sem `'unsafe-inline'`**. Também sem `'strict-dynamic'`, porque os chunks do Next vêm de `'self'`, não há carregador de terceiros, e `'strict-dynamic'` faria o navegador ignorar a allowlist de host. `'unsafe-eval'` entra só em desenvolvimento.
  - `style-src 'self' 'nonce-…'` (elementos `<style>` só com nonce) + `style-src-attr 'unsafe-inline'` (somente atributos `style=""` dos gráficos e acentos; eles não executam código e não aceitam nonce).
  - Demais diretivas mantidas do S6 (`connect-src` restrito à origem do Supabase do ambiente, `frame-ancestors 'none'`, `object-src 'none'`, `base-uri`/`form-action 'self'`).
- A CSP saiu do `next.config.ts`, para não haver duas políticas. Os outros headers (HSTS, XFO, nosniff, Referrer, Permissions, COOP) continuam lá.
- `src/app/layout.tsx` chama `connection()`, então toda página (inclusive a 404) é renderizada por requisição e recebe o nonce.
- `/api/agents/worker` continua sem exigir sessão; só passa a receber o cabeçalho CSP.

### Destino externo de logs
- `src/lib/observability/log.ts` agora tem a interface `LogSink`. O `consoleSink` continua sendo o padrão.
- `createHttpSink`: adaptador HTTP genérico, um POST JSON por registro.
  - Liga só com `LOG_DRAIN_URL`, e só aceita https.
  - `LOG_DRAIN_TOKEN` (opcional) é enviado como `Authorization: Bearer`.
  - Nível mínimo configurável (`LOG_DRAIN_LEVEL`, padrão `warn`).
  - Timeout curto (`LOG_DRAIN_TIMEOUT_MS`, padrão 1500 ms, máximo 5000), com `AbortController`.
- O envio não usa `await` e é registrado no `waitUntil` da Vercel quando ele existe, então nunca bloqueia a requisição. As falhas são engolidas sem chamar `log()`, o que evita recursão.
- O registro enviado é o mesmo do console, já passado pela redação de campos sensíveis existente (`redact`). Uma configuração inválida não derruba o app: o sistema volta a usar só o console.
- `setLogSinks()` existe para os testes.

## Variáveis de ambiente (documentadas em `.env.example`; nada foi configurado)
| Variável | Obrigatória | Descrição |
|---|---|---|
| `LOG_DRAIN_URL` | não | Endpoint HTTPS que recebe POST JSON. Sem ela, os logs vão só para o console/Vercel. |
| `LOG_DRAIN_TOKEN` | não | Bearer token do destino. É segredo e deve ser configurado só no servidor (Vercel, sem `NEXT_PUBLIC_`). |
| `LOG_DRAIN_LEVEL` | não | `info`, `warn` ou `error` (padrão `warn`). |
| `LOG_DRAIN_TIMEOUT_MS` | não | Timeout em ms (padrão 1500, máximo 5000). |

Nenhuma conta, chave ou destino foi criado. Qualquer serviço que aceite POST JSON por HTTPS serve: Axiom, Better Stack, Datadog HTTP intake ou um coletor próprio. Também dá para usar um Log Drain nativo da Vercel em vez deste adaptador.

## Arquivos
`src/lib/http/security-headers.ts`, `src/lib/supabase/proxy.ts`, `src/app/layout.tsx`, `next.config.ts`, `src/lib/observability/log.ts`, `.env.example`, `tests/unit/csp-nonce.test.ts` (novo), `tests/unit/log-sink.test.ts` (novo), `tests/unit/security-and-logging.test.ts`, `tests/e2e/csp.spec.mjs` (novo), `docs/S6_1_PROGRESS.md`, `docs/S6_1_HANDOFF.md`, linha do S6 em `docs/ROADMAP_SPLITS.md`.

## Testes (resultados reais)
- Local (19/11, após o merge da integração): `npm ci` OK, `typecheck` OK, `lint` OK, `test:unit` **180/180** (170 antes do merge do #46) e `build` OK, com todas as rotas dinâmicas (ƒ) exceto ícones estáticos. Desses testes, 6 são de CSP/nonce, 8 do sink e 7 de segurança/log.
- CI do PR #45 (head `c75b2c9`): "Typecheck, lint and build" ✅, "Database migrations and SQL tests" ✅.
- E2E no Preview com staging (run 44536307908, tentativa 2): **33/33 passaram**. Entre eles estão:
  - o `csp.spec.mjs`, que verifica cada módulo sem violações de CSP no console, scripts inline sempre com o nonce da resposta e scripts externos só da própria origem;
  - o teste de que o nonce muda a cada requisição;
  - o teste de que a rota de máquina do worker não exige sessão;
  - toda a navegação, produtos, Studio e mídia.

## Problemas encontrados
- A barra de comentários da Vercel (`vercel.live/_next-live/feedback/feedback.js`) injeta `<style>` sem o nosso nonce e só existe nos Previews. O header `x-vercel-skip-toolbar` não a desligou. No E2E, as violações vindas de `vercel.live` viram anotação; qualquer outra reprova. Em produção a barra não é injetada.
- Chunks carregados depois pelo runtime do Next não recebem nonce e são liberados por `'self'`. Isso é o esperado, porque não usamos `'strict-dynamic'`.
- Execuções do E2E desta frente foram canceladas pela fila global `e2e-staging`. O GitHub mantém só uma execução pendente por grupo, então um push de outra frente cancela a que está esperando. Foi preciso executar de novo manualmente. Essa questão fica para a frente de Integração, se ela quiser tratar.

## Pendências
- Opcional, depende do Owner: escolher e contratar um destino de logs e configurar `LOG_DRAIN_URL`/`LOG_DRAIN_TOKEN` na Vercel. Isso exige autorização, porque mexe em variáveis de ambiente, secrets e possível gasto.
- Opcional: `report-to`/`report-uri` para coletar violações de CSP em produção. Precisa de um endpoint de coleta, que pode reaproveitar o sink.
- Para produção, a mudança chega com o próximo merge da integração na `main`, que também precisa de autorização do Owner.
