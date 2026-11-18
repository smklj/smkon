# S5 — Acesso somente por convite

**Branch:** `feature/s5-invite-only` → PR para `feature/smkon-production-readiness`
**Decisão do Owner aplicada:** acesso somente por convite.
**Contrato seguido:** `docs/INVITATIONS_AND_IDEMPOTENCY_PLAN.md`.

## O que mudou

| Área | Mudança | Arquivos |
|---|---|---|
| Banco | Tabela `organization_invitations` (e-mail normalizado, papel `admin`/`analyst`/`viewer`, `token_hash` SHA-256, expiração de 7 dias, aceite/revogação). Um convite pendente por workspace+e-mail. `token_hash` sem permissão de leitura pela API. RLS: só owner/admin leem. Auditoria por trigger. | `supabase/migrations/20261118190000_workspace_invitations.sql` |
| Funções | `create_invitation` (idempotente; encerra expirado; recusa `owner`, e-mail inválido e quem já é membro), `accept_invitation` (uso único; e-mail confirmado e igual ao convidado; replay idempotente só para o mesmo usuário), `revoke_invitation` | idem |
| API | `GET/POST/DELETE /api/invitations`. Workspace e papel vêm da sessão. O token (256 bits) é gerado no servidor, só o hash vai ao banco, e o link de aceite é devolvido uma única vez ao criador, com `Cache-Control: no-store`. | `src/app/api/invitations/route.ts`, `src/lib/invitations/token.ts` |
| Aceite | `/convite?token=…`: exige login, aceita o convite e entra no workspace. Sem sessão, o Proxy leva ao `/login?next=…` e volta ao convite depois do login. | `src/app/(app)/convite/*`, `src/lib/supabase/proxy.ts` |
| Login | Formulário "Criar conta" e a action `signUp` removidos. Redirecionamento pós-login seguro (`next` só aceita caminhos internos). | `src/app/login/*`, `src/lib/http/safe-redirect.ts` |
| Callback | Aceita `token_hash` + `type` (convite e recuperação de senha pelo template de e-mail do Supabase) além do `code` PKCE; convite/recuperação seguem para definir senha. | `src/app/auth/callback/route.ts` |
| Conta | `/conta/senha`: definir ou trocar senha. | `src/app/(app)/conta/senha/*` |
| Admin | Painel "Membros e convites": convidar, copiar link, listar estado (pendente, aceito, revogado, expirado) e revogar. | `src/components/admin/InvitationsPanel.tsx` |
| Tipos | `organization_invitations` e as 3 funções adicionadas ao `database.types.ts` (regerar após aplicar a migration no remoto). | `src/lib/supabase/database.types.ts` |

## Testes executados (Claude Code, 18/11/2026)

| Suíte | Resultado |
|---|---|
| `npm run test:db` — Postgres 16 + shim (5 arquivos, inclui o novo `005_workspace_invitations`) | ✅ 125 afirmações; os 17 testes de erro do `005` conferidos um a um |
| `npm run test:unit` | ✅ 25/25 (token, e-mail, papéis, redirecionamento seguro, mapeamento de erros) |
| Sintaxe TS/TSX dos 21 arquivos alterados (TypeScript 6 transpile) | ✅ 0 erros |
| typecheck, lint, build | CI do PR |

Cenários do contrato cobertos em `005`: sem sessão, anon, membro sem permissão, outro tenant, papel `owner`, e-mail inválido, quem já é membro, idempotência, `token_hash` ilegível, e-mail divergente, e-mail não confirmado, replay pelo mesmo usuário e por outro, revogação, expiração e substituição, auditoria.

## Como o convidado entra (até existir envio de e-mail próprio)

1. O convidado precisa de uma conta Supabase com o mesmo e-mail. Com o cadastro desligado, o Owner a cria em **Supabase → Authentication → Users → Invite user**. O e-mail do Supabase leva a `/auth/callback`, e de lá a `/conta/senha`.
2. Owner/admin cria o convite no SMKON (Admin → Membros e convites) e envia o link de aceite.
3. O convidado entra e abre o link; o convite o adiciona ao workspace com o papel definido.

## Pendências (autorização ou ação do Owner)

- 🔐 Aplicar `20261118190000_workspace_invitations.sql` no Supabase `smkonlj` e regerar os tipos.
- Painel Supabase: **desligar "Allow new users to sign up"** e ajustar o template "Invite user" para
  `{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=invite`
  (e "Reset password" para `…&type=recovery`).
- Envio automático do convite por e-mail (Resend ou Admin API do Supabase): exige domínio verificado e `SUPABASE_SECRET_KEY` só no servidor. Fica para um split posterior.
- Listar membros atuais e alterar/remover papéis: próximo incremento do S5.
