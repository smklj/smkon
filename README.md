# SMKON Control Center

**Achados inteligentes. Escolhas melhores.**

Plataforma interna da SMKON para curadoria de produtos, gestão de conteúdo, direitos, aprovações, crescimento e inteligência operacional.

## Status

Sprint 0 — fundação técnica iniciada. A aplicação Next.js e o pipeline inicial de qualidade estão versionados na branch `main`.

## Stack

- Next.js App Router + TypeScript
- Supabase (Postgres, Auth, RLS e Storage) — integração ainda não configurada
- Vercel — projeto ainda não vinculado

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

Consulte `docs/architecture/decisions.md` para os limites e a sequência de entrega.