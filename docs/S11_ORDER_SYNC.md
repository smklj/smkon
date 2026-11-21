# S11 — Mercado Livre: snapshots de pedidos

## Escopo desta fase

A ingestão é manual e paginada, com até 50 pedidos por chamada de `GET /orders/search`. A primeira página fixa uma janela de criação dos últimos 12 meses; as páginas seguintes reutilizam exatamente o mesmo `createdFrom`/`createdTo` e avançam por `offset`, até o limite defensivo de 10.000. O endpoint exige sessão autenticada, workspace ativo e papel Owner/Admin. A identidade da conta é conferida com `GET /users/me` antes da persistência.

O servidor transforma cada pedido em uma allowlist de campos normalizados e calcula SHA-256 sobre essa representação. Não persiste payload bruto, comprador, vendedor, endereço, destinatário, identificadores de pagamento ou outros dados pessoais.

## Paginação manual do histórico

- O servidor usa os filtros oficiais `order.date_created.from` e `order.date_created.to`, arredondados para a hora UTC porque a API ignora minutos/segundos nesses filtros.
- O cartão mantém a janela fixa e oferece `Importar próxima página`; cada página contém até 50 pedidos e é persistida atomicamente.
- Repetir uma página é seguro por causa das chaves idempotentes de evento/pedido. Se a tela for recarregada, o usuário pode reiniciar do offset zero; o cursor não é persistido no banco.
- A navegação é limitada a offset 10.000. Acima disso, a divisão automática em janelas menores ainda não está disponível na interface.
- A documentação do Mercado Livre informa que a busca por vendedor pode filtrar pedidos cancelados e que os pedidos ficam disponíveis por até 12 meses; portanto, este backfill não equivale a um extrato financeiro completo.

## Persistência e idempotência

A migration `20261121150000_mercado_livre_order_sync.sql` adiciona a RPC `mercado_livre_persist_order_snapshots`. A função valida a conexão ativa (organização, provider, domínio e status), limita o lote a 50, rejeita campos fora da allowlist e executa upsert de `external_events` e `sales_orders` na mesma transação.

As chaves únicas existentes de eventos e pedidos garantem replay idempotente. Um evento/pedido já associado a outra conexão não é reassociado silenciosamente: a transação falha. A RPC usa `SECURITY DEFINER`, `search_path=''` e execução concedida somente a `service_role`; clientes anon/authenticated não recebem permissão de execução.

## Semântica financeira deliberadamente conservadora

- `gross_amount` usa `total_amount` do pedido.
- `fee_amount` agrega `sale_fee × quantity` quando informado no item; é snapshot de taxa do item, não valor líquido final.
- `discount_amount`, `shipping_amount` e `refund_amount` permanecem zero nesta primeira fase porque ainda não há reconciliação dos detalhes de pagamentos, descontos, frete e estornos.
- `paid` significa pagamento aprovado no pedido, não repasse liquidado.
- `settled_at` permanece nulo quando o pedido é inserido; updates do snapshot preservam qualquer valor já existente.
- Nenhum registro é criado em `financial_ledger_entries`.

## Limitações e próximos critérios de aceite

1. A paginação manual cobre a janela de criação de até 12 meses, 50 pedidos por página e offset até 10.000; ainda não há cursor persistido, divisão automática em janelas menores nem checkpoint de cobertura.
2. O timestamp `source_connections.last_synced_at` registra a última página persistida, mas não é usado como cursor de cobertura nem como watermark incremental de `date_last_updated`.
3. Pagamentos, parcelas, estornos, marketplace fees, frete do vendedor e provisões exigem reconciliação separada antes de produzir ajustes ou lançamentos financeiros.
4. OAuth real e leitura com uma conta de teste Mercado Livre ainda precisam ser validados em Preview.
5. Produção permanece bloqueada até CI verde no head final, Preview READY, staging validado, backup verificável e ausência de drift de migrations.

## Testes

- `tests/unit/mercado-livre-order-snapshot.test.ts`: normalização, status, hash estável, PII e entradas inválidas.
- `tests/unit/mercado-livre-order-sync-window.test.ts`: janela fixa de 12 meses, alinhamento por hora, offset de página, timezone explícito e rejeição de janelas inválidas.
- `supabase/tests/mercado_livre_order_sync.test.sql`: privilégio/RLS, replay idempotente, atualização de status, isolamento por conexão/tenant, rejeição de valores inválidos/PII e ausência de liquidação/ledger.
- `scripts/test-db.sh shim`: executa migrations e todos os testes SQL em PostgreSQL 17 descartável.

