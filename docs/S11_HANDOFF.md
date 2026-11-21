# S11 — Decisão de provedor e plano de implementação

**Data:** 20/11/2026  
**Agente:** ChatGPT  
**Branch:** `feature/smkon-production-readiness`  
**Status:** decisão registrada; especificação pronta para implementação; nenhuma conta conectada.

## 1. Decisão tomada

- **Primeiro provedor:** Mercado Livre.
- **Ambiente inicial:** staging do SMKON, usando usuários/anúncios/pedidos de teste do ambiente de desenvolvedor do Mercado Livre quando disponíveis.
- **Modo inicial:** somente leitura + dry-run; nenhuma mutação de anúncios, pedidos, pagamentos ou conta.
- **Contas reais:** não conectar nesta etapa.
- **Produção:** fora do escopo; sem secrets, migrations ou deploys de produção.

### Justificativa

1. O roadmap S11 já lista Mercado Livre como uma das opções previstas.
2. Começar com um único marketplace reduz o número de contratos externos e facilita provar OAuth, paginação, idempotência e conciliação.
3. O fluxo de staging permite validar isolamento por workspace e persistência sem misturar dados reais.
4. A integração deve começar como ingestão financeira/read-only, não como automação de vendas.

A escolha é uma decisão de execução reversível. Amazon pode ser adicionada depois como segundo adapter, sem alterar o modelo canônico.

## 2. Objetivo funcional do primeiro incremento

Importar e reconciliar informações financeiras do Mercado Livre que estejam disponíveis para a conta autorizada, mantendo separados:

- pedido/venda bruta;
- comissão estimada;
- comissão aprovada;
- valor liquidado;
- valor efetivamente pago;
- cancelamento, devolução e reembolso;
- moeda, taxas e ajustes;
- identificadores externos e timestamps de origem.

Não inferir pagamento recebido a partir de pedido concluído. Cada estado deve vir de evidência explícita do provedor.

## 3. Arquitetura proposta

Manter o conector isolado em um adapter, sem acoplar regras do domínio ao formato externo:

- `src/lib/integrations/mercado-livre/types.ts`: DTOs externos e tipos normalizados.
- `src/lib/integrations/mercado-livre/client.ts`: chamadas HTTP server-side, timeout, paginação e tratamento de rate limit.
- `src/lib/integrations/mercado-livre/oauth.ts`: troca/refresh/revogação de tokens e validação de state.
- `src/lib/integrations/mercado-livre/mapper.ts`: mapeamento puro para eventos financeiros canônicos.
- `src/lib/integrations/mercado-livre/sync.ts`: orquestração de janela, cursor/checkpoint, retry e dry-run.
- `src/lib/integrations/mercado-livre/repository.ts`: persistência com workspace explícito.
- `src/lib/integrations/mercado-livre/service.ts`: autorização, conexão, sincronização e reconciliação.
- `src/app/api/integrations/mercado-livre/oauth/*`: callbacks server-side, se compatíveis com o roteamento existente.
- `src/app/api/integrations/mercado-livre/sync/route.ts`: endpoint protegido para iniciar sync controlado, se o padrão atual do projeto permitir.

Antes de criar esses caminhos, o implementador deve inspecionar os padrões reais de `src/lib`, rotas, conexões, tenancy e migrations. Os caminhos acima são proposta de organização, não declaração de arquivos existentes.

### Fluxo OAuth

1. Usuário autenticado e autorizado como administrador do workspace inicia conexão.
2. Gerar `state` criptograficamente aleatório, com expiração curta e uso único; associar a workspace e usuário no servidor.
3. Redirecionar para autorização oficial do Mercado Livre com escopos mínimos.
4. Callback valida state, workspace, usuário, expiração e uso único antes de trocar o code.
5. Tokens são armazenados somente no servidor, cifrados com chave de ambiente/secret manager; nunca enviados ao browser, logs ou telemetria.
6. Refresh usa lock/controle de concorrência; falhas de refresh suspendem sync e exigem reconexão quando necessário.
7. Desconexão revoga quando suportado, apaga/cripta irreversivelmente os tokens e registra auditoria sem credenciais.

