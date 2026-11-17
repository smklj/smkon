# SMKON Control Center

**Achados inteligentes. Escolhas melhores.**

Plataforma interna da SMKON para curadoria de produtos, gestão de conteúdo, direitos, aprovações, crescimento e inteligência operacional.

## Status

Sprint 0 — fundação técnica criada. Split 01 em revisão no PR #1: separação de mídia/anúncios, vendas próprias e afiliados/comissões; migration SQL e testes estruturais adicionados na branch `feature/revenue-stream-split`. A migration ainda não foi aplicada ao Supabase hospedado.

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