## Validação real em staging — 21/11/2026 UTC

- Aplicadas no projeto `smkon-staging` (`xoyasrizivadxnpmzzno`) as migrations `mercado_livre_credentials`, `mercado_livre_oauth_attempts` e `mercado_livre_order_sync`. As três operações retornaram sucesso.
- Executado no staging, em transação com rollback, o teste comportamental de lease/CAS e os testes de segurança das tabelas/rotas de credenciais: RLS habilitado, sem grants para anon/authenticated, acesso service_role, state OAuth one-time e concorrência de refresh. Resultado sem exceções.
- Executado no staging, em transação com rollback, o teste da RPC de snapshots: replay sem duplicação de evento/pedido, atualização de status, isolamento de tenant/conexão, rejeição de valor negativo e campo PII não permitido, `settled_at` nulo e nenhum lançamento no ledger. Resultado sem exceções.
- CI push #393 para o commit anterior `8fbcd9f` passou nos dois jobs (typecheck/lint/unit/build e migrations/SQL tests). A validação do merge commit e do head posterior deve ser confirmada no run mais recente.
- Preview do merge commit `c3c5f0a` foi publicado como READY: [smkon-m8hyatie0-smkon.vercel.app](https://smkon-m8hyatie0-smkon.vercel.app). O build compilou, concluiu TypeScript e publicou as rotas `/api/integrations/mercado-livre/sync` e `/sync/preview`.
- O advisor de segurança reporta INFO para RLS habilitado sem policy nas duas tabelas novas. Isso é intencional nesta fase: os grants anon/authenticated foram revogados e o acesso ocorre por service_role. Os avisos de outras funções SECURITY DEFINER e de proteção contra senhas vazadas são preexistentes e não foram alterados por S11.

## Bloqueios de operação e produção

- No Vercel não estão configuradas `SUPABASE_SECRET_KEY`, `MERCADO_LIVRE_CLIENT_ID`, `MERCADO_LIVRE_CLIENT_SECRET`, `MERCADO_LIVRE_REDIRECT_URI` nem `MERCADO_LIVRE_TOKEN_ENCRYPTION_KEY`. Há apenas URL/chave pública do Supabase para Preview/Production; não é suficiente para acessar credenciais server-side nem para OAuth.
- Não foi possível comprovar backup/restauração de produção pelo conector disponível. O histórico de migrations de produção também está atrás: falta `20261119232441_keyset_pagination_indexes`; as três migrations S11 ainda não foram aplicadas em produção.
- Portanto, nenhuma migration ou deploy de produção foi executado. Não houve OAuth real, pedidos reais importados nem validação ponta a ponta com conta Mercado Livre.


## OAuth completion atomicity — 21/11/2026 UTC

- A migration `20261121160000_mercado_livre_oauth_atomic_completion.sql` adiciona `mercado_livre_complete_oauth_connection`.
- O callback não grava mais credencial e metadados em duas operações separadas. Uma única RPC verifica Owner/Admin, organização, conexão/provider/domain/status, identidade externa, scopes, expiração e envelope cifrado; atualiza `source_connections` e faz upsert de `mercado_livre_credentials` na mesma transação.
- Reautorização usa a conexão `connected`/erro existente em vez de criar placeholder duplicado. Um refresh lease ativo impede substituição dos tokens; qualquer falha faz rollback também dos metadados.
- A RPC é `SECURITY DEFINER`, `search_path=''`, sem execução para anon/authenticated e com execução apenas para service_role.
- O teste `supabase/tests/mercado_livre_oauth_completion.test.sql` valida atomicidade, incremento de versão, bloqueio por lease, rollback de metadados, rejeição de papel não administrador e de conta externa diferente.
- Migration aplicada no staging e teste rollback-only executado sem exceções em 21/11/2026 UTC.


## Paginação manual — follow-up S11 (21/11/2026)

- `POST /api/integrations/mercado-livre/sync` agora recebe `offset` e, nas páginas seguintes, a mesma janela `createdFrom`/`createdTo`.
- A UI mantém a janela na sessão e apresenta `Importar próxima página` quando o provedor informa mais resultados.
- Cada página é limitada a 50 e usa a RPC transacional já existente. O replay de uma página não duplica pedidos/eventos.
- A janela padrão é de 12 meses; o offset máximo é 10.000. A tela informa quando esse teto é atingido; seleção de sub-janelas e cursor durável continuam pendentes.
- Fonte oficial: [Pedidos e opiniões](https://developers.mercadolivre.com.br/pt_br/pedidos-e-opinioes) e [Gerenciamento de vendas](https://developers.mercadolivre.com.br/pt_br/gerenciamento-de-vendas) — filtros de data, paginação e retenção de pedidos.


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


- Segurança adicional de paginação: offsets maiores que zero exigem que o cliente reenvie a mesma janela explícita; o servidor rejeita offset sem `createdFrom`/`createdTo`, evitando que a janela móvel mude entre páginas.


### Confirmação final de CI da paginação — 21/11/2026 04:21 BRT

- CI #435 passou no head final `1780c02cee1d1b595e4e0412e592c370055d64b6`: Quality (audit, typecheck, lint, unit tests e build) e Database/SQL tests.
- O teste S11 de offset foi ajustado para exigir a janela fixa em páginas posteriores. A falha timing-sensitive do teste S14 observada em #431 não se repetiu em #435.
- PR #60 continua Draft porque o check Vercel falha por `api-deployments-free-per-day`; não existe Preview da paginação. O Preview READY `af27230` é da versão anterior e não valida a UI nova.
- Nenhum merge da paginação, OAuth real ou alteração de produção foi feito.


## Cursor durável (incremento em revisão)

O fluxo manual agora usa cursor server-side em mercado_livre_order_sync_state, único por organização/conexão. O browser envia somente action: "next" ou action: "restart"; não pode escolher offset, createdFrom ou createdTo.

1. mercado_livre_claim_order_sync cria a janela de 12 meses se ainda não houver estado e adquire uma lease exclusiva.
2. O endpoint valida a identidade Mercado Livre e lê a página de até 50 pedidos usando a janela/offset do banco.
3. mercado_livre_persist_order_sync_page persiste snapshots via RPC existente e avança o offset na mesma transação; o replay com lease/offset antigo falha.
4. Em erro externo, o endpoint libera a lease com um código genérico; se a liberação falhar, a lease expira em até cinco minutos.
5. Após reload, next retoma a partir do último checkpoint confirmado. restart reinicia a janela explicitamente e a UI pede confirmação.

Estados: ready, running, completed e blocked. blocked é usado quando o offset máximo do provedor é atingido. A tabela é server-side only: RLS ligado, sem grants para anon/authenticated, e RPCs SECURITY DEFINER com search_path vazio concedidas somente a service_role.

A migration e o teste SQL estão em revisão no PR #60. Não aplicar no Staging/Production antes do CI verde e de reconciliar o histórico remoto de migrations. O cursor não é ainda um sync incremental: a próxima etapa é dividir automaticamente janelas quando o offset atingir o teto e acompanhar date_last_updated.


## Validação do checkpoint durável — 21/11/2026

CI #456 passou nos dois jobs no head b898c5c7ff4741bdfe4a196b2fe6bc32ff17507e. A migration mercado_livre_order_sync_state foi aplicada no smkon-staging e registrada pelo Supabase como 20261121090433. Os quatro testes SQL S11 (credentials, OAuth completion, order sync e order sync state) foram executados em rollback-only e terminaram sem exceções.

A verificação do ambiente confirmou RLS ligado, nenhum SELECT direto por anon/authenticated, leitura por service_role e as três RPCs novas com SECURITY DEFINER/search_path vazio e EXECUTE somente para service_role. Não há checkpoint real, pois nenhuma conta Mercado Livre está conectada.

Production continua com 20 migrations e sem tabelas/RPCs S11. Não houve alteração de produção. O Preview READY disponível ainda corresponde ao commit intermediário 98ca20c, não ao head validado; a quota Vercel bloqueia novo deployment. A configuração OAuth e SUPABASE_SECRET_KEY ainda estão ausentes.
