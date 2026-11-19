# S6.1 — CSP com nonce e destino externo de logs · Progresso

Branch: `feature/s6-1-csp-nonce-log-sink` → PR para `feature/smkon-production-readiness`.
Sem migrations (a frente não precisa de banco).

## Diagnóstico (19/11/2026)

**CSP atual** (`src/lib/http/security-headers.ts`, aplicada a tudo via `next.config.ts`):
`script-src 'self' 'unsafe-inline' https://vercel.live` e `style-src 'self' 'unsafe-inline'`. A política é estática (build), sem nonce.

**O que quebra sem `'unsafe-inline'`:**
- Scripts: o App Router injeta scripts inline (`self.__next_f.push(...)`, bootstrap do React). Sem nonce todos seriam bloqueados e a página não hidrata.
- Estilos: `next/font` injeta `<style>` inline; e há atributos `style="..."` renderizados no servidor (`AppShell` `--accent`, `DailyBars`, `StateBar`, ícones da visão geral). Atributos de estilo **não** aceitam nonce.
- Página estática: `/_not-found` era pré-renderizada (○) — sem requisição, sem nonce, scripts bloqueados.

**Estratégia para Next 16.4.6** (guia `node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md`):
1. O Proxy (`src/proxy.ts` → `updateSession`) gera um nonce aleatório (16 bytes, base64) por requisição.
2. A CSP com o nonce vai no cabeçalho **da requisição** encaminhada ao Next (o Next extrai `'nonce-…'` e o aplica aos seus scripts e `<style>`) e no cabeçalho **da resposta** (inclusive redirects, 401 e 503). `x-nonce` também é repassado para Server Components que precisarem.
3. A CSP sai do `next.config.ts` (evita duas políticas); os demais headers continuam lá.
4. Layout raiz chama `connection()` para que todas as páginas sejam dinâmicas (inclusive 404).
5. `script-src 'self' 'nonce-…' https://vercel.live` — **sem `'strict-dynamic'`**: os chunks do Next vêm de `'self'`, não há carregador de terceiros, e `'strict-dynamic'` faria o navegador ignorar a allowlist de host (quebrando a barra da Vercel nos Previews, que não recebe o nosso nonce). Sem `'unsafe-inline'`.
6. `style-src 'self' 'nonce-…'` (elementos `<style>` só com nonce) + `style-src-attr 'unsafe-inline'` (somente atributos `style=""`, necessários para gráficos e acentos; não executam código).
7. Rota de máquina `/api/agents/worker` continua sem sessão; só recebe o cabeçalho CSP.

**Logs:** `log.ts` escreve só no console. Plano: interface `LogSink`, console como padrão, adaptador HTTP genérico ativado só com `LOG_DRAIN_URL` (https), token opcional, nível mínimo, timeout curto, `fetch` sem `await` (registrado no `waitUntil` da Vercel quando existir), falhas nunca propagam e nunca chamam `log()` (sem recursão). O registro enviado é o mesmo já redigido.

## Checklist

- [x] 1. Plano (este arquivo)
- [~] 2. CSP com nonce no proxy + testes unitários + build + E2E sem erros de CSP — implementado; unit 162/162, typecheck, lint e build OK; verificação local com Chromium (/login e 404 → 12 scripts, todos com o nonce da resposta, 0 violações; nonce muda a cada requisição; worker responde pela própria rota). E2E no Preview, 1ª execução (run 44527391146): todas as violações vieram **só** da barra de comentários da Vercel (`vercel.live/_next-live/feedback/feedback.js` injeta `<style>` sem nonce); o app em si ficou limpo e os demais 6 specs passaram. O teste também travava em `networkidle` (conexão aberta da barra). Correção no spec: header oficial `x-vercel-skip-toolbar: 1` só para a origem do app e espera por hidratação/h1 em vez de `networkidle`. Reexecução: aguardando CI
- [x] 3. Destino externo de logs (sink HTTP) + testes unitários (8 em `tests/unit/log-sink.test.ts`) + variáveis em `.env.example`
- [ ] 4. Handoff `docs/S6_1_HANDOFF.md` + linha do S6 no ROADMAP
