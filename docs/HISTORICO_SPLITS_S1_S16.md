# SMKON — Histórico reconstruído dos splits S1–S16

**Data da reconstrução:** 20/11/2026  
**Fonte:** histórico GitHub de `smklj/smkon`, `docs/ROADMAP_SPLITS.md`, `docs/INTEGRATION_STATUS.md`, handoffs S1/S3/S5/S5.1/S6/S6.1/S8/S9/S10/S12/S13/S14/S15/S16 e PRs registrados.  
**Branch de referência:** `feature/smkon-production-readiness`.

> Este documento reconstrói o histórico que possui evidência no repositório. Não presume que código em preview esteja em produção, nem que integração planejada esteja conectada. Onde os documentos divergem ou estão desatualizados, a divergência é explicitada.

## 1. Duas divisões diferentes

### 1.1 Três domínios operacionais de receita

O PR #1 criou a separação conceitual e arquitetural em:
1. **Split 01 — Mídia e anúncios:** investimento e performance de mídia paga; spend é custo, não receita.
2. **Split 02 — Vendas próprias:** pedidos da SMKON, com estados de pagamento, envio, liquidação, cancelamento e reembolso.
3. **Split 03 — Afiliados e comissões:** cliques atribuídos e comissões previstas/aprovadas/revertidas/pagas.

Documento mestre: `docs/architecture/SMKON_SPLITS_MASTER.md`, branch `feature/revenue-stream-split`. As conexões Meta Ads, Mercado Livre, Amazon, TikTok Shop etc. são descritas como planejadas e dependentes de elegibilidade, OAuth, escopos e validação. Não devem ser tratadas como integrações operacionais apenas por constarem na arquitetura.

### 1.2 Dezesseis splits de execução

O roadmap `docs/ROADMAP_SPLITS.md` organiza o trabalho técnico S1–S16 em P0–P4. S7.2 é uma frente de experiência adicional, não um novo split numerado no conjunto S1–S16.

## 2. Linha do tempo registrada

### 17/11/2026 — arquitetura inicial e fundação
- **PR #1 — Split 01/02/03:** separação dos três domínios de receita e regras de governança. Merge registrado.
- **PR #2 — fundação de Auth/tenancy:** FKs compostas, testes de RLS e isolamento entre tenants, Supabase SSR, login/cadastro/callback PKCE. Merge registrado; migrations hospedadas e Auth ainda dependiam de configuração.
- **PR #3 — Content Studio MVP:** editor/brief, rascunhos locais, filtros e previews por canal; API e schema organizacionais como base. Continua listado como aberto no levantamento; o próprio PR ressalta que a UI ainda usava localStorage, a migration não estava aplicada e não havia publicação de plataforma.

### 18/11/2026 — integração principal, segurança, banco e módulos iniciais
- **PR #4 — integração principal:** reuniu Admin Panel, Content Studio e Product Intelligence inicial na branch de integração e foi mergeado em `main`. O registro alerta que Product Intelligence ainda não persistia, o histórico remoto de migrations estava vazio naquele momento, variáveis Vercel não estavam configuradas e não houve deploy Production.
- **S1 — P0 Segurança e Integridade / PR #5:** Proxy fail-closed; bootstrap atômico de workspace; aprovação vinculada ao hash/versão exata; auditoria append-only; ledger imutável; erros sem vazamento. A suíte S1.1 registrou 80/80 afirmações SQL e 14/14 unitários. PR #5 mergeado na integração. O handoff registra validação inicial reprovada por falta de execução de testes, seguida da execução da suíte.
- **S3/S3.1 — Supabase:** PR #6 escondeu funções internas da API e registrou divergências do histórico remoto; PR #8 documentou aplicação das migrations 170000/180000 e alinhamento do histórico. PR #7 abriu documentação de reconciliação segura e plano de convites/idempotência, em draft e sem alterações remotas. O handoff S3 documenta schema remoto, RLS, tipos e configuração Auth ainda dependente do Owner.
- **S5 — convites:** PR #9 implementou convites de uso único com hash; PR #10 integrou S3.1 + S5; PR #11 tratou bootstrap do workspace no primeiro login. Handoff S5 registra convites em produção.
- **S8 — ciclo financeiro de comissão:** PR #12 implementou estados/histórico/ledger; PR #13 release. Handoff registra S8 em produção, mas ingestão real e conciliação ficaram para S11.
- **S6 — observabilidade/segurança:** PR #14 implementou headers, rate limit e logs redigidos; PR #15 release. Handoff registra S6 em produção.
- **S9 — Product Intelligence:** PR #16 implementou evidências verificáveis e score baseado em evidência; PR #17 release. Handoff registra S9 em produção, com coleta automática ainda pendente.
- **QA/E2E:** PR #18 adicionou staging isolado e smoke suite Playwright; PR #19 registrou primeira execução E2E verde e correções; PR #20 consolidou QA/E2E e confirmação de status.
- **S10 — mídia, direitos e calendário:** PR #21 implementou calendário editorial e fila de publicação em dry-run; PR #22 mídia privada no Storage e licenças; PR #24 release. O handoff S10 registra calendário, fila dry-run, mídia e licenças implementados/testados. Dry-run não equivale a publicação real.
- **S12 — dashboard:** PR #23 implementou visão geral com dados reais via `workspace_overview`; PR #25 documentou migration no staging e produção; PR #26 release. Handoff S12 registra em produção.

