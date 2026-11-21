# SMKON — Protocolo de coordenação entre agentes

**Documento vivo de coordenação.** Atualizar sempre que houver auditoria, decisão arquitetural, implementação, bloqueio, alteração de ambiente ou mudança de prioridade.

## Objetivo

Manter Samuel, ChatGPT e Claude trabalhando sobre o mesmo estado verificável do SMKON, evitando decisões divergentes, retrabalho, alterações duplicadas e contexto desatualizado.

## Fonte única da verdade

1. **Código e histórico:** repositório GitHub `smklj/smkon`.
2. **Estado de integração e validações:** `docs/INTEGRATION_STATUS.md`.
3. **Decisões, prioridades e bloqueios:** este documento, com links para PRs, commits, handoffs e evidências.
4. **Estado real dos ambientes:** Supabase e Vercel; nunca presumir que documentação ou preview equivalem a produção.

Não considerar mensagens isoladas de chat como registro oficial de implementação.

## Divisão de responsabilidades

### ChatGPT
- Auditar arquitetura, código, banco, integrações e documentação.
- Identificar riscos, inconsistências, dependências e critérios de aceite.
- Propor planos técnicos e decompor trabalho em tarefas verificáveis.
- Quando autorizado e tecnicamente possível, executar alterações no repositório ou nos serviços conectados.
- Registrar no GitHub o que foi analisado, alterado, validado e o que continua pendente.
- Não declarar uma tarefa concluída sem evidência observável.

### Claude
- Consultar este protocolo e `docs/INTEGRATION_STATUS.md` antes de iniciar trabalho relacionado.
- Verificar o estado atual do GitHub e dos ambientes antes de implementar.
- Executar as tarefas atribuídas, respeitando decisões e critérios de aceite registrados.
- Atualizar documentação, testes, PRs e handoffs após cada execução.
- Registrar commits, arquivos alterados, comandos/testes executados, resultados e limitações.
- Não sobrescrever decisões vigentes sem registrar justificativa e impacto.

### Samuel (Owner)
- Priorizar objetivos e aprovar decisões que afetem produção, segurança, custos, credenciais ou dados.
- Autorizar migrations e deploys de produção quando necessários.
- Resolver conflitos de prioridade ou decisões arquiteturais que exijam escolha de produto.

## Protocolo obrigatório antes de qualquer execução

1. Ler este arquivo e `docs/INTEGRATION_STATUS.md`.
2. Consultar branch, PRs, commits recentes e estado atual do deployment.
3. Verificar migrations e estado do ambiente afetado, quando aplicável.
4. Conferir se outro agente já iniciou ou concluiu a mesma tarefa.
5. Trabalhar em branch/PR apropriado; não alterar produção sem autorização explícita.
6. Executar testes pertinentes e registrar resultados reais.
7. Atualizar a documentação compartilhada no mesmo PR ou commit da alteração.
8. Deixar explícito o próximo passo e quem deve executá-lo.

## Formato obrigatório de atualização

Para cada execução, registrar:

- **Data/hora (UTC):**
- **Agente:** ChatGPT ou Claude
- **Objetivo:**
- **Branch / PR / commit:**
- **Arquivos alterados:**
- **Ambiente afetado:** local, staging ou produção
- **Ações executadas:**
- **Validações e resultados:** incluir comandos e contagens quando disponíveis
- **Bloqueios / riscos:**
- **Decisões que exigem Samuel:**
- **Próxima ação / responsável:**

Distinguir sempre:
- **Implementado:** código/alteração existe.
- **Validado:** teste ou verificação foi executado e passou.
- **Publicado:** deployment foi promovido ao ambiente pretendido.
- **Operacional:** fluxo real foi comprovado de ponta a ponta.

Esses estados não são intercambiáveis.

## Estado inicial registrado — 20/11/2026

Auditoria de referência realizada por ChatGPT, consultando GitHub, Vercel e Supabase.

