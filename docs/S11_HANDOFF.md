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


## 10. Fluxo de conexão Mercado Livre no produto — 21/11/2026 UTC

A conexão deve existir como etapa futura do produto, sem exigir que Samuel configure o provedor agora e sem bloquear o restante do SMKON.

### Jornada planejada

1. **Desconectado:** área de integrações apresenta Mercado Livre como disponível para conectar, com explicação curta das permissões e finalidade.
2. **Configuração do provedor:** Owner cria/seleciona o app no DevCenter, configura a redirect URI exata e cadastra as variáveis apenas em Vercel Preview. Segredos não são enviados pelo chat.
3. **Autorização:** usuário com papel permitido inicia o OAuth pelo servidor; redirecionamento ao Mercado Livre; callback valida sessão iniciadora, state de uso único, PKCE, organização, role, provider, domínio e identidade externa.
4. **Conectado:** mostrar identificação da conta autorizada, status e horário da última validação; nunca mostrar access/refresh token.
5. **Validação de dados:** primeiro executar leitura limitada e dry-run manual; apresentar contagens, totais e divergências sem lançar valores no Finance Center.
6. **Reconexão/desconexão:** oferecer ações explícitas, tratar refresh expirado e revogação quando suportada, limpar credenciais com segurança e registrar auditoria sem segredos.
7. **Operação posterior:** sincronização persistente/recorrente só depois de mapper, idempotência, checkpoint, reconciliação e testes multi-tenant, com aprovação separada do Owner.

### Estados de interface exigidos

- Não configurado (app/credenciais ausentes).
- Desconectado / pronto para conectar.
- Aguardando autorização.
- Conectado e validado.
- Conectado com atenção (token próximo de expirar ou reautorização necessária).
- Falha de conexão com mensagem segura e ação recomendada.
- Desconectando / desconectado.

A interface deve distinguir “OAuth autorizado” de “dados sincronizados” e de “financeiro reconciliado”. Não usar um único selo “conectado” para sugerir que a ingestão financeira está operacional.

### Escopo que permanece fora

- Nenhuma conexão real foi feita nesta atualização.
- Não configurar secrets, não aplicar migrations hospedadas, não habilitar sync recorrente, não gravar lançamentos financeiros, não fazer merge ou deploy de produção.
- A UI de conexão não deve ser declarada pronta até existir implementação e teste no PR.
- O primeiro teste externo deve usar conta de teste do Mercado Livre, Preview e leitura/dry-run.

### Critérios de aceite da jornada

- OAuth iniciado por usuário autorizado e callback vinculado à mesma sessão/organização.
- State inválido, expirado ou reutilizado rejeitado; PKCE S256 validado.
- Tokens armazenados somente cifrados server-side; ausência em browser, logs e telemetria.
- Identidade externa verificada e isolamento entre organizações demonstrado.
- Reconexão, refresh concorrente e desconexão testados.
- Dry-run apresenta origem, período, contagens e divergências; nenhuma escrita financeira automática.
- Documentação e status distinguem implementado, validado, publicado e operacional.
