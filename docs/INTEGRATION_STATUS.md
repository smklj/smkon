## Estado de integração S14 — 22/11/2026 07:02 BRT

- GitHub: main 84afe632; PR #113 aberta, Draft, mergeable, 29 commits ahead/0 behind; HEAD e12ee6f. Compare confirma cinco arquivos docs-only. Única PR aberta.
- Splits #35–#42 e #46 merged; #82/#97 merged; #102 fechada sem merge. Branch feature/smkon-production-readiness diverged 2/36; release/s14-mainline-integration-20261121 diverged 34/289 e contém código antigo; não promover.
- CI #45005652099 no HEAD exato: 2/2 jobs success, 418/418 unit tests; typecheck/lint/audit/build aprovados; SQL/migrations job success, 20 arquivos SQL distintos listados nos logs.
- E2E deployment_status #45005672517: Playwright · Staging success, 36/36 no Preview exato e12ee6f; artifact #14747642548. PR-run #45005652053 cancelado/skipped, sem alterar o resultado do deployment_status.
- Preview dpl_RTBXRFjKSXqY2zgyb8MgpfVe9mFt READY. Production dpl_3RdCGJ2THbYE9aajDZGgGzwWTUnV READY na main 84afe632.
- Cron Production: /api/agents/worker, 17 11 UTC = 08:17 BRT. Runtime logs de Production nos últimos 30 min: nenhum registro. Às 07:02 BRT, próxima execução ainda futura.
- Vercel env metadata decrypt=false: SUPABASE_SECRET_KEY ausente em Preview/Production; CRON_SECRET Sensitive separado; AGENT_EXECUTOR_ENABLED=true; provider vercel-ai-gateway; auth oidc; modelo anthropic/claude-haiku-5.5; teto interno US$ 5. Nenhum valor sensitive lido; formato de CRON_SECRET não certificado.
- Staging: 158 runs, todas killed; 0 steps/grants/usage/linked content; kill_switch=false, 500 runs/dia, 12 steps/run. Production: zero dados S14.
- agent_model_usage: 0 linhas/tokens/custo nos dois bancos. RLS 6/6; 9 policies; 19 funções agent_*; EXECUTE anon=0, authenticated=6, service_role=12.
- Migrations: 31 nomes correspondentes, 0/31 version IDs coincidentes; não fazer repair/db push sem reconciliação formal.
- AI Gateway 7d: 0 requests/tokens/custo; budgets project/default e rules ausentes; catálogo contém anthropic/claude-haiku-5.5. Nenhuma chamada real comprovada.
- Gate: chave service exclusiva de staging, grants mínimos, budget externo isolado, prova OIDC e validação segura de CRON_SECRET. Sem esses itens, não executar operations_review real.
- Sem merge, alteração de main/Production, migration remota, secret, grant, budget ou chamada paga.

# SMKON — Status da integração

Mantido pela frente **Integração** (execução agendada de hora em hora). Branch de integração:
`feature/smkon-production-readiness`. Correções desta frente usam `fix/integration-*`.

**Última verificação:** 21/11/2026 ~19:25 UTC (execução 13) · commit `96580f3` (Frente B, push direto)

## 0. Quadro atual — execução 13 (21/11/2026 ~19:25 UTC)

> Esta seção é o estado vigente. As seções 1–6 são o histórico da execução 5; as seções 7+ são auditorias S11 de 20–21/11.

**Base verificada:** `96580f3`. Desde a execução 12 entraram: #70 (S17 hub de conectores, com S18 Hotmart e S19
Metricool), #82 (S14 timeout/ledger — substitui o #78), #60 (S11 paginação histórica) e `96580f3` (Frente B:
reconciliação/desconexão/ledger do Mercado Livre — **commit direto na branch de integração, sem PR**).

