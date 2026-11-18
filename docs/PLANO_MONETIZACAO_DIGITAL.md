# SMKON — Plano Estruturado de Monetização Digital e Automação

**Versão:** 1.0  
**Data:** 18/11/2026  
**Identidade:** smkonlj@gmail.com / smklj  
**Branch de partida:** feature/content-growth-studio-mvp  

## 1. Objetivo
Transformar o SMKON em um Control Center operacional que gere receita com produtos digitais e infoprodutos, através de:
- Descoberta e scoring de produtos em alta (próprios e afiliados).
- Geração semi-automatizada de conteúdo (roteiro, legenda, CTA).
- Conexões oficiais com plataformas (Shopify, Hotmart, Kiwify, etc.).
- Fila de publicação com aprovação humana obrigatória.
- Conciliação financeira dos 3 domínios (mídia, vendas próprias, afiliados).

## 2. Estado atual (18/11/2026)
- Fundação Next.js + Supabase SSR pronta.
- Content Studio UI consome API CRUD (branch atual).
- Migration content_items versionada, **não aplicada** no host.
- 3 PRs draft. Nenhuma integração externa operacional.
- Arquitetura de 8 áreas + 3 domínios financeiros documentada.
- Agentes conceituais definidos, não implementados.

## 3. Princípios não negociáveis
- Aprovação humana da versão exata antes de qualquer publicação.
- Evidência e fonte auditável para toda recomendação de produto.
- Disclosure de afiliado/publicidade obrigatório.
- Sem gastos, deploys de produção ou migrations host sem autorização explícita.
- APIs oficiais, menor privilégio, RLS, idempotência.
- Separação total dos 3 domínios financeiros.

## 4. Plataformas prioritárias (ordem)
1. **Kiwify** e/ou **Hotmart** (infoprodutos BR — APIs e webhooks disponíveis).
2. **Shopify** (loja própria + Catalog/Shop MCP para discovery).
3. Amazon Associates / Gumroad / Mercado Livre.
4. Redes sociais via Metricool ou APIs oficiais (Instagram, TikTok, YouTube).
Yahoo Shopping = baixa prioridade inicial.

## 5. Roadmap por fases

### Fase 0–2 — Fundação (1–2 semanas)
**Entregas:**
- Validar e (com autorização) aplicar migration content_items.
- Confirmar Auth + RLS multi-tenant.
- Content Studio 100% persistido em cloud.
**Aceite:** CRUD autenticado isolado por workspace, sem perda de dados.

### Fase 6 (acelerada) — Product Intelligence MVP (2–3 semanas)
**Entregas:**
- Schema `products`, `product_sources`, `product_scores`, `product_evidence`.
- API `/api/products` (list, create, score).
- Tipos e normalização de produto (nome, preço, comissão, origem, status afiliado/próprio).
- Stub de ingestão (manual + estrutura para Kiwify/Hotmart/Shopify).
- Scoring explicável (tendência, comissão, risco, evidência).
**Aceite:** Produto registrado com fonte, timestamp e score justificável. Separação venda própria vs afiliado.

### Fase 3–4 — Conteúdo semi-automático (2–3 semanas)
**Entregas:**
- Geração de roteiro, legenda, hashtags e CTA a partir do produto (Creative stub).
- Fluxo de aprovação no Studio.
- Biblioteca de mídia básica + registro de direitos.
**Aceite:** Conteúdo gerado vinculado a produto, só avança após aprovação + direitos.

### Fase 5 + 7 — Conexões e publicação (3–4 semanas)
**Entregas:**
- Conector OAuth/API para 1 plataforma de afiliado + Shopify (se aplicável).
- Webhooks de vendas/comissões → ledger.
- Fila de publicação com retries, idempotência e status.
- Disclosure automático.
**Aceite:** Fluxo ponta a ponta em ambiente de teste. Publicação real só com OK explícito.

### Fase 8 — Agentes controlados
Scout (descoberta), Analyst (scoring), Creative (conteúdo), Publisher (fila).  
Planner → Executor → Verifier + kill switch + limites.

### Fase 9 — Produção e observabilidade
Logs, alertas, backups, Preview estável, checklist de release.

## 6. Arquitetura técnica inicial (Product Intelligence)

```sql
-- Draft (não aplicar sem autorização)
create table public.products (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  name text not null,
  source text not null, -- kiwify, hotmart, shopify, manual
  external_id text,
  type text, -- digital, info, physical
  price_cents int,
  currency text default 'BRL',
  commission_percent numeric,
  affiliate_url text,
  status text default 'discovered', -- discovered, selected, active, archived
  score numeric,
  evidence jsonb default '[]',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

## 7. Próximos passos imediatos (esta sessão)
1. Criar branch `feature/product-intelligence-mvp`.
2. Adicionar tipos, migration draft e API stub de produtos.
3. Documentar o módulo.
4. Manter todas as restrições de governança.

## 8. Riscos principais
- Aplicar migration host sem validação local.
- Automação excessiva sem aprovação → banimento.
- Dados de comissão sem reconciliação.
- Mistura de domínios financeiros.

---
**Plano vivo.** Atualizar conforme implementação e aprovações do Owner.
