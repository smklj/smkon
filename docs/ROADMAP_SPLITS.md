## Fechamento S14 — checkpoint 22/11/2026 00:55 BRT

### Splits
- [x] Planner (#35), Executor core (#36), read tools (#37), draft RPC (#38), claim queue (#39), worker (#40), model adapter (#41), budget/OIDC (#42) e run detail (#46): 9/9 PRs confirmadas individualmente como merged.
- [x] Correções de timeout/ledger integradas à main por PR #82; PR #97 documental merged.
- [x] PR #113 é somente documentação, Draft, 14 ahead/0 behind; sem merge.

### Verificação
- [x] CI #44978955812 no HEAD 52aae681: 418/418 unit tests, 28 arquivos SQL, typecheck/lint/audit/build aprovados.
- [x] E2E Staging anterior #44974751006: 36/36 no SHA de aplicação e5ba869f, artifact #14735191696. O E2E PR #44978955925 foi cancelado/skip; não atribuir ao HEAD atual.
- [x] Preview atual READY; Production READY em SHA 86bd67c, main 7 commits à frente e sem arquivos S14 no diff.
- [x] Auditoria RLS/ACL: 6/6 tabelas com RLS, 19 funções agent_*, grants anon=0/authenticated=6/service_role=12.
- [x] Staging 146 runs killed, 0 steps/grants/usage/drafts vinculados; Production sem dados S14.
- [x] 31 nomes de migrations nos dois bancos; 0/31 version IDs coincidem. Não executar repair/db push sem reconciliação.

### Homologação operacional ainda aberta
- [ ] SUPABASE_SECRET_KEY exclusiva do staging.
- [ ] Grants mínimos de leitura para operations_review.
- [ ] Budget externo de AI Gateway restrito ao projeto de staging.
- [ ] Validar CRON_SECRET de Production sem revelar valor.
- [ ] Comprovar OIDC em runtime.
- [ ] Executar uma única operations_review real e reconciliar request/modelo/tokens/custo com agent_model_usage.
- [ ] Resolver reserva atômica/outbox antes de ampliar execução: teto interno US$ 5 é soft e não há outbox durável.

Nenhuma chamada real ao Gateway foi comprovada; uso agregado e ledger permanecem zero. Nenhuma alteração em Production foi executada.

---

## Fechamento S14 — checkpoint 22/11/2026 00:00 BRT

### Implementação integrada
- [x] Planner (#35), Executor core (#36), read tools (#37), draft RPC (#38), claim queue (#39), worker (#40), model adapter (#41), budget/OIDC (#42) e run detail (#46): 9/9 PRs confirmadas individualmente como merged.
- [x] Correções de timeout/ledger no histórico da main.
- [x] CI no head exato e5ba869f: 418/418, migrations e SQL tests aprovados.
- [x] E2E no Preview/Staging exato e5ba869f: Playwright · Staging 36/36, 0 falhas; artifact #14735191696. O run PR #44974732762 teve o job Staging skipped, mas o deployment_status #44974751006 executou Staging com sucesso.
- [x] Preview do head e5ba869f READY. Production READY em SHA 86bd67c, sete commits atrás da main, sem alterações S14 no diff.
- [x] Auditoria read-only de RLS/ACL: 6/6 tabelas com RLS, 19 funções agent_* e grants anon=0/authenticated=6/service_role=12.

### Homologação ainda aberta
- [ ] Provisionar SUPABASE_SECRET_KEY exclusiva do Supabase staging somente no target Preview.
- [ ] Validar CRON_SECRET sem ler/expor o valor (mínimo 32 caracteres, sem whitespace nas pontas).
- [ ] Comprovar emissão e aceitação do token OIDC em runtime.
- [ ] Aprovar somente grants mínimos de leitura para operations_review no staging.
- [ ] Criar budget externo de AI Gateway restrito ao projeto; o teto interno de US$ 5 é soft e não reserva atomicamente.
- [ ] Reconciliar formalmente o histórico de migrations: 31 nomes correspondentes, 0/31 version IDs iguais; sem db repair/db push automático.
- [ ] Reforçar orçamento com reserva atômica por chamada e outbox durável para reconciliação.
- [ ] Executar uma única operations_review real em staging e reconciliar request/modelo/tokens/custo com agent_model_usage, validando draft e Verifier.

### Evidência financeira
- AI Gateway últimos 7 dias: 0 requests, 0 tokens, US$0; sem budgets específicos/default e sem regras.
- agent_model_usage: 0 linhas e somas zero em staging e Production. Consistente com uso zero, não comprova reconciliação após cobrança.
- Staging: 144 runs históricas, todas killed; 0 steps/grants/usage/linked content. Production: zero dados S14.

### Segurança
Sem merge, alteração em main/Production, deploy Production, migrations remotas, alteração de secrets, grants, budgets ou chamada paga nesta rodada.


---

## Checkpoint de fechamento S14 — 21/11/2026 22:00 BRT

### Implementação integrada
- [x] Planner (#35), Executor core (#36), read tools (#37), draft RPC (#38), claim queue (#39), worker (#40), model adapter (#41), budget/OIDC (#42) e run detail (#46): 9/9 PRs fechadas e mergeadas.
- [x] Correções de timeout e contabilização incorporadas ao histórico de `main`.
- [x] CI no head documental anterior: 418/418 testes, 0 falhas; migrations/SQL tests aprovados.
- [x] Playwright: 36/36 no build local com staging isolado; job dedicado de Staging foi skipped pelo evento `pull_request`.
- [x] Preview da PR #113 READY no checkpoint `6a05caec`; Production READY em SHA `86bd67c`, sete commits atrás da main e sem arquivos S14 no diff.

### Homologação ainda aberta
- [ ] Provisionar `SUPABASE_SECRET_KEY` exclusiva do Supabase staging somente em Preview.
- [ ] Validar `CRON_SECRET` (mínimo 32 caracteres e sem whitespace) sem imprimir o valor.
- [ ] Comprovar emissão e aceitação do token OIDC em runtime.
- [ ] Aprovar apenas grants mínimos de leitura no workspace de staging.
- [ ] Criar budget externo restrito ao projeto; o teto interno de US$ 5 é soft e não reserva atomicamente.
- [ ] Resolver a ausência de outbox/reconciliação durável para cobranças após falha de gravação do ledger.
- [ ] Rodar uma única `operations_review` em staging.
- [ ] Comprovar Planner → Executor → Verifier, read tools e `draft_content` real.
- [ ] Reconciliar request ID, modelo, tokens/custo e `agent_model_usage`.

### Critério de conclusão
Não marcar S14 operacional até existir request real do AI Gateway, run/steps verificáveis, draft vinculado por `agent_run_id`, Verifier concluído e ledger reconciliado. Não fazer merge nem alterações de Production sem autorização específica.

---

## Reconciliação S14 — 21/11/2026 20:00 BRT

- Os nove splits S14 (#35–#42 e #46) estão integrados. Não há split de implementação original pendente.
- Correções de timeout/ledger S14 estão no histórico de `main`.
- A linha oficial é `main`. `feature/smkon-production-readiness` está congelada (2 ahead/36 behind; somente diff documental observado); não promover.
- `release/s14-mainline-integration-20261121` está obsoleta (34 ahead/289 behind); não promover.
- A PR #102 está aberta, sem reviews e divergente (5 ahead/10 behind); será substituída por uma atualização documental baseada no HEAD atual.
- Estado operacional: código e Cron S14 estão presentes no deployment Production READY `86bd67c`, mas o deployment está 7 commits atrás do HEAD atual `84afe632`. A rota não tem invocação real comprovada.
- Homologação permanece bloqueada: `SUPABASE_SECRET_KEY` ausente; `CRON_SECRET` não validado; OIDC sem prova runtime; zero grants de leitura no staging; nenhum budget externo; zero requests no Gateway e zero linhas no ledger.
- Não fazer merge, deploy, alterações de Production, migrations remotas, secrets, grants ou budgets sem autorização específica.


---

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
| **S4** · ✅ camada de domínio em todos os módulos (produtos, conteúdo/publicação, mídia, financeiro, tenancy/convites, audiência, agentes) e validação central (`docs/S4_HANDOFF.md`); sem migrations; tipos do Supabase conferidos com o staging | Camada de domínio por módulo (`schema/service/repository`), validação de schema, tipos gerados do Supabase, atualização do toolchain de lint | S1 (+ rede para npm) |
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
| **S14** · 🟡 PR #82 Draft, branch limpa 1 ahead/0 behind sobre 9dbf6cb9; PR #78 fechada sem merge. CI #44933511061 aprovado no SHA 46a6d1f5 (288/288 unitários, audit/typecheck/lint/build/SQL); Preview READY no mesmo SHA; E2E #44933605001 em execução, configuração QA passou, sem resultado final. Staging: 114 runs killed, 0 steps/usage/grants/drafts vinculados; kill switch desligado e limites 500/12. Produção sem dados S14. Migrations S14 têm version IDs diferentes entre ambientes. OIDC/modelo configurados; SUPABASE_SECRET_KEY ausente; CRON_SECRET sensitive sem validação; AGENT_EXECUTOR_ENABLED=true em Preview/Production; nenhum budget externo nem chamada real comprovada; agent_model_usage vazio e uso Gateway zero. Worker/Cron ausentes de main; Cron não ativo em Production. 🔐 | Geração de roteiro/legenda com evidência obrigatória; publicação via APIs oficiais só com hash aprovado 🔐 |

## Experiência (proposto)

| Split | Escopo |
|---|---|
| **S7.2** · fases A, B e C implementadas (`docs/S7_2_HANDOFF.md`); monocromático com cor só para estado | Movimento e feedback: tokens de motion, transições, `loading.tsx`/`error.tsx`, toasts, destaque de linha alterada, contagem nas métricas, sparklines em SVG, hierarquia visual |

## Integrações e Automação de Conteúdo

| Split | Escopo |
|---|---|
| **S17** · ✅ implementado e testado (`docs/S17_HANDOFF.md`); mergeado na integração | Hub de Conectores: Hotmart/Shopify/Stripe em `source_connections`, `social_accounts`, `external_action_requests` com aprovação por hash, catálogo e painel em `/admin` |
| **S18** · ✅ implementado e testado (`docs/S18_HANDOFF.md`); mergeado na integração | Receptor de Webhooks Hotmart → normalização PII-free e ledger contábil idempotente |
| **S19** · ✅ implementado e testado (`docs/S19_HANDOFF.md`); mergeado na integração | Adaptador Metricool para redes sociais + painel de decisão e execução de ações externas |

## Frente D — Content Studio Pro & Motor Criativo (CapCut + Canva + Photoshop REA) (`docs/FRENTE_D_CONTENT_STUDIO_PRO.md`)

| Split | Escopo |
|---|---|
| **S20** · planejado | Motor de Remix & Vídeo Autônomo (CapCut REA): legendas dinâmicas palavra por palavra (word-by-word highlight), auto-crop 9:16, inpainting/remoção de marcas d'água de terceiros, injeção de marca d'água SMKON e locução neural TTS |
| **S21** · planejado | Motor de Banners & Mockups 3D (Canva + Photoshop REA): remoção automática de fundo por IA, renderizador de capas/mockups 3D de infoprodutos, templates de carrosséis e banners com selos de desconto/frete grátis e stories interativos |
| **S22** · planejado | Content Studio Pro: player vertical 9:16 no navegador, inspector lateral de ajustes rápidos (gancho, legenda, tags de afiliado) e fluxo de aprovação com 1 clique para despacho automático |

## Frente E — Expansão de Marketplaces & Infoprodutos (`docs/FRENTE_E_COMMERCE_INFOPRODUTOS.md`)

| Split | Escopo |
|---|---|
| **S23** · planejado | Conector de Afiliados Shopee & Shein: geração automatizada de links rastreados com SubIDs, injeção de cupons de criador, catálogo de achadinhos virais e cookie de atribuição de 7 dias |
| **S24** · planejado | Conector Kiwify & Checkout Instantâneo Pix: webhook receptor em tempo real, validação de token, conciliação e lançamento automático no ledger contábil do SMKON |
| **S25** · planejado | Fábrica Autônoma de Infoprodutos Digitais: geração completa de e-books, manuais e kits digitais pela IA, diagramação profissional em PDF com índice e capa 3D (S21) e cadastro para venda imediata |

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


## Reconciliação pós-E2E S14 — 21/11/2026 16:07 BRT

Esta seção supersede snapshots anteriores quando houver divergência. Evidências desta rodada: GitHub PR/compare/Actions, Vercel deployment/env inventory/AI Gateway e Supabase migrations/SQL somente de leitura. Nenhum secret foi exibido.

### GitHub e branches
- PR #82 permanece aberta em Draft, mergeable=true, sem reviews e sem threads de revisão. Compare real contra feature/smkon-production-readiness: 2 commits à frente / 0 atrás; base SHA 9dbf6cb9. Head documental consultado: 769d0756.
- PR #78 foi fechada sem merge após o compare apontar divergência. PR #82 contém as correções reaplicadas; nenhum merge foi realizado nesta rodada.
- Os nove splits S14 originais (#35–#42 e #46) permanecem integrados na branch de integração. PRs #75 (S4), #79 (governança) e #81 (Frente B) são escopos separados.
- Reviews e review threads da PR #82: nenhuma pendente.

### CI, Preview e E2E
- CI de código #44933511061: sucesso nos dois jobs no SHA 46a6d1f5; 288/288 testes unitários, dependency audit, typecheck, lint, build Next.js, migrations e testes SQL.
- CI documental #44933893554: sucesso nos dois jobs no head documental 769d0756.
- Preview READY do código S14: https://smkon-biemu0r7c-smkon.vercel.app — deployment dpl_AWf8HaAnCGR4FotuTT6qfRtWnWK1, branch fix/s14-timeout-ledger-rebased-20261121-1500, SHA 46a6d1f5b12eb2e5a8fdcd543a8a839ed930a68e.
- E2E Playwright #44933605001: concluído com sucesso, 36/36 testes em 3,6 min no Preview/SHA exato 46a6d1f5. Inclui agents.spec.mjs: limites, criação de run na fila e interrupção pelo kill switch; também CSP, navegação, autenticação, produtos e Content Studio. Artefato: https://github.com/smklj/smkon/actions/runs/44933605001/artifacts/14719220504.
- O E2E valida fila/kill switch e UI, não chama o modelo nem comprova o worker processando uma run com IA.
- O deployment mais recente do projeto no instante da consulta é de outra frente (S19, branch feature/s19-social-metricool-approvals, SHA b99392a6) e estava BUILDING; não confundir com o Preview S14 READY acima.
- Consulta de runtime logs do deployment S14 nos últimos 30 minutos não encontrou registros de /api/agents/worker. Isso não substitui teste de execução autenticada.

### Supabase — estado atual
- Staging xoyasrizivadxnpmzzno: 31 migrations; produção hpplboyysmfcjsnjrdmw: 20 migrations.
- Staging após o E2E: 116 agent_runs, todas status=killed; 0 agent_steps; 0 agent_model_usage; 0 agent_tool_grants; 0 content_items com agent_run_id. agent_settings: kill_switch=false, max_runs_per_day=500, max_steps_per_run=12.
- Produção: 0 agent_runs, 0 agent_steps, 0 agent_model_usage, 0 agent_tool_grants e 0 agent_settings.
- RLS permanece ativo nas tabelas S14 e content_items. Policies consultadas: leitura autenticada com escopo de organização; sem política para anon. As RPCs de execução/consumo seguem restritas a service_role, conforme auditoria anterior.
- As migrations S14 existem nos dois bancos, mas os version IDs diferem: staging 20261119101353 agent_draft_content, 20261119101414 agent_claim_queue, 20261119114718 agent_model_usage; produção 20261119040000, 20261119050000, 20261119060000. Isso é divergência de histórico; não prova por si só divergência de schema. Não executar repair/db push sem comparar definições e backup.
- Soma no ledger de staging e produção: 0 linhas, 0 input tokens, 0 output tokens e US$ 0.

### Vercel, OIDC, AI Gateway e Cron
- Inventário de envs (sem decrypt): SUPABASE_SECRET_KEY ausente. CRON_SECRET consta como sensitive separadamente em Preview e Production; valor não lido e comprimento mínimo de 32 caracteres não validado.
- AGENT_EXECUTOR_ENABLED=true em Preview e Production. AGENT_MODEL_PROVIDER=vercel-ai-gateway; AGENT_MODEL_AUTH=oidc; modelo anthropic/claude-haiku-5.5; AGENT_MONTHLY_BUDGET_USD=5.
- OIDC está selecionado, mas token e autenticação efetiva em runtime não foram comprovados.
- AI Gateway do projeto nos últimos 7 dias: nenhuma linha de uso (0 requests/tokens/custo). Budgets de team, project e defaults: nenhum.
- agent_model_usage está vazio nos dois bancos, consistente com o uso agregado zero do Gateway. Nenhuma chamada real ao modelo foi comprovada.
- O orçamento interno é soft: não há reserva atômica por chamada nem outbox durável para reconciliar custo se a RPC falhar após uma resposta cobrada.
- feature/smkon-production-readiness contém vercel.json com cron 17 11 * * * para /api/agents/worker e a rota do worker. GitHub Contents API retornou 404 para ambos os caminhos em main; logo o Cron S14 não está implantado/ativo em Production.
- O Cron secret não foi validado em conteúdo/comprimento; não contornar a redaction da API. Não há logs recentes do worker no deployment S14.

### Bloqueio para teste real
Não executar operations_review real enquanto faltarem: (1) SUPABASE_SECRET_KEY exclusiva de staging no Preview; (2) grants mínimos de leitura para operations_review; (3) budget externo com escopo isolado de Production; (4) validação segura do CRON_SECRET; (5) autenticação OIDC comprovada no runtime. O E2E aprovado não substitui esses gates.

### Segurança
Nenhum merge, alteração em main/Production, migration remota, alteração de secret, concessão de grant, criação de budget compartilhado ou chamada paga ao modelo foi executada nesta rodada.

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


## S14 — checkpoint operacional 21/11/2026 18:01 BRT

- Splits #35–#42 e #46 integrados; PR #82 e release #87 incorporadas. PRs #94/#95 também entraram na main.
- Production deployment READY `dpl_CgbrQ8jM7pzDCeWzCNbAQco5sUEZ` / SHA `d30c42a` inclui worker e é descendente do release #87; main está 4 commits à frente.
- Cron diário 08:17 BRT está na revisão implantada. Nenhuma invocação do worker foi observada na janela de logs disponível.
- S14 ainda não homologado com IA real: SUPABASE_SECRET_KEY ausente; grants Staging zero; budget externo zero; CRON_SECRET/OIDC sem prova runtime; AI Gateway 7d sem requests/tokens/custo; agent_model_usage zerado.
- CI S14 288/288 e E2E 36/36 no Preview exato 46a6d1f5; CI integração 350/350 em SHA anterior às últimas frentes.
- Staging 121 runs killed, sem steps/grants/usage; Production sem runs. Assinaturas de objetos auditados coincidem, mas versões de migrations S14 diferem; reconciliar histórico antes de qualquer repair/db push.
- Gate operacional: chave exclusiva de Staging, grants mínimos, budget externo isolado, validação de CRON_SECRET/OIDC, Preview/E2E do SHA de homologação, uma operations_review e reconciliação de tokens/custo com agent_model_usage.
- Nenhuma mudança de Production nesta auditoria.


## S14 — checkpoint operacional 22/11/2026 01:57 BRT

- Os nove splits originais (#35–#42 e #46) foram confirmados individualmente como merged. #82/#97 também merged; #102 fechada sem merge; PR #113 é a única aberta, Draft/mergeable, 15 ahead / 0 behind e docs-only.
- CI #44983092682 no head 7d957275: 418/418 testes unitários e 2/2 jobs success; migrations/SQL tests aprovados.
- E2E deployment_status #44983114589: 36/36 no Preview exato do SHA 7d957275; artifact 14738303182. O teste valida UI, fila, limites e kill switch; não chama o AI Gateway.
- Preview atual dpl_Exi3uZxvFqmX5mugDtKWsuuG9oKi READY. Production atual dpl_3RdCGJ2THbYE9aajDZGgGzwWTUnV READY no main SHA 84afe632. Cron /api/agents/worker, 17 11 UTC (08:17 BRT).
- Production registrou uma requisição GET não autenticada ao worker às 04:49:13Z, recusada como unauthorized. Isso prova que flag e formato do CRON_SECRET passaram suas validações nessa requisição; não prova Cron, OIDC, claim ou execução de IA.
- Staging: 148 runs, todas killed; 0 steps, 0 grants, 0 usage, 0 conteúdo vinculado; settings kill_switch=false, 500 runs/dia, 12 steps/run. Production sem dados S14.
- AI Gateway 7d: 0 requests/tokens/custo; budgets de projeto/default e regras ausentes. agent_model_usage zerado nos dois bancos, consistente com uso zero, sem provar reconciliação de cobrança.
- Gate operacional permanece: SUPABASE_SECRET_KEY exclusiva de staging ausente, grants mínimos ausentes, budget externo isolado ausente e OIDC não comprovado em runtime. Não executar operations_review real até fechar esses gates.
- Nenhum merge, alteração de Production, migration remota, secret, grant, budget ou chamada paga foi executado.

---

## S14 — checkpoint de fechamento operacional 22/11/2026 03:00 BRT

- Os nove splits originais (#35–#42 e #46) permanecem integrados. #82 e #97 merged; #102 fechada sem merge; PR #113 é a única PR aberta e continua Draft.
- PR #113 head `2513d971`, 20 ahead / 0 behind, somente cinco documentos. CI #44987586564: 418/418 e 2/2 jobs success.
- E2E do head atual cancelado/skipped; último E2E Staging aprovado #44983114589, 36/36 no SHA de aplicação `7d957275`, app-equivalente porque a PR atual é docs-only.
- Preview atual READY em `dpl_9oZkfe9pm5D1oXa5RuuVbpmBLFcS`; Production READY em `dpl_3RdCGJ2THbYE9aajDZGgGzwWTUnV`, main `84afe632`. Sem alteração de Production.
- Worker e Cron declarados em Production, 17 11 UTC (08:17 BRT). Às 03:00 a próxima execução diária ainda era futura.
- Staging: 150 runs killed, 0 steps/grants/usage/linked content; Production sem dados S14. RLS 6/6 em ambos; migrations: 31 nomes correspondentes, 0/31 version IDs iguais.
- AI Gateway 7d: 0 requests/tokens/custo; budgets externos/default e regras ausentes. agent_model_usage vazio nos dois bancos; nenhuma chamada real comprovada.
- Pendências para homologação: SUPABASE_SECRET_KEY exclusiva de staging, grants mínimos, budget externo isolado, validação CRON_SECRET e OIDC em runtime. Sem esses gates, não executar operations_review real.

---

## Atualização operacional — 22/11/2026 03:56 BRT
- CI #44992062696 no HEAD 8f9bd8: 2/2 jobs success, 418/418 testes, typecheck/lint/audit/build e migrations/SQL aprovados. E2E PR #44992062742: 36/36 no job local com Supabase staging; job Playwright · Staging skipped pelo evento pull_request. Último E2E via deployment_status: #44983114589, 36/36 no SHA de aplicação 7d957275.
- PR #113 permanece Draft/mergeable; branch 24 commits ahead / 0 behind de main 84afe632; apenas os cinco documentos S14 alterados. Splits #35–#42 e #46 integrados; #82/#97 merged; #102 fechada sem merge.
- Preview do HEAD 7b5c421 READY: dpl_8idR4fUwcvP1TWjLaRDEawoDQiDB, https://smkon-2011ifjfr-smkon.vercel.app. Production READY: dpl_3RdCGJ2THbYE9aajDZGgGzwWTUnV, main 84afe632; nenhuma alteração Production.
- Cron /api/agents/worker às 17:11 UTC (08:17 BRT). No checkpoint 03:56, ainda futuro. Runtime logs Production nos últimos 30 min: zero linhas; janela de 3h indisponível pela retenção Hobby.
- Inventário sem decrypt: AGENT_EXECUTOR_ENABLED=true em Preview/Production; CRON_SECRET Sensitive por target; SUPABASE_SECRET_KEY/SUPABASE_SERVICE_ROLE_KEY ausentes; Gateway/OIDC/Claude Haiku 5.5 e teto interno US$5. OIDC runtime não comprovado.
- Staging: 152 runs, todas killed; 0 steps/grants/usage/drafts vinculados; kill_switch=false, max_runs_per_day=500, max_steps_per_run=12. Production sem dados S14. RLS 6/6 em ambos; policies 5 S14 + 4 content_items; funções agent_* EXECUTE authenticated=6, service_role=12, postgres=19.
- Ambos os bancos têm 31 nomes de migrations, mas 0/31 version IDs iguais; não executar db repair/db push sem reconciliação formal.
- AI Gateway 7d: 0 requests/tokens/custo; budgets team/project/default e regras ausentes. agent_model_usage: 0 linhas/tokens/custo nos dois bancos. Nenhuma chamada real comprovada.
- Gate permanece: chave service exclusiva de staging, grants mínimos, budget externo isolado e prova OIDC em runtime. Não executar operations_review real antes desses gates.
- Nenhuma alteração de main/Production, migration remota, secret, grant, budget ou chamada paga nesta rodada.

## S14 — checkpoint operacional 22/11/2026 05:02 BRT
- Splits #35–#42 e #46 integrados; #82/#97 merged; #102 fechada sem merge; #113 é a única PR aberta, Draft/mergeable, 26 ahead/0 behind. Compare confirma apenas cinco arquivos docs.
- CI #44996313091 no head c7deb14: 418/418 e 2/2 jobs success. E2E PR #44996313030 cancelado/skipped; último E2E Staging #44983114589: 36/36 no SHA de aplicação 7d957275 (código equivalente; PR docs-only).
- Preview c7deb14 READY; Production main 84afe632 READY. Cron 17 11 UTC (08:17 BRT); às 05:02 ainda futuro. Sem mudança de Production.
- Staging: 154 runs killed, 0 steps/grants/usage/linked content; kill_switch=false, 500 runs/dia, 12 steps/run. Production sem dados S14.
- AI Gateway 7d: 0 requests/tokens/custo; budgets project/default e rules ausentes. agent_model_usage vazio nos dois bancos.
- Gates pendentes: SUPABASE_SECRET_KEY exclusiva de staging, grants mínimos, budget externo isolado, validação segura de CRON_SECRET e prova OIDC runtime. Não executar run real até aprovação dos gates.
