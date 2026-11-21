# Engenharia de release do SMKON

## Tronco único
- `main` é a única linha de base. Toda mudança entra por PR para a `main`.
- `feature/smkon-production-readiness` está congelada (histórico das frentes S1–S16); não recebe mais merges.
- Merge na `main` = deploy de produção automático pela integração Git da Vercel.

## Checks de um PR
| Check | O que garante |
|---|---|
| Typecheck, lint and build | `tsc`, ESLint, testes unitários, build de produção e auditoria de dependências (high+) |
| Database migrations and SQL tests | todas as migrations num Postgres limpo + suítes SQL (RLS, papéis, append-only) |
| Playwright · Build local | o app compilado no runner, testado no navegador contra o Supabase de **staging**. Não depende da cota de deploy da Vercel |
| Playwright · Staging | o mesmo, contra o Preview da Vercel, quando ele existe |

Os dois primeiros são obrigatórios pela proteção da `main`.

Os dois jobs de Playwright usam a mesma conta QA no staging, então rodam um por vez (fila
`e2e-staging`, no nível do job). Enquanto um roda, só um outro fica pendente: se um terceiro
chegar, o pendente mais antigo é cancelado e precisa de "Re-run". PRs do Dependabot não entram
na fila (não recebem os secrets e não conseguiriam entrar no staging).

## Banco de dados
1. Migration nova vai em `supabase/migrations/` com teste SQL correspondente em `supabase/tests/`.
2. Nunca editar uma migration já aplicada: correções entram como migration nova.
3. Ordem de aplicação: CI (banco limpo) → staging → produção.
4. Depois de aplicar, conferir paridade: corpo das funções (sem comentários), constraints, RLS e grants de `anon`/`authenticated` iguais ao banco gerado pelo repositório, e `get_advisors` sem achado novo.

Estado em 21/11/2026: staging e produção com as 31 migrations do repositório; paridade conferida em 534 objetos.

## Segredos
- Nunca com valor padrão no código (o repositório é público).
- Produção e Preview com valores diferentes.
- Lista completa e situação: `docs/SEGREDOS.md`.

## Dependências
Dependabot semanal (npm) e mensal (GitHub Actions), agrupado por família. Branches
`dependabot/**` não geram Preview na Vercel (`vercel.json` → `git.deploymentEnabled`): o CI
valida typecheck, testes e build sem gastar a cota diária de deploys. Saltos de versão
maior (por exemplo `actions/checkout` 4 → 7) só entram depois de ler as notas de mudança.

## Removido
`scheduled-deploy.yml` fazia commits vazios na `main` duas vezes por dia para driblar o limite diário de deploys do plano gratuito da Vercel. O limite continua existindo; o caminho correto é o plano Pro ou espaçar merges.

## Cota de deploys da Vercel
O plano Hobby aceita 100 deploys em 24 horas corridas, somando Preview e produção. Cada push em
qualquer branch gera um Preview. Quando a cota acaba, o push na `main` recebe o status
"Deployment rate limited" e a produção não é atualizada; é preciso disparar o deploy de novo
quando a janela libera. O E2E com build local não depende dessa cota.
