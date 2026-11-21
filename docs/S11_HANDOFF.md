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


### Incremento de criptografia de tokens — 21/11/2026 UTC

- Adicionado `token-crypto.ts`: envelope versionado AES-256-GCM, IV aleatório de 96 bits, tag de autenticação, AAD vinculando organization/provider/conta externa, limite de payload e validação estrita do envelope.
- Adicionado `token-crypto.server.ts` como entrypoint protegido por `server-only`; o núcleo criptográfico permanece isolado para testes unitários.
- Chave configurada por `MERCADO_LIVRE_TOKEN_ENCRYPTION_KEY` (base64 de 32 bytes) e identificador `MERCADO_LIVRE_TOKEN_ENCRYPTION_KEY_ID`. Nenhuma chave foi criada/configurada. O loader atual lê uma chave ativa; o formato suporta keyring com chaves antigas retidas quando fornecido pelo servidor.
- Testes adicionados para round-trip, adulteração, AAD cross-tenant, rotação via keyring e entradas inválidas.
- **Limite:** ainda não há repository, tabela, callback, lock de refresh ou persistência integrada. O módulo criptográfico isolado não torna a conexão operacional.
- CI para head `9961b9cf5197e3ba72962e6fd32170d85903efba` está pendente no momento do registro; commits intermediários tiveram execuções canceladas por novo push. Consultar o run mais recente antes de declarar aprovação.
- Nenhuma migration aplicada, nenhuma conta conectada, nenhum secret configurado e nenhum deploy realizado.


### Persistência server-side e refresh serializado — 21/11/2026 UTC

- Migration preparada: `supabase/migrations/20261121130000_mercado_livre_credentials.sql`.
- A migration cria `mercado_livre_credentials`, vinculada por FK composta a `source_connections(id, organization_id)`; guarda apenas envelope cifrado JSONB, expiração e versão do token. RLS habilitado; sem grants para anon/authenticated; acesso de tabela somente service_role.
- RPCs service_role-only: `mercado_livre_claim_refresh` (lease transacional para impedir refresh simultâneo), `mercado_livre_save_refreshed_tokens` (CAS por versão e lease ativo) e `mercado_livre_release_refresh`.
- Repository server-only adicionado. Escrita de credenciais exige sessão autenticada, papel owner/admin e validação da conexão no mesmo organization_id, provider Mercado Livre e domínio owned_sales antes do uso do service role.
- Limites atuais: o repository ainda não orquestra o refresh end-to-end nem implementa callback OAuth; o caminho de claim deve ser integrado a uma operação que descriptografe, faça refresh, cifre o novo par e salve via CAS, liberando lease em falha. O save retorna false se a lease/version não corresponder.
- CI precisa ser verificado no head mais recente após estes commits. Migration é apenas arquivo versionado; **não foi aplicada** em Supabase local, staging ou produção.
- Nenhuma chave real, token ou conta conectada; nenhum deploy ou merge.


### Orquestração de refresh e callback OAuth — 21/11/2026 UTC

