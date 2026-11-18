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

## Execução

O workflow `.github/workflows/e2e.yml` roda em Pull Requests para `main` e manualmente via workflow_dispatch. Ele só executa quando os quatro secrets necessários estão presentes.

O teste inicial é smoke/regressão de navegação. Testes de CRUD, convites, score e cálculos financeiros serão adicionados após instrumentar seletores estáveis e validar cada fluxo no staging.

## Segurança

- Não use usuário, senha, service_role ou dados de produção no staging.
- A publishable key pode estar no frontend; nunca use secret/service_role key em `NEXT_PUBLIC_*`.
- O bypass da Vercel é exclusivo do CI e deve ser rotacionado/revogado se exposto.
- Pull Requests de forks não recebem secrets por padrão; mantenha essa proteção.
