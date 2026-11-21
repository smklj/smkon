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
| **S11** · 🟡 backend OAuth + snapshots PII-free idempotentes mergeados; paginação manual, cursor durável com lease e guarda de snapshot fora de ordem no PR #60 (Draft); CI #475 verde, cinco testes SQL revalidados e migrations S11 em Staging (28/28); Preview do head atual bloqueado por quota Vercel; pendente: OAuth real, divisão automática de janelas, sync incremental e conciliação financeira; não operacional | Primeiro conector financeiro real (Mercado Livre ou Amazon), com ingestão e conciliação comprovadas 🔐 (contas/escopos) |
| **S12** · ✅ em produção (`docs/S12_HANDOFF.md`); migration `20261119010000` aplicada no staging e na produção | Dashboard com dados reais substituindo constantes |

## P3 — IA e automações

| Split | Escopo |
|---|---|
| **S13** · ✅ em produção (`docs/S13_HANDOFF.md`); migration `20261119020000` no staging e na produção; executor no S14 | Infra de jobs + `agent_runs`/`agent_steps` (Planner → Executor → Verifier), limites, kill switch, allowlist |
| **S14** · ✅ executor integrado (`docs/S14_HANDOFF.md`); migrations `20261119040000`/`050000` no staging e na produção, `060000` só no staging; falta `SUPABASE_SECRET_KEY`, crédito no AI Gateway e merge na `main` 🔐 | Geração de roteiro/legenda com evidência obrigatória; publicação via APIs oficiais só com hash aprovado 🔐 |

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


---

## Atualização de fechamento S11 — 21/11/2026

Status verificado diretamente no GitHub, Supabase e Vercel nesta rodada:

- PR #57: fechado e mergeado por squash em `feature/smkon-production-readiness`, merge commit `8c73cbc`. Não repetir.
- PR #60: aberto, Draft, base `feature/smkon-production-readiness`; head documental atual `6099b174402836c2474014db67327d4fa14ffdf5`. Head de código validado pelo CI #546: `36e135cb2ac757125bb543ea9319fe9f9e7ff869`.
- Comparação PR #60/base: 89 commits à frente, 18 atrás. Divergência exige reconciliação por arquivo; não rebasear/mergear automaticamente.
- CI #546: ambos os jobs (Quality e Database/SQL) passaram no head de código `36e135c`. O commit documental posterior ainda não tem execução CI identificada.
- Staging: projeto `xoyasrizivadxnpmzzno`, ACTIVE_HEALTHY, 29 migrations. Produção: `hpplboyysmfcjsnjrdmw`, ACTIVE_HEALTHY, 20 migrations.
- Preview para os SHAs `36e135c` e `6099b17`: nenhum deployment encontrado. E2E do head atual não comprovado.
- A validação fail-closed da resposta `GET /orders/search`, persistência idempotente e checkpoint durável estão no código. O limite de offset 10.000 permanece; divisão automática de janelas e sync incremental continuam pendentes.
- ACL/RLS S11 foi verificado anteriormente em Staging; a consulta desta rodada confirmou estado/migrations, não repetiu a auditoria de grants.
- Produção permanece sem alterações. Não executar migration repair, `db push`, deploy ou promoção da branch de integração enquanto a divergência, Preview/E2E, backup e plano de release isolado não forem resolvidos.
- A homologação com conta real/OAuth será feita pelo Owner posteriormente; não é critério para a implementação técnica desta rodada.
