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

## Usar a sua conta Google (BYOK)

O plano **Google AI Pro** (assinatura do app Gemini) **não inclui uso da API**: a cobrança da API é separada.
O plano dá créditos mensais do Google Cloud que podem ser usados na API do Gemini.

1. Em [Google AI Studio](https://aistudio.google.com) → **Get API key**, crie uma chave num projeto com
   faturamento ativo (é onde entram os créditos mensais do plano). No nível gratuito, sem faturamento, o Google
   pode usar os dados enviados para melhorar os produtos; não use esse nível com dados do SMKON.
2. Na Vercel: **AI Gateway → Bring Your Own Key → Google (Gemini API)** → cole a chave → **Test Key**.
3. Em **Environment Variables**, defina `AGENT_MODEL=google/gemini-3.8-flash` (Production e Preview) e faça
   um novo deploy.

Com BYOK a Vercel não cobra taxa e o uso aparece na conta Google. Se a chave falhar, o Gateway tenta de novo
com as credenciais dele (cobrança no saldo do AI Gateway da Vercel).

O painel **Admin → Prontidão para uso** mostra o modelo configurado e avisa se ele não tiver preço cadastrado.
