# Product Intelligence — SMKON

**Status:** MVP iniciado (draft)  
**Branch:** feature/product-intelligence-mvp  
**Data:** 18/11/2026

## Objetivo
Catálogo, scoring e evidências de produtos digitais/infoprodutos (próprios e afiliados).

## Arquivos
- `src/lib/products/types.ts` — tipos
- `src/app/api/products/route.ts` — stub GET/POST (não persiste ainda)
- `supabase/migrations/20261118120000_product_intelligence.sql` — **draft, não aplicado**

## Próximos passos
1. Validar schema localmente.
2. Conectar a fontes oficiais (Kiwify, Hotmart, Shopify) com OAuth.
3. Implementar scoring explicável.
4. Vincular a Content Studio (geração de conteúdo a partir do produto).

## Restrições
Nenhuma migration host, nenhum dado real, nenhuma publicação sem autorização.
