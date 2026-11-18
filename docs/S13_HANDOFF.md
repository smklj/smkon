# S13 — Infraestrutura de agentes (Planner → Executor → Verifier)

**Branch:** `feature/s13-agent-runs` → PR para `feature/smkon-production-readiness`

## O que mudou

| Área | Mudança |
|---|---|
| Banco | Migration `20261119020000_agent_runs.sql`, com quatro tabelas: `agent_settings` (kill switch e limites por workspace), `agent_tool_grants` (ferramentas liberadas), `agent_runs` (execuções, sem delete) e `agent_steps` (passos append-only). Leitura para membros via RLS. **Nenhum papel escreve direto, nem `service_role`**: toda escrita passa pelas funções |
| Allowlist | `agent_tool_catalog()` lista 6 ferramentas: 5 de leitura e `draft_content`, que só propõe rascunho. **Não existe ferramenta de publicação ou aprovação.** Um passo com ferramenta fora da allowlist ou não liberada é registrado como `rejected`, sem saída, e conta no limite |
| Ordem | `agent_record_step` só aceita plan → execute (1..n) → verify. Um verify reprovado permite voltar a executar. `agent_finish_run` só conclui se o último passo for verify `ok` |
| Limites | Execuções por 24 h (padrão 20, faixa 1–500) e passos por execução (padrão 12, faixa 3–50). Um passo além do limite encerra a execução como `failed`/`step_limit` em vez de ser registrado. Entrada e saída limitadas a 64 KB |
| Kill switch | `agent_set_kill_switch` (só owner, motivo obrigatório para ligar) encerra na hora as execuções ativas (`killed`/`kill_switch`) e bloqueia novas (`agents_killed`) |
| Papéis | owner/admin iniciam e cancelam execuções e liberam ferramentas. Só o owner controla o kill switch e os limites. Viewer só lê. Passos, falha e conclusão são exclusivos do executor do servidor (`service_role`) |
| Auditoria | Triggers de `audit_log` em settings, grants e runs; os passos são append-only |
| App | Página `/agentes` com kill switch, ferramentas, limites, nova execução e execuções recentes com os passos. O módulo 04 da navegação passa a "Em construção" |

## Arquivos

- `supabase/migrations/20261119020000_agent_runs.sql`, `supabase/tests/012_agent_runs.test.sql` (60 checagens)
- `src/lib/agents/types.ts`, `src/lib/agents/server.ts`
- `src/app/(app)/agentes/page.tsx`, `src/app/(app)/agentes/actions.ts`
- `src/components/agents/*` (KillSwitchForm, ToolToggle, LimitsForm, StartRunForm, CancelRunForm)
- `src/lib/http/errors.ts` (códigos novos), `src/lib/supabase/database.types.ts`, `src/lib/navigation.ts`, `src/app/globals.css`
- `tests/unit/agents.test.ts`

## Testes executados (resultados reais, 18/11/2026)

| Verificação | Resultado |
|---|---|
| `npm run test:db` (PostgreSQL 16.15 + shim) | ✅ 12/12 arquivos; `012_agent_runs` 60/60 |
| `npm run test:unit` | ✅ 61/61 (5 novos) |
| `npm run typecheck` / `lint` / `build` | ✅ sem erros; rota `/agentes` listada |
| CI e E2E | ver PR |

## Decisões

- **Executor fora deste split.** O S13 entrega o trilho: estados, limites, allowlist, kill switch e trilha de passos. O processo que de fato chama um modelo e executa ferramentas é o S14 e exige escolher provedor e custo (🔐). Até lá, execuções criadas ficam `queued`, e a tela diz isso.
- **Passos só pelo `service_role`.** Uma sessão de usuário não forja passos nem conclui execuções: a fronteira de confiança é o banco.
- **Rejeição registrada, não erro.** Uma tentativa de usar ferramenta proibida fica na trilha (`rejected` / `tool_not_allowed`), para auditoria.
- **Publicação continua impossível para agentes:** nenhuma ferramenta publica, e a publicação real (fora do dry-run) nem existe no banco.

## Ambientes (autorizado pelo Owner em 18/11/2026)

- **Staging** (`xoyasrizivadxnpmzzno`): migration aplicada via MCP. As 13 funções `agent_*` conferem por md5 com um banco local montado a partir do Git; as 4 tabelas estão com RLS e 1 política de leitura cada; `anon` não executa `agent_start_run`, `authenticated` não executa `agent_record_step` e `service_role` não faz UPDATE direto em `agent_runs`.
- **E2E:** `/agentes` entrou no `navigation.spec.mjs`, e o novo `agents.spec.mjs` cobre limites, execução na fila, kill switch interrompendo e bloqueando, e o desligamento.
- **Produção** (`hpplboyysmfcjsnjrdmw`): aplicada via MCP, versão alinhada para `20261119020000`; as mesmas 13 funções conferem por md5, RLS e privilégios iguais ao staging.
- **main:** PR #29 com CI e E2E (21/21) verdes.

## Pendências

- S14: executor do servidor (worker com `service_role`, provedor de IA, custo 🔐), ferramentas reais conectadas às tabelas e `draft_content` gerando rascunho no Studio.
