## Inventário não secreto S14 — 22/11/2026 07:02 BRT

Consulta Vercel com decrypt=false. Nenhum valor sensitive foi descriptografado ou registrado.

| Variável | Preview | Production | Observação |
|---|---|---|---|
| SUPABASE_SECRET_KEY | Ausente | Ausente | Obrigatória para o cliente service do worker; chave exclusiva de staging ainda não provisionada |
| SUPABASE_SERVICE_ROLE_KEY | Ausente | Ausente | Não é o nome lido pelo código S14 |
| CRON_SECRET | Sensitive presente | Sensitive presente | Targets separados; valores, comprimento e trim não verificados |
| AGENT_EXECUTOR_ENABLED | true | true | Owner deve desabilitar Production até homologação |
| AGENT_MODEL_PROVIDER | vercel-ai-gateway | vercel-ai-gateway | Provider selecionado |
| AGENT_MODEL_AUTH | oidc | oidc | Seleção configurada; autenticação em runtime não comprovada |
| AGENT_MODEL | anthropic/claude-haiku-5.5 | anthropic/claude-haiku-5.5 | Modelo no catálogo live |
| AGENT_MONTHLY_BUDGET_USD | 5 | 5 | Teto interno soft, não substitui budget externo |
| AI_GATEWAY_API_KEY | Ausente | Ausente | Caminho selecionado é OIDC |

- NEXT_PUBLIC_SUPABASE_URL: Preview/Development aponta para o projeto smkon-staging; Production aponta para o projeto smkonlj. Não compartilhar chave de serviço entre ambientes.
- O worker valida flag → CRON_SECRET → Bearer → OIDC/modelo → budget → cliente Supabase service → claim. Sem SUPABASE_SECRET_KEY, não cria o cliente service e não reivindica execução.
- Não executar leitura de valores Sensitive para validar formato. O comprimento mínimo de 32 caracteres e ausência de whitespace de CRON_SECRET devem ser verificados por procedimento seguro no ambiente, sem imprimir o valor.
- Nenhuma variável foi criada, alterada ou removida nesta rodada.

# Segredos e variáveis de ambiente

Situação conferida na Vercel em 21/11/2026. Valores nunca entram no repositório nem em conversas.

| Variável | Para quê | Production | Preview |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | cliente Supabase | ✅ | ✅ (staging) |
| `NEXT_PUBLIC_SITE_URL` | redirects de e-mail | ✅ | por origem |
| `SUPABASE_SECRET_KEY` | operações de servidor (webhooks, sync, agentes, execução de ações) | ❌ **falta** | ❌ falta |
| `CRON_SECRET` | worker de agentes | ✅ | ✅ |
| `AGENT_*` | executor de agentes via AI Gateway | ✅ | ✅ |
| `INTEGRATION_TOKEN_ENCRYPTION_KEY` (+ `_ID`) | cifra tokens do Metricool | ❌ falta | ❌ falta |
| `MERCADO_LIVRE_CLIENT_ID` / `_CLIENT_SECRET` / `_REDIRECT_URI` | OAuth Mercado Livre | ❌ falta | ❌ falta |
| `MERCADO_LIVRE_TOKEN_ENCRYPTION_KEY` (+ `_ID`) | cifra tokens do Mercado Livre | ❌ falta | ❌ falta |
| `KIWIFY_WEBHOOK_ENABLED` / `KIWIFY_WEBHOOK_SECRET` | receptor Kiwify (desligado) | — | — |

Sem `SUPABASE_SECRET_KEY` nenhuma integração de receita ou de publicação funciona em produção.

## Como gerar as chaves de cifragem
```bash
openssl rand -base64 32
```
Cadastre direto na Vercel (Settings → Environment Variables), tipo **Sensitive**, um valor para Production e outro para Preview. Trocar a chave exige recifrar os tokens já salvos (use um `_KEY_ID` novo).


## Auditoria de variáveis S14 — 22/11/2026 01:57 BRT

Inventário Vercel consultado com decrypt=false. Nenhum valor Sensitive foi lido.

