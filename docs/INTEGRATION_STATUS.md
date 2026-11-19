# SMKON — Status da integração

Mantido pela frente **Integração** (execução agendada de hora em hora). Branch de integração:
`feature/smkon-production-readiness`. Correções desta frente usam `fix/integration-*`.

**Última verificação:** 19/11/2026 ~18:40 UTC (execução 4) · commit `5ab7e7b` (Merge S6.1, PR #45)

## 1. CI da branch de integração (push)

| Commit | Run | Resultado |
|---|---|---|
| `5ab7e7b` Merge S6.1 CSP/logs (#45) | [#238](https://github.com/smklj/smkon/actions/runs/44584395330) | ✅ success |
| `9d253b5` Merge S14 detalhe da execução (#46) | [#235](https://github.com/smklj/smkon/actions/runs/44581463366) | ✅ success |
| `c22082f` Merge Integração execução 3 (#48) | [#220](https://github.com/smklj/smkon/actions/runs/44534611101) | ✅ success |

Nenhuma quebra de integração detectada; nenhuma correção de código `fix/integration-*` necessária nesta execução.

## 2. Validação local (Postgres 16 descartável, Node 22.23.5) — commit `5ab7e7b`

| Etapa | Resultado real |
|---|---|
| `npm ci` | ✅ 0 vulnerabilidades |
| `npm run typecheck` | ✅ sem erros |
| `npm run lint` | ✅ sem erros |
| `npm run test:unit` | ✅ 180/180 (0 falhas, 0 pulados) — eram 156 na execução 3 (+S14 #46, +S6.1 #45) |
| `npm run build` | ✅ |
| `npm run test:db` (19 migrations) | ✅ 17/17 arquivos de teste |

## 3. Migrations: repositório × staging × produção (comparação por nome)

Repositório (integração): 19 migrations, de `20261117183000_split_01_revenue_domains` a `20261119070000_workspace_members`
(sem mudança desde a execução 3).

| Migration | Integração | Staging `xoyasrizivadxnpmzzno` | Produção `hpplboyysmfcjsnjrdmw` |
|---|---|---|---|
| `split_01_revenue_domains` … `agent_claim_queue` (17) | ✅ | ✅ | ✅ |
| `20261119060000_agent_model_usage` (S14) | ✅ | ✅ (versão `20261119114718`) | ❌ falta 🔐 |
| `20261119070000_workspace_members` (S5.1) | ✅ | ❌ **falta** | ❌ falta 🔐 |
| `20261119110000_audience_consent` (S15, PR #47 draft) | ❌ | ⚠️ aplicada (versão `20261119132522`) | ❌ |
| `20261119120000_keyset_pagination_indexes` (S16, PR #49 draft) | ❌ | ❌ | ❌ |

**Falta no staging:** `workspace_members` (e, após os merges, `keyset_pagination_indexes` do S16).
**Falta na produção (🔐 Owner):** `agent_model_usage`, `workspace_members` (+ `audience_consent` e `keyset_pagination_indexes` após merge).
**Desvio conhecido:** `audience_consent` está no staging antes do merge do #47. O arquivo no PR não mudou desde
13:15 UTC (antes da aplicação às 13:25), portanto ainda coincide com o staging.

## 4. Pendências do S5.1 (desta frente)

- ⛔ **Aplicar `20261119070000_workspace_members` no staging** (autorizado pelo Owner em 19/11/2026) — **continua bloqueado**.
  Testes SQL passaram localmente antes da tentativa (17/17). Três tentativas (execuções 1, 3 e 4 de 19/11/2026):
  `apply_migration` do conector Supabase **pede confirmação interativa** e expira em 180 s sem resposta (execução agendada).
  **Nada foi aplicado** (conferido com `list_migrations` após a tentativa da execução 4). Não usamos `execute_sql` para
  contornar a confirmação. Para destravar (Owner): aprovar `apply_migration` do Supabase como "sempre permitir" para esta
  tarefa agendada, ou aplicar manualmente pelo SQL Editor do staging o conteúdo do arquivo (registrando o nome `workspace_members`).
- ⏳ Depois de aplicada: conferir grants/RLS de `user_active_workspace` e das 4 funções, rodar `get_advisors` (security e
  performance) e endurecer o E2E de admin (`tests/e2e/admin-finance.spec.mjs`, teste "Membros", que hoje aceita o aviso
  `20261119070000_workspace_members`) para exigir a lista de membros. Não endurecemos antes da aplicação para não quebrar o
  "Playwright · Staging" de todas as frentes.
- 🔐 Decisão do Owner (não alterar): `ensure_workspace` cria workspace vazio para usuário removido de todos os workspaces.

## 5. Quadro das frentes

| Frente | Etapa atual | PR aberto | CI do PR | Pendências | Autorizações do Owner |
|---|---|---|---|---|---|
| S14 (agentes) | ✅ **handoff** (`docs/S14_HANDOFF.md`, #46 mergeado) | — | ✅ | — | Produção de `agent_model_usage`; `SUPABASE_SECRET_KEY`/OIDC/AI Gateway na Vercel; Vercel Cron; gasto com modelo |
| S15 (CRM/LGPD) | Audiência e CRM com consentimento | #47 (draft, `feature/s15-audience-consent`) | ✅ typecheck/build, ✅ SQL, ✅ Playwright | Merge do #47; handoff | Produção de `audience_consent` |
| S16 (performance) | Etapas 1–3: diagnóstico, paginação por cursor, índices | #49 (draft, `feature/s16-keyset-pagination`) | ✅ typecheck/build, ✅ SQL (base `c22082f`, desatualizada) | Atualizar com a base; merge; staging da migration; handoff | Produção de `keyset_pagination_indexes` |
| S6.1 (CSP/logs) | ✅ **handoff** (`docs/S6_1_HANDOFF.md`, #45 mergeado) | — | ✅ | — | Destino externo de logs (serviço/segredo) |
| S4 (camada de domínio) | Não iniciada (sem branch `feature/s4-*`) | — | — | Tudo | — |
| S5.1 (membros) | ✅ concluída (#43) | — | ✅ | Staging + E2E (seção 4) | Produção da migration |
| Integração | Execução 4: CI e validação local verdes | este PR | — | Seção 4 (bloqueada por confirmação) | Liberar `apply_migration` no staging |

Handoffs finais: ✅ S14, ✅ S6.1 · pendentes: S15, S16, S4.

## 6. Autorizações necessárias para produção (acumulado)

1. Migrations na produção, em ordem: `20261119060000_agent_model_usage`, `20261119070000_workspace_members`
   (e `20261119110000_audience_consent` após merge do #47; `20261119120000_keyset_pagination_indexes` após merge do #49).
2. Merge de `feature/smkon-production-readiness` na `main` e promoção do deploy.
3. Variáveis/segredos (S14): `SUPABASE_SECRET_KEY` por ambiente, credencial OIDC/AI Gateway, `CRON_SECRET`, `AGENT_EXECUTOR_ENABLED`.
   (S6.1, opcional): `LOG_DRAIN_URL`/`LOG_DRAIN_TOKEN` — destino externo de logs (ver `docs/S6_1_HANDOFF.md`).
