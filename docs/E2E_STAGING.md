# SMKON — E2E staging

## Isolamento

- Produção: projeto Supabase `hpplboyysmfcjsnjrdmw`.
- Staging: projeto Supabase `xoyasrizivadxnpmzzno` (`smkon-staging`, região `sa-east-1`).
- O staging foi inicializado exclusivamente com as migrations versionadas do repositório.
- Nenhum dado, usuário ou workspace de produção foi copiado.
- Não configure credenciais de produção nos ambientes Preview/Development.

## Secrets do GitHub Actions

Cadastre em **Settings → Secrets and variables → Actions → New repository secret**:

- `E2E_BASE_URL`: URL HTTPS do deployment Preview ligado à branch `qa-e2e-staging`.
- `E2E_EMAIL`: e-mail da conta QA criada manualmente no projeto Supabase de staging.
- `E2E_PASSWORD`: senha forte da conta QA.
- `VERCEL_AUTOMATION_BYPASS_SECRET`: segredo de bypass de automação gerado na proteção da Vercel.

Nunca inclua valores desses secrets em commits, issues, logs ou mensagens.

## Variáveis do Preview na Vercel

Para a branch `qa-e2e-staging`, configure somente no target Preview, com escopo de branch:

- `NEXT_PUBLIC_SUPABASE_URL=https://xoyasrizivadxnpmzzno.supabase.co`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: publishable key do projeto de staging.
- `NEXT_PUBLIC_SITE_URL`: URL HTTPS do deployment Preview da branch.

As variáveis de Production permanecem apontando para o Supabase de produção.

## Primeiro acesso QA

1. No dashboard do projeto `smkon-staging`, abra Authentication → Users → Add user.
2. Crie o usuário QA com e-mail confirmado automaticamente.
3. Crie a senha localmente e salve-a diretamente no GitHub Secret `E2E_PASSWORD`.
4. No primeiro login, `ensure_workspace()` deve criar um workspace isolado e atribuir `owner`.
5. O teste Playwright valida login, bootstrap e renderização dos módulos principais.

## Bypass da proteção da Vercel (feito pelo Owner)

1. Vercel → projeto `smkon` → Settings → Deployment Protection → **Protection Bypass for Automation** → Add/Generate.
2. Copie o valor e cole direto em GitHub → Settings → Secrets and variables → Actions → `VERCEL_AUTOMATION_BYPASS_SECRET`.
3. O valor não deve passar por chat, commits ou logs. A proteção geral (SSO) continua ligada.

A suíte só envia o header de bypass para a origem da aplicação (`tests/e2e/fixtures.mjs`), nunca para o Supabase ou terceiros.

## Execução

O workflow `.github/workflows/e2e.yml` roda em Pull Requests para `main` e manualmente via workflow_dispatch. Ele só executa quando os quatro secrets necessários estão presentes.

Suítes:

| Arquivo | Cobre |
|---|---|
| `auth.setup.mjs` | trava de isolamento (CSP precisa apontar para o Supabase de staging), senha errada, login QA, bootstrap do workspace |
| `navigation.spec.mjs` | os 5 módulos carregam sem erro, visitante vai ao login com `next`, API sem sessão responde 401, headers de segurança |
| `products.spec.mjs` | cadastro, validação de link, evidências, revisão (rejeição exige motivo), score 40 → 50, rejeitada não conta, arquivar; API ignora score do cliente |
| `studio.spec.mjs` | rascunho, aprovação da versão exata, exclusão bloqueada após aprovação, arquivar |
| `admin-finance.spec.mjs` | convite criado, link exibido uma vez, revogar; Financeiro sem valores inventados |

Os dados criados usam um sufixo por execução (`runId`) e ficam só no workspace QA do staging.

## Limitações atuais
- `E2E_BASE_URL` aponta para o Preview fixo da branch `qa-e2e-staging`. Os testes do PR rodam contra esse deployment, não contra o código do PR. Para testar o código de cada PR, os Previews de todas as branches precisam usar o Supabase de staging (hoje usam o de produção) e o workflow deve ler a URL do evento `deployment_status`.
- Traces e vídeos de falha (artifacts privados, 14 dias) podem conter cookies da sessão QA de staging. O login roda sem trace para não gravar a senha.

## Segurança

- Não use usuário, senha, service_role ou dados de produção no staging.
- A publishable key pode estar no frontend; nunca use secret/service_role key em `NEXT_PUBLIC_*`.
- O bypass da Vercel é exclusivo do CI e deve ser rotacionado/revogado se exposto.
- Pull Requests de forks não recebem secrets por padrão; mantenha essa proteção.
