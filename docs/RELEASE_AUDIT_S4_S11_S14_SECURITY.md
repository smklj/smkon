# SMKON — Auditoria de fechamento S4/S11/S14, segurança e release

**Data da auditoria:** 20/11/2026 (horário local do Owner; consultas ao Supabase ocorreram em 21/11 UTC).  
**Agente:** ChatGPT  
**Repositório:** `smklj/smkon`  
**Branch analisada:** `feature/smkon-production-readiness`  
**Commit consultado:** `d0d83a4cc422b76022738d84a48f6776beb21a18`  
**Escopo:** somente leitura em GitHub e Supabase. Nenhuma migration, alteração de segredo, mudança de Auth, merge ou deploy foi executado.

## 1. Resultado executivo

| Frente | Diagnóstico | Próxima ação |
|---|---|---|
| S4 — camada de domínio | Parcial. Etapas 1, 2, 2a e 2b concluídas nos PRs #54/#55; 2c–2g e handoff pendentes. | Concluir módulos na ordem registrada; staging agora tem 21/21 migrations, então regenerar tipos é possível após comparar o diff. |
| S11 — conector financeiro | Não há handoff S11 nem código de conector real no commit examinado. Existem placeholders de conexões e lógica de comissões. | Escolher provedor, definir conta/escopos, contrato de ingestão, idempotência e conciliação; não inventar dados. |
| S14 — executor de IA | Código e testes integrados, mas operação real não comprovada. Testes usam fetch falso. Configuração de credenciais/AI Gateway e cron precisa ser revalidada na Vercel. | Teste real controlado no staging após confirmação de configuração e orçamento. |
| Segurança | Alertas atuais do Advisor incluem 1 SECURITY DEFINER executável por anon, 31 por authenticated, RLS sem política em rate_limit_buckets e proteção de senha vazada desligada. | Revisão função a função; não revogar em lote. |
| Release | Staging 21/21 migrations; produção 20 migrations e falta somente `keyset_pagination_indexes` em relação ao conjunto atual. PR #56 aberto e GitHub reportou `mergeable=false`. | Resolver bloqueio do PR, aplicar migration faltante em produção só após aprovação, validar candidato e solicitar autorização de merge/deploy. |

## 2. S4 — camada de domínio

Fonte: `docs/S4_PROGRESS.md`, PRs #54 e #55 e árvore de arquivos no commit consultado.

### Entregue
- Etapa 1: plano e conferência dos tipos.
- Etapa 2: primitivas centralizadas em `src/lib/validation/fields.ts`.
- Etapa 2a: produtos em schema/repository/service.
- Etapa 2b: conteúdo e publicação/calendário em schema/repository/service.
- PR #54: validação centralizada + produtos; PR #55: conteúdo/publicação. Ambos mergeados na branch de integração.
- Testes declarados nos PRs: typecheck, lint, build, 238/238 unitários e 19/19 arquivos SQL no marco do PR #55.

### Pendente confirmado na árvore do repositório
| Módulo | Arquivos atuais observados | Estado |
|---|---|---|
| mídia/licenças | `src/lib/media/server.ts`, `types.ts`, `validation.ts` | 2c não migrado |
| financeiro/comissões | `src/lib/finance/commissions.ts` | 2d não migrado |
| tenancy | `src/lib/tenancy/admin.ts`, `members.ts`, `workspace.ts` | 2e não migrado |
| audiência | `src/lib/audience/server.ts`, `types.ts`, `validation.ts` | 2f não migrado |
| agentes | `src/lib/agents/server.ts`, `types.ts`, `executor/`, `worker/` | 2g não migrado |

A arquitetura pretendida é `schema.ts` (parse/validação), `repository.ts` (acesso a dados) e `service.ts` (casos de uso/permissões), preservando mensagens, ordem de validação e comportamento. Não refatorar tudo em um único PR.

### Dependência de tipos resolvida
O `S4_PROGRESS.md` diz que a regeneração de `database.types.ts` deveria esperar o staging receber as migrations pendentes. A consulta atual mostra staging com 21/21, inclusive `workspace_members`, `audience_consent` e `keyset_pagination_indexes`. Portanto, essa dependência está removida: gerar tipos do staging e revisar o diff é agora a primeira tarefa segura de S4. Não substituir cegamente o arquivo; validar nulabilidade e compatibilidade.

