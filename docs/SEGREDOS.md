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
