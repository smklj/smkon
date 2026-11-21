# S11 — Mercado Livre: snapshots de pedidos

## Escopo desta fase

A primeira ingestão é manual, limitada a uma página de até 50 pedidos recentes de `GET /orders/search`. O endpoint exige sessão autenticada, workspace ativo e papel Owner/Admin. A identidade da conta é conferida com `GET /users/me` antes da persistência.

O servidor transforma cada pedido em uma allowlist de campos normalizados e calcula SHA-256 sobre essa representação. Não persiste payload bruto, comprador, vendedor, endereço, destinatário, identificadores de pagamento ou outros dados pessoais.

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

1. A importação busca somente os 50 pedidos da primeira página; ainda não há paginação histórica, janela incremental com checkpoint de cobertura nem backfill.
2. O timestamp `source_connections.last_synced_at` registra a última execução bem-sucedida, mas não é usado como cursor de cobertura.
3. Pagamentos, parcelas, estornos, marketplace fees, frete do vendedor e provisões exigem reconciliação separada antes de produzir ajustes ou lançamentos financeiros.
4. OAuth real e leitura com uma conta de teste Mercado Livre ainda precisam ser validados em Preview.
5. Produção permanece bloqueada até CI verde no head final, Preview READY, staging validado, backup verificável e ausência de drift de migrations.

## Testes

- `tests/unit/mercado-livre-order-snapshot.test.ts`: normalização, status, hash estável, PII e entradas inválidas.
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
