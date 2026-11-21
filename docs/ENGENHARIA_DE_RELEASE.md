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
Dependabot semanal (npm) e mensal (GitHub Actions), agrupado por família.

## Removido
`scheduled-deploy.yml` fazia commits vazios na `main` duas vezes por dia para driblar o limite diário de deploys do plano gratuito da Vercel. O limite continua existindo; o caminho correto é o plano Pro ou espaçar merges.
