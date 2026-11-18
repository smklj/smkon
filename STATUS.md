# STATUS — Admin Panel MVP

**Data:** 2026-11-18  
**Branch:** `feature/admin-panel`  
**Repositório:** smklj/smkon

## O que foi feito nesta sessão

1. Criada nova branch `feature/admin-panel` a partir de `feature/content-growth-studio-mvp`.
2. Estrutura inicial do Painel Administrativo na rota `/admin`:
   - Dashboard somente leitura com status das 8 áreas operacionais + 3 domínios financeiros (dados de constantes baseadas no schema/documentação existente).
   - Listagem de conteúdos do Content Studio consumindo a API pronta `/api/content` (com tratamento de 401).
   - Placeholders claros para Metricool / Instagram / TikTok (sem OAuth real).
3. Componentes reutilizáveis:
   - `src/lib/admin/constants.ts`
   - `src/components/admin/AreaCard.tsx`
   - `src/components/admin/DomainCard.tsx`
   - `src/components/admin/ContentList.tsx`
   - `src/components/admin/IntegrationPlaceholders.tsx`
4. Link de navegação adicionado no Control Center (`/` → `/admin`).
5. RLS e auth existentes mantidos (sem alterações de políticas ou secrets).

## Arquivos criados / alterados

- `src/lib/admin/constants.ts` (novo)
- `src/components/admin/*.tsx` (novos)
- `src/app/admin/page.tsx` (novo)
- `src/app/page.tsx` (nav atualizado)
- `STATUS.md` (este arquivo)

## Restrições respeitadas

- Não merge em `main`
- Não aplicação de migration no Supabase hospedado
- Não deploy de produção
- Não publicação em redes
- Sem secrets no Git

## Próximo bloco sugerido

1. Extrair constantes do Control Center (`page.tsx`) para reutilizar `src/lib/admin/constants.ts`.
2. Adicionar layout protegido ou middleware check para `/admin` (redirecionar não autenticados).
3. Melhorar UX da listagem (paginação, filtros, link direto para editar no Studio).
4. Validar fluxo autenticado ponta a ponta em Preview.
5. Revisar RLS antes de qualquer aplicação em host.

**Nota:** A migration continua apenas versionada. Qualquer aplicação em host exige autorização explícita.
