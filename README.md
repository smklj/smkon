# SMKON Control Center

**Achados inteligentes. Escolhas melhores.**

Plataforma interna da SMKON para curadoria de produtos, gestão de conteúdo, direitos, aprovações, crescimento e inteligência operacional.

## Status (branch `feature/content-growth-studio-mvp`)

- **Content Studio UI** consome `/api/content` (GET/POST/PATCH/DELETE).
- Persistência no workspace autenticado (Supabase via API). Labels em PT: Rascunho / Aprovado / Arquivado.
- Migração opcional de `localStorage` (`smkon-content-studio-v1`) para a API, sem duplicar (chave estável título+updatedAt).
- Loading e feedback de erro/sucesso implementados.
- Migration SQL versionada (`supabase/migrations/20261117200000_content_studio.sql`). **Não aplicada** ao Supabase hospedado.
- Sem merge em `main`, sem deploy de produção, sem publicação em redes.

## Stack

- Next.js App Router + TypeScript
- Supabase (Postgres, Auth, RLS) — integração de leitura/escrita via `/api/content`
- Vercel — projeto ainda não vinculado para produção

## Princípios operacionais

- Utilidade antes de comissão; evidência antes de alegação.
- Conteúdo só pode ser distribuído após aprovação da versão exata e validação dos direitos.
- Gastos, compras, mídia paga, assinaturas e contratações são bloqueados por padrão.
- Segredos nunca entram no Git, logs ou documentação.
- Acesso de privilégio mínimo, trilha de auditoria, idempotência e retries limitados.

## Desenvolvimento

```bash
npm install
npm run dev
```

Verificações locais/CI:

```bash
npm run typecheck
npm run lint
npm run build
```

Consulte `docs/architecture/decisions.md` e `STATUS.md` para limites e próximos blocos.