### Evidências observadas
- Repositório: `smklj/smkon`.
- Branch de integração: `feature/smkon-production-readiness`.
- Último commit de integração consultado: `d0d83a4cc422b76022738d84a48f6776beb21a18` (`fix/integration-run6`).
- PR #56 identificado como aberto na auditoria; verificar estado antes de agir.
- Último preview Vercel consultado: READY, associado ao commit `d0d83a4`. Isso não comprova promoção para Production.
- Supabase produção: 20 migrations identificadas.
- Supabase staging: 21 migrations identificadas.
- Migrations presentes no staging e ausentes na produção: `workspace_members`, `audience_consent`, `keyset_pagination_indexes`.
- `agent_model_usage` aparece na produção; origem da aplicação precisa ser confirmada.
- Produção: 32/32 tabelas públicas consultadas com RLS habilitado.
- Security Advisors: alertas para funções SECURITY DEFINER, `rate_limit_consume` acessível por anon, `rate_limit_buckets` sem política RLS e proteção contra senhas vazadas desabilitada.
- Performance Advisors: quatro FKs sem índice de cobertura e 67 índices reportados como não utilizados.
- Registro de integração: 238/238 testes unitários, 19/19 arquivos de testes de banco, typecheck, lint e build aprovados localmente. Confirmar novamente no commit/PR atual antes de release.
- Lista de Edge Functions consultada no projeto de produção retornou vazia; confirmar se a arquitetura atual realmente depende de Edge Functions ou se foram removidas/substituídas.

### Prioridades iniciais
1. **P0 — Segurança:** revisar privilégios das funções SECURITY DEFINER, exposição de `rate_limit_consume`, política da tabela `rate_limit_buckets`, Auth e isolamento multi-tenant.
2. **P1 — Release:** reconciliar migrations de produção com staging, verificar PR #56, CI e destino do deployment.
3. **P2 — Produto:** validar persistência e fluxos ponta a ponta de Content Studio, Product Intelligence, Finance Center e mídia.
4. **P3 — Integrações:** comprovar conexões, OAuth, filas, publicação e conciliação com provedores.
5. **P4 — Inteligência:** evoluir o Market Opportunity Radar com scoring reproduzível e evidências.

### Restrições
- Não aplicar migrations em produção sem autorização explícita do Owner.
- Não promover deployment para produção sem autorização explícita do Owner.
- Não alterar, imprimir ou registrar valores de segredos, tokens ou credenciais.
- Não assumir que RLS habilitado significa isolamento multi-tenant validado.
- Não assumir que uma função SECURITY DEFINER é vulnerável apenas por aparecer no Advisor; revisar grants e corpo/validações.
- Não executar alterações destrutivas para resolver divergências sem backup, plano de rollback e aprovação.

## Regra de continuidade

Ao terminar qualquer tarefa, o agente responsável deve atualizar este protocolo e, quando aplicável, `docs/INTEGRATION_STATUS.md`, abrir/atualizar PR e deixar a próxima ação explícita. O próximo agente deve continuar do estado registrado, não recomeçar a análise nem presumir que trabalho não documentado foi concluído.


## Reconstrução histórica S1–S16 — 20/11/2026

