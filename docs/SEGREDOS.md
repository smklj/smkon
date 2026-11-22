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