- Adicionado `refresh.ts`: adquire lease exclusivo, descriptografa o par atual com AAD de organização/provedor/conta, valida o usuário externo, chama refresh OAuth, confirma que a conta retornada não mudou, cifra o novo par e persiste via CAS/versão/lease. O lease é liberado no `finally`; nenhum token é escrito em logs ou retornado por API.
- Adicionada migration `20261121140000_mercado_livre_oauth_attempts.sql`: estado OAuth armazenado como hash SHA-256, verifier cifrado, usuário iniciador, conexão/workspace e expiração de 10 minutos. RPC consome state atomicamente uma única vez; tabela e RPC acessíveis apenas por service_role.
- Adicionado repository `oauth-attempts.ts`, rota autenticada `POST /api/integrations/mercado-livre/oauth/start` e callback `GET /api/integrations/mercado-livre/oauth/callback`.
- O start exige usuário autenticado, papel owner/admin e conexão Mercado Livre/owned_sales existente; cria state aleatório, PKCE S256 e retorna URL de autorização sem expor verifier.
- O callback exige a mesma sessão iniciadora, consome state antes da troca do code, valida a conta externa, persiste apenas tokens cifrados e atualiza metadados da conexão. State inválido, expirado ou reutilizado é rejeitado.
- Variáveis esperadas no servidor: `MERCADO_LIVRE_CLIENT_ID`, `MERCADO_LIVRE_CLIENT_SECRET`, `MERCADO_LIVRE_REDIRECT_URI`, `MERCADO_LIVRE_TOKEN_ENCRYPTION_KEY` e opcional `MERCADO_LIVRE_TOKEN_ENCRYPTION_KEY_ID`. Nenhuma variável foi criada nem configurada.
- Adicionado teste SQL estrutural `supabase/tests/mercado_livre_credentials.test.sql` para RLS, grants, FK composta, SECURITY DEFINER, search_path e privilégio da RPC.
- **Limitações/validação pendente:** CI ainda não foi confirmado para o head mais recente; testes concorrentes com fixtures reais de duas conexões e execução end-to-end OAuth em conta de teste ainda não foram realizados. O callback não foi exercitado contra o Mercado Livre. A migration continua sem aplicação em qualquer Supabase hospedado.
- **Atenção operacional:** callback requer que a conexão `source_connections` exista previamente e que a sessão Supabase do usuário seja preservada durante o redirecionamento do provedor. O app deve cadastrar exatamente o mesmo redirect URI em DevCenter e Vercel antes de qualquer teste.
- PR #57 permanece Draft. Nenhum merge, deploy, secret, conta real ou chamada OAuth foi executado.


### Revisão de robustez pós-CI — 21/11/2026 UTC

- CI do head anterior `c09635d5e3bccd5721d461cdf0b796a569ec132a`: **sucesso confirmado**. Jobs concluídos: Typecheck/lint/unit tests/build e migrations/SQL tests em banco descartável.
- O teste SQL atual é estrutural (RLS, grants, FK composta, SECURITY DEFINER, search_path e privilégios). Ele **não comprova ainda concorrência real** entre workers nem CAS com fixtures persistidas; esses cenários continuam pendentes.
- Callback OAuth ajustado para verificar configuração server-side antes de consumir o state e para consumir/inutilizar state também em caso de recusa explícita do provedor.
- Refresh ajustado para não executar cleanup redundante após CAS bem-sucedido e para não mascarar a falha primária caso a liberação do lease falhe.
- Commits de correção: `ecf101193a3c795bc3a518bd3d70290eacea7281` (callback) e `212fc3170609fbc3e53ee297472554ab1045d3fd` (refresh). Ambos estão presentes na branch consultada.
- **CI das correções:** ainda sem workflow associado retornado na consulta; status Vercel estava pending no momento da checagem. Não declarar as correções validadas até o novo CI terminar.
- Próximo teste de banco: fixture isolada com usuário, organização e source_connection; adquirir lease uma vez, confirmar segunda aquisição vazia, rejeitar save com lease/version incorretos, aceitar save com lease correto e confirmar incremento de versão/limpeza do lease. Executar somente no banco descartável do pipeline.
- Nenhuma migration aplicada em Supabase hospedado; nenhuma credencial ou segredo criado; nenhuma conta Mercado Livre conectada; nenhum merge ou deploy de produção.


### Teste comportamental de lease e CAS — 21/11/2026 UTC

- Acrescentado fixture transacional ao teste SQL S11 usando usuário, organização, membership owner, source_connection Mercado Livre e credencial fictícia no banco descartável.
- O teste comprova: primeiro worker adquire lease; segundo worker não adquire enquanto ativo; save com lease incorreto falha; save com lease/versão corretos incrementa token_version e limpa lease; worker seguinte recebe novo lease; cleanup com lease antigo não libera lease novo; segundo CAS correto é aceito.
- Commit do teste: `f6dc0a8878fca6b429dc6a1695afc1a5b44b5bbd`.
- O teste é executado somente por `npm run test:db` no banco descartável criado pelo pipeline. Não foi executado contra qualquer banco hospedado.
- CI das correções anteriores: run #356, **sucesso** nos dois jobs (typecheck/lint/unit/build e migrations/SQL tests). O run #354 foi cancelado por novo push e não é evidência de falha de código.
- CI para o novo teste comportamental: aguardar run do commit atual antes de declarar aprovado.


