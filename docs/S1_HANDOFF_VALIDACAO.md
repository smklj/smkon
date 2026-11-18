# S1 — P0 Segurança e Integridade · Handoff para validação

**Branch:** `feature/p0-security-integrity` (base: `feature/smkon-production-readiness` @ `cc2d447`)
**Estado:** implementado · **aguardando validação independente (GPT/Codex)**. Nenhum teste foi executado e nada foi enviado ao GitHub. O split só será considerado concluído após a validação.
**Plano geral:** `docs/ROADMAP_SPLITS.md`.

## 1. O que mudou

| Área | Mudança | Arquivos |
|---|---|---|
| Auth | `proxy.ts` movido para `src/proxy.ts` (com app em `src/app`, o Next.js só reconhece o Proxy ali). Fail-closed sem variáveis do Supabase (503). APIs sem sessão recebem 401 JSON em vez de redirect. | `src/proxy.ts`, `src/lib/supabase/proxy.ts` |
| Tenancy | Bootstrap atômico `public.ensure_workspace()` (security definer, lock por usuário). Clientes perdem o INSERT direto em `organizations`/`organization_members`. `GET /api/content` não cria mais workspace. | migration P0, `src/lib/tenancy/workspace.ts`, `src/app/api/content/route.ts` |
| Aprovação | `content_items` ganha `version`, `content_hash` (SHA-256 canônico), `approved_*`. Tabelas append-only `content_versions` e `content_approvals`. Trigger bloqueia `status = approved` sem decisão para a versão/hash atual e devolve o item a rascunho quando editado. `approve_content(id, hash)` é o único caminho. API aceita só `draft`/`archived`. Novo `POST /api/content/approve`. | migration P0, `src/app/api/content/approve/route.ts`, `src/lib/content/*`, `src/app/studio/studio-client.tsx` |
| Auditoria | `audit_log` append-only (nem service_role altera), triggers em organizações, membros, conexões, pedidos, conversões, ledger, conteúdo e produtos; evento `APPROVE`. Leitura só owner/admin. | migration P0 |
| Financeiro | `financial_ledger_entries` append-only; authenticated sem INSERT/UPDATE/DELETE (escrita futura só server-side). | migration P0 |
| Vocabulário | Domínio de receita unificado com o enum do banco: `owned_sales`, `affiliate`, `paid_media` (antes `own_sales`/`media` em produtos). `products` usa o enum e ganha índice único `(org, source, external_id)`. A migration de produtos nunca foi aplicada, por isso foi editada. | `supabase/migrations/20261118120000_product_intelligence.sql`, `src/lib/products/*`, `src/app/api/products/route.ts` |
| Erros | Respostas sem mensagens internas do banco; códigos de negócio mapeados (409 `hash_mismatch`, 409 `has_dependencies`, 403 `forbidden`...); log estruturado no servidor. | `src/lib/http/errors.ts` |
| Login | Redirect do e-mail de confirmação usa `NEXT_PUBLIC_SITE_URL` ou a origem da requisição (não mais `localhost:3000`). | `src/app/login/actions.ts` |
| CI | `npm ci` (lockfile exato), sem `npm audit fix`; gate de auditoria em dependências de produção (`--omit=dev --audit-level=high`). | `.github/workflows/ci.yml` |
| UX | Studio mostra versão, "Aprovar esta versão", aviso ao editar conteúdo aprovado e confirmação antes de excluir. | `src/app/studio/studio-client.tsx` |

## 2. Roteiro de validação (a executar)

### 2.1 Build e qualidade
```bash
npm ci
npm run typecheck
npm run lint
npm run build   # o resumo de rotas deve listar "Proxy (Middleware)"
```

### 2.2 Banco (Postgres local ou Supabase CLI)
Aplicar as migrations em ordem num banco descartável (`supabase start` + `supabase db reset`, ou Postgres com um shim de `auth.users`/`auth.uid()` e os papéis `anon`/`authenticated`/`service_role`). Testes mínimos que devem ser escritos e passar:

1. `ensure_workspace()` como usuário novo cria 1 organização + membership owner; segunda chamada retorna a mesma (idempotente).
2. `authenticated` não consegue `insert` direto em `organizations` nem em `organization_members`.
3. Inserir `content_items` com `status = 'approved'` falha com `approval_required`.
4. Inserir conteúdo gera `version = 1`, `content_hash` com 64 hex e 1 linha em `content_versions`.
5. `approve_content(id, hash_errado)` falha com `hash_mismatch`; com o hash correto aprova e grava `content_approvals` + `audit_log` (`APPROVE`).
6. Editar o conteúdo aprovado incrementa `version`, volta `status` para `draft` e zera `approved_*`.
7. `update content_items set status = 'approved'` direto (sem aprovação da versão atual) falha.
8. Usuário `viewer`/`analyst` recebe `forbidden` em `approve_content`; usuário de outro tenant recebe `content_not_found`.
9. `delete` de conteúdo com aprovação falha (FK restrict, 23503); sem aprovação, apaga e remove as versões.
10. `update`/`delete` em `audit_log`, `content_versions` (direto), `content_approvals` e `financial_ledger_entries` falham, inclusive como `postgres`/`service_role`.
11. Isolamento: usuário A não lê `content_items`, `content_versions`, `content_approvals` nem `audit_log` do tenant B.
12. Regressão do Split 01: `supabase/tests/001_split_01_schema.test.sql` continua passando (precisa de pgTAP).

### 2.3 Fluxo no navegador (preview com banco de teste)
- Anônimo em `/`, `/admin`, `/studio` → redirect para `/login`; `GET /api/content` anônimo → 401 JSON.
- Login → Studio vazio (GET sem criar workspace) → "Salvar rascunho" cria workspace e item v1.
- "Aprovar esta versão" → status "Aprovado · v1". Editar e salvar → "Rascunho · v2".
- Excluir item aprovado → mensagem de arquivamento (409).

## 3. Push e PR (somente após autorização do Owner)
```bash
git push -u origin feature/p0-security-integrity
```
Abrir PR **para `feature/smkon-production-readiness`** (não para `main`), com o título `fix(p0): auth gate, atomic workspace bootstrap, exact-version approval, audit trail`. Sem merge em `main`, sem migration remota, sem deploy de produção.

## 4. Não concluído neste split
- Testes automatizados (unitários, integração e SQL) não foram escritos nem executados: responsabilidade do validador (seção 2).
- Build, lint e typecheck não foram executados: o ambiente do Claude não acessa o registro npm.
- Desativação do signup público e configuração do Supabase Auth: dependem de decisão do Owner (S2).
- Aprovador diferente do autor: depende de convites e papéis (S5).
- Atualização do toolchain de lint (14 alertas *high*, todos em dependências de desenvolvimento): depende de acesso ao npm (S4).

## 5. Riscos e pontos de atenção
- **Supabase real:** confirmar que `sha256()` e `hashtextextended()` estão disponíveis (Postgres 17 nativo) e que funções `security definer` pertencem a `postgres`.
- **Proxy:** conferir no build se as rotas públicas (`/login`, `/auth/callback`, assets) não entram em loop de redirect.
- **Tipos do Supabase:** o cliente não usa tipos gerados; erros de tipo só aparecem no `typecheck`.
- **Signup público** continua ativo: depende da decisão do Owner (uso interno por convite × SaaS), split S2.
- **Separação de funções:** com um único usuário owner, o autor aprova o próprio conteúdo. Exigir aprovador diferente fica para o S5 (convites e papéis).
