# SMKON — Roadmap de execução em splits

**Origem:** Auditoria Técnica v1 (18/11/2026).
**Regra:** cada split vira uma branch `feature/<split>` e um PR. Nenhum merge em `main`, migration remota, deploy de produção ou mudança de configuração crítica sem autorização explícita do Owner.

Legenda de autorização: 🟢 pode executar · 🔐 exige autorização explícita

## Divisão de responsabilidades

| Claude Code | GPT / Codex |
|---|---|
| Implementa o código em branch isolada | Revisa o código de forma independente |
| Não executa testes | Executa testes unitários, de integração e build |
| Não faz push, merge nem deploy | Identifica bugs e regressões; revisa segurança e arquitetura |
| Entrega alterações, arquivos, justificativas técnicas e instruções de validação | Valida os critérios de aceite |
| Declara o que não conseguiu concluir | Prepara e executa o push **somente após autorização do Owner** |

Uma tarefa só é considerada concluída depois da validação independente. Estados de um split: `implementado` → `em validação` → `validado` → `push autorizado`.

## Base de integração

`feature/smkon-production-readiness` (PR #4) é a base. Os PRs #1, #2 e #3 estão contidos nela e devem ser fechados depois que o #4 for aceito 🔐.
As branches divergentes (`feature/admin-dashboard-mvp`, `feat/fila-status-machine`, `feature/product-intelligence-mvp`) ficam congeladas e serão arquivadas.

## P0 — Segurança, integridade e bloqueadores

| Split | Branch | Escopo | Autorização | Critério de conclusão |
|---|---|---|---|---|
| **S1** · ✅ validado (80/80 SQL, 14/14 unit, CI verde) · integrado via PR #5 | `feature/p0-security-integrity` | Proxy em `src/` e fail-closed; bootstrap atômico de workspace (`ensure_workspace`); aprovação da versão exata (`content_versions`, `content_approvals`, `approve_content`); `audit_log` append-only; ledger imutável; erros sem vazamento; CI com `npm ci` e job de banco | 🟢 | Testes SQL e CI verdes; build lista o Proxy; a API não aprova conteúdo diretamente |
| **S2** | — (configuração) | Proteção da `main`; secret scanning e push protection; Dependabot; Supabase Auth (Site URL, redirects, signup/convites); `NEXT_PUBLIC_SITE_URL` na Vercel; visibilidade do repositório | 🔐 | Configurações aplicadas e verificadas via API |
| **S3** · migrations base aplicadas no remoto pelo Owner; S3.1 (hardening + alinhamento) aguardando aplicação | `feature/s3-1-db-sync` | Aplicar migrations num **branch de banco** Supabase; preview Vercel apontando para ele; smoke test login → Studio → aprovação | 🔐 | Fluxo ponta a ponta funcionando no preview |

## P1 — Fundação

| Split | Escopo | Dependência |
|---|---|---|
| **S4** | Camada de domínio por módulo (`schema/service/repository`), validação de schema, tipos gerados do Supabase, atualização do toolchain de lint | S1 (+ rede para npm) |
| **S5** · ✅ convites em produção (`docs/S5_HANDOFF.md`); **S5.1** membros (listar, alterar papel, remover, último owner protegido) e seletor de organização implementados e testados (`docs/S5_1_HANDOFF.md`), migration `20261119070000` aguardando aplicação 🔐 | Tenancy completa: membros, convites, papéis, seletor de organização, RBAC central | S1, S3 |
| **S6** · ✅ em produção (`docs/S6_HANDOFF.md`); S6.1 ✅ CSP com nonce e sink de logs na integração (PR #45, `docs/S6_1_HANDOFF.md`); destino de logs aguarda escolha do Owner | Observabilidade (logs estruturados, rastreio de erros), headers de segurança (CSP/HSTS), rate limit | S1 |
| **S7** · ✅ build/CI verdes, integrado via PR #5 (validação visual manual pendente) | Design system com o kit de marca oficial (tokens, tipografia, ícones), app shell com sidebar, navegação responsiva | S1 |
| **S8** · ✅ em produção (`docs/S8_HANDOFF.md`); falta ingestão real e conciliação (S11) | Financeiro: estados completos de comissão (prevista → aprovada → liquidada/cancelada/estornada → paga), ingestão server-side, conciliação | S1, S3 |

## P2 — Integração dos módulos

| Split | Escopo |
|---|---|
| **S9** · ✅ em produção (`docs/S9_HANDOFF.md`); falta coleta automática | Product Intelligence persistente com evidências verificáveis e scoring baseado em evidência |
| **S10** · calendário, fila em dry-run, mídia no Storage e licenças implementados e testados (`docs/S10_HANDOFF.md`) | Assets (Storage), registro de licenças e direitos, calendário editorial e fila de publicação em dry-run |
| **S11** · 🟡 backend OAuth + snapshots PII-free idempotentes mergeados na integração; CI #412/E2E #193 verdes; índices FK aplicados e validados em staging via PR #59/CI #422; pendente: OAuth real, backfill/paginação e conciliação financeira; não operacional | Primeiro conector financeiro real (Mercado Livre ou Amazon), com ingestão e conciliação comprovadas 🔐 (contas/escopos) |
| **S12** · ✅ em produção (`docs/S12_HANDOFF.md`); migration `20261119010000` aplicada no staging e na produção | Dashboard com dados reais substituindo constantes |

## P3 — IA e automações

| Split | Escopo |
|---|---|
| **S13** · ✅ em produção (`docs/S13_HANDOFF.md`); migration `20261119020000` no staging e na produção; executor no S14 | Infra de jobs + `agent_runs`/`agent_steps` (Planner → Executor → Verifier), limites, kill switch, allowlist |
| **S14** · 🟡 correções de timeout/ledger reaplicadas em branch limpa `fix/s14-timeout-ledger-rebased-20261121-1415` sobre `79ff06be`; CI anterior 278/278 no SHA `41ee45e2`, E2E 36/36 apenas na base `99a9ac8`; CI/Preview/E2E da branch limpa pendentes. Staging: 110 runs killed, 0 steps/usage/grants/drafts; produção: zero dados S14. Migrations S14 têm nomes iguais, mas version IDs diferentes. OIDC/modelo configurados, sem `SUPABASE_SECRET_KEY`, sem budget externo, `CRON_SECRET` sensitive sem validação; nenhuma chamada real comprovada. Cron/worker ausentes em main. 🔐 | Geração de roteiro/legenda com evidência obrigatória; publicação via APIs oficiais só com hash aprovado 🔐 |

## Experiência (proposto)

| Split | Escopo |
|---|---|
| **S7.2** · fases A, B e C implementadas (`docs/S7_2_HANDOFF.md`); monocromático com cor só para estado | Movimento e feedback: tokens de motion, transições, `loading.tsx`/`error.tsx`, toasts, destaque de linha alterada, contagem nas métricas, sparklines em SVG, hierarquia visual |

## P4 — Escala e experiência

| Split | Escopo |
|---|---|
| **S15** · ✅ implementado e testado (`docs/S15_HANDOFF.md`): contatos com base legal, consentimento append-only, pedidos do titular com prazo e exclusão por anonimização; migration `20261119110000` no staging, produção aguardando autorização 🔐 | Audiência e CRM com consentimento (LGPD) |
| **S16** · ✅ implementado e testado (`docs/S16_HANDOFF.md`): consultas medidas com EXPLAIN ANALYZE em volume, paginação por cursor em produtos, conteúdos, mídia, agentes e audiência, índices medidos (`20261119120000`), cache seguro e teste de carga com p50/p95; staging aplicado e coberto por E2E de paginação, produção aguardando autorização 🔐 | Performance, paginação, cache, testes de carga |

## Bloqueios de ambiente conhecidos

- O ambiente do Claude não acessa o registro npm. Adicionar dependências (S4) exige que o validador gere o lockfile ou que o acesso de rede seja liberado.
- A validação final do schema acontece no branch de banco Supabase (S3), após autorização.


## QA e staging

- Supabase de staging `xoyasrizivadxnpmzzno` para todos os Previews e Development; Production segue em `hpplboyysmfcjsnjrdmw`.
- Testes de navegador (Playwright) rodam no Preview de cada commit (`docs/E2E_STAGING.md`).
- Toda migration nova é aplicada também no staging, antes do Preview que depende dela.


## Reconciliação S14 — 21/11/2026 13:10 BRT

- PR #71 está divergida (24 commits à frente/8 atrás da integração), apesar do body antigo indicar 24/0; não mergear.
- Integração está 128 ahead/6 behind de main; release isolada S14 está 34 ahead/0 behind de main, sem merge.
- CI #44917422154 success e Preview READY no SHA a834292; E2E de navegador desse deployment não comprovado.
- Staging: 108 runs killed, 0 steps/usage/grants/conteúdo vinculado. Produção: zero dados S14. Migrations S14 presentes nos dois bancos; RLS ativo nas tabelas auditadas.
- OIDC/provider/modelo e teto interno US$ 5 configurados; sem SUPABASE_SECRET_KEY, sem budget externo; CRON_SECRET sensitive presente mas não validado em comprimento. Gateway e ledger sem consumo; nenhuma chamada real comprovada.
- main não contém vercel.json nem a rota do worker; Cron S14 não ativo em Production.


## Atualização S14 — 21/11/2026 13:16 BRT

- PR #71 fechada sem merge por divergência (24 ahead/8 behind); PR #76 substitui com branch limpa (2 ahead/0 behind, mergeable=true, Draft).
- CI #44923342292 success: 278/278 testes unitários, typecheck, lint, build, audit e SQL.
- E2E #44922532633: 36/36 Playwright no Preview da integração SHA 99a9ac8616e07f85417f51772c175cc11a023712; não é execução do head da PR #76.
- Vercel bloqueou Preview do head 41ee45e2 por api-deployments-free-per-day.
- Staging 108 runs killed, sem steps/usage/grants/rascunhos ligados; produção zero dados S14. Migrations S14 nos dois ambientes; RLS ativo.
- OIDC/provider/modelo configurados, budget interno US$ 5, sem budget externo; SUPABASE_SECRET_KEY ausente; CRON_SECRET sensitive sem validação de tamanho; AGENT_EXECUTOR_ENABLED=true em Preview e Production.
- AI Gateway e ledger sem consumo, nenhuma chamada real comprovada; teto interno soft e sem reservation/outbox durável.
- main não contém vercel.json nem worker; Cron S14 não ativo em Production.


## Reconciliação S14 — 21/11/2026 14:05 BRT

PR #76 está diverged (5 ahead/2 behind) contra a base atual `79ff06be`; não mergear. Correções reaplicadas em `fix/s14-timeout-ledger-rebased-20261121-1415` a partir da base atual. CI anterior 278/278 no SHA `41ee45e2`; E2E 36/36 apenas na base `99a9ac8`; novo CI/Preview/E2E ainda pendentes. Staging: 110 runs killed, 0 steps/usage/grants/drafts; produção: zero dados S14. Migrations S14 têm nomes iguais, mas version IDs diferentes entre ambientes. Vercel: OIDC/modelo, budget interno US$ 5 e flag true em Preview/Production; `SUPABASE_SECRET_KEY` ausente, `CRON_SECRET` sensitive sem validação; AI Gateway sem budgets/uso; nenhuma chamada real comprovada. Worker/Cron não estão em main. Sem merge, alteração de produção, migration, secret, grant ou chamada paga.


## Rebase adicional S14 — 21/11/2026 14:15 BRT

A integração avançou cinco commits de `79ff06be` para `2455806c` por alterações de S4/audiência sem sobreposição com o código/testes S14. Correções reaplicadas em `fix/s14-timeout-ledger-rebased-20261121-1415` sobre o head atual; CI/Preview/E2E desta branch pendentes. PR #76 segue divergida e não deve ser mergeada.