- **Agente:** ChatGPT
- **Objetivo:** reconstruir a linha do tempo dos 16 splits a partir do GitHub, PRs, roadmap, status de integração e handoffs.
- **Branch:** `feature/smkon-production-readiness`
- **Documento criado:** `docs/HISTORICO_SPLITS_S1_S16.md`
- **Commit:** `2b0f6367b7e176047a94e9cf8e577aa91f548d48`
- **Escopo:** separa os três domínios de receita dos 16 splits de execução; registra PRs #1–#56, status por split, cronologia, diferenças entre implementado/validado/staging/produção e pendências.
- **Descoberta importante:** S4 não está totalmente pendente: PRs #54 e #55 integraram etapas 1–2b; restam 2c–2g e handoff, conforme a atualização do PR #56. O status antigo do documento de integração dizia “não iniciada” e ficou desatualizado.
- **Estado consultado:** PR #56 aberto; PR #7 e #3 também aparecem abertos. O PR #56 registra CI e testes locais verdes (238/238 unitários, 19/19 arquivos SQL, typecheck/lint/build) e staging 21/21 migrations; preview READY não significa Production.
- **Limites:** reconstrução baseada em PRs, roadmap e handoffs; a busca de commits vazia do conector não retornou uma exportação completa de commits. O estado de produção e as pendências de autorização precisam ser revalidados antes de qualquer release.
- **Ações externas:** nenhuma migration, alteração de segredo, merge em `main` ou promoção de produção executada.
- **Próxima ação:** usar o histórico como base para fechar S4, revisar PRs abertos e resolver as pendências de segurança/produção com autorização do Owner.


## Auditoria S4/S11/S14, segurança e release — 20/11/2026

