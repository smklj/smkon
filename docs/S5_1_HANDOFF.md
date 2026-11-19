# S5.1 — Membros e seletor de organização

**Branch:** `feature/s5-1-members-org` → PR para `feature/smkon-production-readiness`
**Base:** S5 (convites). Decisão do Owner mantida: acesso somente por convite.

## O que mudou

| Área | Mudança | Arquivos |
|---|---|---|
| Banco | `list_workspace_members(org)`: owner/admin listam membros com e-mail (lido de `auth.users` só pela função). | `supabase/migrations/20261119070000_workspace_members.sql` |
| Banco | `change_member_role(org, user, role)` e `remove_member(org, user)`: **somente owner**; nunca rebaixa nem remove o último owner (`last_owner`); serializadas por workspace com advisory lock e permissão conferida depois do lock (dois owners não se rebaixam ao mesmo tempo); mesmo papel é no-op (`changed = false`, sem linha de auditoria). | idem |
| Banco | `user_active_workspace` + `set_active_workspace(org)`: workspace ativo lembrado no servidor. Só leitura da própria linha pela API; escrita só pela função, que confere a membership. FK composta para `organization_members` com `on delete cascade`: remover o membro apaga a preferência. | idem |
| Auditoria | Mudança de papel e remoção caem no trigger existente `audit_organization_members` (UPDATE/DELETE com ator, papel anterior e novo). | — |
| Tenancy | `findWorkspace` passa a resolver o workspace ativo: preferência salva se o usuário ainda for membro; senão a membership mais antiga (comportamento anterior). A preferência só escolhe entre memberships existentes; a autorização continua na RLS. Sem a migration no ambiente, cai no comportamento anterior. `ensureWorkspace` devolve o ativo. | `src/lib/tenancy/workspace.ts`, `src/lib/tenancy/members.ts` (regras puras), `src/lib/tenancy/admin.ts` (RPCs) |
| Admin | Seção **Membros** separada de **Convites**: lista com papel, "você", "único owner"; owner altera papel (select + Salvar) e remove (confirmação; "Sair" para si mesmo). Admin só consulta. Toast + destaque de linha via `useActionFeedback`. Sem a migration, mostra aviso com o nome da migration em vez de erro. | `src/components/admin/MembersPanel.tsx`, `src/components/admin/MemberControls.tsx`, `src/app/(app)/admin/actions.ts`, `src/app/(app)/admin/page.tsx` |
| Shell | Rodapé da navegação mostra o workspace ativo e o papel; com 2+ workspaces vira seletor (Server Action `switchWorkspace` → `set_active_workspace` → visão geral). | `src/components/shell/WorkspaceSwitcher.tsx`, `src/components/shell/AppShell.tsx`, `src/app/(app)/layout.tsx`, `src/app/(app)/actions.ts`, `src/app/globals.css` |
| Convite | Depois de aceitar, o workspace do convite vira o ativo (falha aqui não desfaz o aceite). | `src/app/(app)/convite/actions.ts` |
| Erros | `invalid_member_role`, `member_not_found`, `last_owner`, `workspace_not_found` com mensagens seguras. | `src/lib/http/errors.ts` |
| Tipos | Tabela e 4 funções no `database.types.ts` (regerar após aplicar no remoto). | `src/lib/supabase/database.types.ts` |

O workspace das ações vem sempre da sessão (`findWorkspace`), nunca de um campo do formulário. O id enviado pelo seletor é só uma escolha, validada no banco.

## Testes executados (Claude, 19/11/2026, ambiente da execução agendada)

| Suíte | Resultado |
|---|---|
| `npm run test:db` — Postgres 16 local + shim (16 arquivos, inclui o novo `017_workspace_members`) | ✅ 508 afirmações; 54 no `017` (anon, sem sessão, papéis, outro tenant, último owner, dois owners, idempotência, preferência e cascata, auditoria, grants) |
| `npm run test:unit` | ✅ 148/148 (8 novos em `tenancy-members.test.ts`) |
| `npm ci`, `npm run typecheck`, `npm run lint`, `npm run build` | ✅ sem erros |
| E2E (Playwright no Preview/staging) | novo teste em `admin-finance.spec.mjs`: aceita a lista **ou** o aviso de migration ausente, porque o staging ainda não tem a migration |

## Decisões
- **Listagem só para owner/admin:** e-mails são dados pessoais; segue a mesma regra dos convites.
- **Owner pode promover a owner e sair** se houver outro owner. O último owner nunca sai nem é rebaixado.
- **Troca de workspace não é auditada:** é preferência de navegação, não muda acesso. Mudanças de membership são auditadas.
- **Após trocar de workspace, vai para a visão geral:** a página atual pode ser um registro do workspace anterior.

## Pendências e autorizações
- 🔐 Aplicar `20261119070000_workspace_members.sql` no **staging** (`xoyasrizivadxnpmzzno`) e depois na **produção** (`hpplboyysmfcjsnjrdmw`), registrando a versão igual ao nome do arquivo; regerar os tipos.
- Depois de aplicada no staging, endurecer o E2E para exigir a lista (hoje aceita o aviso).
- Comportamento herdado (não alterado aqui): um membro removido de **todos** os workspaces que fizer login recebe um workspace novo e vazio via `ensure_workspace`. Não há vazamento de dados, mas contradiz "acesso só por convite"; proposta: `ensure_workspace` só criar workspace para o primeiro usuário/owner do sistema ou mostrar uma tela "sem workspace". Precisa de decisão do Owner.
- Transferência de propriedade guiada e saída voluntária de não-owners ficam para depois, se necessárias.

## Próxima etapa
S15 — Audiência e CRM com consentimento (LGPD).