Não implementar OAuth com segredo em variável NEXT_PUBLIC, localStorage, cookie legível pelo cliente ou tabela acessível por authenticated.

## 4. Persistência e segurança

Modelo lógico a validar contra o schema atual antes de criar migrations:

- conexão por `workspace_id + provider + external_account_id`, com unicidade;
- metadados de conexão e estado OAuth sem token em texto puro;
- material secreto cifrado ou referência a secret store;
- eventos/importações com `workspace_id`, `provider`, `external_id`, `event_type`, `occurred_at`, `observed_at`, moeda, valores e hash do payload mínimo;
- unicidade idempotente por provedor + conta externa + tipo + ID estável do evento/entidade;
- checkpoints por conexão e tipo de recurso;
- histórico de tentativas sem payload sensível.

Requisitos obrigatórios:
- RLS e autorização server-side; nunca confiar apenas no workspace enviado pelo cliente.
- Repository sempre recebe workspace validado pelo contexto autenticado e verifica membership/role.
- Não permitir leitura de conexões ou eventos de outro workspace.
- Não armazenar payload integral se campos mínimos forem suficientes; definir retenção e expurgo.
- Sanitizar logs; não registrar authorization code, access token, refresh token, client secret, e-mail ou payload financeiro bruto.
- Validar assinatura de webhook, se o fluxo escolhido utilizar webhooks; não confiar em callback sem verificação.
- Rate limit e proteção contra replay no OAuth/callback e endpoints de sync.

**Bloqueio de implementação:** escolher a estratégia concreta de criptografia/secret store com base nas capacidades já existentes no projeto e Vercel. Não inventar chave nem criar secret automaticamente.

## 5. Sincronização e idempotência

- Iniciar com backfill limitado por janela temporal configurável e paginação do provedor.
- Salvar checkpoint somente depois de persistir com sucesso o lote.
- Reprocessamento do mesmo lote deve produzir zero duplicatas.
- Usar retry exponencial com jitter para erros transitórios e respeitar `Retry-After`/limites oficiais.
- Erros permanentes vão para estado de falha revisável; não avançar checkpoint silenciosamente.
- Tratar eventos fora de ordem por versão/timestamp do provedor e regras explícitas de transição.
- Dry-run apresenta contagens e totais previstos sem gravar lançamentos financeiros.
- Primeira execução persistente deve ser pequena e manual em staging.

## 6. Plano por etapas

### S11-A — Descoberta e contrato
- Inspecionar ConnectionsPanel, placeholders, tenancy, finance/commissions, schema e padrões OAuth existentes.
- Conferir documentação oficial atual do Mercado Livre: OAuth, permissões, usuários de teste, pedidos, pagamentos, taxas e limites.
- Escrever contrato de dados e matriz de campos com origem e disponibilidade.
- **Aceite:** nenhuma suposição sobre campos ou status sem referência oficial ou fixture.

### S11-B — Adapter e testes unitários
- Criar client tipado, tratamento de erros, mapper puro e fixtures sanitizadas.
- Testar paginação, timeout, 401/403, 429, 5xx, campos ausentes e moeda.
- **Aceite:** testes sem chamadas reais; nenhum segredo no bundle client.

### S11-C — OAuth seguro em staging
- Implementar state de uso único, callback, armazenamento seguro, refresh e desconexão.
- Usar conta/usuário de teste do Mercado Livre.
- **Aceite:** state inválido/expirado/reutilizado rejeitado; token nunca aparece no browser/logs; isolamento entre workspaces demonstrado.

### S11-D — Ingestão dry-run
- Importar janela limitada, paginar e mapear pedidos/pagamentos/comissões disponíveis.
- Produzir relatório de divergências sem escrever lançamentos.
- **Aceite:** totais e amostras reconciliados manualmente com a conta de teste; cursor não avança em falha.