### Ordem de execução recomendada
1. Gerar tipos atualizados a partir do staging e comparar com o arquivo versionado.
2. 2c mídia/licenças.
3. 2d financeiro/comissões.
4. 2e tenancy.
5. 2f audiência.
6. 2g agentes por último, preservando os contratos do worker e do executor.
7. Adicionar testes por módulo, typecheck/lint/build e suíte unitária/SQL; produzir `docs/S4_HANDOFF.md`.
8. Atualizar roadmap e status de integração.

Critério de aceite: nenhum comportamento de negócio alterado; rotas e Server Actions usam service; repositories aplicam filtro explícito de workspace além de RLS; testes verificam permissões e isolamento.

## 3. S11 — primeiro conector financeiro real

### Evidência disponível
- `docs/ROADMAP_SPLITS.md` descreve S11 como primeiro conector real (Mercado Livre ou Amazon), com idempotência e conciliação, dependente de contas e escopos.
- A árvore do commit não contém diretório ou implementação de conector OAuth/webhook. Foram encontrados `src/components/admin/ConnectionsPanel.tsx` e `IntegrationPlaceholders.tsx`, além de `src/lib/finance/commissions.ts`.
- Não foi encontrado handoff S11 na pasta `docs`.
- S8 cobre o ciclo de vida das comissões, mas a documentação aponta ingestão real e conciliação como dependentes de S11.

### Conclusão
S11 permanece não implementado/operacionalmente não comprovado. Não há evidência de OAuth conectado, sincronização de pedidos/comissões, ingestão de eventos externos, reconciliação ou execução idempotente em provedor real.

### Plano técnico proposto (sem conectar contas ainda)
1. Decidir o provedor inicial: Mercado Livre **ou** Amazon; começar com um único.
2. Definir entidade de conexão por workspace, estados OAuth, escopos mínimos, expiração/refresh e revogação.
3. Guardar tokens somente no servidor, criptografados/gerenciados por secret store; nunca em tabelas legíveis pelo cliente ou logs.
4. Ingerir por janela temporal com cursor/checkpoint, retries com backoff e dead-letter/registro de falha.
5. Criar chave idempotente estável por provedor + conta + evento/entidade externa; impor unicidade no banco.
6. Preservar os três domínios de receita e moeda; não confundir venda bruta, comissão prevista, comissão aprovada, liquidação, pagamento, cancelamento e reembolso.
7. Persistir payload mínimo e metadados de origem; manter auditoria e trilha de reconciliação.
8. Implementar modo dry-run e fixtures; comparar totais com o painel do provedor antes de habilitar ingestão recorrente.
9. Testar duplicatas, eventos fora de ordem, reprocessamento, revogação OAuth, paginação, limites de API e isolamento multi-tenant.
10. Só então autorizar credenciais reais e ativação de sincronização.

Decisões exigidas do Owner: provedor inicial, conta/ambiente, escopos, política de retenção e autorização para credenciais/acesso externo. Nenhuma conta foi conectada.

## 4. S14 — executor de IA

Fonte: `docs/S14_PROGRESS.md`, `docs/S14_HANDOFF.md`, árvore de arquivos e migrations atuais.

### Implementado e testado no repositório
- Worker `/api/agents/worker`, fila com lease e reserva sem corrida.
- Planner → Executor → Verifier.
- Ferramentas de leitura limitadas por workspace e allowlist.
- Única escrita é `draft_content`; não há ferramenta de publicação ou aprovação.
- Verifier exige evidência de produto verificada.
- Limites de passos, payload, timeout, kill switch e orçamento.
- UI de detalhe da execução e consumo estimado.
- Testes locais usam fetch falso; o handoff declara explicitamente que não houve chamada real ao AI Gateway.