### 18–19/11/2026 — agentes, UX, CRM, performance e camada de domínio
- **S13 — infraestrutura de agentes:** PR #27 implementou execuções, limites, allowlist e kill switch; PR #28 adicionou E2E de agentes/kill switch no staging; PR #29 release; PR #30 documentou S13 em produção. Handoff S13 descreve Planner → Executor → Verifier, `agent_runs`, `agent_steps`, ferramentas permitidas e ausência de ferramentas de publicação/aprovação.
- **S7.2 — movimento e feedback:** PR #31 implementou fases A+B; PR #32 release e correção de data das evidências; PR #33 gráficos/hierarquia fase C; PR #34 release. Roadmap registra fases A, B e C implementadas, com linguagem monocromática e cor para estados.
- **S14 — executor de agentes:** PR #35 documentou plano de 9 etapas; #36 núcleo Planner → Executor → Verifier; #37 ferramentas reais de leitura; #38 `draft_content` restrito a rascunho; #39 reserva de fila/lease; #40 worker `/api/agents/worker` com `CRON_SECRET` e desligado por padrão; #41 adaptador AI Gateway sem chave, Verifier de evidência e timeout; #42 teto mensal, registro de consumo e opção OIDC; #46 detalhe da execução e handoff. O roadmap declara executor integrado, mas ainda lista dependências de segredo Supabase, crédito/orçamento AI Gateway, cron/merge e primeira execução real controlada. O handoff proíbe inferir publicação operacional.
- **S5.1 — membros e organizações:** PR #43 implementou membros, papéis e seletor de organização. A execução 6 de integração confirmou a migration no staging, conferiu grants/RLS e endureceu E2E. A migration de produção continuava pendente.
- **S6.1 — CSP/logs:** PR #45 implementou CSP com nonce por requisição e destino externo de logs. Handoff concluído; escolha/configuração de destino externo de logs depende do Owner.
- **S14 detalhe/handoff:** PR #46 concluiu a tela de detalhe da execução e handoff do executor.
- **S15 — audiência/CRM/LGPD:** PR #47 implementou contatos com base legal, consentimento append-only, pedidos do titular, prazo de 15 dias, exportação e anonimização. Handoff registra testes SQL/unitários/build e migration aplicada no staging; produção pendente de autorização.
- **S16 — performance:** PR #49 diagnóstico, keyset pagination, índices medidos e carga; PR #51 paginação de agentes, cache seguro e carga autenticada; PR #53 paginação de audiência e handoff. Handoff registra medições, melhorias e 216/216 unitários no marco do S16; migration aplicada no staging na execução 6. Produção ainda pendente; E2E adicional da API de produtos foi recomendado.
- **S4 — camada de domínio:** PR #54 centralizou validação e camada de domínio de produtos (etapas 1, 2 e 2a); PR #55 avançou domínio de conteúdo/publicação (etapa 2b). Ambos mergeados. O registro da execução 6 deixa 2c mídia, 2d financeiro, 2e tenancy, 2f audiência, 2g agentes e etapa 3/handoff como pendentes.
- **Integração execução 6 — PR #56:** registrou CI verde, 238/238 unitários, 19/19 arquivos de testes de banco, typecheck/lint/build verdes, staging 21/21 migrations e E2E de membros endurecido. O PR #56 aparece aberto no levantamento; preview READY associado ao commit da branch não prova deploy de produção.

