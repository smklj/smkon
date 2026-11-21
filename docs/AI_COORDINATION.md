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