### Estado atual dos bancos
Consulta ao Supabase em 20/11 local:
- Staging `xoyasrizivadxnpmzzno`: 21 migrations, incluindo `agent_model_usage`.
- Produção `hpplboyysmfcjsnjrdmw`: 20 migrations, incluindo `agent_model_usage`, `workspace_members` e `audience_consent`; falta `keyset_pagination_indexes`.
- As versões registradas no Supabase são diferentes dos timestamps dos arquivos, mas os nomes foram comparados.

Isso atualiza o handoff antigo que dizia que `agent_model_usage` faltava em produção: a migration está atualmente registrada na produção. A origem da aplicação não é comprovada pela consulta de migrations.

### Bloqueios reais para operação
- A documentação S14 exige `SUPABASE_SECRET_KEY` sensível por ambiente; não é possível confirmar o valor nem sua presença apenas pela consulta atual.
- AI Gateway: crédito e orçamento do projeto precisam ser verificados no painel.
- `AGENT_EXECUTOR_ENABLED`, modelo, autenticação OIDC/API key, `CRON_SECRET` e cron Vercel devem ser conferidos no ambiente real.
- O handoff mais antigo contém instruções divergentes sobre OIDC versus API key; a configuração efetiva deve ser verificada antes do teste.
- Não há prova de execução real bem-sucedida com provedor.

### Teste de aceitação recomendado
1. Confirmar em staging as variáveis sem revelar seus valores.
2. Confirmar limite de projeto de US$ 5/mês e teto da aplicação.
3. Criar uma execução `operations_review` sem escrita de conteúdo.
4. Conferir run, passos, consumo, custo estimado, tempo, falhas e isolamento.
5. Confirmar que kill switch interrompe a execução.
6. Fazer segundo teste com geração de rascunho sem publicar/aprovar.
7. Validar que nenhuma ação de publicação está disponível ao agente.

Não habilitar em produção antes do teste de staging e aprovação do Owner.

## 5. Segurança — estado vivo do Supabase de produção

Consulta dos Security Advisors e SQL somente leitura em 21/11/2026 UTC.

### Achados
1. **`rate_limit_consume(text,text)` — SECURITY DEFINER executável por anon e authenticated.** O corpo atual:
   - `search_path = ''`;
   - permite somente scopes `login_ip`, `login_email`, `invite_create`, `invite_accept`;
   - exige usuário autenticado para os dois scopes de convite;
   - exige subject de 64 caracteres hexadecimais para os scopes pré-login;
   - grava em `rate_limit_buckets` e aplica limites por janela.
   
   A exposição anon parece intencional para rate limit pré-login, mas o Advisor está correto ao sinalizar uma função privilegiada exposta. O chamador deve ser auditado para garantir hash não controlável pelo cliente e derivado de IP/e-mail no servidor. Avaliar mover a função para schema privado ou endpoint server-side e restringir grants, mas não revogar anon antes de substituir o fluxo pré-login.

2. **`rate_limit_buckets` — RLS ligada sem políticas.** Consulta confirmou zero políticas e grants diretos apenas para `postgres` e `service_role`; não foram encontrados grants diretos a anon/authenticated. O acesso ocorre via função SECURITY DEFINER. O aviso INFO é compatível com tabela interna, mas a função deve continuar validando rigorosamente entrada e limites.

3. **31 SECURITY DEFINER executáveis por authenticated.** Não aplicar revoke em lote. A maioria parece representar RPCs de negócio deliberadas. Revisar individualmente: `search_path`, validação de auth.uid, membership/role, organização, ownership, parâmetros, grants e testes negativos.

4. **Proteção contra senhas vazadas desligada.** Recomendação de ativar no Auth, começando pelo staging e depois produção, com autorização do Owner e avaliação de impacto de login.

5. Advisors também reportam FKs sem índice de cobertura e índices sem uso. Não remover índices automaticamente; verificar planos, workload e volume antes de qualquer DDL.

### Prioridade de correção
- P0: auditoria do chamador de `rate_limit_consume` e revisão de grants/corpo; garantir que IP/email hash não seja arbitrariamente fornecido pelo navegador.
- P1: inventário das 31 funções SECURITY DEFINER com matriz de autorização e testes negativos.
- P1: ativar leaked-password protection em staging, validar login/recuperação e solicitar autorização para produção.
- P2: revisar FKs e índices com EXPLAIN e tráfego real.

