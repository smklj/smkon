## Checkpoint de credenciais S14 — 22/11/2026 00:55 BRT (inventário Vercel com decrypt=false)

| Controle | Production | Preview/Staging |
|---|---|---|
| SUPABASE_SECRET_KEY | Ausente | Ausente |
| SUPABASE_SERVICE_ROLE_KEY | Ausente | Ausente |
| CRON_SECRET | Sensitive presente; valor/comprimento não lidos | Sensitive presente; valor não lido; passou indiretamente mínimo 32/trim via resposta unauthorized |
| AGENT_EXECUTOR_ENABLED | true | true |
| AGENT_MODEL_PROVIDER | vercel-ai-gateway | vercel-ai-gateway |
| AGENT_MODEL_AUTH | oidc | oidc |
| AGENT_MODEL | anthropic/claude-haiku-5.5 | anthropic/claude-haiku-5.5 |
| AGENT_MONTHLY_BUDGET_USD | 5 (teto interno soft) | 5 (teto interno soft) |
| AI_GATEWAY_API_KEY | Ausente (OIDC selecionado) | Ausente (OIDC selecionado) |

Nenhum valor secreto foi descriptografado. O GET sem Bearer no Preview foi rejeitado como unauthorized depois das barreiras de flag e formato de CRON_SECRET; isso não comprova OIDC nem execução autenticada. Em Production, comprimento/whitespace do CRON_SECRET não foi validado.

Bloqueios: SUPABASE_SECRET_KEY exclusiva de staging, grants mínimos, budget externo isolado e prova OIDC em runtime. Recomenda-se ao Owner desabilitar AGENT_EXECUTOR_ENABLED em Production até homologação. Nenhuma variável foi alterada.

---

## Checkpoint de credenciais S14 — 22/11/2026 00:00 BRT (inventário Vercel com decrypt=false)

| Controle | Production | Preview/Staging |
|---|---|---|
| SUPABASE_SECRET_KEY | Ausente | Ausente |
| SUPABASE_SERVICE_ROLE_KEY | Ausente | Ausente |
| CRON_SECRET | Sensitive presente; valor/comprimento não lidos | Sensitive presente; valor não lido |
| AGENT_EXECUTOR_ENABLED | true | true |
| AGENT_MODEL_PROVIDER | vercel-ai-gateway | vercel-ai-gateway |
| AGENT_MODEL_AUTH | oidc | oidc |
| AGENT_MODEL | anthropic/claude-haiku-5.5 | anthropic/claude-haiku-5.5 |
| AGENT_MONTHLY_BUDGET_USD | US$5 (limite interno soft) | US$5 (limite interno soft) |
| AI_GATEWAY_API_KEY | Ausente; OIDC selecionado | Ausente; OIDC selecionado |
| Budget externo AI Gateway | Nenhum budget específico/default | Nenhum budget específico/default |

Nenhum valor Sensitive foi descriptografado ou incluído. OIDC é aceito pelo código somente com opt-in explícito `AGENT_MODEL_AUTH=oidc`, usando `x-vercel-oidc-token` ou `VERCEL_OIDC_TOKEN`; emissão e aceitação em runtime não foram comprovadas. O handler valida flag, CRON_SECRET, Bearer, modelo/OIDC e orçamento antes de criar o cliente de serviço. O cliente usa especificamente `SUPABASE_SECRET_KEY`; sem ela, a rota responde `503 service_not_configured` antes de claim/model call, se as barreiras anteriores passarem.

Recomendação ao Owner: manter/desligar `AGENT_EXECUTOR_ENABLED` em Production até a homologação. Nenhuma variável foi alterada nesta rodada.


---

## Checkpoint de credenciais S14 — 21/11/2026 22:58 BRT (decrypt=false)

| Controle | Production | Preview/Staging |
|---|---|---|
| SUPABASE_SECRET_KEY | Ausente | Ausente |
| CRON_SECRET | Sensitive presente; comprimento não validado | Sensitive presente; GET sem Bearer gerou evento unauthorized, provando validação do mínimo de 32 caracteres/trim antes da comparação |
| AGENT_EXECUTOR_ENABLED | true | true |
| AGENT_MODEL_PROVIDER | vercel-ai-gateway | vercel-ai-gateway |
| AGENT_MODEL_AUTH | oidc | oidc |
| AGENT_MODEL | anthropic/claude-haiku-5.5 | anthropic/claude-haiku-5.5 |
| AGENT_MONTHLY_BUDGET_USD | US$5 (limite interno soft) | US$5 (limite interno soft) |
| AI_GATEWAY_API_KEY | Ausente; OIDC selecionado | Ausente; OIDC selecionado |
| Budget externo AI Gateway | Nenhum | Nenhum |