- Correção de sintaxe do bloco PL/pgSQL de fixture: delimitador nomeado `$s11_lease_test$` (commit `04681e354ea7131c511b00e9fcb67f47cf752372`). O arquivo foi relido após a correção e o bloco abre/fecha com o mesmo delimitador.
- A consulta de workflows ainda não retornou execução associada ao commit do teste corrigido. Portanto, o teste está commitado, mas sua execução automatizada permanece **não comprovada** até o pipeline mais recente terminar.


### Fechamento da validação automatizada — 21/11/2026 UTC

- **CI #364:** [execução GitHub Actions](https://github.com/smklj/smkon/actions/runs/44866546044), commit `e5ea42629ed76bf1454f7b4891aa373574894e5a`, posterior ao fixture comportamental e à correção do delimitador PL/pgSQL.
- Job `Typecheck, lint and build`: success — npm ci, auditoria de dependências de produção high+, typecheck, lint, testes unitários e build.
- Job `Database migrations and SQL tests`: success — `bash scripts/test-db.sh shim` em PostgreSQL 17 descartável; o step de migrations + SQL tests concluiu com sucesso, incluindo o teste de lease/CAS.
- **Resultado:** validação automatizada de banco descartável e quality gate de CI aprovados. Runs #358, #360 e #362 foram cancelados por pushes concorrentes; #364 é a execução concluída e bem-sucedida usada como evidência.
- **Fora do escopo aprovado/validado:** OAuth real contra conta de teste do Mercado Livre, secrets, migration em Supabase hospedado, sync, dry-run financeiro e reconciliação. Não declarar S11 operacional.
- PR #57 continua Draft. Nenhum merge, migration hospedada, credencial real ou deploy de produção.
- Status compartilhado atualizado em `docs/INTEGRATION_STATUS.md`.

## Continuidade — conexão da conta Mercado Livre como etapa futura (21/11/2026 UTC)

**Decisão:** a conexão da conta Mercado Livre permanece planejada como etapa futura do S11. Não é pré-requisito para continuar desenvolvendo outras frentes do SMKON e não deve ser iniciada até o Owner preparar o aplicativo e as credenciais de staging.

### Sequência de execução quando houver disponibilidade

1. Criar/selecionar o aplicativo SMKON no DevCenter do Mercado Livre e conferir os produtos/permissões necessários.
2. Definir a URL pública do callback no Preview e cadastrá-la exatamente no DevCenter.
3. Configurar no ambiente **Preview** da Vercel, sem copiar valores para o chat:
   - `MERCADO_LIVRE_CLIENT_ID`
   - `MERCADO_LIVRE_CLIENT_SECRET`
   - `MERCADO_LIVRE_REDIRECT_URI`
   - `MERCADO_LIVRE_TOKEN_ENCRYPTION_KEY` (Base64 de 32 bytes)
   - `MERCADO_LIVRE_TOKEN_ENCRYPTION_KEY_ID` (opcional)
4. Reimplantar Preview se a configuração de ambiente exigir.
5. Na interface SMKON, iniciar “Conectar Mercado Livre”; autenticar e consentir na conta de teste.
6. Validar callback, state one-time, PKCE S256, usuário/workspace iniciador, papel owner/admin, external account id e scopes.
7. Verificar que tokens são persistidos somente cifrados e que refresh usa lease/CAS; conferir logs sem tokens/segredos.
8. Testar desconectar/reconectar e executar ingestão limitada read-only/dry-run, com reconciliação manual antes de qualquer persistência financeira.

### Critérios de aceite

- OAuth completo em Preview com conta de teste, sem redirecionamento indevido.
- State inválido, expirado e replay rejeitados.
- Isolamento entre workspaces comprovado.
- Token access/refresh nunca exposto ao browser, logs ou respostas.
- Refresh concorrente serializado e recuperação de falha documentada.
- Dados importados com origem, timestamps, moeda e estados explícitos; sem inferir liquidação a partir de pedido concluído.
- Sync manual/dry-run validado antes de qualquer agendamento.

### Bloqueios e limites atuais

