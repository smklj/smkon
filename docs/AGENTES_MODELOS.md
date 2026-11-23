# Agentes de IA: modelos e cobrança

Os agentes chamam o modelo pelo **Vercel AI Gateway** (`/v1/chat/completions`). Trocar de modelo é só mudar
`AGENT_MODEL` na Vercel; o código não depende do provedor.

## Modelos suportados

| `AGENT_MODEL` | Uso indicado | Preço usado no teto (USD por milhão, entrada / saída) |
|---|---|---|
| `google/gemini-3.8-flash` | padrão recomendado: rápido, bom em português, custo baixo | 1,50 / 7,50 (tabela; o catálogo mostra 0,75 / 3,75 em promoção) |
| `google/gemini-4-argon` | análises mais difíceis | 4 / 20 (tabela; promoção a 2 / 10) |
| `anthropic/claude-haiku-5.5` | alternativa barata | 0,10 / 0,50 até 100 mil tokens de entrada; 0,50 / 2,50 acima |
| `openai/gpt-5-mini` | alternativa | 0,25 / 2 |
| `anthropic/claude-opus-5.5` | uso pontual | 4 / 20 |

O teto (`AGENT_MONTHLY_BUDGET_USD`) soma o custo estimado de cada chamada com 10% de margem. Modelo fora desta
lista é recusado pelo worker, porque o teto não teria como ser aplicado. Gemini vai com raciocínio baixo
(`reasoning.effort = low`) e 1.024 tokens de folga de saída, para o raciocínio não truncar a resposta.

## Usar a sua conta Google (recomendado)

O plano **Google AI Pro** (assinatura do app Gemini) **não inclui uso da API**, mas dá créditos mensais do
Google Cloud que valem para a API do Gemini. O SMKON chama o Gemini **direto no Google** (endpoint compatível
com OpenAI do Google AI Studio) quando existe `GEMINI_API_KEY`, sem passar pelo AI Gateway.

1. [Google AI Studio](https://aistudio.google.com) → **Get API key** → crie a chave num projeto com
   faturamento ativo e resgate os créditos do plano. No nível gratuito, sem faturamento, o Google usa os dados
   enviados para melhorar os produtos; não use esse nível com dados do SMKON.
2. Vercel → projeto smkon → **Environment Variables** → `GEMINI_API_KEY` (tipo Secret/Sensitive, Production).
3. Novo deploy.

O BYOK do AI Gateway também funciona, mas exige créditos comprados no AI Gateway com saldo positivo.

## Onde a IA aparece

| Módulo | Recurso | Quem usa |
|---|---|---|
| Content Studio | **Escrever com IA**: roteiro, legenda, CTA e hashtags a partir do produto e das evidências verificadas | owner, admin |
| Jurídico/compliance | **Revisar conformidade**: regras automáticas + revisão do modelo (promessa de renda, saúde, #publi, alegação sem evidência, direito autoral) | owner, admin, analyst |
| Agentes | Planner → Executor → Verifier, sem publicar nada | worker (exige `SUPABASE_SECRET_KEY`) |

Barreiras de cada chamada nos módulos: papel, 60 chamadas por hora por usuário (`rate_limit_consume('ai_assist')`)
e teto mensal por workspace (`AI_MONTHLY_BUDGET_USD`, ou `AGENT_MONTHLY_BUDGET_USD`) somando assistente e agentes.
Cada chamada fica em `ai_assist_usage` (só inclusão). Nada é salvo, aprovado ou publicado pela IA.

O painel **Admin → Prontidão para uso** mostra o modelo configurado e avisa se ele não tiver preço cadastrado.