Nenhum valor Sensitive foi descriptografado ou incluído. O evento unauthorized do Preview prova apenas que a rota passou pela validação do CRON_SECRET e rejeitou a ausência do Bearer; não prova OIDC nem execução do worker. Em Production, não há invocação autenticada/log que permita validar comprimento do CRON_SECRET.

O worker usa especificamente SUPABASE_SECRET_KEY para o cliente service_role. Sem essa variável, após as barreiras anteriores, retorna 503 service_not_configured antes de claim/steps/model call. Recomenda-se ao Owner manter AGENT_EXECUTOR_ENABLED=false em Production até homologação; nenhuma configuração foi alterada nesta auditoria.

---
## Inventário S14 — 21/11/2026 22:00 BRT (sem descriptografar)

| Variável/controle | Production | Preview (staging) |
|---|---|---|
| `SUPABASE_SECRET_KEY` | Ausente | Ausente |
| `CRON_SECRET` | Sensitive presente; comprimento não verificado | Sensitive presente; comprimento não verificado |
| `AGENT_EXECUTOR_ENABLED` | `true` | `true` |
| `AGENT_MODEL_PROVIDER` | `vercel-ai-gateway` | `vercel-ai-gateway` |
| `AGENT_MODEL_AUTH` | `oidc` | `oidc` |
| `AGENT_MODEL` | `anthropic/claude-haiku-5.5` | `anthropic/claude-haiku-5.5` |
| `AGENT_MONTHLY_BUDGET_USD` | US$ 5 (limite interno soft) | US$ 5 (limite interno soft) |
| `AI_GATEWAY_API_KEY` | Ausente (OIDC selecionado) | Ausente (OIDC selecionado) |
| Budget externo AI Gateway do projeto | Nenhum | Nenhum |
| Budget default AI Gateway | Nenhum | Nenhum |

A consulta Vercel foi feita com `decrypt=false`. Nenhum valor Sensitive foi lido ou incluído. OIDC está selecionado, mas token/aceitação em runtime não foram comprovados. `SUPABASE_SECRET_KEY` está ausente nos dois targets; sem ela, após passar as barreiras anteriores, o worker retorna `503 service_not_configured` antes de claim.

**Recomendação:** manter `AGENT_EXECUTOR_ENABLED=false` em Production até homologação. Não copiar segredo de Production para Preview. Para o teste real, provisionar a chave exclusiva do projeto staging apenas em Preview, validar o Cron secret sem revelar valor, aprovar grants mínimos e configurar budget externo restrito ao projeto.

---

## Estado S14 verificado — 21/11/2026 20:00 BRT

| Variável/controle | Production | Preview (staging) |
|---|---|---|
| `SUPABASE_SECRET_KEY` | ❌ ausente | ❌ ausente |
| `CRON_SECRET` | Sensitive presente; comprimento não verificado | Sensitive presente; comprimento não verificado |
| `AGENT_EXECUTOR_ENABLED` | `true` | `true` |
| `AGENT_MODEL_PROVIDER` | `vercel-ai-gateway` | `vercel-ai-gateway` |
| `AGENT_MODEL_AUTH` | `oidc` | `oidc` |
| `AGENT_MODEL` | `anthropic/claude-haiku-5.5` | `anthropic/claude-haiku-5.5` |
| `AGENT_MONTHLY_BUDGET_USD` | US$ 5 (teto interno) | US$ 5 (teto interno) |
| Budget AI Gateway do projeto | ❌ nenhum | ❌ nenhum |
| Budget default AI Gateway | ❌ nenhum | ❌ nenhum |

O inventário foi consultado sem descriptografar variáveis. Nenhum valor de secret foi lido. A presença do registro Sensitive de `CRON_SECRET` não prova que seu valor atende ao mínimo de 32 caracteres. A configuração OIDC está selecionada, mas a emissão/aceitação do token não foi comprovada em runtime.

**Bloqueio:** o worker usa `SUPABASE_SECRET_KEY` para criar o cliente server-only. Sem ela, retorna `503 service_not_configured` antes de reivindicar execuções (se as barreiras anteriores forem satisfeitas). Manter `AGENT_EXECUTOR_ENABLED=false` até a homologação é a recomendação; nenhuma variável foi alterada nesta auditoria.

O próximo teste real deve usar apenas a chave do Supabase staging no target Preview, grants mínimos, budget externo restrito ao projeto e uma única execução controlada. Não copiar segredo de Production para Preview.


---

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
