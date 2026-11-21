# SMKON — Roadmap de execução em splits

**Origem:** Auditoria Técnica v1 (18/11/2026).
**Regra:** cada split vira uma branch `feature/<split>` e um PR. Nenhum merge em `main`, migration remota, deploy de produção ou mudança de configuração crítica sem autorização explícita do Owner.

Legenda de autorização: 🟢 pode executar · 🔐 exige autorização explícita

## Divisão de responsabilidades

| Claude Code | GPT / Codex |
|---|---|
| Implementa o código em branch isolada | Revisa o código de forma independente |
| Não executa testes | Executa testes unitários, de integração e build |
| Não faz push, merge nem deploy | Identifica bugs e regressões; revisa segurança e arquitetura |
| Entrega alterações, arquivos, justificativas técnicas e instruções de validação | Valida os critérios de aceite |
| Declara o que não conseguiu concluir | Prepara e executa o push **somente após autorização do Owner** |

Uma tarefa só é considerada concluída depois da validação independente. Estados de um split: `implementado` → `em validação` → `validado` → `push autorizado`.

## Base de integração

`feature/smkon-production-readiness` (PR #4) é a base. Os PRs #1, #2 e #3 estão contidos nela e devem ser fechados depois que o #4 for aceito 🔐.
As branches divergentes (`feature/admin-dashboard-mvp`, `feat/fila-status-machine`, `feature/product-intelligence-mvp`) ficam congeladas e serão arquivadas.

## P0 — Segurança, integridade e bloqueadores

| Split | Branch | Escopo | Autorização | Critério de conclusão |
|---|---|---|---|---|
| **S1** · ✅ validado (80/80 SQL, 14/14 unit, CI verde) · integrado via PR #5 | `feature/p0-security-integrity` | Proxy em `src/` e fail-closed; bootstrap atômico de workspace (`ensure_workspace`); aprovação da versão exata (`content_versions`, `content_approvals`, `approve_content`); `audit_log` append-only; ledger imutável; erros sem vazamento; CI com `npm ci` e job de banco | 🟢 | Testes SQL e CI verdes; build lista o Proxy; a API não aprova conteúdo diretamente |
| **S2** | — (configuração) | Proteção da `main`; secret scanning e push protection; Dependabot; Supabase Auth (Site URL, redirects, signup/convites); `NEXT_PUBLIC_SITE_URL` na Vercel; visibilidade do repositório | 🔐 | Configurações aplicadas e verificadas via API |
| **S3** · migrations base aplicadas no remoto pelo Owner; S3.1 (hardening + alinhamento) aguardando aplicação | `feature/s3-1-db-sync` | Aplicar migrations num **branch de banco** Supabase; preview Vercel apontando para ele; smoke test login → Studio → aprovação | 🔐 | Fluxo ponta a ponta funcionando no preview |

## P1 — Fundação

| Split | Escopo | Dependência |
|---|---|---|
| **S4** | Camada de domínio por módulo (`schema/service/repository`), validação de schema, tipos gerados do Supabase, atualização do toolchain de lint | S1 (+ rede para npm) |
| **S5** · ✅ convites em produção (`docs/S5_HANDOFF.md`); **S5.1** membros (listar, alterar papel, remover, último owner protegido) e seletor de organização implementados e testados (`docs/S5_1_HANDOFF.md`), migration `20261119070000` aguardando aplicação 🔐 | Tenancy completa: membros, convites, papéis, seletor de organização, RBAC central | S1, S3 |
| **S6** · ✅ em produção (`docs/S6_HANDOFF.md`); S6.1 ✅ CSP com nonce e sink de logs na integração (PR #45, `docs/S6_1_HANDOFF.md`); destino de logs aguarda escolha do Owner | Observabilidade (logs estruturados, rastreio de erros), headers de segurança (CSP/HSTS), rate limit | S1 |
| **S7** · ✅ build/CI verdes, integrado via PR #5 (validação visual manual pendente) | Design system com o kit de marca oficial (tokens, tipografia, ícones), app shell com sidebar, navegação responsiva | S1 |
| **S8** · ✅ em produção (`docs/S8_HANDOFF.md`); falta ingestão real e conciliação (S11) | Financeiro: estados completos de comissão (prevista → aprovada → liquidada/cancelada/estornada → paga), ingestão server-side, conciliação | S1, S3 |

## P2 — Integração dos módulos

| Split | Escopo |
|---|---|
| **S9** · ✅ em produção (`docs/S9_HANDOFF.md`); falta coleta automática | Product Intelligence persistente com evidências verificáveis e scoring baseado em evidência |
| **S10** · calendário, fila em dry-run, mídia no Storage e licenças implementados e testados (`docs/S10_HANDOFF.md`) | Assets (Storage), registro de licenças e direitos, calendário editorial e fila de publicação em dry-run |
| **S11** · 🟡 backend OAuth + snapshots PII-free idempotentes mergeados na integração; CI #412/E2E #193 verdes; índices FK aplicados e validados em staging via PR #59/CI #422; pendente: OAuth real, backfill/paginação e conciliação financeira; não operacional | Primeiro conector financeiro real (Mercado Livre ou Amazon), com ingestão e conciliação comprovadas 🔐 (contas/escopos) |
| **S12** · ✅ em produção (`docs/S12_HANDOFF.md`); migration `20261119010000` aplicada no staging e na produção | Dashboard com dados reais substituindo constantes |

## P3 — IA e automações

| Split | Escopo |
|---|---|
| **S13** · ✅ em produção (`docs/S13_HANDOFF.md`); migration `20261119020000` no staging e na produção; executor no S14 | Infra de jobs + `agent_runs`/`agent_steps` (Planner → Executor → Verifier), limites, kill switch, allowlist |
| **S14** · 🟡 nove etapas implementadas na integração, ainda não operacional. PR #67 divergida (2 à frente/8 atrás); PR #71 reaplicação limpa (7 à frente/0 atrás, Draft/mergeable), head `c2454be`; CI anterior #44906510584 falhou no typecheck por escopo de variáveis de timeout, corrigido em `c2454be` e aguardando CI próprio. Staging: 29 migrations, 100 runs `killed/kill_switch`, 0 steps/usage/grants/drafts; Production: 20 migrations, sem runs/steps/usage/grants/drafts. Três migrations S14 nos dois ambientes. OIDC configurado; sem budget externo/uso no Gateway; `SUPABASE_SECRET_KEY` ausente; `CRON_SECRET` sensitive sem validação de comprimento. Preview/E2E bloqueados pela quota Vercel. Cron não ativo em produção: rota e `vercel.json` ausentes em `main`. 🔐 | Geração de roteiro/legenda com evidência obrigatória; publicação via APIs oficiais só com hash aprovado 🔐 |

## Experiência (proposto)

| Split | Escopo |
|---|---|
| **S7.2** · fases A, B e C implementadas (`docs/S7_2_HANDOFF.md`); monocromático com cor só para estado | Movimento e feedback: tokens de motion, transições, `loading.tsx`/`error.tsx`, toasts, destaque de linha alterada, contagem nas métricas, sparklines em SVG, hierarquia visual |

## P4 — Escala e experiência

| Split | Escopo |
|---|---|
| **S15** · ✅ implementado e testado (`docs/S15_HANDOFF.md`): contatos com base legal, consentimento append-only, pedidos do titular com prazo e exclusão por anonimização; migration `20261119110000` no staging, produção aguardando autorização 🔐 | Audiência e CRM com consentimento (LGPD) |
| **S16** · ✅ implementado e testado (`docs/S16_HANDOFF.md`): consultas medidas com EXPLAIN ANALYZE em volume, paginação por cursor em produtos, conteúdos, mídia, agentes e audiência, índices medidos (`20261119120000`), cache seguro e teste de carga com p50/p95; staging aplicado e coberto por E2E de paginação, produção aguardando autorização 🔐 | Performance, paginação, cache, testes de carga |

## Bloqueios de ambiente conhecidos

- O ambiente do Claude não acessa o registro npm. Adicionar dependências (S4) exige que o validador gere o lockfile ou que o acesso de rede seja liberado.
- A validação final do schema acontece no branch de banco Supabase (S3), após autorização.


## QA e staging

- Supabase de staging `xoyasrizivadxnpmzzno` para todos os Previews e Development; Production segue em `hpplboyysmfcjsnjrdmw`.
- Testes de navegador (Playwright) rodam no Preview de cada commit (`docs/E2E_STAGING.md`).
- Toda migration nova é aplicada também no staging, antes do Preview que depende dela.


## Reconciliação operacional S14 — 21/11/2026, 09:55 BRT

- A PR #67 ficou divergida após avanços na integração (2 commits à frente, 8 atrás, mergeable=false). A PR #71 reaplica apenas o patch de timeout/ledger sobre a head atual da integração: 3 commits à frente, 0 atrás, Draft e mergeable; CI #44906510584 em execução.
- Staging: 29 migrations, 100 runs encerradas por `kill_switch`, 0 steps, usage, grants e drafts. Production: 20 migrations e nenhuma execução/etapa/usage/grant/draft. As três migrations S14 constam nos dois ambientes.
- RLS habilitado nas quatro tabelas de agentes verificadas em staging; RPCs de claim/draft/usage restritas a `service_role`.
- Vercel: provider/model/OIDC e teto interno US$ 5 presentes; `SUPABASE_SECRET_KEY` ausente; `CRON_SECRET` sensitive presente sem validação do comprimento; `AGENT_EXECUTOR_ENABLED=true` em Preview e Production.
- AI Gateway sem budget do projeto/default e sem uso nos últimos 7 dias. Nenhuma chamada real comprovada; `agent_model_usage` segue vazio.
- Cron `crons` declarado na integração, mas a rota e `vercel.json` não existem em `main`; não ativo em produção.
- Sem merge, alteração de secrets/grants, migration remota ou mudança de Production. Primeiro teste real permanece bloqueado pelas autorizações/configurações de staging listadas no handoff.


## Atualização de CI e branch — 21/11/2026, 10:00 BRT

- PR #71 agora está 7 commits à frente e 0 atrás da head de integração `16bd6b009a64884fadccbfa5afc47d40ccb11eae`; comparação `ahead`, Draft e mergeable. Head atual: `c2454be94a6f221502f768ed917f636c73cdbaaf`.
- O primeiro CI disparado na PR (#44906510584, synthetic merge da head anterior) falhou no typecheck: `planTimeout`, `toolTimeout` e `summaryTimeout` estavam declarados dentro dos blocos `try`, mas usados nos respectivos `catch`. O job de migrations/SQL passou.
- Corrigi o escopo no commit `c2454be`, declarando cada budget antes do `try`. Esse commit ainda aguarda uma execução CI própria; não atribuir a ele o resultado do run anterior.
- O check Vercel segue falhando por `api-deployments-free-per-day`; o inventário de deployments da branch #71 continua vazio (nenhum Preview criado). E2E do head atual não executado.
- PR #67 continua aberta em Draft, mas a comparação atual é divergente (2 commits à frente/8 atrás, mergeable=false). Mantida como fallback até o CI atual da #71 concluir.
