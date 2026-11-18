# S3 — Conexão completa do Supabase

**Projeto:** `smkonlj` (`hpplboyysmfcjsnjrdmw`, us-west-2, Postgres 17, plano Free)
**Atualizado:** 18/11/2026

## Estado

| Item | Estado | Responsável |
|---|---|---|
| URL e chave pública na Vercel (prod, preview, dev) | ✅ já existia | — |
| `NEXT_PUBLIC_SITE_URL=https://smkon-smkon.vercel.app` (production) | ✅ criado em 18/11 | Claude |
| Migrations no banco remoto (4 arquivos) | ⛔ bloqueado: exige autorização explícita do Owner | Owner → Claude |
| Advisors de segurança e performance após migrations | ⏳ depende do item anterior | Claude |
| Tipos TypeScript gerados do schema | ⏳ depende das migrations | Claude |
| Configuração do Auth (URLs, e-mail, cadastro) | ⏳ painel do Supabase (não acessível pelas ferramentas do Claude) | Owner |
| Integração GitHub ↔ Supabase (deploy de migrations) | ⏳ painel | Owner |

## 1. Migrations remotas — autorização necessária

Ordem de aplicação (todas em `supabase/migrations/`):
1. `20261117183000_split_01_revenue_domains.sql`
2. `20261117200000_content_studio.sql`
3. `20261118120000_product_intelligence.sql`
4. `20261118150000_p0_security_integrity.sql`

O banco está vazio (0 tabelas, 0 usuários). Para autorizar, envie: **"Autorizo aplicar as 4 migrations do SMKON no projeto Supabase smkonlj."**
Recomendação: autorizar depois que o GPT aprovar a revalidação do S1 (`npm run test:db`).

Observação: as migrations aplicadas pela ferramenta recebem versão com o horário da aplicação. Antes de ligar a integração GitHub ou usar `supabase db push`, alinhar o histórico com `supabase migration repair` para as versões dos arquivos.

## 2. Auth — passos no painel (Owner)

Painel → projeto `smkonlj`:

1. **Authentication → URL Configuration**
   - Site URL: `https://smkon-smkon.vercel.app`
   - Redirect URLs:
     - `https://smkon-smkon.vercel.app/auth/callback`
     - `https://smkon-*-smkon.vercel.app/**` (previews da Vercel)
     - `http://localhost:3000/auth/callback` (desenvolvimento)
2. **Authentication → Sign In / Providers → Email**
   - Confirm email: **ligado**.
   - Allow new users to sign up: **desligar** se o SMKON for só por convite (decisão pendente). Com o cadastro desligado, os usuários entram por convite em Authentication → Users → Invite.
3. **Authentication → Emails → SMTP Settings** (obrigatório antes de convidar pessoas de fora)
   - O envio embutido só entrega para e-mails da equipe da organização e tem limite baixo por hora.
   - Opção pronta: Resend (já conectado). Exige um domínio verificado no Resend e as credenciais SMTP dele no Supabase. Desligar o rastreamento de links no provedor para não quebrar os links de confirmação.
4. **Authentication → Rate Limits**: revisar depois do SMTP.
5. **Conta Supabase**: ativar MFA no login do painel.

## 3. Integrações (Owner)

- **Supabase → Settings → Integrations → GitHub**: conectar `smklj/smkon`, diretório `supabase`. Deixar "Deploy to production" desligado até existir proteção na `main` (S2).
- **Vercel ↔ Supabase** (opcional): a integração oficial sincroniza as variáveis. Hoje elas já estão configuradas manualmente; não é necessária.

## 4. Limites do plano Free

- Projetos com pouca atividade em 7 dias podem ser pausados.
- Backups não ficam disponíveis para download.
- Branching (banco por PR) exige plano Pro.

Considerar o Pro antes de dados reais de clientes ou financeiros.