## 3. Situação por split (síntese)

| Split | Tema | Estado sustentado pelos registros consultados |
|---|---|---|
| S1 | Segurança e integridade | Implementado, testado e integrado na branch; PR #5 |
| S2 | Configuração de repositório/Auth/Vercel | Itens de configuração do Owner; não há handoff que prove todos concluídos |
| S3 | Banco/Supabase e alinhamento | Base aplicada/alinhada em etapas; hardening e novas migrations exigem controle por ambiente |
| S4 | Camada de domínio | Etapas 1–2b mergeadas (#54/#55); 2c–2g e handoff pendentes no último status detalhado |
| S5 | Convites/RBAC | Convites registrados em produção; S5.1 membros implementados e staging confirmado; migration de produção pendente |
| S6 | Observabilidade/headers/rate limit | Handoff em produção |
| S7 | Design system/app shell | Build/CI e integração; validação visual manual ainda pendente |
| S7.2 | Movimento/feedback | Fases A–C implementadas e integradas |
| S8 | Ciclo de comissões | Handoff em produção; ingestão real/conciliação dependem do S11 |
| S9 | Product Intelligence | Handoff em produção; coleta automática pendente |
| S10 | Mídia, licenças e calendário | Implementado/testado; fila em dry-run, sem prova de publicação real |
| S11 | Conector financeiro real | Parcial: adapter/OAuth server-side e snapshots idempotentes em staging; sem OAuth real, backfill ou conciliação financeira; não operacional |
| S12 | Dashboard com dados reais | Handoff em produção; migration aplicada em staging e produção |
| S13 | Infraestrutura de agentes | Handoff em produção |
| S14 | Executor real de agentes | Código/handoff integrados; primeira execução real e credenciais/orçamento/cron ainda dependentes de Owner |
| S15 | Audiência/CRM/LGPD | Implementado/testado; staging aplicado; produção pendente |
| S16 | Performance/paginação/cache/carga | Implementado/testado; staging aplicado no status da execução 6; produção pendente |

## 4. PRs relevantes em ordem de criação

| PR | Assunto | Resultado observado |
|---:|---|---|
| #1 | Três domínios de receita | Mergeado |
| #2 | Tenancy/Auth base | Mergeado |
| #3 | Content Studio MVP | Aberto no levantamento |
| #4 | Integração principal | Mergeado em `main` |
| #5 | S1/S1.1/S7 | Mergeado |
| #6 | S3.1 funções internas | Mergeado |
| #7 | Reconciliação/readiness | Aberto, draft |
| #8 | Estado remoto S3 | Mergeado |
| #9–#15 | S5, S3.1/S5, bootstrap, S8 e S6 | Mergeados |
| #16–#26 | S9, QA/E2E, S10 e S12 | Mergeados |
| #27–#42 | S13, S7.2 e etapas do S14 | Mergeados |
| #43–#46 | S5.1, integração, S6.1 e S14 detalhe | Mergeados |
| #47–#53 | S15, integrações, S16 | Mergeados |
| #54–#55 | S4 etapas 1–2b | Mergeados |
| #56 | Integração execução 6 | Aberto no levantamento |
| #57 | S11 Mercado Livre — OAuth server-side e snapshots idempotentes | Mergeado por squash em `feature/smkon-production-readiness`; não promovido a `main` |

## 5. Divergências e limites documentais

1. `docs/INTEGRATION_STATUS.md` na versão consultada antes do PR #56 dizia que S4 não havia começado. O PR #54/#55 e a atualização incluída no PR #56 provam que etapas 1–2b foram implementadas e mergeadas. Para S4, prevalece a atualização mais recente do PR #56.
2. O roadmap e os handoffs descrevem o estado de implementação; não substituem consulta atual ao Supabase/Vercel.
3. No registro de execução 6, staging estava com 21/21 migrations. Produção ainda tinha pendentes `workspace_members`, `audience_consent` e `keyset_pagination_indexes`; `agent_model_usage` apareceu na produção sem origem confirmada pela frente de integração.
4. PR #56 contém um preview Vercel READY, não uma promoção de Production.
5. PRs #3 e #7 aparecem abertos/draft e não devem ser confundidos com as entregas já integradas pela branch de readiness.
6. O histórico de commits pesquisado não retornou resultados via busca vazia do conector; a linha do tempo acima foi reconstruída a partir de PRs, branches, roadmap e handoffs, não de uma exportação completa de cada commit.

## 6. Próxima sequência recomendada (sem executar ações protegidas)

1. Atualizar o quadro de S4 e fechar o handoff das etapas 2c–2g/3.
2. Confirmar estado atual e destino de PR #56, #7 e #3; revisar se #3 está obsoleto frente ao Content Studio integrado.
3. Resolver a origem da migration `agent_model_usage` que apareceu na produção sem registro da frente de integração.
4. Planejar, com aprovação explícita do Owner, migrations de produção na ordem documentada: `workspace_members`, `audience_consent`, `keyset_pagination_indexes`.
5. Revisar segurança P0 (rate limit pré-autenticação, SECURITY DEFINER, RLS e proteção de senha vazada) antes de qualquer promoção.
6. Configurar credenciais/AI Gateway/cron somente após decisão e autorização do Owner; executar primeiro uma operação real de agente no staging com orçamento baixo.
7. Só depois de CI, E2E, migrations, variáveis e smoke tests comprovados, pedir autorização para merge da integração em `main` e promoção para produção.

## 7. Referências

- [Roadmap S1–S16](https://github.com/smklj/smkon/blob/feature/smkon-production-readiness/docs/ROADMAP_SPLITS.md)
- [Status da integração](https://github.com/smklj/smkon/blob/feature/smkon-production-readiness/docs/INTEGRATION_STATUS.md)
- [Protocolo entre agentes](https://github.com/smklj/smkon/blob/feature/smkon-production-readiness/docs/AI_COORDINATION.md)
- [Documento mestre dos três domínios](https://github.com/smklj/smkon/blob/feature/revenue-stream-split/docs/architecture/SMKON_SPLITS_MASTER.md)
- [Handoff S14](https://github.com/smklj/smkon/blob/feature/smkon-production-readiness/docs/S14_HANDOFF.md)
- [Handoff S15](https://github.com/smklj/smkon/blob/feature/smkon-production-readiness/docs/S15_HANDOFF.md)
- [Handoff S16](https://github.com/smklj/smkon/blob/feature/smkon-production-readiness/docs/S16_HANDOFF.md)


## 21/11/2026 — S11 Mercado Livre: PR #57 e follow-up de performance

- PR #57 foi mergeado por squash na branch de integração (`feature/smkon-production-readiness`), commit `8c73cbc`; não houve merge em `main` nem release de produção.
- O incremento inclui OAuth server-side, AES-256-GCM, refresh lease/CAS, conexão one-click, importação manual limitada a 50 pedidos e persistência transacional/idempotente de snapshots sem PII.
- CI #412 passou nos jobs Quality e Database/SQL; E2E #193 foi reportado como aprovado contra staging/Preview. O Preview READY corresponde ao commit de runtime `af27230`, não ao merge commit.
- Quatro migrations S11 estão registradas no Staging; produção continua com 20 migrations e sem S11/keyset. Nenhuma migration/deploy de produção foi executada.
- Auditoria identificou quatro índices de FK S11 ausentes no Staging. Follow-up criado em `fix/s11-performance-hardening` com migration aditiva e teste estrutural; aguarda CI/PR e aplicação controlada em staging.
- OAuth real, backfill, paginação histórica e reconciliação de pagamentos/taxas/estornos/repasses continuam pendentes.


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