### CI da integração (push)
- Último run: [CI #608](https://github.com/smklj/smkon/actions/runs/44940668272) em `96580f3` — ✅ success.
  [#607](https://github.com/smklj/smkon/actions/runs/44940196474) (`aa27579`, #82) ✅; #606 (`190b352`, #70) cancelado por concorrência.

### Validação local (Postgres 16 descartável) — `96580f3`
| Etapa | Resultado real |
|---|---|
| `npm ci` | ✅ |
| `npm run typecheck` | ✅ |
| `npm run lint` | ✅ |
| `npm run test:unit` | ✅ 341/341 (0 falhas, 0 pulados) — eram 285 |
| `npm run build` | ✅ |
| `npm run test:db` (31 migrations) | ✅ 28/28 arquivos de teste |

O teste intermitente de timeout do S14 (execução 12) foi corrigido pelo #82.

### 🔧 Conflito semântico corrigido nesta execução — versões de migration duplicadas (PR `fix/integration-run13-migration-versions`)
Após os merges de #60 e #70 havia **duas versões repetidas** em `supabase/migrations`:
- `20261121180000`: `integration_hub` (S17) **e** `mercado_livre_order_sync_state` (S11);
- `20261121200000`: `metricool_credentials` (S19) **e** `mercado_livre_order_versioning` (S11).

O CI não detectava (o `test:db` aplica os arquivos por nome completo), mas o Supabase CLI usa a versão como chave
primária de `schema_migrations`: `supabase db push`/`db reset` falhariam, e a ordem relativa ficava ambígua.
Correção (só renomeação, conteúdo idêntico — `git diff -M` 100%):
- `20261121180000_mercado_livre_order_sync_state.sql` → `20261121171000_mercado_livre_order_sync_state.sql`
- `20261121200000_mercado_livre_order_versioning.sql` → `20261121172000_mercado_livre_order_versioning.sql`

A nova ordem do repositório é exatamente a ordem em que o staging aplicou (fk_indexes → order_sync_state →
order_versioning → integration_hub → hotmart_webhook → metricool_credentials). Nenhum banco remoto foi alterado
(staging e produção registram versões próprias; comparação é por nome). `scripts/test-db.sh` passou a **falhar se
houver versões duplicadas** (guarda testada com um arquivo duplicado temporário: sai com código 1).
⚠️ Frentes S11/S19: ao continuar nesses arquivos, usem os nomes novos.

### Migrations (comparação por nome; `list_migrations` em 21/11 ~19:20 UTC)
- Repositório (integração): **31** migrations, até `20261121200000_metricool_credentials`.
- **Staging** (`xoyasrizivadxnpmzzno`): **31** — idêntico por nome ao repositório. ✅ Desvio da execução 12 resolvido
  (#60 e #70 mergeados). `hotmart_webhook` (`20261121184427`) e `metricool_credentials` (`20261121185150`) foram aplicadas
  no staging por outra frente ~30 min antes do merge do #70.
- **Falta no staging:** nada.
- **Produção** (`hpplboyysmfcjsnjrdmw`): 20 (sem mudança). Faltam (🔐 Owner), nesta ordem:
  1. `20261119120000_keyset_pagination_indexes`
  2. `20261121130000_mercado_livre_credentials`
  3. `20261121140000_mercado_livre_oauth_attempts`
  4. `20261121150000_mercado_livre_order_sync`
  5. `20261121160000_mercado_livre_oauth_atomic_completion`
  6. `20261121170000_mercado_livre_fk_indexes`
  7. `20261121171000_mercado_livre_order_sync_state`
  8. `20261121172000_mercado_livre_order_versioning`
  9. `20261121180000_integration_hub`
  10. `20261121190000_hotmart_webhook`
  11. `20261121200000_metricool_credentials`
- Version IDs diferem entre repositório, staging e produção (nomes iguais); não usar `db push`/repair sem reconciliação.

### S5.1 (desta frente) — ✅ concluído
- `workspace_members` aplicada no staging (`20261119232430`) e na produção; grants/RLS/advisors conferidos (execução 6).
- E2E de admin endurecido (#56, mergeado): "Membros" exige a lista com o próprio usuário.
- 🔐 Decisão do Owner (não alterada): `ensure_workspace` cria workspace vazio para usuário removido de todos os workspaces.

### Quadro das frentes
| Frente | Etapa atual | PR aberto | CI | Pendências | Autorizações do Owner |
|---|---|---|---|---|---|
| S14 (agentes) | ✅ handoff; correção de timeout/ledger mergeada (#82) | — | ✅ | — | `SUPABASE_SECRET_KEY`/OIDC/AI Gateway, `CRON_SECRET`, gasto com modelo |
| S15 (CRM/LGPD) | ✅ handoff | — | ✅ | — | — (migration já na produção) |
| S16 (performance) | ✅ handoff | — | ✅ | — | Produção de `keyset_pagination_indexes` |
| S6.1 (CSP/logs) | ✅ handoff | — | ✅ | — | Destino externo de logs (opcional) |
| S4 (domínio) | Etapas 1–2f mergeadas; 2g (agentes) em revisão | #75 | — | 2g e handoff (`docs/S4_PROGRESS.md`) | — |
| S11 (Mercado Livre) | #60 mergeado; Frente B (`96580f3`) adicionou reconciliação/desconexão/ledger sync | — | ✅ | Migrations renomeadas nesta execução; `96580f3` entrou sem PR/revisão | Produção das migrations S11; segredos OAuth/cripto ML; `SUPABASE_SECRET_KEY` |
| S17/S18/S19 (hub, Hotmart, Metricool) | Mergeados (#70, #83, #84) | — | ✅ | Prefixo de teste `040_` duplicado (cosmético) | Produção de `integration_hub`, `hotmart_webhook`, `metricool_credentials`; credenciais Hotmart/Metricool/redes |
| Docs (governança) | PR #79 contra `main` (Draft) — só documentação | #79 | — | Fora da integração | Merge na `main` |
| Integração | Execução 13: CI e validação local verdes; versões duplicadas corrigidas | #85 | — | Preview Vercel bloqueado por cota diária (externo) | — |

Handoffs: ✅ S14, ✅ S15, ✅ S16, ✅ S6.1 · ⏳ S4. Relatório final ao Owner só quando S4 tiver handoff.

### Autorizações para produção (acumulado)
1. Migrations na produção na ordem acima (11 arquivos).
2. Merge na `main` com plano de release — a integração está muito à frente de `main`; não promover sem reconciliar.
3. Vercel: `SUPABASE_SECRET_KEY`, OIDC/AI Gateway, `CRON_SECRET`, `AGENT_EXECUTOR_ENABLED`; credenciais OAuth e chave de
   criptografia do Mercado Livre; credenciais Hotmart (webhook) e Metricool; opcional `LOG_DRAIN_URL`/`LOG_DRAIN_TOKEN`.
4. Segurança (revisão antes da promoção): `rate_limit_consume` executável por anon (intencional), funções SECURITY DEFINER
   para authenticated, leaked-password protection desativada (configuração de Auth).
5. Governança: commits diretos na branch de integração (ex.: `96580f3`) contornam PR/revisão; recomendável proteger a branch.

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


### Fechamento da validação automatizada S11 — 21/11/2026 UTC

- Workflow GitHub Actions **CI #364**: [execução #364](https://github.com/smklj/smkon/actions/runs/44866546044), commit testado `e5ea42629ed76bf1454f7b4891aa373574894e5a` (posterior aos commits do fixture e da correção do delimitador).
- Job **Typecheck, lint and build**: success. Passaram npm ci, auditoria de dependências de produção (high+), typecheck, lint, unit tests e build.
- Job **Database migrations and SQL tests**: success. O step `bash scripts/test-db.sh shim` passou em PostgreSQL 17 descartável, aplicando as migrations e executando os arquivos SQL de teste, incluindo `mercado_livre_credentials.test.sql` com fixture de lease/CAS.
- **Conclusão:** validação automatizada do banco descartável e quality gate do CI fechados com sucesso no commit acima. Os runs #358, #360 e #362 foram cancelados por pushes subsequentes e não são considerados falhas de teste; #364 é a evidência final válida.
- Escopo não coberto por esse CI: OAuth real com conta de teste Mercado Livre, configuração de secrets, migrations em Supabase hospedado, sincronização e reconciliação financeira.
- Estado protegido: PR #57 continua Draft; nenhum merge, migration hospedada ou deploy de produção foi realizado.


## 10. S11 Mercado Livre — persistência e validação em staging (21/11/2026 UTC)

- **Branch/PR:** `feature/s11-mercado-livre-adapter`, PR #57 Draft, base `feature/smkon-production-readiness`. A base foi integrada ao branch S11 por merge commit `c3c5f0a`; o head atual no registro é `af27230`.
- **Implementação:** conexão one-click, OAuth Authorization Code/state one-time/PKCE, AES-256-GCM, refresh lease/CAS, callback validado com `GET /users/me`, conclusão OAuth atômica e reautorização da conexão existente.
- **Importação:** manual e limitada aos 50 pedidos recentes; snapshots normalizados sem PII; upsert transacional idempotente de `external_events` + `sales_orders`; nenhum ledger ou `settled_at` inferido.
- **CI:** PR run #408 [passou nos dois jobs](https://github.com/smklj/smkon/actions/runs/44869249003) no head `af272309d3dade2cd333c9bec73723fb4a1590a4`: typecheck/lint/unit/build e migrations/SQL tests. O push run #407 ainda estava em execução no momento deste registro; o PR check #408 é a evidência concluída.
- **Preview:** deployment Vercel `dpl_zpPfhaJoadYfNz63YdfnP1drMQJw` READY em [smkon-obl46ubjj-smkon.vercel.app](https://smkon-obl46ubjj-smkon.vercel.app). E2E do Preview mais recente ainda pendente; não declarar E2E verde no head atual.
- **Staging:** 25 migrations aplicadas, incluindo as quatro S11: credentials, OAuth attempts, order snapshots e OAuth atomic completion. Testes rollback-only executados no projeto `smkon-staging` (`xoyasrizivadxnpmzzno`) para lease/CAS, state one-time, RLS/grants, idempotência, isolamento, PII, valores inválidos, atomicidade de OAuth e rollback quando existe refresh lease ativo; sem exceções.
- **Produção:** 20 migrations registradas; falta `20261119232441_keyset_pagination_indexes` e as quatro S11. Não há evidência verificável de backup/restauração no conector. O PR #57 tem como base a branch de integração, não `main`; a branch de integração está divergente de `main` (92 commits à frente e 6 atrás). Nenhuma migration/deploy de produção ou merge em `main` foi executado.
- **Configuração:** Vercel não tem `SUPABASE_SECRET_KEY` nem as variáveis de OAuth/criptografia Mercado Livre. OAuth real e importação de dados reais continuam bloqueados.
- **Classificação:** S11 parcialmente implementado e validado em staging; não está operacional como conector financeiro completo.

## S11 — estado após merge do PR #57 (21/11/2026 UTC)

- PR #57 foi mergeado por squash na branch `feature/smkon-production-readiness`, commit `8c73cbc87575ae49dd102c493deada17c19c9123`; não houve merge em `main`.
- CI #412 passou nos dois jobs no head `399e08b0119018df1294688b332bab9025956a09`: typecheck, lint, unit tests, build, dependency audit e migrations/SQL tests.
- Playwright E2E #193 passou no job `Playwright · Staging`. Os dois commits após o Preview READY `af27230` foram apenas documentação e fixture SQL; o código de runtime validado no Preview é o mesmo do head.
- Os três testes SQL S11 foram reexecutados no Supabase staging em rollback-only e terminaram sem exceções.
- Vercel bloqueou novos deployments pelo limite `api-deployments-free-per-day`; Preview S11 anterior continua READY, mas o merge commit ainda não tem Preview próprio.
- Staging: quatro migrations S11 presentes por nome; os versions do histórico (20261121050108/110/114/631) diferem dos prefixos dos arquivos no Git (20261121130000/140000/150000/160000). Alinhar o histórico antes de qualquer novo `supabase db push` no staging.
- Produção: 20 migrations; faltam keyset pagination e as quatro migrations S11. Sem evidência verificável de backup/restauração. Não foram aplicadas migrations nem feito deploy.
- Vercel ainda sem `SUPABASE_SECRET_KEY` e sem credenciais OAuth/criptografia Mercado Livre; OAuth real não validado.
- S11 continua **parcial**: importação manual de até 50 pedidos, sem paginação histórica, checkpoint, reconciliação financeira ou sync recorrente. Nenhuma liquidação/ledger é inferida.


## Auditoria complementar S11 — 21/11/2026 04:10 BRT

- PR #57 foi fechado como **merged** por squash em `feature/smkon-production-readiness` no commit `8c73cbc87575ae49dd102c493deada17c19c9123`. O PR não foi integrado em `main` e não promoveu produção.
- Head do PR: `399e08b0119018df1294688b332bab9025956a09`. CI #412 passou (Quality + Database/SQL). E2E Playwright #193 foi reportado como sucesso no comentário de fechamento; Preview de código `af27230` está READY. O check Vercel do merge commit está em failure por quota `api-deployments-free-per-day`, não por falha de compilação.
- Staging `smkon-staging` registra 25 migrations: 21 da base incluindo keyset + quatro S11. Os nomes correspondem aos arquivos; os valores de version do histórico foram registrados em timestamps diferentes dos prefixos Git. Não rodar `db push` até comparar o conteúdo aplicado e reconciliar o histórico de forma suportada.
- Produção `smkonlj` registra 20 migrations: falta `20261119120000_keyset_pagination_indexes` e faltam as quatro migrations S11. Nenhuma migration S11 foi aplicada em produção.
- Auditoria de ACL em Staging confirmou RLS ligado nas tabelas de credenciais e tentativas OAuth; SELECT negado a `anon` e `authenticated`; leitura e RPCs de persistência/completion concedidas a `service_role` apenas. As três tabelas sem policies específicas aparecem como INFO no Advisor e são intencionais: o acesso de aplicação é server-side via service role, sem grants aos papéis browser.
- Advisor de performance do Staging encontrou quatro FKs S11 sem índice cobrindo todas as colunas (credentials connection/org/domain; OAuth attempts connection/org/domain, created_by e organization_id). Esta branch adiciona migration aditiva `20261121170000_mercado_livre_fk_indexes.sql` e teste `mercado_livre_fk_indexes.test.sql`; validar no CI e aplicar primeiro em Staging após revisão.
- Advisor de segurança também reporta 1 SECURITY DEFINER executável por anon (`rate_limit_consume`), 31 executáveis por authenticated e proteção de senha vazada desativada. São alertas preexistentes/abrangentes; não foram alterados nesta frente por risco de quebrar fluxos existentes. Revisão específica e grants esperados devem ocorrer antes da promoção global.
- Variáveis Vercel de Mercado Livre e `SUPABASE_SECRET_KEY` não aparecem configuradas (listagem feita sem descriptografar valores). OAuth real continua bloqueado; não foram criados secrets nem conectada conta.
- Produção permanece intacta. Não há evidência verificável de backup/restauração no conector. A branch de integração está 102 commits à frente e 6 atrás de `main`; promover tudo junto não é seguro. Não fazer merge da integração inteira em `main` sem plano de release/cherry-pick e validação de dependências.
- Limitações funcionais: importação manual limitada à primeira página (máximo 50), sem backfill/cursor histórico; pagamentos, frete, descontos, estornos, provisões e repasses não reconciliados; nenhum ledger é criado e `settled_at` permanece nulo.


### Atualização S11 — follow-up de performance em Staging (21/11/2026 04:10 BRT)

- PR #59 (`fix/s11-performance-hardening`) foi mergeado por squash na branch de integração em `8e2106c8d26cd4fac43cf83f49ecddfafa411e12`.
- CI #422 passou nos dois jobs: Database migrations/SQL tests e Quality (audit, typecheck, lint, unit tests e build). O check Vercel continua failure por quota `api-deployments-free-per-day`; o PR contém somente SQL/documentação, sem código de runtime.
- Migration `mercado_livre_fk_indexes` aplicada em `smkon-staging` e registrada como versão `20261121071019`. O teste SQL estrutural foi executado diretamente em staging em transação com rollback e não lançou exceções.
- Advisor de performance deixou de apontar as quatro FKs S11; restam quatro FKs sem cobertura em tabelas de S15/S10 (`consent_events`, `data_subject_requests`, `media_licenses`, `product_evidence`). Os índices novos aparecem como unused enquanto o conector ainda não importa pedidos reais; isso é esperado antes de tráfego.
- Advisor de segurança mantém 3 INFO de RLS sem policy (credenciais, tentativas OAuth e rate-limit buckets), 1 WARN de SECURITY DEFINER acessível a anon (`rate_limit_consume`, intencional para rate limit pré-login conforme migration/teste S6) e 31 WARN para funções SECURITY DEFINER acessíveis a authenticated, além de leaked-password protection desativada. Não foi feita revogação em lote; cada função precisa de revisão de autorização/uso.
- ACLs S11 verificadas novamente: RLS ativo; browser roles sem SELECT nas tabelas secretas; RPCs sensíveis apenas para `service_role`.
- Produção permanece sem alterações: 20 migrations, sem keyset e sem S11; backup/restauração não verificáveis pelo conector; OAuth real sem secrets. A integração segue divergente de `main` e não deve ser promovida inteira.


### S11 — paginação manual do histórico (21/11/2026)

- A importação agora percorre a janela fixa de criação dos últimos 12 meses, 50 pedidos por página, com `order.date_created.from/to` e offset validado/alinhado à página.
- A UI oferece `Importar próxima página`; o mesmo intervalo é reutilizado em cada chamada. Cada página usa a RPC transacional existente e é replay-safe.
- O offset tem teto defensivo de 10.000. A janela/cursor fica apenas no estado da tela; recarregar permite reiniciar do offset zero e reprocessar idempotentemente. Não existe checkpoint durável nem sync incremental por `date_last_updated` ainda.
- A documentação oficial do Mercado Livre indica retenção de pedidos de até 12 meses, filtros por data e que a busca por vendedor pode filtrar pedidos cancelados. O backfill, portanto, não é um extrato financeiro completo.
- Teste unitário novo: `tests/unit/mercado-livre-order-sync-window.test.ts` cobre janela de 12 meses, hora UTC, timezone explícito, offset e rejeição de janelas inválidas.
- Não houve chamada real ao Mercado Livre, OAuth ou gravação de pedidos reais; CI/Preview desta alteração ainda pendentes.


### Validação da paginação — 21/11/2026 04:16 BRT

- PR #60 aberto como Draft contra `feature/smkon-production-readiness`.
- CI #428 passou nos dois jobs: Quality (audit, typecheck, lint, unit tests e build) e Database migrations/SQL tests.
- O check Vercel está failure por `api-deployments-free-per-day`; não há Preview para o código de paginação. O Preview anterior `af27230` continua READY, mas não contém esta alteração.
- O PR permanece Draft até haver Preview verificável; não houve merge desta alteração nem deploy de produção.


### Correção de inventário e ACL S11 — 21/11/2026 04:17 BRT

- Inventário atualizado após PR #59: Staging registra **26 migrations** (21 base, incluindo keyset, + cinco S11: credentials, OAuth attempts, order sync, OAuth atomic completion e FK indexes). Produção registra **20**; faltam keyset e as cinco migrations S11.
- Query read-only em Produção confirmou ausência das tabelas `mercado_livre_credentials`, `mercado_livre_oauth_attempts` e das funções `mercado_livre_*` (zero funções). Nenhuma parte do S11 foi aplicada em produção.
- Query read-only em Staging confirmou seis RPCs S11: todas `SECURITY DEFINER`, `search_path=''`, sem EXECUTE para `anon`/`authenticated`, com EXECUTE somente para `service_role`.
- A migration de índices FK foi aplicada em Staging; Advisor não aponta mais as quatro FKs S11 sem cobertura. Nenhuma alteração de produção foi feita.


### Confirmação final de CI da paginação — 21/11/2026 04:21 BRT

- CI #435 passou no head final `1780c02cee1d1b595e4e0412e592c370055d64b6`: Quality (audit, typecheck, lint, unit tests e build) e Database/SQL tests.
- O teste S11 de offset foi ajustado para exigir a janela fixa em páginas posteriores. A falha timing-sensitive do teste S14 observada em #431 não se repetiu em #435.
- PR #60 continua Draft porque o check Vercel falha por `api-deployments-free-per-day`; não existe Preview da paginação. O Preview READY `af27230` é da versão anterior e não valida a UI nova.
- Nenhum merge da paginação, OAuth real ou alteração de produção foi feito.


## S11 — estado consolidado após checkpoint durável (21/11/2026)

- PR #57 está fechado/mergeado por squash em feature/smkon-production-readiness (commit 8c73cbc); isso não é merge em main.
- PR #60 continua Draft na branch feat/s11-manual-history-pagination. Implementa paginação manual e cursor durável server-side com lease, retomada e persistência/checkpoint atômicos.
- CI #456 passou no código head b898c5c7ff4741bdfe4a196b2fe6bc32ff17507e. O head documental mais recente está em nova execução CI #462; não declarar verde até concluir.
- Migration 20261121180000_mercado_livre_order_sync_state aplicada em smkon-staging e registrada como 20261121090433. Quatro testes SQL S11 foram executados em rollback-only no Staging sem exceções.
- A tabela de checkpoint tem RLS; anon/authenticated não têm SELECT; service_role tem SELECT. As três RPCs novas são SECURITY DEFINER, search_path vazio e EXECUTE somente para service_role. Zero checkpoints reais porque nenhuma conta está conectada.
- Security Advisor mantém INFO de RLS enabled/no policy para tabelas secretas server-side; WARNs de SECURITY DEFINER/leaked-password são preexistentes. Performance Advisor ainda aponta quatro FKs de S15/S10, não do S11.
- Vercel tem Preview READY apenas para commit intermediário 98ca20c, não para o head atual; quota api-deployments-free-per-day impede novo Preview.
- Vercel não possui variáveis MERCADO_LIVRE_* nem SUPABASE_SECRET_KEY. OAuth real e leitura com conta de teste não foram executados.
- Produção: 20 migrations, zero tabelas/funções S11, sem alterações. Backup/restauração não puderam ser comprovados com as ferramentas disponíveis.
- Pendências: divisão automática de janelas acima do offset 10.000, sync incremental por date_last_updated, OAuth real, reconciliação de pagamentos/taxas/frete/estornos/provisões/repasses e promoção isolada para main. Não declarar o conector financeiro operacional.


## Inventário Vercel — correção do Preview intermediário (21/11/2026)

A listagem de deployments identificou quatro Preview READY da branch. O mais recente é o commit 58093005de9807d0c41a74bbd2e0c0c3d7e1eb93, disponível em https://smkon-9ms5o5dgg-smkon.vercel.app. Esse commit contém somente o parser server-owned; não contém a rota/UI do cursor durável. Não existe Preview do head 206fa3bb0e6cef219d498e52f979deb4d33b45c4.

A tentativa de deployment explícito do head retornou HTTP 402 api-deployments-free-per-day, retryAfter 86400. O ambiente não tem Vercel CLI nem checkout local para fallback. Não houve contorno de quota, upgrade ou alteração de billing. O último Production deployment continua em main, commit 01677bad697ed412bffe58d6b8dd7eabec8d6183.


## Proteção contra snapshot fora de ordem — 21/11/2026

- A migration 20261121200000_mercado_livre_order_versioning adiciona external_events.source_updated_at e substitui a RPC mercado_livre_persist_order_snapshots.
- O normalizer agora usa Mercado Livre date_last_updated como watermark (normalization_version 2). Se o provedor omitir o campo, usa date_created como fallback.
- A RPC só atualiza o evento/pedido quando o watermark recebido é igual ou mais recente que o já persistido; snapshots antigos são ignorados e não podem regredir order_status/valores. A persistência da página e o checkpoint continuam atômicos.
- CI #475 passou nos dois jobs no head 2014df15e749be97adb29a5809edf2dff815a7c0: typecheck, lint, unit tests, build, migration e SQL tests.
- Migration aplicada somente no Staging, registrada pelo Supabase como versão 20261121091235. Staging agora tem 28 migrations. Cinco testes SQL S11 executados em rollback-only sem exceções, incluindo regressão de snapshot antigo.
- O Security Advisor não apontou novo WARN para S11; permanecem quatro INFO de RLS enabled/no policy em tabelas server-side, 31 WARNs de SECURITY DEFINER authenticated preexistentes, um WARN de rate_limit_consume para anon e um WARN de proteção de senha vazada. Performance Advisor: quatro FKs de S10/S15 e índices não utilizados INFO; sem FK S11 pendente.
- Staging continua sem conexão, credenciais, OAuth attempts, pedidos, eventos ou checkpoints reais.
- Produção continua com 20 migrations e sem objetos S11. Nenhuma migration/deploy de produção foi executado.
- Preview do head continua bloqueado por HTTP 402 api-deployments-free-per-day; o Preview READY mais recente é do commit intermediário 5809300, anterior à rota/UI do checkpoint. Credenciais Mercado Livre e SUPABASE_SECRET_KEY continuam ausentes.
- Pendências: dividir automaticamente janelas acima do offset 10.000, sync incremental por date_last_updated, OAuth real, conciliação financeira e backup/restauração comprováveis.


## S14 — reconciliação de deployment e worker (21/11/2026 18:01 BRT)

- PR #82 e release #87 estão incorporadas; main HEAD atual `4347080` (PR #95). Production deployment READY `dpl_CgbrQ8jM7pzDCeWzCNbAQco5sUEZ`, SHA `d30c42a`, descendente do merge #87 e 4 commits atrás da main.
- Build Production confirma `/api/agents/worker`; `vercel.json` implantado declara `17 11 * * *` (08:17 BRT). Sem invocações nos últimos 30 minutos; 1h não está disponível na retenção Hobby. Próxima janela após deploy: 22/11/2026 08:17 BRT.
- Inventário sem decrypt: `SUPABASE_SECRET_KEY` ausente; `CRON_SECRET` sensitive em Preview/Production sem validação de tamanho; `AGENT_EXECUTOR_ENABLED=true` em ambos; OIDC/Gateway/Haiku 5.5 e teto interno US$ 5 configurados.
- O handler falha fechado sem chave de serviço: após flag, cron bearer, modelo e budget, `createServiceClient()` retorna null e o worker responde 503 `service_not_configured` antes de claim. Sem execução runtime comprovada.
- AI Gateway 7d: 0 requests/tokens/custo; budgets/rules externos ausentes. Staging 121 runs killed, sem steps/grants/usage; Production sem runs/usage. Ledger consistente com agregado zero, sem chamada real.
- Assinaturas de colunas, constraints, policies, RLS/ACL e funções selecionadas coincidem nos dois Supabase; versões de migration S14 ainda diferem. Nenhum repair executado.
- A flag Production não foi alterada. Recomendação: manter executor desabilitado até credenciais, grants, budget e OIDC/CRON homologados em Staging.


## S14 — checkpoint operacional 22/11/2026 01:57 BRT

- GitHub: main SHA 84afe632; PR #113 Draft/mergeable, head 7d957275, 15 ahead / 0 behind, somente cinco arquivos documentais. PRs #35–#42 e #46 verificadas como merged; #82/#97 merged; #102 fechada sem merge.
- CI #44983092682: 2/2 jobs success, 418/418 unit tests, typecheck/lint/audit/build e SQL/migrations tests aprovados. E2E de deployment_status #44983114589: 36/36 no Preview exato 7d957275, artifact [14738303182](https://github.com/smklj/smkon/actions/runs/44983114589/artifacts/14738303182). O job Staging do evento pull_request foi skipped; o run de deployment_status é a evidência válida de Staging.
- Preview dpl_Exi3uZxvFqmX5mugDtKWsuuG9oKi READY. Production mais recente dpl_3RdCGJ2THbYE9aajDZGgGzwWTUnV READY, main SHA 84afe632, aliases públicos ativos. vercel.json e src/app/api/agents/worker/route.ts estão em main; Cron 17 11 * * * UTC = 08:17 BRT.
- Runtime Production: GET /api/agents/worker às 04:49:13Z terminou em unauthorized. Como o handler valida flag e formato do CRON_SECRET antes do Bearer, esse request prova AGENT_EXECUTOR_ENABLED=true e CRON_SECRET utilizável no runtime; não prova chamada autenticada do Cron ou OIDC. Não houve claim.
- Vercel env inventory sem decrypt: SUPABASE_SECRET_KEY ausente em Preview/Production; CRON_SECRET Sensitive em targets separados; AGENT_EXECUTOR_ENABLED=true nos dois; AGENT_MODEL_PROVIDER=vercel-ai-gateway, AGENT_MODEL_AUTH=oidc, AGENT_MODEL=anthropic/claude-haiku-5.5, AGENT_MONTHLY_BUDGET_USD=5. Nenhum valor secreto foi lido. OIDC não comprovado em runtime.
- Supabase staging: 148 runs, todas killed; 0 steps, 0 tool grants, 0 usage, 0 conteúdo vinculado; settings kill_switch=false, 500 runs/dia, 12 steps/run. Production: zero dados S14. agent_model_usage soma 0 linhas/tokens/custo em ambos. Os dois bancos têm 31 nomes de migrations e 0/31 version IDs iguais.
- AI Gateway 7d: 0 requests/tokens/custo; budget específico de projeto e defaults ausentes; regras de roteamento ausentes. Ledger zero é consistente, mas não valida reconciliação de cobrança.
- Gate: não executar operations_review real até haver chave service exclusiva de staging, grants mínimos, budget externo isolado e prova de OIDC. Nenhum merge, mudança de Production, migration, secret, grant, budget ou chamada paga nesta rodada.

---

## S14 — reconciliação operacional 22/11/2026 03:00 BRT

### GitHub e deploy
- PR #113 aberta/Draft/mergeable, head `2513d971`, 20 ahead / 0 behind; diff verificado com apenas cinco arquivos documentais. Main `84afe632`.
- CI #44987586564: 418/418 e 2/2 jobs success no head exato. E2E desse head cancelado; último E2E Staging aprovado #44983114589, 36/36 no SHA de aplicação `7d957275` (mesmo código, PR docs-only).
- Preview atual do head: `dpl_9oZkfe9pm5D1oXa5RuuVbpmBLFcS`, READY. Production: `dpl_3RdCGJ2THbYE9aajDZGgGzwWTUnV`, READY em main `84afe632`.
- Cron no deployment Production: `/api/agents/worker`, `17 11 * * *` UTC (08:17 BRT). Sem runtime logs Production na janela recente de 50 min; a execução das 08:17 de 22/11 ainda era futura às 03:00 BRT.

### Ambiente e segurança
- Sem decrypt: `AGENT_EXECUTOR_ENABLED=true` nos dois targets; provider `vercel-ai-gateway`, auth `oidc`, modelo `anthropic/claude-haiku-5.5`, teto interno US$ 5.
- `CRON_SECRET` Sensitive separado em Preview/Production; valores não lidos. `SUPABASE_SECRET_KEY`, `SUPABASE_SERVICE_ROLE_KEY` e `AI_GATEWAY_API_KEY` ausentes.
- Handler: flag → CRON_SECRET mínimo 32 e trim → Bearer em tempo constante → modelo/OIDC → budget/preço → cliente de serviço → claim. O cliente usa SUPABASE_SECRET_KEY. OIDC runtime não comprovado; sem chave service o worker não alcança claim/model call.
- Recomenda-se ao Owner desabilitar a flag em Production até homologação; nenhuma variável alterada.

### Supabase e Gateway
- Staging: 150 runs, todas killed; 0 steps, 0 grants, 0 usage e 0 conteúdo vinculado; settings kill_switch=false, 500 runs/dia, 12 steps/run.
- Production: zero dados S14. agent_model_usage zerado em ambos.
- RLS 6/6 em ambos; uma policy em cada tabela S14 e quatro em content_items. Funções agent_*: authenticated=6, service_role=12, postgres=19; nenhuma EXECUTE anon observada.
- 31 nomes de migrations correspondentes, 0/31 version IDs iguais; não executar repair/db push sem reconciliação.
- AI Gateway 7d: 0 requests, tokens e custo. Budgets de team/projeto/default e regras: nenhum. Nenhuma chamada real comprovada.
- Limite interno US$ 5 é soft; sem reserva atômica por chamada ou outbox durável para reconciliar cobrança se a gravação falhar.

---

## Checkpoint operacional S14 — 22/11/2026 03:56 BRT

### GitHub e CI
- Repositório smklj/smkon; main permanece em 84afe632. PR #113 está aberta, Draft e mergeable; branch docs/s14-current-operational-handoff-20261121-2000 está 21 commits à frente / 0 atrás. Compare confirma somente cinco arquivos documentais. #113 é a única PR aberta. Splits #35–#42 e #46, além de #82 e #97, seguem merged; #102 fechada sem merge.
- CI #44992062696 no HEAD 8f9bd8fad5c5df0acf3bc9a0a88161139cbc2084: 2/2 jobs success. Logs confirmam 418/418 unit tests, typecheck, lint, dependency audit, build Next.js e migrations/SQL tests em banco descartável.
- E2E PR #44992062742: Playwright · Build local success, 36 passed (2.7m), usando o Supabase de staging; Playwright · Staging foi skipped pelo evento pull_request. Último job Playwright · Staging disparado por deployment_status ainda é #44983114589, 36/36 no SHA 7d957275 (código de app equivalente porque a PR é docs-only). Nenhum desses testes chama o AI Gateway.

### Vercel e Cron
- Preview exato do HEAD 8f9bd8: deployment dpl_Fim54qNNSjWVp3eFx4jbJxN17dXP, READY, https://smkon-p8lolgft9-smkon.vercel.app.
- Production mais recente: dpl_3RdCGJ2THbYE9aajDZGgGzwWTUnV, READY, main SHA 84afe632, alias https://smkon.vercel.app. Nenhum deploy/alias Production foi alterado nesta rodada.
- vercel.json declara /api/agents/worker, 17 11 * * * UTC = 08:17 BRT. No checkpoint 03:56 BRT, a execução diária das 08:17 ainda é futura. Logs de runtime Production na janela recente de 30 min: nenhuma linha. A consulta de 3h foi recusada pelo plano Hobby por exceder retenção; não interpretar como ausência de logs nesse período.

### Credenciais e proteções (inventário Vercel sem decrypt)
- AGENT_EXECUTOR_ENABLED=true em Preview e Production; AGENT_MODEL_PROVIDER=vercel-ai-gateway; AGENT_MODEL_AUTH=oidc; modelo anthropic/claude-haiku-5.5; teto interno AGENT_MONTHLY_BUDGET_USD=5.
- CRON_SECRET consta como Sensitive separadamente em Preview e Production; nenhum valor foi lido. SUPABASE_SECRET_KEY e SUPABASE_SERVICE_ROLE_KEY ausentes no inventário de ambos os targets. AI_GATEWAY_API_KEY ausente; OIDC é o caminho configurado.
- Código revisado: handler.ts valida flag → CRON_SECRET (mínimo 32 e trim) → Bearer em tempo constante → modelo/OIDC → budget/preço → cliente service_role → claim. service.ts exige SUPABASE_SECRET_KEY. model.ts aceita x-vercel-oidc-token ou VERCEL_OIDC_TOKEN somente com opt-in OIDC. Token/autenticação OIDC em runtime não comprovados. Sem token, bloqueio model_not_configured; se OIDC passar, chave Supabase ausente bloqueia com service_not_configured antes de claim/model call.
- Não alterar Production sem autorização. Recomenda-se ao Owner manter/desligar AGENT_EXECUTOR_ENABLED em Production até homologação; nenhuma variável foi modificada.

### Supabase, RLS, ACL e migrations
- Staging xoyasrizivadxnpmzzno: 152 runs, todas killed; 0 steps, 0 tool grants, 0 agent_model_usage e 0 conteúdos com agent_run_id. agent_settings: kill_switch=false, max_runs_per_day=500, max_steps_per_run=12 (atualizado em 22/11 03:09 BRT). Production hpplboyysmfcjsnjrdmw: 0 runs, steps, grants, usage e conteúdo vinculado; sem linha de agent_settings.
- RLS habilitado em 6/6 tabelas auditadas em ambos os bancos; policy count: uma em cada tabela S14 (agent_runs, agent_steps, agent_model_usage, agent_tool_grants, agent_settings) e quatro em content_items.
- Funções agent_*: EXECUTE authenticated=6, service_role=12, postgres=19; nenhuma concessão a anon foi retornada. As ACLs consultadas coincidem entre Staging e Production.
- Ambos listam os mesmos 31 nomes de migrations, mas 0/31 version IDs coincidem; audience_consent e workspace_members aparecem em ordem diferente. Isso não prova, isoladamente, schema divergente. Não executar db repair / db push sem comparar definições aplicadas, backup e plano formal.

### Planner, Executor, Verifier, ferramentas e orçamento
- run.ts relê status antes de fases, respeita cancelamento/kill switch, timeout por passo e prazo total; ferramenta fora de allowlist/grant é rejeitada. read.ts limita a 50 itens e 60.000 bytes, com allowlist e escopo da organização. draft.ts usa RPC agent_draft_content e só aceita retorno content_status=draft. verifier.ts é determinístico e exige evidência verificada do mesmo produto antes de permitir draft.
- model-gateway.ts usa endpoint fixo https://ai-gateway.vercel.sh/v1/chat/completions; testes usam fetch injetado e não fazem chamadas reais. budget.ts grava por agent_record_model_usage; tick.ts consulta agent_model_spend_since antes de cada claim. Limite interno US$ 5 é soft, sem reserva atômica de custo máximo e sem outbox durável de reconciliação.

### AI Gateway e ledger
- Uso do projeto nos últimos 7 dias: nenhuma série/linha, 0 requests, 0 input/output tokens e US$ 0. Budgets de projeto, equipe e defaults: nenhum (defaultCoveredCounts zero); regras de roteamento: nenhuma. Catálogo live confirma anthropic/claude-haiku-5.5 disponível.
- agent_model_usage: 0 linhas, 0 input tokens, 0 output tokens e US$ 0 em Staging e Production. Consistência observável com uso agregado zero; não comprova reconciliação depois de uma cobrança. Nenhuma chamada real ao Gateway foi comprovada.

### Gate de homologação e segurança
Não executar operations_review real enquanto faltarem: chave service exclusiva de Staging no target Preview, grants mínimos de leitura aprovados, budget externo isolado do Production, validação segura de CRON_SECRET e prova de OIDC em runtime. Depois dos gates, executar uma única run e reconciliar request/modelo/tokens/custo do Gateway com agent_model_usage, conferindo steps, draft e Verifier.

Somente leituras, inspeção de código e atualização documental nesta rodada. Sem merge, alteração em main ou Production, migration remota, secret, grant, budget, deploy Production ou chamada paga.


## Atualização operacional — 22/11/2026 05:02 BRT (consulta direta)

### Repositório e PRs
- Repositório smklj/smkon; main em 84afe632464cc83c347ca1cfe5923efe9bbc91fe.
- PR #113 aberta, Draft e mergeable; head anterior c7deb14eb89913e64ccd94497da3502c3f2c004c, 26 commits à frente e 0 atrás. Compare main...head confirma exclusivamente os cinco documentos deste handoff.
- A busca de PRs abertas retornou somente #113. Splits #35–#42 e #46, além de #82 e #97, estão merged; #102 está fechada sem merge. Não promover branches antigas divergentes.

### CI, E2E e Preview
- CI #44996313091 associado ao head c7deb14: 2/2 jobs concluídos com success. Logs do job de aplicação confirmam # tests 418, # pass 418, typecheck, lint, audit e build; job de migrations/SQL tests também success.
- E2E PR #44996313030: Build local cancelled e Playwright · Staging skipped. Não atribuir sucesso a esse run.
- Último job Playwright · Staging concluído com success: #44983114589, 36/36 no SHA de aplicação anterior 7d957275; a PR #113 é docs-only sobre a mesma base de aplicação. Isso não é teste de IA nem chamada ao Gateway.
- Preview atual do head c7deb14: deployment dpl_DoNMN47RiSC4Td3HmQGTR4AbW6mj, READY, https://smkon-9by7gt71w-smkon.vercel.app.
- Production mais recente: dpl_3RdCGJ2THbYE9aajDZGgGzwWTUnV, READY, SHA 84afe632, alias smkon.vercel.app. Nenhuma alteração de Production foi feita.

### Worker, Cron e ambiente Vercel
- vercel.json: /api/agents/worker, 17 11 * * * UTC = 08:17 BRT. No checkpoint 05:02 BRT, a próxima janela diária ainda era futura. Runtime logs de Production nos últimos 30 min: nenhuma linha; isso não prova ausência de execução fora dessa janela.
- Inventário consultado com decrypt=false: SUPABASE_SECRET_KEY, SUPABASE_SERVICE_ROLE_KEY e AI_GATEWAY_API_KEY ausentes; CRON_SECRET Sensitive separado para Preview e Production; AGENT_EXECUTOR_ENABLED=true nos dois targets; provider vercel-ai-gateway, auth oidc, modelo anthropic/claude-haiku-5.5 e teto interno US$ 5. Nenhum valor secreto foi lido.
- O handler valida flag → presença/formato de CRON_SECRET → Bearer em tempo constante → modelo/OIDC → budget/preço → cliente service_role → claim. Sem token OIDC válido, model_not_configured; se OIDC passar, a ausência de SUPABASE_SECRET_KEY bloqueia em service_not_configured antes de claim e chamada ao modelo. O token OIDC em runtime não foi comprovado; comprimento/valor de CRON_SECRET não foi lido.
- Recomenda-se ao Owner manter AGENT_EXECUTOR_ENABLED=false em Production até a homologação. Nenhuma variável foi alterada.

### Supabase e consumo
- Staging xoyasrizivadxnpmzzno: 154 agent_runs, todas killed; 0 agent_steps, 0 agent_tool_grants, 0 agent_model_usage, 0 conteúdos vinculados por agent_run_id. agent_settings: kill_switch=false, 500 runs/dia, 12 steps/run.
- Production hpplboyysmfcjsnjrdmw: 0 runs, steps, grants, usage e conteúdo vinculado.
- Soma de agent_model_usage nos dois bancos: 0 linhas, 0 input tokens, 0 output tokens e US$ 0.
- RLS ativo em 6/6 tabelas auditadas em ambos; policies: 1 em cada tabela S14 e 4 em content_items. Funções agent_*: EXECUTE authenticated=6, service_role=12, postgres=19; nenhuma concessão a anon retornada.
- Os dois bancos listam os mesmos 31 nomes de migrations, mas os version IDs divergem e audience_consent/workspace_members aparecem em ordem diferente. Isso não prova schema divergente; não executar db repair/db push sem comparação formal, backup e plano.

### AI Gateway, modelo e orçamento
- Catálogo live: anthropic/claude-haiku-5.5 disponível; endpoint Anthropic declara ZDR e no-training. Isso é metadado do catálogo, não prova de chamada ou política configurada no projeto.
- Uso agregado do projeto nos últimos 7 dias: 0 requests, 0 tokens e US$ 0. Budgets de projeto e defaults: nenhum; regras de roteamento: nenhuma.
- agent_model_usage vazio é consistente com o agregado zero, mas não prova reconciliação após uma cobrança.
- model-gateway.ts usa endpoint fixo e registra usage de respostas 2xx antes de aceitar o conteúdo; sem usage estima cenário conservador e falha se a RPC de registro falhar. tick.ts relê o gasto antes de cada claim; teto interno é soft, sem reserva atômica por chamada nem outbox durável para reconciliar falha posterior.

### Gate de homologação
Não executar operations_review real enquanto faltarem: chave service exclusiva de staging no target Preview, grants mínimos de leitura, budget externo isolado, prova de OIDC em runtime e validação segura do Cron secret. Depois dos gates, executar uma única run e reconciliar request/modelo/tokens/custo do Gateway com agent_model_usage, além de steps, draft e Verifier.

Somente consultas, inspeção de código e documentação nesta rodada. Sem merge, alteração em main/Production, migration remota, secret, grant, budget ou chamada paga.


## Estado verificado — 22/11/2026 07:59 BRT

- PR #113: aberta, Draft, mergeable; HEAD `a9cbe2f`, 30 ahead/0 behind, diff limitado aos cinco documentos S14. Main `84afe632`. PRs #35–#42, #46, #82 e #97 merged; #102 fechada sem merge.
- CI #45010831733 no HEAD exato: 418/418 unit tests, 28 arquivos SQL, typecheck/lint/audit/build aprovados. Playwright deployment_status #45010855834: 36/36 no Preview exato do HEAD, 3,4 min; artifact #14750330616. O E2E PR #45010831811 passou 36/36 local, mas o job Staging desse evento foi skipped.
- Preview `dpl_96w44YQjmQ5h6ihUjB49KCqQeTC5` READY; Production `dpl_3RdCGJ2THbYE9aajDZGgGzwWTUnV` READY na main `84afe632`. Nenhuma alteração Production.
- Cron de Production: `/api/agents/worker`, `17 11 * * *` UTC (08:17 BRT). Às 07:59 ainda futuro; logs runtime de 30 min sem eventos do worker.
- Env inventory com `decrypt=false`: `SUPABASE_SECRET_KEY`/ `SUPABASE_SERVICE_ROLE_KEY` ausentes, inclusive no target `qa-e2e-staging`; `CRON_SECRET` Sensitive em Preview e Production (valor não lido, formato não certificado); `AGENT_EXECUTOR_ENABLED=true` nos dois; provider Gateway, auth OIDC, Haiku 5.5, teto interno US$ 5. `AI_GATEWAY_API_KEY` ausente.
- Worker resolve configuração do modelo e budget, mas não chama o tick até obter cliente service. Sem `SUPABASE_SECRET_KEY`, `createServiceClient()` retorna null e o handler termina antes de claim/model call. OIDC runtime não comprovado.
- Staging: 160 runs, todas killed; 0 steps/grants/usage; kill_switch=false, 500 runs/dia, 12 steps/run. Production: zero dados S14. `agent_model_usage` zero linhas/tokens/custo em ambos.
- AI Gateway 7d: rows/series vazias; budget específico e defaults ausentes; rules ausentes. Modelo consta no catálogo, mas não há request real comprovado.
- Limite interno de US$ 5 é soft; sem reserva atômica/outbox durável. Não executar `operations_review` real até provisionar chave service de staging, grants mínimos, budget externo isolado e comprovar OIDC/CRON.