# Checklist — Aplicação da Migration Content Studio

**Migration:** `supabase/migrations/20261117200000_content_studio.sql`  
**Status:** Versionada, **NÃO APLICADA** no Supabase hospedado.  
**Requer:** Autorização explícita do Owner antes de qualquer aplicação em host.

## Pré-requisitos
- [ ] Identidade SMKON autenticada no Supabase (smkonlj@gmail.com)
- [ ] Project ref confirmado: `hpplboyysmfcjsnjrdmw`
- [ ] Backup ou snapshot do banco atual (se houver dados)
- [ ] Auth + organizações/membros já funcionando
- [ ] Ambiente local ou Preview validado

## Validação local
- [ ] `supabase db reset` ou apply local da migration
- [ ] Testar RLS com 2 usuários em workspaces diferentes
- [ ] Confirmar policies SELECT/INSERT/UPDATE/DELETE
- [ ] Testar API `/api/content` ponta a ponta (login → CRUD)
- [ ] Verificar constraint de rights_confirmed quando há source_url

## Aplicação no host (somente com OK explícito)
- [ ] Autorização escrita do Owner registrada
- [ ] Aplicar migration via Supabase CLI ou dashboard
- [ ] Confirmar tabela `content_items` e policies
- [ ] Smoke test autenticado
- [ ] Documentar data e resultado

## Pós-aplicação
- [ ] Atualizar STATUS.md e dossiê
- [ ] Marcar persistência cloud como operacional
- [ ] Prosseguir para Product Intelligence completo

**Não aplicar sem autorização.** Qualquer ação no host exige OK explícito.
