# S9 — Product Intelligence persistente

**Branch:** `feature/s9-product-intelligence` → PR para `feature/smkon-production-readiness`

## Problema encontrado
- `/api/products` não salvava nada (`persistence: "disabled"`); a tabela `products` existia vazia.
- O score dava pontos pela fonte (Hotmart/Kiwify +15) e por evidências enviadas pelo próprio cliente, sem link nem verificação. Isso contrariava a regra "evidências verificáveis antes de apresentar informações sobre produtos".

## O que mudou

| Área | Mudança |
|---|---|
| Banco | `product_evidence` (append-only, link https obrigatório, regra de valor por tipo, data não futura, autoria forçada, auditoria). `review_product_evidence` (owner/admin, uma vez, motivo obrigatório para rejeitar). Score calculado no banco só com evidência verificada dos últimos 180 dias. Em `products`: autoria e `updated_at` forçados, cliente não escreve score, produto não muda de workspace, produto com evidência não é apagado (arquivar) |
| App | `/produtos` (catálogo ordenado por score, cadastro) e `/produtos/[id]` (score e motivos, dados informados, evidências, revisão, status). Menu "Produtos" passa a abrir a tela |
| API | `/api/products` GET lista do banco; POST salva (owner/admin) e responde 201 |
| Removido | `scoring.ts` (score por fonte, no cliente) e `content-stub.ts` (só usado pela API em preview) |
| Erros | Mensagens para duplicidade (23505), regra violada (23514) e códigos de evidência; mensagem de dependência ficou genérica |

Regras do score: `docs/PRODUCT_INTELLIGENCE.md`.

## Testes executados (Claude Code, 18/11/2026)

| Suíte | Resultado |
|---|---|
| `npm run test:db` (8 arquivos, inclui `008_product_evidence`) | ✅ 209 afirmações |
| `npm run test:unit` | ✅ 41/41 |
| Sintaxe TS/TSX | ✅ 0 erros |
| typecheck / lint / build | CI do PR |

## Decisões
- Owner pode verificar evidência registrada por ele mesmo (workspaces de uma pessoa). A revisão fica registrada com autor e data. Exigir quatro olhos pode ser uma opção por workspace no futuro.
- Colunas antigas `products.evidence` e `score_reasons` foram mantidas, sem remoção destrutiva. `evidence` fica marcada como obsoleta.

## Pendências
- 🔐 Aplicar `20261118220000_product_evidence.sql` no Supabase `smkonlj` e alinhar a versão.
- Coleta automática via conectores oficiais (exige contas).
- Captura de prova (screenshot/arquivo) além do link.
