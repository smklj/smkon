# SMKON — Product Intelligence

**Status (S9):** catálogo persistente no Supabase, evidências verificáveis com revisão humana e score calculado no banco.

## Regras
- **Evidência** = afirmação + link `https` da fonte + data de observação. Tipos: página de venda, preço, comissão, avaliação, reembolso, sinal de demanda, outra. Cada tipo tem regra de valor (ex.: comissão 0–100%, avaliação 0–5).
- Evidências são **append-only**: não podem ser editadas nem apagadas. Para corrigir, registre outra e rejeite a anterior.
- **Quem faz o quê:** owner/admin cadastram produtos e revisam evidências; analistas também registram evidências; viewers só leem.
- **Revisão** acontece uma única vez por evidência (verificada ou rejeitada). Rejeitar exige motivo. Quem revisou, quando e o motivo ficam gravados e auditados.
- **Score (0–100)** é calculado por `public.product_evidence_score` usando só evidências **verificadas** observadas nos **últimos 180 dias**:

| Critério | Pontos |
|---|---|
| Página de venda verificada (obrigatória) | +20 |
| Comissão verificada mais recente | metade do %, até +25 |
| Preço verificado mais recente | +10 na faixa 97–497, +5 fora dela |
| Avaliação verificada mais recente | nota × 4, até +20 |
| Política de reembolso verificada | +10 |
| Sinais de demanda verificados | +5 cada, até +15 |

Sem página de venda verificada, o produto fica **sem score** (null) e o motivo é exibido. A fonte do produto (Hotmart, Kiwify etc.) não dá pontos. Preço e comissão digitados no cadastro são referência e não entram no score.

## Onde está
- Banco: `supabase/migrations/20261118220000_product_evidence.sql` (tabela `product_evidence`, `review_product_evidence`, score).
- App: `/produtos` (catálogo e cadastro) e `/produtos/[id]` (score, motivos, evidências, revisão, status).
- API: `GET /api/products` (catálogo do workspace) e `POST /api/products` (cadastro, owner/admin).
- Validação compartilhada: `src/lib/products/validation.ts`.

## Ainda não faz
- Coleta automática de evidências (conectores Hotmart/Kiwify/Amazon) — exige contas e APIs oficiais.
- Captura de screenshot/arquivo da fonte; hoje a prova é o link e a data.
- Geração de conteúdo a partir do produto (o stub antigo foi removido; o Content Studio é o fluxo oficial).