### S11-E — Persistência idempotente em staging
- Criar migration somente depois de revisar schema, grants, RLS e rollback.
- Persistir eventos normalizados e checkpoint.
- **Aceite:** repetir sync não duplica; reprocessar evento fora de ordem mantém estado consistente; teste de dois workspaces passa.

### S11-F — Operação controlada
- Sync manual inicialmente; monitorar falhas, latência, rate limits e discrepâncias.
- Agendamento recorrente somente depois de estabilidade demonstrada e aprovação do Owner.
- **Aceite:** reconciliação sem divergências inexplicadas e procedimento de desconexão/recuperação testado.

## 7. Matriz mínima de testes

- OAuth: state válido, inválido, expirado, replay, callback duplicado, usuário sem permissão.
- Tokens: refresh concorrente, refresh expirado, revogação, segredo ausente.
- API: 401, 403, 404, 429, 5xx, timeout, resposta parcial, paginação repetida.
- Dados: duplicata, evento fora de ordem, cancelamento, reembolso, comissão estimada vs liquidada, moedas e valores nulos.
- Segurança: dois workspaces, papéis distintos, IDOR, acesso direto a rota, logs e respostas sem tokens.
- Resiliência: falha entre gravação e checkpoint, retry, replay, sync interrompido.
- Operação: dry-run, desconectar/reconectar e auditoria.

## 8. Limites de autorização

Esta decisão autoriza preparar a especificação e a implementação não produtiva no branch de integração. Não autoriza:
- conectar conta real ou solicitar/usar credenciais reais;
- criar ou alterar secrets em Vercel/Supabase;
- aplicar migrations em staging ou produção sem revisar e confirmar o escopo da operação;
- habilitar sincronização recorrente;
- incorrer em custos pagos;
- fazer merge em `main` ou deploy de produção.

Qualquer migration de staging será submetida como alteração revisável, com SQL, RLS, grants, testes e rollback documentados antes de aplicação.

## 9. Próximas ações

1. Claude/ChatGPT: inspecionar padrões atuais de OAuth, ConnectionsPanel, tenancy e finance antes de codificar.
2. ChatGPT: preparar o adapter e fixtures sem credenciais, se não houver conflito com alterações em andamento.
3. Claude: revisar o contrato e a integração com o domínio financeiro antes de persistência.
4. Owner: fornecer autorização separada quando estiver pronto para conectar usuário de teste, configurar secrets ou aplicar migration.

**Estado:** decisão de produto tomada; plano documentado; implementação ainda não iniciada; integração operacional não comprovada.


---

## 10. Implementação inicial — 20/11/2026

**Branch de trabalho:** `feature/s11-mercado-livre-adapter` (criada a partir de `feature/smkon-production-readiness`).  
**Estado:** adapter técnico inicial implementado; OAuth ainda não integrado a rotas nem persistido; nenhuma conta conectada.

### Arquivos adicionados

- `src/lib/integrations/mercado-livre/types.ts`: tipos de configuração, tokens e erros.
- `src/lib/integrations/mercado-livre/oauth-state.ts`: geração de state/verifier, PKCE S256, comparação constante e validade temporal.
- `src/lib/integrations/mercado-livre/oauth-url.ts`: construção da URL de autorização Brasil.
- `src/lib/integrations/mercado-livre/oauth.ts`: troca server-side de authorization code e refresh token; respostas limitadas e sem propagar mensagens do provedor.
- `src/lib/integrations/mercado-livre/client.ts`: cliente HTTP server-only, GET-only, origem fixa, timeout, limite de resposta e erros tipados.
- `tests/unit/mercado-livre-oauth.test.ts`: testes de state, expiração, PKCE e URL.

### Evidência oficial consultada

