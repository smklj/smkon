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


## 7. Auditoria atualizada — 20/11/2026 (consulta Supabase 21/11 UTC)

> Esta seção substitui os estados antigos das seções 3–5 quando houver divergência. O restante do documento é histórico da execução 5.

- **Staging:** 21/21 migrations presentes, incluindo `workspace_members`, `audience_consent` e `keyset_pagination_indexes`.
- **Produção:** 20 migrations presentes. Inclui `agent_model_usage`, `workspace_members` e `audience_consent`; falta somente `20261119120000_keyset_pagination_indexes` do conjunto atual. A origem da aplicação de `agent_model_usage` não foi estabelecida.
- **S4:** PRs #54 e #55 mergeados (etapas 1–2b). Restam 2c mídia, 2d financeiro, 2e tenancy, 2f audiência, 2g agentes e handoff. Como staging está em dia, a regeneração/comparação de tipos do Supabase pode ser retomada.
- **S11:** nenhum conector financeiro real ou handoff foi encontrado na árvore do commit consultado. Há placeholders de conexão e módulo de comissões. Não declarar integração operacional.
- **S14:** código integrado, mas não há evidência de chamada real ao AI Gateway. Migration de consumo `agent_model_usage` agora consta em produção; conferir a configuração efetiva de `SUPABASE_SECRET_KEY`, OIDC/API key, orçamento e cron sem revelar valores.
- **Segurança produção:** Advisors consultados em 21/11 UTC: 1 SECURITY DEFINER executável por anon (`rate_limit_consume`), 31 executáveis por authenticated, RLS sem política em `rate_limit_buckets` e leaked-password protection desativada. A tabela não mostrou grants diretos a anon/authenticated; função de rate limit tem `search_path=''`, allowlist de scopes e validação de subject. Revisar sem revogação em lote.
- **PR #56:** aberto; API GitHub retornou `mergeable=false`. Status check Vercel do commit consultado estava success, mas isso não autoriza merge nem prova Production.
- **Validações:** os números 238/238 unitários e 19/19 SQL vêm do corpo do PR #56; não foram reexecutados nesta auditoria.
- **Ações protegidas:** nenhuma migration de produção, alteração de Auth/segredos, merge em `main` ou deploy executado.
- **Plano detalhado:** `docs/RELEASE_AUDIT_S4_S11_S14_SECURITY.md`.


## 8. Decisão e plano S11 — 20/11/2026

- **Provedor inicial:** Mercado Livre.
- **Ambiente:** staging do SMKON, com usuários/dados de teste do ambiente de desenvolvedor do Mercado Livre quando disponíveis.
- **Modo inicial:** somente leitura e dry-run; nenhuma ação de escrita no marketplace.
- **Documento de execução:** [S11_HANDOFF.md](S11_HANDOFF.md).
- **Estado:** decisão registrada e plano definido; conector ainda não implementado nem operacionalmente validado.
- **Próxima etapa:** inspeção dos padrões de OAuth, ConnectionsPanel, tenancy e financeiro; adapter tipado + fixtures; testes de OAuth, paginação, idempotência, falhas e isolamento multi-tenant.
- **Não autorizado nesta decisão:** contas reais, secrets, sincronização recorrente, migrations aplicadas, custos pagos, merge em `main` ou deploy de produção.


## 9. S11 Mercado Livre — validação do banco descartável (21/11/2026 UTC)

- Branch: `feature/s11-mercado-livre-adapter`; PR #57 permanece Draft, base `feature/smkon-production-readiness`.
- Schema do fixture conferido contra `20261117183000_split_01_revenue_domains.sql` e `supabase/tests/_support/supabase_shim.sql`: colunas de `organizations`, `organization_members`, `source_connections` e `auth.users` correspondem ao schema usado pelo teste.
- Assinaturas das RPCs conferidas contra a migration `20261121130000_mercado_livre_credentials.sql`: claim(uuid, integer), save(uuid, bigint, uuid, jsonb, timestamptz), release(uuid, uuid).
- O teste comportamental em `supabase/tests/mercado_livre_credentials.test.sql` cobre lease exclusivo, segundo worker sem lease, rejeição de lease incorreto, CAS válido com incremento de versão, limpeza do lease, novo lease e proteção contra release obsoleto.
- Delimitador PL/pgSQL nomeado `$s11_lease_test$` foi relido e está balanceado.
- Workflow `.github/workflows/ci.yml` executa `bash scripts/test-db.sh shim` no job Database, usando PostgreSQL 17 descartável; também executa typecheck, lint, unit tests, build e audit de dependências no job Quality.
- **Resultado de execução do teste novo:** pendente de run GitHub Actions associado ao commit que contém o fixture corrigido. Revisão estática não equivale a execução aprovada.
- Preview Vercel do commit `e5ea42629ed76bf1454f7b4891aa373574894e5a`: READY em ambiente Preview; não é deploy de produção nem validação de OAuth.
- Nenhuma migration aplicada em Supabase hospedado; nenhuma credencial/secret configurada; nenhuma conta Mercado Livre conectada; nenhum merge ou deploy de produção.
- Próxima ação: aguardar o CI do head mais recente e registrar os jobs/resultado. Se houver falha, inspecionar logs, corrigir no mesmo branch e repetir. Só então considerar encerrada a validação de banco.
