# S3 — Conexão completa do Supabase e e-mail

**Projeto:** `smkonlj` (`hpplboyysmfcjsnjrdmw`, us-west-2, Postgres 17)
**Atualizado:** 18/11/2026

## Estado remoto confirmado

| Item | Estado |
|---|---|
| URL e publishable key na Vercel (prod, preview, dev) | Configurados |
| `NEXT_PUBLIC_SITE_URL=https://smkon-smkon.vercel.app` | Configurado em Production |
| Migration base `split_01_revenue_domains` | Já aplicada antes desta execução |
| `content_studio` | Aplicada |
| `product_intelligence` | Aplicada |
| `p0_security_integrity` | Aplicada |
| Tabelas public | 15 identificadas; RLS habilitado em todas |
| Tipos TypeScript | Gerados do schema remoto em `src/lib/supabase/database.types.ts` |
| Clientes browser/server | Tipados com `Database` |
| SMTP Supabase / Resend | Pendente de domínio próprio verificado |
| Auth invite-only e redirect URLs | Requer conferência/configuração no painel |

As versões de migration registradas no Supabase refletem o horário real de aplicação. **Alinhado em 18/11 (S3.1):** os arquivos locais foram renomeados para as mesmas versões do remoto (`20261118155856`, `20261118160203`, `20261118160207`, `20261118160210`), na mesma ordem. Migrations novas usam versões posteriores.

### Pendentes de aplicação no remoto (exigem autorização)
| Arquivo | Conteúdo | Testes |
|---|---|---|
| `20261118170000_hardening_rls_indexes_audit.sql` | Políticas por comando (sem `FOR ALL`), 17 índices de FK, auditoria nas 4 tabelas restantes | `003_hardening_regression.test.sql` |
| `20261118180000_revoke_internal_functions.sql` | Remove `content_canonical_hash` e `reject_mutation` da API RPC | `004_internal_functions.test.sql` |

## Advisors pós-migration

- Segurança: dois avisos de `SECURITY DEFINER` para `ensure_workspace()` e `approve_content(...)`. As duas funções foram intencionalmente concedidas a `authenticated`, usam `search_path = ''`, validam `auth.uid()` e, no caso de aprovação, validam membership/role, tenant, hash e direitos. O aviso é para revisão manual, não prova exploração. A função de trigger `audit_row_change()` é SECURITY DEFINER, mas tem EXECUTE revogado para os papéis da API.
- Performance: 19 FKs sem índice de cobertura e 8 avisos de políticas permissivas sobrepostas. Os índices de uso zero são esperados em banco recém-criado. Corrigir/otimizar em migration própria após revisar consultas e planos, sem remover políticas de autorização por conveniência.

## Auth — painel Supabase (Owner)

Authentication → URL Configuration:
- Site URL: `https://smkon-smkon.vercel.app`
- Redirect URLs:
  - `https://smkon-smkon.vercel.app/auth/callback`
  - URL de Preview exata da Vercel + padrão wildcard suportado pelo painel, se permitido
  - `http://localhost:3000/auth/callback`

Authentication → Sign In / Providers → Email:
- Confirm email: ligado.
- Signup público: desligado (decisão invite-only).
- Convites devem ser emitidos server-side por Admin API; nunca expor service-role/secret key ao browser.

Ativar MFA para Owner no painel Supabase. Verificar URLs/redirects efetivamente salvos antes de convidar usuários.

## Resend — preparação e ativação

A conta Resend está conectada, mas a consulta retornou **nenhum domínio cadastrado**. Portanto não é possível ativar SMTP de produção nem gerar um sender confiável ainda.

Após comprar/definir domínio próprio:
1. Cadastrar o domínio no Resend.
2. Publicar exatamente os registros DNS SPF/DKIM/Return-Path apresentados pelo Resend.
3. Verificar o domínio até ficar `verified`.
4. Criar uma API key de envio restrita ao domínio.
5. Configurar Supabase → Authentication → Emails → SMTP:
   - Host: `smtp.resend.com`
   - Port: `465` (TLS) ou valor recomendado pelo painel atual do Resend
   - Username: `resend`
   - Password: API key restrita de envio
   - Sender: endereço no domínio verificado
6. Enviar e confirmar e-mail de teste; revisar rate limits e desativar click tracking para preservar links de autenticação.

Não criar API key ampla, não colocar segredo em `NEXT_PUBLIC_*`, e não usar remetente inventado ou domínio compartilhado `vercel.app`.

## Vercel

Projeto `smkon`, domínio `smkon-smkon.vercel.app`, Node `22.x`. As variáveis públicas Supabase já estão presentes nos três ambientes. SSO protection permanece habilitada em deployments; validar acesso externo por convite antes de alterar a proteção. Não fazer merge em `main` nem promover Production sem aprovação explícita do Owner.

## Integração GitHub ↔ Supabase

Histórico local alinhado ao remoto (S3.1). Ainda assim, não habilitar deploy automático de migrations até configurar a proteção da `main`. Por enquanto, migrations são aplicadas de forma controlada e verificadas manualmente.
