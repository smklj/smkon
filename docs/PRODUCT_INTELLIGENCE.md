# Product Intelligence — SMKON

**Status:** MVP integrado ao ramo de readiness; scoring e geração de conteúdo são previews, sem persistência.
**Branch:** feature/smkon-production-readiness
**Data:** 18/11/2026

## Implementado neste ramo
- Tipos de produto, origem, domínio financeiro, estado e evidências.
- Scoring explicável de 0 a 100, com justificativas.
- Preview de roteiro, legenda, CTA, hashtags e disclosure de afiliado.
- Endpoint autenticado `/api/products` para calcular score e retornar preview.
- Validação básica de nome, origem, preço e comissão.
- Import corrigido para a implementação Supabase SSR que existe em `feature/admin-panel`.

## Limites funcionais
- GET ainda retorna lista vazia; não existe persistência.
- POST retorna HTTP 202 com preview; não salva produto.
- Nenhuma API de Kiwify, Hotmart, Shopify ou Amazon foi conectada.
- Nenhum conteúdo é enviado para redes sociais.
- Scoring é heurístico e não usa tendências ou dados de mercado reais.

## Banco
Migration `supabase/migrations/20261118120000_product_intelligence.sql` versionada como draft. Depende das tabelas `organizations` e `organization_members`. Não aplicar no host antes de validar a migration base, autenticação, bootstrap do workspace e RLS multi-tenant.

## Próximos passos para ativar
1. Validar a cadeia completa de migrations em banco local descartável.
2. Implementar e testar bootstrap seguro de organização/owner.
3. Validar Auth, cookies e redirects no Preview.
4. Aplicar migrations somente após backup e aprovação específica do Owner.
5. Implementar persistência GET/POST/PATCH/DELETE com tenant scoping.
6. Testar isolamento com pelo menos dois usuários/workspaces.
7. Criar UI do catálogo e fluxo de seleção.
8. Só depois ligar fontes oficiais e fila de publicação com aprovação humana.