- [Autenticação e autorização — Mercado Livre](https://developers.mercadolivre.com.br/pt_br/registre-o-seu-aplicativo/autenticacao-e-autorizacao): Authorization Code server-side e access token enviado no header Bearer.
- [Quick Start in-house — Mercado Livre](https://developers.mercadolivre.com.br/desenvolvimento-in-house): redirect URI HTTPS exato, state imprevisível, scopes mínimos e PKCE opcional conforme configuração da aplicação.
- [Autenticação e autorização para testes](https://developers.mercadolivre.com.br/pt_br/realizacao-de-testes/autenticacao-e-autorizacao): troca de code e refresh token; refresh token é de uso único e cada refresh devolve um novo token.
- A documentação informa access token com validade de seis horas e refresh token rotativo; por isso o novo par precisa ser persistido atomicamente antes de qualquer chamada subsequente.

### Decisões técnicas e limitações intencionais

- O client permite apenas GET; não existe caminho de escrita no marketplace neste incremento.
- URL de API é fixa em `https://api.mercadolibre.com`; não aceita host informado pelo chamador.
- O OAuth usa PKCE S256. O fluxo só será compatível se PKCE estiver habilitado na configuração da aplicação do DevCenter.
- Ainda não há callback, armazenamento server-side de state, criptografia/persistência de tokens, lock de refresh, repository, sync, mapper financeiro ou migration. Não declarar OAuth ou S11 operacional.
- A persistência de tokens está bloqueada até definir e revisar um secret store/criptografia já suportado pelo ambiente. Nenhuma chave ou variável foi criada.
- A URL de autorização usa o domínio brasileiro `auth.mercadolivre.com.br`; confirmar que o app do DevCenter e seu redirect URI foram cadastrados para Brasil.
- O client HTTP e os testes não foram executados neste ambiente. A validação deve rodar no checkout com Node 22.18+ e dependências instaladas: `npm run test:unit`, `npm run typecheck` e `npm run lint`.

### Próxima etapa segura

1. Validar a compilação/testes no CI desta branch.
2. Inspecionar o suporte de cookies/sessão e a política de rotas para desenhar o armazenamento de state one-time server-side.
3. Escolher, com base nos recursos já configurados, o mecanismo de cifragem e armazenamento de tokens; não armazenar tokens em `source_connections`.
4. Só então adicionar rotas OAuth e testes de callback sem conectar conta até o Owner fornecer o cadastro de app e aprovar a configuração de credenciais.

**Validação atual:** código commitado na branch; testes ainda não executados; nenhum acesso externo ao Mercado Livre foi realizado.


### Correção após primeira execução do CI — 21/11/2026 UTC

- Primeira execução: typecheck e lint passaram; testes unitários falharam em um único arquivo por resolução ESM dos imports sem extensão `.ts`. O restante dos 238 testes passou; testes de migrations/SQL passaram.
- Corrigido o teste para usar extensões explícitas, seguindo o padrão já utilizado por `tests/unit/tenancy-members.test.ts`.
- Revisão do adapter também encontrou e corrigiu a normalização da lista de scopes OAuth (separação por espaços) e passou a exigir `token_type=bearer` na resposta.
- Commit de correção mais recente: `63eee98244f57772bd1e08f8a0e46fdf39495d52`.
- **Revalidação:** aguardando workflow para o head atualizado; não declarar CI verde até consultar a nova execução.

### Revalidação concluída — 21/11/2026 UTC

- CI do PR #57, head `520671b10cc7ac7cab18fb7dbc3e0a2051ea60a0`: **Typecheck, lint, unit tests, build e migrations/SQL tests passaram**.
- Execução CI push do mesmo head também passou nos dois jobs.
- A execução E2E separada acionada por `deployment_status` foi cancelada e não faz parte do CI principal.
- Vercel Preview foi consultado sem descriptografar valores. Não há variáveis de configuração Mercado Livre visíveis no projeto; portanto, nenhum app OAuth está configurado e nenhuma conta pode ser conectada nesta etapa.
- O projeto não possui ainda módulo de cifragem/persistência de tokens para esse adapter. Próxima implementação deve adicionar envelope AES-256-GCM com chave de 32 bytes gerida como secret server-side, tabela isolada por organization, RLS sem acesso direto de cliente e operações de refresh serializadas. Não criar chave real, não gravar tokens e não aplicar migration sem validação.
- PR #57 permanece Draft; merge e deploy não autorizados.