| Variável | Preview | Production | Evidência |
|---|---|---|---|
| SUPABASE_SECRET_KEY | ausente | ausente | Não aparece no inventário do projeto |
| CRON_SECRET | Sensitive | Sensitive | Targets separados; valores não lidos |
| AGENT_EXECUTOR_ENABLED | true | true | Variável plain nos dois targets |
| AGENT_MODEL_PROVIDER | vercel-ai-gateway | vercel-ai-gateway | Configuração plain |
| AGENT_MODEL_AUTH | oidc | oidc | Opt-in OIDC explícito |
| AGENT_MODEL | anthropic/claude-haiku-5.5 | anthropic/claude-haiku-5.5 | Catálogo do Gateway |
| AGENT_MONTHLY_BUDGET_USD | 5 | 5 | Teto interno |
| AI_GATEWAY_API_KEY | ausente | ausente | OIDC é o caminho selecionado |

Às 04:49:13Z, a rota Production /api/agents/worker registrou unauthorized. Pelo fluxo do handler, a requisição passou pela flag e pelo validador de formato do CRON_SECRET, mas o Bearer não correspondeu. Isso não comprova Cron autenticado nem OIDC.

Sem SUPABASE_SECRET_KEY, o cliente service_role não é criado; o worker não chega ao claim nem à chamada paga. A recomendação é o Owner manter AGENT_EXECUTOR_ENABLED=false em Production até homologação. Nenhuma variável foi alterada nesta auditoria.

---

## Inventário S14 — 22/11/2026 03:00 BRT (sem descriptografar)

- `AGENT_EXECUTOR_ENABLED=true` em Preview e Production.
- `AGENT_MODEL_PROVIDER=vercel-ai-gateway`, `AGENT_MODEL_AUTH=oidc`, `AGENT_MODEL=anthropic/claude-haiku-5.5`, `AGENT_MONTHLY_BUDGET_USD=5`.
- `CRON_SECRET`: Sensitive presente separadamente em Preview e Production; valores não lidos. Não há validação de comprimento/whitespace de Production comprovada nesta janela.
- `SUPABASE_SECRET_KEY` e `SUPABASE_SERVICE_ROLE_KEY`: ausentes no inventário. `AI_GATEWAY_API_KEY`: ausente; OIDC é o caminho configurado.
- O handler valida OIDC/modelo antes de criar cliente de serviço; `src/lib/supabase/service.ts` usa especificamente `SUPABASE_SECRET_KEY`. Sem token OIDC válido, o bloqueio pode ser `model_not_configured`; se OIDC passar, a chave ausente bloqueia com `service_not_configured` antes de claim.
- Cron Production: `/api/agents/worker`, 17:11 UTC = 08:17 BRT. Às 03:00 BRT a execução diária ainda era futura; não houve invocação manual.
- Recomendação: Owner manter `AGENT_EXECUTOR_ENABLED=false` em Production até homologação. Nenhuma variável foi alterada nesta auditoria.
- Nenhum valor secreto foi lido, copiado ou registrado.

---

## Checkpoint operacional S14 — 22/11/2026 03:56 BRT

### GitHub e CI
- Repositório smklj/smkon; main permanece em 84afe632. PR #113 está aberta, Draft e mergeable; branch docs/s14-current-operational-handoff-20261121-2000 está 21 commits à frente / 0 atrás. Compare confirma somente cinco arquivos documentais. #113 é a única PR aberta. Splits #35–#42 e #46, além de #82 e #97, seguem merged; #102 fechada sem merge.
- CI #44992062696 no HEAD 8f9bd8fad5c5df0acf3bc9a0a88161139cbc2084: 2/2 jobs success. Logs confirmam 418/418 unit tests, typecheck, lint, dependency audit, build Next.js e migrations/SQL tests em banco descartável.
- E2E PR #44992062742: Playwright · Build local success, 36 passed (2.7m), usando o Supabase de staging; Playwright · Staging foi skipped pelo evento pull_request. Último job Playwright · Staging disparado por deployment_status ainda é #44983114589, 36/36 no SHA 7d957275 (código de app equivalente porque a PR é docs-only). Nenhum desses testes chama o AI Gateway.

### Vercel e Cron
- Preview exato do HEAD 8f9bd8: deployment dpl_Fim54qNNSjWVp3eFx4jbJxN17dXP, READY, https://smkon-p8lolgft9-smkon.vercel.app.
- Production mais recente: dpl_3RdCGJ2THbYE9aajDZGgGzwWTUnV, READY, main SHA 84afe632, alias https://smkon.vercel.app. Nenhum deploy/alias Production foi alterado nesta rodada.
- vercel.json declara /api/agents/worker, 17 11 * * * UTC = 08:17 BRT. No checkpoint 03:56 BRT, a execução diária das 08:17 ainda é futura. Logs de runtime Production na janela recente de 30 min: nenhuma linha. A consulta de 3h foi recusada pelo plano Hobby por exceder retenção; não interpretar como ausência de logs nesse período.

