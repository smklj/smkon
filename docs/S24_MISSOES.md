# S24 — Missões de agentes (execuções recorrentes por agenda)

**Branch:** `feature/s24-agent-missions` · **Base:** `main` em `22c24e0` · **Plano:** `PLANO_AUTONOMIA` (Centro de Comando Autônomo, fase 1)

## O que muda

Uma **missão** é um objetivo permanente de um agente com agenda própria: todo dia, toda semana ou a cada N horas, no horário de Brasília. Quando vence, o worker do servidor coloca **uma execução comum na fila**. Essa execução passa pelas mesmas barreiras de uma execução manual: kill switch, limite de 24 h, limite de passos, allowlist de ferramentas e Verifier.

Missões não publicam nada. Elas só criam execuções, e nenhum agente tem ferramenta de publicação.

| Área | Mudança |
|---|---|
| Banco | Migration `20261124100000_agent_missions.sql`: tabela `agent_missions` (RLS, leitura para membros, sem escrita direta, sem DELETE, auditoria); coluna anulável `agent_runs.mission_id`; funções `agent_mission_next_run`, `agent_create_mission`, `agent_set_mission_enabled`, `agent_archive_mission` (owner/admin) e `agent_enqueue_due_missions` (só `service_role`) |
| Worker | `tick` chama `agent_enqueue_due_missions` antes de expirar e reservar. Falha nas missões (por exemplo, migration ainda não aplicada) só é registrada; a fila existente continua. Resposta do worker ganha `missions: { enqueued, skipped, error }` |
| App | Seção **Missões** em `/agentes`: lista com agenda, próxima execução, última execução e motivo de pulo; criar, pausar, retomar e arquivar. Sem a migration, a seção mostra "migration pendente" e o restante da página funciona |

## Regras no banco

- **Responsável:** a execução é criada em nome de quem criou ou retomou a missão por último. Se essa pessoa deixar de ser owner/admin, a missão é pausada (`owner_not_allowed`) e nada roda em nome dela.
- **Sem acúmulo:** a próxima execução é calculada a partir de agora, nunca da hora perdida. Uma missão não cria execução nova enquanto a anterior está ativa (`previous_run_active`).
- **Pulos registrados:** `kill_switch`, `previous_run_active`, `run_limit_reached`, `max_steps_above_limit`. A agenda avança e o motivo aparece na tela.
- **Teto:** 20 missões ativas (não arquivadas) por workspace.
- **Erros novos:** `invalid_mission_name`, `invalid_mission_schedule`, `invalid_timezone`, `mission_limit_reached`, `mission_not_found`, `mission_archived`, `invalid_mission_state`.

## Testes executados (resultados reais, 24/11/2026)

| Verificação | Resultado |
|---|---|
| `npm run test:db` (PostgreSQL 16 + shim) | 33/33 arquivos; `022_agent_missions` com 55 checagens |
| `npm run test:unit` | 500/500 (13 novos em `agents-missions.test.ts`; 1 ajuste em `agents-worker.test.ts` para a nova chamada e o campo `missions`) |
| `npm run typecheck` · `lint` · `build` | sem erros; `/agentes` no build |
| E2E | teste novo em `agents.spec.mjs` (criar, pausar, retomar, arquivar). É pulado enquanto a migration não estiver no banco do Preview |

## Pendências do Owner 🔐

1. **Aplicar a migration** `20261124100000_agent_missions.sql` no staging e depois na produção.
2. **Worker mais frequente (S23).** Hoje o cron da Vercel roda uma vez por dia (`17 11 * * *`, limite do plano Hobby). Com isso, uma missão das 08h só entra na fila às 08:17 e só uma missão por workspace avança por dia. Duas saídas:
   - **Vercel Pro:** trocar o cron em `vercel.json` para `*/15 * * * *`. É o caminho mais simples.
   - **Supabase `pg_cron` + `pg_net` (sem custo extra):** as duas extensões estão disponíveis, mas não instaladas. O agendamento abaixo chama o mesmo endpoint com o `CRON_SECRET` guardado no Vault. Ele **não** está nas migrations porque cria segredo e chamada de rede no banco remoto.

```sql
-- Rodar uma vez, no SQL Editor do projeto, depois de autorizado. Substituir os dois valores entre <>.
create extension if not exists pg_cron;
create extension if not exists pg_net;
select vault.create_secret('<CRON_SECRET da Vercel>', 'agent_worker_cron_secret');
select cron.schedule(
  'smkon-agent-worker',
  '*/15 * * * *',
  $$
  select net.http_get(
    url := 'https://<domínio de produção>/api/agents/worker',
    headers := jsonb_build_object(
      'Authorization',
      'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'agent_worker_cron_secret')
    ),
    timeout_milliseconds := 290000
  );
  $$
);
```

3. As pendências anteriores continuam valendo para o worker rodar de verdade: `SUPABASE_SECRET_KEY`, `AGENT_EXECUTOR_ENABLED=true`, modelo e teto mensal (`docs/S14_PROGRESS.md`, `docs/S18_HANDOFF.md`).

## Próximo passo (S25)

Gatilhos por evento (venda na Hotmart, evidência nova, conteúdo aprovado), níveis de autonomia por missão e a caixa de aprovação única com briefing diário.