- O Owner ainda precisa configurar o app no DevCenter e cadastrar secrets no Preview.
- Nenhuma conta real ou de teste foi conectada; OAuth real não foi executado.
- Nenhum secret foi criado/alterado; nenhuma migration hospedada foi aplicada nesta etapa.
- Nenhuma sync recorrente, mutação no marketplace, merge do PR #57 ou deploy de produção está autorizado.
- O PR #57 contém implementação do fluxo server-side e persistência/refresh, mas isso não equivale a conexão real ou operação ponta a ponta. Existe risco documentado de credencial persistida sem metadata se a atualização de `source_connections` falhar; esse caso precisa de reconciliação/atomicidade antes de declarar robustez operacional.

**Próxima ação / responsável:** ChatGPT/Claude continua as frentes independentes. Quando Samuel estiver pronto, ele configura o app e secrets de Preview; em seguida ChatGPT/Claude executa o checklist OAuth e registra evidências.

## Incremento de preparação one-click e smoke test read-only — 21/11/2026 UTC

- **Branch/PR:** `feature/s11-mercado-livre-adapter` / PR #57 (Draft).
- **Interface:** `ConnectionsPanel` agora apresenta ação “Conectar Mercado Livre” mesmo sem conexão existente; botão chama endpoint de preparação e depois inicia OAuth. Após retorno, usuário é redirecionado para Administração.
- **Criação do vínculo:** `POST /api/integrations/mercado-livre/connect` deriva usuário e workspace da sessão, exige owner/admin, valida presença de configuração server-side e formato da chave de criptografia, e cria/reutiliza conexão pendente do domínio `owned_sales`. Não aceita organizationId arbitrário do browser.
- **Validação OAuth:** callback consulta `GET /users/me` com access token recém-trocado e compara o ID retornado com o user_id do token antes de marcar a conexão como connected.
- **Leitura de vendas:** `POST /api/integrations/mercado-livre/sync/preview` valida workspace/role, lê credencial cifrada via service role, renova token sob lease quando próximo da expiração, confere identidade novamente e consulta uma página limitada (até 50) de `/orders/search`. Retorna apenas totais agregados por moeda/status.
- **Segurança do smoke test:** endpoint é read-only e bounded; não persiste pedidos, compradores, payloads, eventos ou lançamentos financeiros. Nenhuma mutação no marketplace.
- **Interface conectada:** apresenta “Testar leitura de vendas” e resumo do dry-run, informando explicitamente que nada foi gravado.
- **Limites restantes antes de operação:** sincronização persistente/idempotente, paginação incremental/checkpoint, reconciliação de pagamentos/estornos/taxas, política de retenção/PII, desconexão e recuperação de falhas ainda precisam ser implementadas e testadas. A página de preview não deve ser interpretada como operação financeira.
- **Ambiente:** nenhum secret configurado, nenhuma conta autorizada, nenhuma migration hospedada aplicada, nenhum deploy de produção.
- **CI:** workflow disparado após as alterações; resultado precisa ser consultado no último head antes de declarar validação.
- **Próxima ação:** fechar revisão de código/CI e completar pipeline persistente em staging com fixtures; depois configurar credenciais e realizar OAuth/dry-run real. Agendamento automático somente após reconciliação comprovada e aprovação do Owner.


## Revisão do modelo financeiro e semântica do Mercado Livre — 21/11/2026 UTC

