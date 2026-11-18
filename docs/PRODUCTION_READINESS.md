# Checklist de prontidão para produção — SMKON

**Data:** 18/11/2026  
**Branch:** feature/smkon-production-readiness  
**Status geral:** BLOQUEADO para Production até concluir os itens críticos.

## Evidências atuais
- Supabase projeto `hpplboyysmfcjsnjrdmw`: ACTIVE_HEALTHY.
- Histórico de migrations hospedadas: vazio.
- Advisors Supabase consultados: sem lints retornados; isso não valida migrations ainda não aplicadas.
- Vercel: há Preview READY para `feature/admin-panel`; último registro Production consultado está CANCELED.
- Product Intelligence e painel existem em branches separadas; ramo de readiness foi criado para integração controlada.
- Content Studio API e Admin Panel dependem de schema e Auth que ainda não estão operacionais no host.

## Bloqueadores antes de publicar
- [ ] Confirmar variáveis de ambiente de Production sem expor valores.
- [ ] Configurar Supabase Auth: URL do site, redirect URLs e usuário Owner.
- [ ] Validar migrations em banco local: revenue domains → content studio → product intelligence.
- [ ] Corrigir/validar bootstrap de organização e associação do Owner.
- [ ] Testar RLS com dois tenants e papéis distintos.
- [ ] Integrar e2e login → painel → CRUD Content Studio → API Product Intelligence.
- [ ] Executar typecheck, lint, testes e build no commit exato candidato.
- [ ] Confirmar domínio e rollback.
- [ ] Rodar smoke tests pós-deploy.

## Escopo que não está pronto
- Product Intelligence ainda não persiste.
- Integrações sociais ainda não publicam.
- OAuth de plataformas externas não validado.
- Métricas financeiras reais ainda não integradas.
- A tela Admin é majoritariamente leitura e placeholders.

## Regra de release
A autorização para preparar publicação não substitui a validação técnica. Não promover commit com bloqueadores de autenticação, banco, RLS ou build. Não aplicar migrations hospedadas sem validar o SQL e o bootstrap. Não publicar conteúdo social nem gastar dinheiro.
