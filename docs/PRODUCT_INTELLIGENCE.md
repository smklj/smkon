# Product Intelligence — SMKON

**Status:** MVP em evolução (draft)  
**Branch:** feature/product-intelligence-mvp  
**Data:** 18/11/2026

## Objetivo
Catálogo, scoring explicável e evidências de produtos digitais/infoprodutos (próprios e afiliados) + preview de conteúdo.

## Arquivos atuais
- `src/lib/products/types.ts` — tipos
- `src/lib/products/scoring.ts` — scoring 0–100 com reasons
- `src/lib/products/content-stub.ts` — geração de roteiro/legenda/CTA/disclosure
- `src/app/api/products/route.ts` — POST retorna score + contentPreview (stub, não persiste)
- `supabase/migrations/20261118120000_product_intelligence.sql` — **draft, não aplicado**

## Como testar o stub (local)
POST `/api/products` com body:
```json
{
  "name": "Curso de Tráfego Pago",
  "source": "kiwify",
  "type": "info",
  "priceCents": 19700,
  "commissionPercent": 40,
  "revenueDomain": "affiliate",
  "evidence": [{"source": "manual", "note": "Produto em alta no nicho", "capturedAt": "2026-11-18"}]
}
```
Retorna score, reasons e preview de conteúdo (com disclosure se afiliado).

## Próximos passos
1. Validar migration localmente.
2. Persistir produtos após aprovação da migration.
3. Conectar fontes oficiais (Kiwify/Hotmart/Shopify).
4. Vincular produto selecionado ao Content Studio (criar rascunho automático).
5. Melhorar scoring com dados reais de tendência.

## Restrições
Nenhuma migration host, nenhum dado real, nenhuma publicação sem autorização. Conteúdo gerado é apenas preview.