- **Agente:** ChatGPT · **Documento:** `docs/RELEASE_AUDIT_S4_S11_S14_SECURITY.md`
- **Commit do relatório:** `d1738d49632b9cfb452f5be727c42e56b2c99356`
- **Escopo:** inspeção read-only de código/árvore GitHub, PR #56, migrations staging/produção, Security Advisors e grants da tabela de rate limit.
- **S4:** etapas 1, 2, 2a e 2b concluídas (#54/#55); 2c mídia, 2d financeiro, 2e tenancy, 2f audiência, 2g agentes e handoff pendentes. Staging 21/21 migrations remove o bloqueio anterior para regenerar tipos.
- **S11:** não foi encontrado conector financeiro real nem handoff S11 no commit; existem placeholders de conexões e módulo de comissões. Provedor inicial e credenciais dependem do Owner.
- **S14:** executor implementado, mas nenhuma chamada real ao AI Gateway foi comprovada. A migration `agent_model_usage` agora consta na produção, atualizando o handoff antigo; a presença/validade das variáveis e OIDC ainda precisa ser verificada sem expor segredos.
- **Ambientes:** staging 21/21 migrations; produção 20/21, falta `keyset_pagination_indexes`. PR #56 aberto e GitHub retornou `mergeable=false`. Preview READY não é Production.
- **Segurança:** `rate_limit_consume` SECURITY DEFINER executável por anon/authenticated; corpo tem `search_path=''`, allowlist de scopes e valida subject de 64 hex. Uso anon parece intencional para login pré-auth, portanto não revogar em lote. `rate_limit_buckets` sem políticas RLS; grants diretos observados somente para postgres/service_role. 31 funções SECURITY DEFINER para authenticated exigem revisão individual; leaked-password protection desligada.
- **Ações:** nenhuma migration, alteração de segredo/Auth, merge, deploy ou chamada paga executada.
- **Próximo responsável:** ChatGPT/Claude pode continuar S4 e análise de código; Samuel precisa decidir provedor/credenciais S11, autorizações de Auth/produção e janela de release.


## Decisão S11 — 20/11/2026

- **Agente:** ChatGPT, decisão operacional tomada para destravar a frente sem solicitar escolha adicional ao Owner.
- **Decisão:** Mercado Livre como primeiro provedor; staging do SMKON como primeiro ambiente; usuários/dados de teste do ambiente de desenvolvedor do provedor quando disponíveis.
- **Modo:** OAuth e ingestão controlada, inicialmente read-only/dry-run; sem ações de escrita no marketplace.
- **Registro técnico:** `docs/S11_HANDOFF.md`.
- **Justificativa:** é uma das opções já previstas no roadmap; limitar o primeiro adapter reduz escopo e permite validar OAuth, paginação, idempotência, conciliação e isolamento antes de adicionar Amazon.
- **Limites:** não conecta conta real, não cria secrets, não habilita sync recorrente, não aplica migrations, não gera custo pago, não faz merge nem deploy de produção.
- **Próxima ação:** inspecionar os padrões reais de OAuth/connections/tenancy/finance; implementar adapter e fixtures sem credenciais; submeter qualquer migration como diff revisável antes de aplicação.


## S11 — primeira implementação em revisão — 21/11/2026 UTC

- **Agente:** ChatGPT
- **Branch:** `feature/s11-mercado-livre-adapter`
- **PR:** [#57 — adapter server-side Mercado Livre](https://github.com/smklj/smkon/pull/57) (Draft; aberto; não mergeado).
- **Handoff:** `docs/S11_HANDOFF.md` atualizado na branch do PR.
- **Implementado:** tipos, helpers puros de state/PKCE S256/expiração, URL de autorização Brasil, troca server-side de code/refresh e cliente GET-only com host fixo/timeout/limite de resposta; testes unitários iniciais.
- **Não implementado:** callback/rotas, armazenamento one-time de state, secret store/criptografia, persistência de tokens, refresh lock, mapper financeiro, sync, repository e migration.
- **Validação:** testes, typecheck e lint ainda não executados; PR permanece Draft.
- **Ambientes:** nenhuma chamada ao Mercado Livre; nenhuma conta ou credencial; nenhuma migration ou alteração em staging/produção.
- **Próxima ação:** CI e revisão do PR; depois desenhar state one-time e armazenamento seguro com base em capacidade real do ambiente, antes de callbacks OAuth.


### S11 — correção após CI inicial (21/11/2026 UTC)

- Primeira execução CI do PR #57: typecheck/lint OK; testes SQL/migrations OK; unit tests 238/239 (um arquivo falhou ao resolver imports ESM sem extensão); build foi pulado por falha anterior.
- Corrigido import dos testes com extensão explícita `.ts`, conforme padrão existente; corrigida normalização de scopes OAuth e validação de `token_type=bearer`.
- Último commit de código: `63eee98244f57772bd1e08f8a0e46fdf39495d52`.
- Nova execução CI ainda não confirmada. PR continua Draft, sem merge/deploy.


### S11 — CI verde e verificação de ambiente (21/11/2026 UTC)

- PR #57 head `520671b10cc7ac7cab18fb7dbc3e0a2051ea60a0`: typecheck, lint, unit tests, build e SQL/migration tests passaram. CI push e CI pull_request concluídos com sucesso.
- E2E disparado por deployment_status foi cancelado; não confundir com o CI principal.
- Vercel Preview verificado sem descriptografar secrets: nenhuma configuração Mercado Livre presente; sem credenciais OAuth, sem integração ativa.
- Próximo passo técnico: módulo de cifragem/persistência segura e isolamento multi-tenant; manter sem chave real, sem token, sem migration aplicada. PR #57 continua Draft, sem merge/deploy.


## Atualização S11 — 21/11/2026 UTC

- Branch `feature/s11-mercado-livre-adapter`, PR #57 continua Draft e aberto.
- Implementado núcleo de cifragem AES-256-GCM para tokens, com AAD amarrado a organization + provider + external user, envelope versionado, validação de IV/tag/ciphertext e suporte a keyring com key id.
- Entry point de uso server-side separado com `server-only`; testes cobrem round-trip, adulteração, isolamento contextual, key rotation e payload inválido.
- Commits do incremento: `4bbdec3`, `525c3eb`, `505fb53`, `9961b9c`.
- CI no head `9961b9cf5197e3ba72962e6fd32170d85903efba` estava pendente ao registrar; não declarar verde antes de consultar Actions.
- Próxima prioridade: validar CI; depois revisar schema real e desenhar repository/migration de conexões com RLS/grants mínimos e membership check server-side. Refresh rotativo exige serialização/CAS antes de ser integrado.
- Não criar/configurar chave real, conectar contas, aplicar migration em ambientes compartilhados, fazer merge em main ou deploy sem autorização explícita.


### Persistência server-side e refresh serializado — 21/11/2026 UTC

- Migration preparada: `supabase/migrations/20261121130000_mercado_livre_credentials.sql`.
- A migration cria `mercado_livre_credentials`, vinculada por FK composta a `source_connections(id, organization_id)`; guarda apenas envelope cifrado JSONB, expiração e versão do token. RLS habilitado; sem grants para anon/authenticated; acesso de tabela somente service_role.
- RPCs service_role-only: `mercado_livre_claim_refresh` (lease transacional para impedir refresh simultâneo), `mercado_livre_save_refreshed_tokens` (CAS por versão e lease ativo) e `mercado_livre_release_refresh`.
- Repository server-only adicionado. Escrita de credenciais exige sessão autenticada, papel owner/admin e validação da conexão no mesmo organization_id, provider Mercado Livre e domínio owned_sales antes do uso do service role.
- Limites atuais: o repository ainda não orquestra o refresh end-to-end nem implementa callback OAuth; o caminho de claim deve ser integrado a uma operação que descriptografe, faça refresh, cifre o novo par e salve via CAS, liberando lease em falha. O save retorna false se a lease/version não corresponder.
- CI precisa ser verificado no head mais recente após estes commits. Migration é apenas arquivo versionado; **não foi aplicada** em Supabase local, staging ou produção.
- Nenhuma chave real, token ou conta conectada; nenhum deploy ou merge.

## Continuidade S11 — conexão Mercado Livre planejada para etapa futura (21/11/2026 UTC)

- **Agente:** ChatGPT
- **Branch/PR:** `feature/s11-mercado-livre-adapter` / [PR #57](https://github.com/smklj/smkon/pull/57), Draft e não mergeado.
- **Decisão de produto:** manter a conexão da conta do Mercado Livre como etapa explícita do fluxo S11, sem exigir configuração imediata do Owner e sem bloquear o restante do SMKON.
- **Fluxo futuro:** (1) configurar app no DevCenter; (2) cadastrar variáveis exclusivamente em Vercel Preview; (3) validar redirect URI exata; (4) executar OAuth Authorization Code com state one-time e PKCE; (5) validar identidade/escopo da conta e callback; (6) verificar persistência cifrada e refresh serializado; (7) só então iniciar ingestão read-only/dry-run e reconciliação.
- **UX esperada:** disponibilizar ação “Conectar Mercado Livre” na área de integrações, com estados desconectado, aguardando autorização, conectado, erro/expiração e desconectar; nunca exibir tokens ou segredos. A ação deve informar claramente o workspace e a conta autorizada.
- **Dependências do Owner:** criar/selecionar app no DevCenter, cadastrar Client ID/Secret e chave AES-256-GCM nos secrets de Preview sem compartilhá-los no chat, e autorizar uma conta de teste quando chegar a hora.
- **Critérios de aceite:** OAuth real concluído em Preview; state inválido/expirado/reutilizado rejeitado; conta externa vinculada ao workspace correto; tokens cifrados server-side; refresh concorrente serializado; logs/respostas sem credenciais; desconexão/reconexão testadas.
- **Limites de segurança:** nenhuma conta conectada nesta atualização; nenhuma variável ou secret criada; nenhuma migration hospedada aplicada; nenhuma sincronização recorrente ou mutação no marketplace habilitada; nenhum merge ou deploy de produção autorizado.
- **Estado:** planejamento e handoff documentados. O adapter, callback, persistência e refresh têm implementação no PR #57; OAuth real e operação ponta a ponta continuam pendentes. Não declarar integração operacional.
- **Próxima ação:** quando o Owner estiver pronto, configurar o aplicativo e os secrets em Preview e executar a validação OAuth com conta de teste. Até lá, seguir com tarefas SMKON independentes da conexão externa.
