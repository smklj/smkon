# SMKON — Status da integração

Mantido pela frente **Integração** (execução agendada de hora em hora). Branch de integração:
`feature/smkon-production-readiness`. Correções desta frente usam `fix/integration-*`.

**Última verificação:** 19/11/2026 ~19:30 UTC (execução 5) · commit `72942c0` (Merge S15, PR #47)

## 1. CI da branch de integração (push)

| Commit | Run | Resultado |
|---|---|---|
| `72942c0` Merge S15 audiência/CRM (#47) | [#251](https://github.com/smklj/smkon/actions/runs/44596546028) | ✅ success |
| `919b5ef` Merge S16 etapas 2b e 4 (#51) | [#248](https://github.com/smklj/smkon/actions/runs/44593980296) | ✅ success |
| `d96278e` Merge S16 etapas 1–3 e 5 (#49) | [#245](https://github.com/smklj/smkon/actions/runs/44590845115) | ✅ success |
| `495994a` Merge Integração execução 4 (#50) | [#244](https://github.com/smklj/smkon/actions/runs/44590025633) | ✅ success |

Nenhuma quebra de integração após os merges de S15 e S16; nenhuma correção de código `fix/integration-*` necessária.

## 2. Validação local (Postgres 16 descartável, Node 22.23.5) — commit `72942c0`

| Etapa | Resultado real |
|---|---|
| `npm ci` | ✅ 362 pacotes |
| `npm run typecheck` | ✅ sem erros |
| `npm run lint` | ✅ sem erros |
| `npm run test:unit` | ✅ 211/211 (0 falhas, 0 pulados) — eram 180 na execução 4 (+S15 #47, +S16 #49/#51) |
| `npm run build` | ✅ |
| `npm run test:db` (21 migrations) | ✅ 19/19 arquivos de teste (inclui `030_audience_consent`, `040_keyset_pagination_indexes`) |

## 3. Migrations: repositório × staging × produção (comparação por nome)

Repositório (integração): 21 migrations, de `20261117183000_split_01_revenue_domains` a `20261119120000_keyset_pagination_indexes`.

| Migration | Integração | Staging `xoyasrizivadxnpmzzno` | Produção `hpplboyysmfcjsnjrdmw` |
|---|---|---|---|
| `split_01_revenue_domains` … `agent_claim_queue` (17) | ✅ | ✅ | ✅ |
| `20261119060000_agent_model_usage` (S14) | ✅ | ✅ (versão `20261119114718`) | ❌ falta 🔐 |
| `20261119070000_workspace_members` (S5.1) | ✅ | ❌ **falta** | ❌ falta 🔐 |
| `20261119110000_audience_consent` (S15) | ✅ (#47 mergeado) | ✅ (versão `20261119132522`) | ❌ falta 🔐 |
| `20261119120000_keyset_pagination_indexes` (S16) | ✅ (#49 mergeado) | ❌ falta (aplicação é da frente S16, também bloqueada por confirmação) | ❌ falta 🔐 |

**Falta no staging:** `workspace_members`, `keyset_pagination_indexes`.
**Falta na produção (🔐 Owner):** `agent_model_usage`, `workspace_members`, `audience_consent`, `keyset_pagination_indexes`.
**Desvio resolvido:** `audience_consent` foi aplicada no staging antes do merge; o arquivo mergeado é idêntico ao de
`aa4b856` (13:15 UTC, anterior à aplicação), conferido com `git diff aa4b856 72942c0` (sem diferenças).

## 4. Pendências do S5.1 (desta frente)

- ⛔ **Aplicar `20261119070000_workspace_members` no staging** (autorizado pelo Owner em 19/11/2026) — **continua bloqueado**.
  Testes SQL passaram localmente antes da tentativa (19/19). Cinco tentativas (execuções 1, 3, 4 e 5 de 19/11/2026):
  `apply_migration` do conector Supabase **pede confirmação interativa** e expira em 180 s sem resposta (execução agendada).
  **Nada foi aplicado** (conferido com `list_migrations` após a tentativa da execução 5). Não usamos `execute_sql` para
  contornar a confirmação. Para destravar (Owner): aprovar `apply_migration` do Supabase como "sempre permitir" para esta
  tarefa agendada, ou aplicar manualmente pelo SQL Editor do staging o conteúdo do arquivo (registrando o nome `workspace_members`).
- ⏳ Depois de aplicada: conferir grants/RLS de `user_active_workspace` e das 4 funções, rodar `get_advisors` (security e
  performance) e endurecer o E2E de admin (`tests/e2e/admin-finance.spec.mjs`, teste "Membros", que hoje aceita o aviso
  `20261119070000_workspace_members`) para exigir a lista de membros. Não endurecemos antes da aplicação para não quebrar o
  "Playwright · Staging" de todas as frentes.
- 🔐 Decisão do Owner (não alterar): `ensure_workspace` cria workspace vazio para usuário removido de todos os workspaces.

## 5. Quadro das frentes

| Frente | Etapa atual | PR aberto | CI | Pendências | Autorizações do Owner |
|---|---|---|---|---|---|
| S14 (agentes) | ✅ **handoff** (`docs/S14_HANDOFF.md`) | — | ✅ | — | Produção de `agent_model_usage`; `SUPABASE_SECRET_KEY`/OIDC/AI Gateway na Vercel; Vercel Cron; gasto com modelo |
| S15 (CRM/LGPD) | ✅ **handoff** (`docs/S15_HANDOFF.md`, #47 mergeado) | — | ✅ | Contatos fictícios de E2E no staging (removíveis pela tela) | Produção de `audience_consent` |
| S16 (performance) | Etapas 1–5 mergeadas (#49, #51); falta 2c (paginação da audiência, agora desbloqueada) e 6 (handoff) | — | ✅ | Staging de `keyset_pagination_indexes` (bloqueado por confirmação); 2c; handoff | Produção de `keyset_pagination_indexes`; `LOAD_COOKIE` de usuário de teste (opcional) |
| S6.1 (CSP/logs) | ✅ **handoff** (`docs/S6_1_HANDOFF.md`) | — | ✅ | — | Destino externo de logs (serviço/segredo) |
| S4 (camada de domínio) | Não iniciada (sem branch `feature/s4-*`) | — | — | Tudo | — |
| S5.1 (membros) | ✅ concluída (#43) | — | ✅ | Staging + E2E (seção 4) | Produção da migration |
| Integração | Execução 5: CI e validação local verdes | este PR | — | Seção 4 (bloqueada por confirmação) | Liberar `apply_migration` no staging |

Handoffs finais: ✅ S14, ✅ S6.1, ✅ S15 · pendentes: S16, S4.

## 6. Autorizações necessárias para produção (acumulado)

1. Migrations na produção, em ordem: `20261119060000_agent_model_usage`, `20261119070000_workspace_members`,
   `20261119110000_audience_consent`, `20261119120000_keyset_pagination_indexes`.
2. Merge de `feature/smkon-production-readiness` na `main` e promoção do deploy.
3. Variáveis/segredos (S14): `SUPABASE_SECRET_KEY` por ambiente, credencial OIDC/AI Gateway, `CRON_SECRET`, `AGENT_EXECUTOR_ENABLED`.
   (S6.1, opcional): `LOG_DRAIN_URL`/`LOG_DRAIN_TOKEN` — destino externo de logs (ver `docs/S6_1_HANDOFF.md`).
4. Staging (já autorizado, falta só a confirmação da ferramenta): `workspace_members` e `keyset_pagination_indexes`.