- **Ambiente inspecionado:** projeto Supabase `smkon-staging` (`xoyasrizivadxnpmzzno`), somente leitura. Nenhuma DDL/DML foi executada nesta revisão.
- **Modelo existente confirmado:** `sales_orders`, `external_events`, `sales_order_adjustments` e `financial_ledger_entries`. `sales_orders` possui unicidade por `(organization_id, provider, external_order_id)`; `external_events` por `(organization_id, provider, external_id, event_type)`. Isso permite ingestão repetível sem duplicação, desde que os upserts ocorram na mesma transação.
- **Restrições relevantes:** `sales_orders.order_status` aceita `pending`, `paid`, `fulfilled`, `cancelled`, `refunded`, `partially_refunded`; valores monetários são não negativos. Ledger aceita `sales_gross`, `sales_discount`, `sales_fee`, `sales_shipping`, `sales_refund`, mas a existência desses tipos não prova liquidação.
- **Semântica externa verificada:** documentação oficial diferencia status de order e status dos pagamentos; order `paid` indica pagamento aprovado, mas não comprova repasse/recebimento líquido. Os objetos de pagamento incluem `status`, `status_detail`, `date_approved` e `transaction_amount_refunded`. Portanto, não preencher `settled_at` nem criar lançamento de recebimento liquidado apenas com `order.status=paid`.
- **Taxas:** `sale_fee` é reportada por item e deve ser agregada com quantidade, mas a reconciliação completa exige considerar marketplace_fee, descontos, frete do vendedor e ajustes de faturamento. Não tratar uma soma simplificada de `sale_fee` como valor líquido final.
- **Plano de implementação seguro:** primeira fase deve persistir snapshot normalizado sem PII, com upsert transacional de evento+pedido e hash do payload; manter `settled_at=null` e não produzir ledger de liquidação. Pagamentos/estornos/encargos serão reconciliados numa etapa separada usando endpoints de billing/payment e ajustes com chave externa idempotente.
- **Documentação oficial consultada:** https://developers.mercadolivre.com.br/pt_br/gerenciamento-de-vendas ; https://developers.mercadolivre.com.br/pt_br/pagamentos ; https://developers.mercadolivre.com.br/pt_br/api-docs-pt-br/provisoes .
- **Decisão:** não ativar persistência nem agendamento até que a RPC transacional, testes de replay/atualização e mapeamento de pagamentos estejam implementados. A revisão foi apenas de schema e semântica, não de execução financeira.


## Persistência de snapshots e validação em staging — 21/11/2026 UTC

- Implementado `order-snapshot.ts`: normalização PII-free, status conservador, valores com precisão de quatro casas e hash SHA-256 da representação normalizada.
- Implementado `POST /api/integrations/mercado-livre/sync`: sessão Supabase, workspace e role Owner/Admin; identidade conferida com `GET /users/me`; leitura limitada a 50 pedidos recentes; persistência via RPC atômica. A UI conectada agora oferece dry-run e importação manual.
- Migration `20261121150000_mercado_livre_order_sync.sql`: upsert transacional em `external_events` e `sales_orders`, allowlist estrita de 11 campos, validação de organização/conexão/provider/domain/status, idempotência por chaves únicas, CAS de conexão e execução somente por service_role. Sem payload bruto, PII ou lançamentos no ledger.
- Semântica: bruto vem de `total_amount`; tarifa é agregação de `sale_fee × quantity`; desconto, frete e reembolso permanecem zero até reconciliação específica; `paid` não é liquidação e `settled_at` não é inferido.
- CI #393 no commit `8fbcd9f`: sucesso nos dois jobs. O merge commit `c3c5f0a` integrou a base atualizada `feature/smkon-production-readiness`; Preview desse commit está READY. O CI do merge commit e o E2E acionado pelo deployment ainda precisam de conclusão no head final.
- Staging `smkon-staging`: migrations de credentials, OAuth attempts e order sync aplicadas. Testes rollback-only de lease/CAS, RLS/grants, state one-time, replay idempotente, atualização, isolamento, rejeição de PII/valor negativo e ausência de ledger passaram sem exceções.
- Security advisor: as duas tabelas S11 aparecem como RLS enabled/no policy (INFO), intencional por serem service_role-only. Avisos em outras RPCs e Auth são preexistentes; não foram modificados.
- Preview não tem `SUPABASE_SECRET_KEY` nem variáveis de app Mercado Livre. OAuth real e importação real continuam bloqueados até o Owner configurar as credenciais no Vercel/DevCenter.
- Produção: histórico de migrations ainda não está alinhado (falta `20261119232441_keyset_pagination_indexes`); não há evidência verificável de backup/restauração pelo conector. Nenhuma migration ou deploy de produção foi executado.
- Limite funcional: importação manual de primeira página (até 50), sem paginação histórica, cursor de cobertura, reconciliação de pagamentos/estornos/provisões ou agendamento. Não declarar operação financeira completa.


## Fechamento da atomicidade OAuth e status do split — 21/11/2026 UTC

