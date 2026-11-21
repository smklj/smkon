# S11 — Mercado Livre: snapshots de pedidos

## Escopo desta fase

A primeira ingestão é manual, limitada a uma página de até 50 pedidos recentes de `GET /orders/search`. O endpoint exige sessão autenticada, workspace ativo e papel Owner/Admin. A identidade da conta é conferida com `GET /users/me` antes da persistência.

O servidor transforma cada pedido em uma allowlist de campos normalizados e calcula SHA-256 sobre essa representação. Não persiste payload bruto, comprador, vendedor, endereço, destinatário, identificadores de pagamento ou outros dados pessoais.

## Persistência e idempotência

A migration `20261121150000_mercado_livre_order_sync.sql` adiciona a RPC `mercado_livre_persist_order_snapshots`. A função valida a conexão ativa (organização, provider, domínio e status), limita o lote a 50, rejeita campos fora da allowlist e executa upsert de `external_events` e `sales_orders` na mesma transação.

As chaves únicas existentes de eventos e pedidos garantem replay idempotente. Um evento/pedido já associado a outra conexão não é reassociado silenciosamente: a transação falha. A RPC usa `SECURITY DEFINER`, `search_path='' ` e execução concedida somente a `service_role`; clientes anon/authenticated não recebem permissão de execução.

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
5. A migration e o teste SQL precisam passar no CI e ser aplicados primeiro no staging. Produção permanece bloqueada até CI verde no head final, Preview READY, staging validado, backup verificável e ausência de drift de migrations.

## Testes

- `tests/unit/mercado-livre-order-snapshot.test.ts`: normalização, status, hash estável, PII e entradas inválidas.
- `supabase/tests/mercado_livre_order_sync.test.sql`: privilégio/RLS, replay idempotente, atualização de status, isolamento por conexão/tenant, rejeição de valores inválidos/PII e ausência de liquidação/ledger.
- `scripts/test-db.sh shim`: executa migrations e todos os testes SQL em PostgreSQL 17 descartável.
