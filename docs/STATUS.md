# SMKON — Matriz de Status Atual

**Data de referência:** 18/11/2026  
**Branch de referência:** feature/content-growth-studio-mvp  
**Classificação:** feito / parcial / planejado / a validar

## Regras de identidade e proibições (explícitas)

### Identidade operacional exclusiva
- **Somente** `smkonlj@gmail.com` / GitHub `smklj`.
- Repositório oficial: `smklj/smkon`.
- Não misturar com conta pessoal ou identidades de outros projetos.
- Confirmar identidade/organização em cada serviço antes de qualquer ação.

### Proibições absolutas (sem autorização explícita do Owner)
- **Sem merge em main**.
- **Sem migration host** (não aplicar migrations no Supabase hospedado).
- **Sem deploy** (especialmente produção).
- **Sem publicar** em perfis reais de redes sociais.
- Sem gastos, campanhas pagas, compras, assinaturas, contratações.
- Secrets nunca no Git, frontend, logs ou documentação.

## O que mudou nesta entrega (Content Studio cloud)

| Item | Status | Notas |
|---|---|---|
| `src/lib/content/types.ts` | feito | Tipos compartilhados, mapeamento legacy→API, labels PT |
| `src/app/api/content/route.ts` | feito | GET/POST/PATCH/DELETE; 404 em item ausente; race 23505 no bootstrap de workspace; validação HTTPS; resposta com `item` completo (+ `id` compat) |
| `src/app/studio/studio-client.tsx` | feito | Consome `/api/content`; loading/erro; filtros Rascunho/Aprovado/Arquivado; migração opcional localStorage → API sem duplicar |
| README.md | feito | Reflete Auth + API + migrations ainda não aplicadas no host |
| Persistência localStorage como fonte primária | removido | Apenas migração one-shot residual |
| Migration `content_items` no host | **não feito** | Versionada no Git; **não aplicar** sem OK do Owner |
| Deploy / publicação social | **não feito** | Proibido nesta linha |

## Matriz resumida

| Área | Status | Observações |
|---|---|---|
| Auth Supabase (login/signup/PKCE/SSR) | parcial | Fundação no código. A validar E2E. |
| Content Studio UI → API | feito (código) | UI ligada à API. Depende de migration host + auth real. |
| Migration content_items | parcial | No Git. Não aplicada no host. |
| CI feature branches | feito | Workflow deve disparar em `feature/**`. |
| Deploy produção / Vercel | a validar | Sem deploy nesta entrega. |
| OAuth / publicação redes | planejado | Bloqueado por governança. |

## Próximo bloco concreto

1. Confirmar se Owner autoriza aplicar migration `20261117200000_content_studio.sql` (e fundação) no projeto Supabase `hpplboyysmfcjsnjrdmw` — **somente se autorizado**.
2. Teste manual autenticado: login → GET lista → POST rascunho → PATCH → DELETE; verificar RLS/isolamento.
3. Manter commits pequenos na branch `feature/content-growth-studio-mvp` (sem merge main).
4. Atualizar PR #3 com o diff desta integração UI↔API.

**Nota:** "feito" no código da branch não implica operação em produção. Sempre revalidar com migration aplicada e usuário autenticado.

## Correção — API realmente endurecida (18/11/2026)

O commit `84617bb` documentou o endurecimento de `/api/content`, mas o `route.ts` ainda era a versão anterior (sem 23505, sem HTTPS, sem 404).

Nesta correção o `src/app/api/content/route.ts` passa a:

- Tratar violação única `23505` no bootstrap de workspace (reconsulta membership).
- Exigir HTTPS em `sourceUrl` e `assetUrl` quando preenchidos.
- Devolver o item completo (`item`) em POST/PATCH, mantendo `id` para o client atual.
- Retornar 404 em PATCH/DELETE quando o item não existe no tenant.
- Contrato GET permanece `{ items: rows snake_case }` para o `studio-client` já na branch.

CI: `pull_request` também dispara em `feature/**`.

Não aplicado: migration no host, merge em main, deploy, publicação.