- Identificada e corrigida a janela de falha em que o callback poderia gravar o token cifrado e falhar ao atualizar `source_connections`. A nova RPC `mercado_livre_complete_oauth_connection` persiste credenciais e ativa a conexão na mesma transação.
- Reautorização reutiliza a conexão existente (`connected` ou `error` com conta externa), evita placeholders duplicados e bloqueia substituição durante lease de refresh.
- Teste de atomicidade em staging passou: sucesso inicial, rollback total quando refresh lease está ativo, nova autorização com incremento de versão, rejeição de viewer e rejeição de conta externa diferente.
- CI PR #408 passou no head `af272309d3dade2cd333c9bec73723fb4a1590a4`; Preview correspondente está READY. E2E do Preview mais recente ainda não concluído.
- **Status do split:** implementação e persistência de snapshots validadas em staging; OAuth real, backfill, paginação histórica, reconciliação financeira e operação recorrente permanecem pendentes. S11 não deve ser marcado como concluído.
- **Produção preservada:** PR #57 aponta para a branch de integração, não `main`; a integração diverge de `main` em 92 commits à frente/6 atrás. Produção está com 20 migrations, sem a keyset migration e sem as quatro migrations S11; não há backup/restauração verificável pelo conector. Nenhuma alteração de produção foi executada.
- **Credenciais:** Vercel não possui `SUPABASE_SECRET_KEY` nem as variáveis Mercado Livre; nenhuma conta real/de teste foi conectada.
## Atualização de execução — merge e validações finais (21/11/2026 UTC)

- **PR #57:** marcado Ready for review e mergeado por squash em `feature/smkon-production-readiness`. Merge commit: `8c73cbc87575ae49dd102c493deada17c19c9123`. Isso integra S11 à branch de readiness; **não** é merge em `main` nem release de produção.
- **CI:** GitHub Actions #412 [concluído com sucesso](https://github.com/smklj/smkon/actions/runs/44869488859) no head `399e08b0119018df1294688b332bab9025956a09`. Typecheck, lint, unit tests, build, audit de dependências e migrations/SQL tests passaram.
- **E2E:** Playwright #193 [concluído com sucesso](https://github.com/smklj/smkon/actions/runs/44869265423), job `Playwright · Staging`. O Preview READY usado foi o commit `af272309d3dade2cd333c9bec73723fb4a1590a4`; os dois commits posteriores até o head testado alteraram apenas documentação e o fixture SQL de OAuth, sem alterar código de runtime. O CI #412 validou o head completo.
- **SQL em staging:** reexecutados diretamente, em transações rollback-only, `mercado_livre_credentials.test.sql`, `mercado_livre_oauth_completion.test.sql` e `mercado_livre_order_sync.test.sql`; os três terminaram sem exceções. Staging continua ACTIVE_HEALTHY.
- **RLS/advisors:** `mercado_livre_credentials` e `mercado_livre_oauth_attempts` aparecem no advisor como RLS enabled/no policy (INFO), intencional porque o acesso é service_role-only. Não foram encontrados avisos de SECURITY DEFINER específicos para as RPCs S11. Existem outros avisos preexistentes de segurança no projeto; não foram alterados nesta entrega.
- **Preview/Vercel:** o deployment do código S11 `af27230` permanece READY. O check Vercel do head/merge falha por `api-deployments-free-per-day` (limite de 100 deployments/dia), não por erro de build. O Preview da branch de readiness ainda aponta para `011accdb`; não afirmar que o merge commit recebeu novo Preview.
- **Histórico de migrations do staging:** as quatro migrations S11 aparecem aplicadas por nome, mas os versions registrados pelo projeto são `20261121050108`, `20261121050110`, `20261121050114` e `20261121050631`, enquanto os arquivos no repositório usam prefixos `20261121130000`, `20261121140000`, `20261121150000` e `20261121160000`. Corrigir/alinhar o histórico de migration antes de usar `supabase db push` no staging; não editar `supabase_migrations.schema_migrations` manualmente.
- **Produção:** projeto ACTIVE_HEALTHY com 20 migrations; faltam `20261119120000_keyset_pagination_indexes` e as quatro migrations S11. Não há evidência verificável de backup/restauração pelo conector. O advisor de segurança de produção mantém findings preexistentes, incluindo RPCs SECURITY DEFINER executáveis por authenticated e `rate_limit_consume` executável por anon; triagem é necessária antes de um release amplo.
- **Credenciais/integração real:** Vercel ainda não tem `SUPABASE_SECRET_KEY` nem Client ID/Secret, Redirect URI e chave AES-256-GCM do Mercado Livre. OAuth real e leitura com conta de teste não foram executados.
- **Limites funcionais:** importação manual de uma página de até 50 pedidos; sem backfill/paginação histórica/checkpoint, reconciliação de pagamentos, taxas, frete, estornos, provisões e repasses, nem ledger ou sync recorrente. S11 permanece parcial, não um conector financeiro operacional completo.
- **Decisão de produção:** nenhuma migration foi aplicada em produção e nenhum deploy de produção foi feito. O merge de PR #57 foi somente para a branch de readiness. Não promover a `main` até alinhar a branch (atualmente 96 commits à frente e 6 atrás), comprovar backup/restauração, alinhar migrations, tratar findings relevantes e validar smoke tests com configuração real.


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