### Credenciais e proteções (inventário Vercel sem decrypt)
- AGENT_EXECUTOR_ENABLED=true em Preview e Production; AGENT_MODEL_PROVIDER=vercel-ai-gateway; AGENT_MODEL_AUTH=oidc; modelo anthropic/claude-haiku-5.5; teto interno AGENT_MONTHLY_BUDGET_USD=5.
- CRON_SECRET consta como Sensitive separadamente em Preview e Production; nenhum valor foi lido. SUPABASE_SECRET_KEY e SUPABASE_SERVICE_ROLE_KEY ausentes no inventário de ambos os targets. AI_GATEWAY_API_KEY ausente; OIDC é o caminho configurado.
- Código revisado: handler.ts valida flag → CRON_SECRET (mínimo 32 e trim) → Bearer em tempo constante → modelo/OIDC → budget/preço → cliente service_role → claim. service.ts exige SUPABASE_SECRET_KEY. model.ts aceita x-vercel-oidc-token ou VERCEL_OIDC_TOKEN somente com opt-in OIDC. Token/autenticação OIDC em runtime não comprovados. Sem token, bloqueio model_not_configured; se OIDC passar, chave Supabase ausente bloqueia com service_not_configured antes de claim/model call.
- Não alterar Production sem autorização. Recomenda-se ao Owner manter/desligar AGENT_EXECUTOR_ENABLED em Production até homologação; nenhuma variável foi modificada.

### Supabase, RLS, ACL e migrations
- Staging xoyasrizivadxnpmzzno: 152 runs, todas killed; 0 steps, 0 tool grants, 0 agent_model_usage e 0 conteúdos com agent_run_id. agent_settings: kill_switch=false, max_runs_per_day=500, max_steps_per_run=12 (atualizado em 22/11 03:09 BRT). Production hpplboyysmfcjsnjrdmw: 0 runs, steps, grants, usage e conteúdo vinculado; sem linha de agent_settings.
- RLS habilitado em 6/6 tabelas auditadas em ambos os bancos; policy count: uma em cada tabela S14 (agent_runs, agent_steps, agent_model_usage, agent_tool_grants, agent_settings) e quatro em content_items.
- Funções agent_*: EXECUTE authenticated=6, service_role=12, postgres=19; nenhuma concessão a anon foi retornada. As ACLs consultadas coincidem entre Staging e Production.
- Ambos listam os mesmos 31 nomes de migrations, mas 0/31 version IDs coincidem; audience_consent e workspace_members aparecem em ordem diferente. Isso não prova, isoladamente, schema divergente. Não executar db repair / db push sem comparar definições aplicadas, backup e plano formal.

### Planner, Executor, Verifier, ferramentas e orçamento
- run.ts relê status antes de fases, respeita cancelamento/kill switch, timeout por passo e prazo total; ferramenta fora de allowlist/grant é rejeitada. read.ts limita a 50 itens e 60.000 bytes, com allowlist e escopo da organização. draft.ts usa RPC agent_draft_content e só aceita retorno content_status=draft. verifier.ts é determinístico e exige evidência verificada do mesmo produto antes de permitir draft.
- model-gateway.ts usa endpoint fixo https://ai-gateway.vercel.sh/v1/chat/completions; testes usam fetch injetado e não fazem chamadas reais. budget.ts grava por agent_record_model_usage; tick.ts consulta agent_model_spend_since antes de cada claim. Limite interno US$ 5 é soft, sem reserva atômica de custo máximo e sem outbox durável de reconciliação.

### AI Gateway e ledger
- Uso do projeto nos últimos 7 dias: nenhuma série/linha, 0 requests, 0 input/output tokens e US$ 0. Budgets de projeto, equipe e defaults: nenhum (defaultCoveredCounts zero); regras de roteamento: nenhuma. Catálogo live confirma anthropic/claude-haiku-5.5 disponível.
- agent_model_usage: 0 linhas, 0 input tokens, 0 output tokens e US$ 0 em Staging e Production. Consistência observável com uso agregado zero; não comprova reconciliação depois de uma cobrança. Nenhuma chamada real ao Gateway foi comprovada.