## 6. Release readiness — estado observado

### Migrations
| Ambiente | Quantidade | Ausência |
|---|---:|---|
| Staging | 21/21 | nenhuma migration do repositório |
| Produção | 20/21 | `20261119120000_keyset_pagination_indexes` |

Migrations de produção observadas incluem `agent_model_usage`, `workspace_members` e `audience_consent`. Isso atualiza registros anteriores. Não foi executada nenhuma migration.

### GitHub
- PR #56 continua aberto no levantamento atual.
- GitHub reportou `mergeable=false`; investigar base/head e conflitos antes de qualquer merge.
- Status check Vercel do commit consultado retornou success, mas o preview READY não significa promoção para Production.
- Os testes 238/238 e 19/19 foram declarados no corpo do PR #56; não foram reexecutados nesta auditoria.

### Sequência de release proposta
1. Corrigir/atualizar documentação de integração com o estado atual das migrations.
2. Resolver `mergeable=false` no PR #56; revisar diff e status checks do head atual.
3. Fechar S4 ou aceitar formalmente o débito técnico com escopo e prazo.
4. Validar S11 como explicitamente fora do release inicial caso conector real não seja requisito de lançamento.
5. Completar teste real S14 no staging, com orçamento e credenciais autorizados.
6. Corrigir/revisar P0 de segurança, testar dois workspaces e papéis distintos.
7. Aplicar `keyset_pagination_indexes` em produção somente com aprovação explícita, backup/rollback e janela definida.
8. Executar typecheck, lint, unit, SQL, E2E e build no commit exato candidato.
9. Conferir env vars, Auth, RLS, migrations e smoke tests.
10. Solicitar autorização explícita para merge na `main` e promoção para Production.
11. Após deploy, smoke test de login, workspace, produtos, conteúdo, financeiro, mídia, audiência e agentes; registrar rollback/resultado.

## 7. Decisões pendentes do Owner

- [ ] Escolher provedor S11: Mercado Livre ou Amazon.
- [ ] Autorizar credenciais/escopos de sandbox para S11.
- [ ] Autorizar teste real do S14 no staging com orçamento máximo de US$ 5/mês.
- [ ] Autorizar ativação de leaked-password protection no staging e depois em produção.
- [ ] Aprovar a estratégia para restringir `rate_limit_consume` sem quebrar rate limiting pré-login.
- [ ] Autorizar aplicação da migration `keyset_pagination_indexes` em produção.
- [ ] Autorizar merge da branch de integração em `main` e promoção para produção, somente após os gates acima.

## 8. Evidências e referências

- [S4_PROGRESS.md](https://github.com/smklj/smkon/blob/feature/smkon-production-readiness/docs/S4_PROGRESS.md)
- [S14_PROGRESS.md](https://github.com/smklj/smkon/blob/feature/smkon-production-readiness/docs/S14_PROGRESS.md)
- [S14_HANDOFF.md](https://github.com/smklj/smkon/blob/feature/smkon-production-readiness/docs/S14_HANDOFF.md)
- [ROADMAP_SPLITS.md](https://github.com/smklj/smkon/blob/feature/smkon-production-readiness/docs/ROADMAP_SPLITS.md)
- [INTEGRATION_STATUS.md](https://github.com/smklj/smkon/blob/feature/smkon-production-readiness/docs/INTEGRATION_STATUS.md)
- [PR #54 — S4 produtos](https://github.com/smklj/smkon/pull/54)
- [PR #55 — S4 conteúdo/publicação](https://github.com/smklj/smkon/pull/55)
- [PR #56 — integração execução 6](https://github.com/smklj/smkon/pull/56)
- [Supabase leaked password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)

**Conclusão:** S4 está parcialmente concluído; S11 não possui conector real comprovado; S14 está implementado, mas sem execução real comprovada. O release permanece bloqueado por PR #56 não mergeável, migration de produção pendente, segurança a revisar e validação operacional do executor.