## Cursor durável e retomada server-side — 21/11/2026

- O PR #60 recebeu um incremento para substituir o offset mantido apenas na tela por public.mercado_livre_order_sync_state, uma linha por organização/conexão.
- A janela fixa de até 12 meses, next_offset, total informado, estado e lease ficam no banco. Recarregar a tela não reinicia a importação.
- mercado_livre_claim_order_sync serializa workers com lease de 5 minutos e permite next (retomar) ou restart (reiniciar explicitamente).
- mercado_livre_persist_order_sync_page chama a persistência existente e avança o checkpoint na mesma transação; lease/offset divergentes são rejeitados. mercado_livre_release_order_sync libera a lease em falha sem registrar detalhes sensíveis.
- A tabela tem RLS habilitado, nenhum acesso direto para anon/authenticated, grants de tabela e RPCs limitados a service_role; SECURITY DEFINER com search_path vazio.
- A UI agora oferece “Importar / retomar histórico” e “Reiniciar histórico”, com confirmação para reinício. A janela e o offset não são aceitos do browser.
- Novo teste SQL mercado_livre_order_sync_state.test.sql cobre claim concorrente, avanço atômico, retomada, replay com lease consumida, conclusão, reinício, liberação e isolamento por organização. Testes unitários cobrem as ações aceitas e rejeição de cursor enviado pelo cliente.
- Validação pendente: executar CI no head atualizado do PR #60; não aplicar esta migration em Supabase hospedado até CI verde e revisão do histórico de migrations. Preview final ainda precisa corresponder ao head do PR; o deployment READY conhecido é de commit anterior.
- Limite conhecido: offset máximo 10.000 continua bloqueando janelas muito densas; divisão automática em sub-janelas e sync incremental por date_last_updated ainda não foram implementados. OAuth real e conciliação financeira continuam pendentes.


## Validação do cursor durável em Staging — 21/11/2026

- CI #456 passou nos dois jobs no head b898c5c7ff4741bdfe4a196b2fe6bc32ff17507e: dependency audit, typecheck, lint, unit tests, build, migrations e SQL tests.
- A migration 20261121180000_mercado_livre_order_sync_state foi aplicada no projeto smkon-staging. O Supabase registrou a versão 20261121090433 com o nome mercado_livre_order_sync_state; não houve edição manual do histórico de migrations.
- Os quatro testes SQL S11 foram executados diretamente no Staging em transações rollback-only: credentials, OAuth atomic completion, order snapshots e durable sync state. Todos terminaram sem exceções.
- Verificação read-only: RLS ativo na tabela de checkpoint; SELECT negado a anon/authenticated e permitido a service_role; três RPCs novas SECURITY DEFINER com search_path vazio e EXECUTE somente para service_role; zero linhas de checkpoint após os testes.
- Security Advisor adicionou somente INFO de RLS enabled/no policy para a tabela de checkpoint, intencional por acesso exclusivamente server-side. Permanecem avisos preexistentes de funções SECURITY DEFINER e proteção de senha vazada; Performance Advisor ainda aponta quatro FKs de S15/S10, sem FKs S11 pendentes.
- Staging registra 27 migrations. Produção permanece com 20; consulta read-only confirmou zero tabelas e zero funções S11. Nenhuma migration ou deploy de produção foi executado.
- Vercel: o único Preview READY conhecido continua no commit intermediário 98ca20c; não há deployment do head b898c5c. A quota api-deployments-free-per-day continua impedindo novo Preview.
- Variáveis de Mercado Livre e SUPABASE_SECRET_KEY não estão configuradas no Vercel. OAuth real e leitura de pedidos reais continuam bloqueados.
- PR #60 segue Draft, aberto contra feature/smkon-production-readiness; não foi mergeado. A branch de integração não foi promovida para main.
- Limites restantes: divisão automática de janelas após offset 10.000, sync incremental por date_last_updated, OAuth real, reconciliação financeira e backup/restauração verificáveis antes de qualquer release.


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


