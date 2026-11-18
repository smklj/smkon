# S1 — P0 Segurança e Integridade · Handoff para validação

**Branch:** `feature/p0-security-integrity` (base: `feature/smkon-production-readiness` @ `cc2d447`)
**Estado:** implementado · validação 1 (GPT): reprovado por falta de testes de banco · S1.1: suíte criada e **executada pelo Claude Code em 18/11/2026** (o Owner reatribuiu a execução de testes, push e merge ao Claude Code).
**Plano geral:** `docs/ROADMAP_SPLITS.md`.

## 0. Resultados reais da execução (18/11/2026)

| Verificação | Ambiente | Resultado |
|---|---|---|
| Migrations (4) aplicadas em ordem | PostgreSQL 16.15 local + shim Supabase | ✅ sem erros |
| `001_split_01_schema.test.sql` (regressão Split 01) | idem | ✅ passou |
| `002_p0_security_integrity.test.sql` (12 cenários) | idem | ✅ passou |
| Total de afirmações SQL | idem | ✅ 80/80 |
| Cada teste de erro recebeu o erro esperado (não por coincidência) | idem | ✅ conferido um a um |
| Prova negativa: 002 sem a migration P0 | idem | ✅ falha no cenário 1, como esperado |
| `npm run test:unit` | Node 22.23.5, sem `node_modules` | ✅ 14/14 |
| `typecheck`, `lint`, `build` | — | ⏳ não executáveis aqui (sem acesso ao npm); executam no CI após o push |
| Validação 1 (GPT): typecheck, lint, build, audit de produção | GPT | ✅ passou (commit `a720cd9`) |

Ajustes feitos durante a execução: runner aceita URL com parâmetros (socket); saída do psql silenciada; `src/lib/http/errors.ts` usa `Response.json` padrão (remove dependência de `next/server` no teste unitário).

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

### 2.2 Banco — suíte automatizada (S1.1)
Não exige Supabase CLI nem pgTAP. Usa PostgreSQL 17 descartável com um shim mínimo do Supabase
(`supabase/tests/_support/supabase_shim.sql`): papéis `anon`/`authenticated`/`service_role`,
`auth.users`, `auth.uid()` e os privilégios padrão do Supabase no schema `public`.

```bash
docker run --rm -d --name smkon-pg -p 54329:5432 -e POSTGRES_PASSWORD=postgres postgres:17
DATABASE_ADMIN_URL=postgres://postgres:postgres@localhost:54329/postgres npm run test:db
docker stop smkon-pg
```

O script cria um banco temporário, aplica shim → migrations (em ordem) → helpers → testes e apaga o banco ao final.
Ele se recusa a rodar contra URLs `supabase.co`/`supabase.com`. Com Supabase local (`supabase start && supabase db reset`):
`DATABASE_URL=postgres://postgres:postgres@127.0.0.1:54322/postgres npm run test:db -- supabase`.

| Arquivo | Cobertura |
|---|---|
| `supabase/tests/001_split_01_schema.test.sql` | Regressão do Split 01 portada para SQL puro: tabelas, RLS, grants, FKs compostas, coerência provedor×domínio, isolamento de pedidos entre tenants |
| `supabase/tests/002_p0_security_integrity.test.sql` | Os 12 cenários abaixo, numerados no próprio arquivo |

1. `ensure_workspace()` cria organização + owner, é idempotente e audita o bootstrap.
2. `authenticated` não insere direto em `organizations`/`organization_members`.
3. Conteúdo não nasce `approved`.
4. Inserção gera `version = 1`, hash SHA-256 e snapshot.
5. `approve_content` recusa hash errado, aprova com o hash exato, registra decisão e `APPROVE`, é idempotente.
6. Editar conteúdo aprovado gera nova versão em rascunho sem aprovação; salvar sem mudança não versiona.
7. `status = approved` direto é recusado, inclusive ao voltar ao texto de uma versão aprovada antiga.
8. Viewer lê mas não aprova nem edita; outro tenant recebe `content_not_found`.
9. Conteúdo com aprovação não é apagado (23503); rascunho é apagado com versões em cascata e auditoria; arquivado não é aprovado.
10. Ledger, `audit_log`, `content_versions` e `content_approvals` são append-only, inclusive para o superusuário; `authenticated` não grava no ledger.
11. Isolamento entre tenants em conteúdo, versões, aprovações, auditoria e ledger; viewer não lê auditoria.
12. `organization_id` e `created_by` são imutáveis.

Saída esperada: linhas `NOTICE: ok - ...` e, ao final, `✓ 2 arquivo(s) de teste passaram.` Qualquer falha interrompe com `FAIL: <cenário>`.

### 2.2.1 Testes unitários
```bash
npm run test:unit   # node:test nativo (Node ≥ 22.18, type stripping), sem dependência nova
```
Cobrem scoring de produtos, mapeadores do Content Studio (nunca enviam `approved`), validação de UUID/hash e mapeamento de erros sem vazamento.

### 2.2.2 CI
O workflow ganhou o passo `Unit tests` e o job `database` (Postgres 17 como serviço + `scripts/test-db.sh shim`).

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
- Testes automatizados foram **escritos** (S1.1), mas **não executados** pelo Claude Code: execução é do validador (seção 2).
- E2E de navegador (Playwright) não foi adicionado: exige nova dependência npm. O fluxo da seção 2.3 segue manual no Preview.
- Build, lint e typecheck não foram executados: o ambiente do Claude não acessa o registro npm.
- Desativação do signup público e configuração do Supabase Auth: dependem de decisão do Owner (S2).
- Aprovador diferente do autor: depende de convites e papéis (S5).
- Atualização do toolchain de lint (14 alertas *high*, todos em dependências de desenvolvimento): depende de acesso ao npm (S4).

## 5. Riscos e pontos de atenção
- **Testes unitários e `next/server`:** `http-errors.test.ts` importa `NextResponse` fora do runtime do Next. Se o Node não resolver a importação, isolar `jsonError` em módulo próprio.
- **Detecção de módulo do Node:** os `.ts` usam sintaxe ESM num pacote sem `"type": "module"`; o Node 22 detecta ESM automaticamente. Se surgir erro de módulo, renomear os testes para `.test.mts`.
- **Fidelidade do shim:** o shim reproduz só o necessário. A validação final continua sendo o branch de banco Supabase (S3).
- **Supabase real:** confirmar que `sha256()` e `hashtextextended()` estão disponíveis (Postgres 17 nativo) e que funções `security definer` pertencem a `postgres`.
- **Proxy:** conferir no build se as rotas públicas (`/login`, `/auth/callback`, assets) não entram em loop de redirect.
- **Tipos do Supabase:** o cliente não usa tipos gerados; erros de tipo só aparecem no `typecheck`.
- **Signup público** continua ativo: depende da decisão do Owner (uso interno por convite × SaaS), split S2.
- **Separação de funções:** com um único usuário owner, o autor aprova o próprio conteúdo. Exigir aprovador diferente fica para o S5 (convites e papéis).
