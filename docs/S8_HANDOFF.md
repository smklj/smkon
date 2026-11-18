# S8 — Ciclo de vida das comissões de afiliado

**Branch:** `feature/s8-commission-lifecycle` → PR para `feature/smkon-production-readiness`
**Regra atendida:** não confundir receita prevista, aprovada, liquidada, cancelada ou paga; toda movimentação com rastreabilidade e histórico.

## Estados e transições

| Estado (banco) | Rótulo | Significado |
|---|---|---|
| `pending` | Prevista | Conversão registrada, ainda não validada pelo programa |
| `approved` | Aprovada | Validada, ainda não disponível |
| `settled` | Liquidada | Disponível para saque/pagamento (**novo**) |
| `paid` | Paga | Recebida |
| `cancelled` | Cancelada | Cancelada antes da aprovação (**novo**) |
| `reversed` | Estornada | Estornada depois de aprovada, liquidada ou paga |

Transições: prevista → aprovada | cancelada; aprovada → liquidada | estornada; liquidada → paga | estornada; paga → estornada. Cancelada e estornada são finais. Qualquer outra transição falha com `invalid_commission_transition`.

## O que mudou

| Área | Mudança | Arquivo |
|---|---|---|
| Enum | `smkon_commission_status` ganha `settled` e `cancelled` | `supabase/migrations/20261118200000_commission_lifecycle.sql` |
| Ledger | Novos tipos `affiliate_commission_settled` e `affiliate_commission_cancelled` | idem |
| Guarda | Trigger valida as transições, trava valor, moeda e valor do pedido depois de "prevista" e mantém imutáveis a identidade e o tenant | idem |
| Histórico | `affiliate_commission_status_history`, append-only (nem o superusuário altera), leitura por membros do tenant | idem |
| Lançamentos | Cada estado alcançado gera 1 lançamento no ledger (positivo; negativo em cancelamento/estorno), idempotente pela chave única do ledger. Sem valor de comissão, só o histórico | idem |
| Resumo | View `affiliate_commission_summary` com totais por estado e moeda (`security_invoker`: respeita RLS) | idem |
| App | Página `/financeiro`: totais por estado, últimas mudanças e explicação dos estados. Link "Financeiro" ativo na navegação | `src/app/(app)/financeiro/page.tsx`, `src/lib/navigation.ts` |
| Regras na UI | Rótulos e transições espelhando o banco | `src/lib/finance/commissions.ts` |
| Tipos | Enum, histórico e view no `database.types.ts` (regerar após aplicar no remoto) | `src/lib/supabase/database.types.ts` |

## Testes executados (Claude Code, 18/11/2026)

| Suíte | Resultado |
|---|---|
| `npm run test:db` (Postgres 16 + shim, 6 arquivos, inclui o novo `006_commission_lifecycle`) | ✅ 157 afirmações; erros do `006` conferidos um a um |
| Migration S8 aplicada em **transação única** (`psql -1`), como no `apply_migration` do Supabase | ✅ sem erros (novos valores do enum não são usados fora de corpos de função) |
| `npm run test:unit` | ✅ 30/30 |
| Sintaxe TS/TSX dos arquivos alterados | ✅ 0 erros |
| typecheck / lint / build | CI do PR |

## Pendências
- 🔐 Aplicar `20261118200000_commission_lifecycle.sql` no Supabase `smkonlj`, alinhar a versão registrada e regerar os tipos.
- Ingestão real de comissões (conector de afiliado, S11): exige contas e escopos autorizados pelo Owner.
- Vendas próprias (`sales_orders`) e mídia paga: o mesmo padrão de estados e lançamentos entra no próximo incremento financeiro.
- Conciliação com relatórios do provedor (totais por período e por estado): S11.