---

## Estado operacional consolidado — 21/11/2026 (consulta direta)

Esta seção prevalece sobre inventários anteriores deste documento quando houver divergência de contagens, SHA ou estado de ambiente.

### GitHub
- PR #57 permanece fechado e mergeado por squash na branch `feature/smkon-production-readiness`; merge commit `8c73cbc`. Não repetir merge.
- PR #60 permanece aberto, Draft e não mergeado; head consultado: `36e135cb2ac757125bb543ea9319fe9f9e7ff869`; base: `feature/smkon-production-readiness`.
- Comparação atual PR #60 → base: 88 commits à frente e 18 atrás. O merge-base é `7ab9b864336b822cb6b86892a6b96f109b9b715d`. Não fazer rebase/merge automático: há alterações concorrentes em documentação e arquivos de runtime; revisar por arquivo antes de reconciliar.
- CI associado ao head `36e135c`: run #546 concluído com sucesso. Jobs Quality e Database/SQL Tests concluídos com sucesso. Isso não substitui E2E no Preview.

### Implementação confirmada no head
- Persistência transacional/idempotente de snapshots e checkpoint durável via RPC; RLS server-side e lease.
- Validação fail-closed de `GET /orders/search`: `results` obrigatório, array limitado a 50 objetos; validação de `paging.total` (incluindo limite int4); rejeição de página parcial/vazia sem prova de conclusão; erro antes da RPC de persistência e tentativa de liberar lease.
- Watermark de atualização do provedor para impedir regressão por snapshots antigos.
- Limite atual de offset é 10.000. A divisão automática em sub-janelas e a sincronização incremental por `date_last_updated` ainda não estão implementadas; estado `blocked` exige tratamento operacional/manual. Não declarar backfill completo além desse limite.

### Supabase — consulta direta
- Staging `xoyasrizivadxnpmzzno`: `ACTIVE_HEALTHY`, 29 migrations registradas. Inclui keyset, migrations S11 e `integration_hub`.
- Produção `hpplboyysmfcjsnjrdmw`: `ACTIVE_HEALTHY`, 20 migrations registradas; keyset e migrations S11 ausentes.
- Os identificadores/versões remotos de migrations não correspondem aos prefixos Git. Não executar migration repair manual nem `db push` antes de reconciliação suportada.
- ACL/RLS descritos nas seções anteriores foram verificados em Staging; esta consulta de inventário não reexecutou a auditoria completa de grants/Advisor.

### Vercel, E2E e credenciais
- Consulta de deployments por SHA `36e135cb2ac757125bb543ea9319fe9f9e7ff869`: zero deployments. Portanto não há Preview do head exato.
- Preview intermediário não valida este head. E2E Playwright do head atual não comprovado.
- Não foram configuradas credenciais OAuth nesta rodada e não foi executado OAuth real; o Owner fará a homologação com conta real posteriormente.
- Backup/restauração de produção não comprovados.

### Segurança de release
- Nenhuma migration, deploy ou alteração de dados em produção foi executada.
- PR #60 continua Draft e não deve ser mergeado sem aprovação específica.
- Não promover a branch de integração inteira para `main`; preparar release isolado após reconciliação, Preview/E2E e backup verificável.
