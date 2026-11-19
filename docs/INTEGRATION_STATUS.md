# SMKON — Status da integração

Mantido pela frente **Integração** (execução agendada de hora em hora). Branch de integração:
`feature/smkon-production-readiness`. Correções desta frente usam `fix/integration-*`.

**Última verificação:** 19/11/2026 ~23:30 UTC (execução 6) · commit `a227ba8` (Merge S4 etapa 2b, PR #55)

## 1. CI da branch de integração (push)

| Commit | Run | Resultado |
|---|---|---|
| `a227ba8` Merge S4 etapa 2b (#55) | [#266](https://github.com/smklj/smkon/actions/runs/44636487861) | ✅ success |
| `db7fedc` Merge S4 etapas 1, 2 e 2a (#54) | [#261](https://github.com/smklj/smkon/actions/runs/44633165509) | ✅ success |
| `d1a1e15` Merge S16 etapas 2c e 6 (#53) | [#256](https://github.com/smklj/smkon/actions/runs/44602524544) | ✅ success |
| `2cb920e` Merge Integração execução 5 (#52) | [#255](https://github.com/smklj/smkon/actions/runs/44600995717) | ✅ success |

Nenhuma quebra de integração após os merges do S16 (handoff) e do S4 (etapas 1–2b); nenhuma correção de código necessária.

## 2. Validação local (Postgres 16 descartável, Node 22.23.5) — commit `a227ba8` + E2E endurecido

| Etapa | Resultado real |
|---|---|
| `npm ci` | ✅ |
| `npm run typecheck` | ✅ sem erros |
| `npm run lint` | ✅ sem erros |
| `npm run test:unit` | ✅ 238/238 (0 falhas, 0 pulados) — eram 211 na execução 5 (+S16 #53, +S4 #54/#55) |
| `npm run build` | ✅ |
| `npm run test:db` (21 migrations) | ✅ 19/19 arquivos de teste |

## 3. Migrations: repositório × staging × produção (comparação por nome)

Repositório (integração): 21 migrations, de `20261117183000_split_01_revenue_domains` a `20261119120000_keyset_pagination_indexes`.

| Migration | Integração | Staging `xoyasrizivadxnpmzzno` | Produção `hpplboyysmfcjsnjrdmw` |
|---|---|---|---|
| `split_01_revenue_domains` … `agent_claim_queue` (17) | ✅ | ✅ | ✅ |
| `20261119060000_agent_model_usage` (S14) | ✅ | ✅ (`20261119114718`) | ✅ (`20261119232518`) ⚠️ ver nota |
| `20261119070000_workspace_members` (S5.1) | ✅ | ✅ (`20261119232430`) | ❌ falta 🔐 |
| `20261119110000_audience_consent` (S15) | ✅ | ✅ (`20261119132522`) | ❌ falta 🔐 |
| `20261119120000_keyset_pagination_indexes` (S16) | ✅ | ✅ (`20261119232441`) | ❌ falta 🔐 |

**Staging em dia com o repositório** (21/21).
**Falta na produção (🔐 Owner):** `workspace_members`, `audience_consent`, `keyset_pagination_indexes`, nesta ordem.

⚠️ **Nota:** `agent_model_usage` apareceu na produção às 23:25 UTC de 19/11/2026. **Não foi aplicada por esta frente** e nenhum
documento da branch de integração registra a aplicação (origem a confirmar pelo Owner). Conferência somente leitura na produção:
`agent_model_usage` com RLS ligada, 1 política, sem `select` para `anon`; `agent_model_spend_since` sem `execute` para `anon`.
As versões no staging e na produção não seguem o timestamp do arquivo (comparação por nome, como nas execuções anteriores).

## 4. Pendências do S5.1 (desta frente)

- ✅ **`20261119070000_workspace_members` aplicada no staging** às 23:24 UTC (versão `20261119232430`). A aplicação não foi feita
  por esta execução (as 5 tentativas anteriores expiraram na confirmação interativa); a migration já constava em `list_migrations`.
  Conferido nesta execução (somente leitura):
  - `user_active_workspace`: RLS ligada; `authenticated` só com `SELECT`; `anon` sem privilégios; política
    "users read their own active workspace" (SELECT).
  - `set_active_workspace`, `list_workspace_members`, `change_member_role`, `remove_member`: `security definer`,
    `search_path=""`, `execute` para `authenticated`, **sem** `execute` para `anon`.
  - `keyset_pagination_indexes` (S16) também aplicada: `products.score_rank` e os 4 índices presentes.
- ✅ **`get_advisors`** (staging, 23:26 UTC): nada novo de nível ERROR. As 4 funções do S5.1 aparecem no aviso genérico
  `authenticated_security_definer_function_executable` (WARN), como as demais RPCs do projeto — intencional, cada função valida
  papel/membro internamente (coberto por `supabase/tests`). Achados preexistentes, não relacionados ao S5.1, registrados para o Owner:
  `rate_limit_consume` executável por `anon` (WARN; usado antes do login), `rate_limit_buckets` com RLS sem política (INFO, acesso
  só via função), proteção de senha vazada desligada no Auth (WARN, configuração de Auth 🔐), 4 FKs compostas sem índice de
  cobertura (INFO: `consent_events`, `data_subject_requests`, `media_licenses`, `product_evidence`) e índices ainda não usados (INFO).
- ✅ **E2E de admin endurecido** (`tests/e2e/admin-finance.spec.mjs`, teste "Membros"): agora exige a lista
  "Membros do workspace" com o próprio usuário e falha se o aviso `20261119070000_workspace_members` aparecer.
- 🔐 Decisão do Owner (não alterar): `ensure_workspace` cria workspace vazio para usuário removido de todos os workspaces.

## 5. Quadro das frentes

| Frente | Etapa atual | PR aberto | CI | Pendências | Autorizações do Owner |
|---|---|---|---|---|---|
| S14 (agentes) | ✅ **handoff** (`docs/S14_HANDOFF.md`) | — | ✅ | — | `SUPABASE_SECRET_KEY`/OIDC/AI Gateway na Vercel; Vercel Cron; gasto com modelo (migration já está na produção, ver nota da seção 3) |
| S15 (CRM/LGPD) | ✅ **handoff** (`docs/S15_HANDOFF.md`) | — | ✅ | Contatos fictícios de E2E no staging (removíveis pela tela) | Produção de `audience_consent` |
| S16 (performance) | ✅ **handoff** (`docs/S16_HANDOFF.md`, #53) | — | ✅ | Staging aplicado; falta E2E de paginação da API de produtos (sugerido no handoff) | Produção de `keyset_pagination_indexes`; `LOAD_COOKIE` (opcional) |
| S6.1 (CSP/logs) | ✅ **handoff** (`docs/S6_1_HANDOFF.md`) | — | ✅ | — | Destino externo de logs (serviço/segredo) |
| S4 (camada de domínio) | Etapas 1, 2, 2a, 2b mergeadas (#54, #55); faltam 2c–2g e 3 (handoff) | — | ✅ | 2c mídia, 2d financeiro, 2e tenancy, 2f audiência, 2g agentes, handoff; regerar tipos do Supabase (staging agora em dia) | — |
| S5.1 (membros) | ✅ concluída (#43); staging aplicado e E2E endurecido | — | ✅ | — | Produção da migration |
| Integração | Execução 6: CI e validação local verdes; S5.1 fechado no staging | este PR | — | — | Produção (seção 6) |

Handoffs finais: ✅ S14, ✅ S6.1, ✅ S15, ✅ S16 · pendente: **S4**.

## 6. Autorizações necessárias para produção (acumulado)

1. Migrations na produção, em ordem: `20261119070000_workspace_members`, `20261119110000_audience_consent`,
   `20261119120000_keyset_pagination_indexes` (`agent_model_usage` já está lá — confirmar a origem).
2. Merge de `feature/smkon-production-readiness` na `main` e promoção do deploy.
3. Variáveis/segredos (S14): `SUPABASE_SECRET_KEY` por ambiente, credencial OIDC/AI Gateway, `CRON_SECRET`, `AGENT_EXECUTOR_ENABLED`.
   (S6.1, opcional): `LOG_DRAIN_URL`/`LOG_DRAIN_TOKEN` — destino externo de logs (ver `docs/S6_1_HANDOFF.md`).
4. Auth (recomendado pelos advisors): ligar a proteção de senha vazada no staging e na produção.