### Gate de homologação e segurança
Não executar operations_review real enquanto faltarem: chave service exclusiva de Staging no target Preview, grants mínimos de leitura aprovados, budget externo isolado do Production, validação segura de CRON_SECRET e prova de OIDC em runtime. Depois dos gates, executar uma única run e reconciliar request/modelo/tokens/custo do Gateway com agent_model_usage, conferindo steps, draft e Verifier.

Somente leituras, inspeção de código e atualização documental nesta rodada. Sem merge, alteração em main ou Production, migration remota, secret, grant, budget, deploy Production ou chamada paga.


## Inventário não secreto S14 — 22/11/2026 05:02 BRT
Consulta Vercel com decrypt=false; nenhum valor sensitive foi lido:
- AGENT_MODEL_PROVIDER=vercel-ai-gateway, AGENT_MODEL_AUTH=oidc, AGENT_MODEL=anthropic/claude-haiku-5.5, AGENT_MONTHLY_BUDGET_USD=5.
- AGENT_EXECUTOR_ENABLED=true em Preview e Production.
- CRON_SECRET existe como Sensitive em targets separados Preview e Production; valor, comprimento e formato não foram lidos/validados.
- SUPABASE_SECRET_KEY, SUPABASE_SERVICE_ROLE_KEY e AI_GATEWAY_API_KEY não aparecem no inventário visível do projeto. OIDC é a credencial selecionada, mas token/autenticação em runtime não comprovados.
- O worker bloqueia sem token OIDC válido (model_not_configured) e, se OIDC passar, sem SUPABASE_SECRET_KEY (service_not_configured) antes do claim.
- Não provisionar segredo compartilhado entre Preview e Production. A chave necessária deve ser exclusiva do Supabase staging e limitada ao target Preview, após aprovação do Owner.


## Inventário não secreto verificado — 22/11/2026 07:59 BRT
Consulta Vercel com `decrypt=false`; nenhum valor Sensitive foi descriptografado:
- `AGENT_MODEL_PROVIDER=vercel-ai-gateway`, `AGENT_MODEL_AUTH=oidc`, `AGENT_MODEL=anthropic/claude-haiku-5.5`, `AGENT_MONTHLY_BUDGET_USD=5`.
- `AGENT_EXECUTOR_ENABLED=true` em Preview e Production.
- `CRON_SECRET` existe como Sensitive em targets separados Preview/Production; valor, comprimento e whitespace não foram lidos/validados.
- `SUPABASE_SECRET_KEY` e `SUPABASE_SERVICE_ROLE_KEY` não constam no inventário de variáveis do projeto; também não há `AI_GATEWAY_API_KEY`. A branch `qa-e2e-staging` tem apenas URL, publishable key e site URL específicos; não tem chave de serviço.
- O caminho OIDC está selecionado, mas autenticação efetiva em runtime não foi comprovada. Sem `SUPABASE_SECRET_KEY`, o cliente service não é criado e o worker para antes do claim/model call.
- Não compartilhar secrets entre Preview e Production. A chave necessária deve ser exclusiva do Supabase staging e limitada ao target Preview, após aprovação do Owner.

---

## Inventário S14 — 22/11/2026 08:58 BRT (sem descriptografar valores)

- `AGENT_EXECUTOR_ENABLED=true` em Preview e Production.
- `CRON_SECRET`: Sensitive em targets separados Preview/Production; valor nunca lido ou registrado.
- `AGENT_MODEL_PROVIDER=vercel-ai-gateway`, `AGENT_MODEL_AUTH=oidc`, `AGENT_MODEL=anthropic/claude-haiku-5.5`.
- `SUPABASE_SECRET_KEY`, `SUPABASE_SERVICE_ROLE_KEY` e `AI_GATEWAY_API_KEY` ausentes no inventário Vercel.
- Runtime Production em 08:53:31 BRT alcançou `service_not_configured`: Bearer/CRON passou; OIDC passou somente checagem local de presença/formato, não houve validação no Gateway. A ausência de `SUPABASE_SECRET_KEY` bloqueou antes do claim/model call.
- Não inserir ou compartilhar chaves entre ambientes. Provisionar uma chave de serviço exclusiva de staging apenas no target Preview, com grants mínimos, depois de aprovação do Owner. Manter Production desabilitado até homologação.
