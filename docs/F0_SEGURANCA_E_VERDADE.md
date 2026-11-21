# Fase 0 — Segurança e verdade · handoff

**Origem:** Auditoria v2 (21/11/2026, documento `AUDITORIA_V2_BASE_PROFISSIONAL.md` no Projeto) sobre a `main` em `d77e7c6`.
**Branch:** `fix/f0-security-truth` · **Base:** `main`

## O que mudou

| Achado | Correção |
|---|---|
| **A1** — `POST /api/actions/external/execute` executava pedido de qualquer workspace com a chave de serviço | O executor recebe o workspace de quem chamou e recusa (404) pedido de outro workspace **antes** de reivindicar. IDs validados como UUID. A conta social e a mídia também são filtradas pelo workspace. |
| **A2** — Kiwify com segredo padrão `smkon_kiwify_dev_secret`, reaproveitando o da Hotmart e aceitando token em query/corpo | Sem valor padrão nem reaproveitamento. Receptor **desligado por padrão** (`KIWIFY_WEBHOOK_ENABLED`), responde 503 sem segredo próprio (≥16 caracteres) e aceita token só em cabeçalho. Logs sem valores financeiros e erros sem mensagem interna. |
| **A3** — token do Metricool lido como texto puro e com fallback para `METRICOOL_USER_TOKEN` global | Envelope AES-256-GCM em `src/lib/integrations/shared/token-envelope.ts`, com AAD amarrado a workspace, provedor e blog (`metricool/credentials.ts`). Sem token global. |
| **A4** — links "rastreados" Shopee/Shein em formatos inventados | Módulos `shopee/` e `shein/` removidos. O gerador usa apenas o link informado pelo usuário, sem URLs de exemplo nem cupons inventados. |
| **A5** — Kiwify não persiste | Mantido desligado e documentado como não homologado até gravar em `external_events`/ledger e confirmar a assinatura oficial. |
| **M2** — promessas de renda e afirmações não verificáveis nos templates | Removidas ("R$ 5.000/Mês", "faturar sem investir", "#rendaextra", "frete grátis", "cupom secreto", "garantia total", avaliação inventada). Viraram campos `[…]` para o criador preencher com o que verificou. Teste impede regressão. |
| **M3** — executor lia `mediaUrls`, mas o payload aprovado tem `mediaIds` | Mídias resolvidas por `mediaIds` no próprio workspace, sem arquivadas, com URL assinada de 1 h. |
| **M4** — Hotmart aceitava segredo global e escolha de workspace por `organization_id` na URL | Autenticação só pelo hash do Hottok por conexão. Parâmetros da URL, se enviados, precisam bater com a conexão. |
| **M5** — erros internos devolvidos ao cliente | Executor e Kiwify respondem códigos e mensagens genéricas; detalhes só no log. |

O executor saiu de `service.ts` (que tem `server-only`) para `metricool/executor.ts`, com o cliente injetado, para poder ser testado.

## Testes (resultados reais)
- `typecheck`, `lint`, `build`: sem erros.
- Unitários: **397/397**. Novos em `tests/unit/integrations-security.test.ts` (envelope, isolamento por workspace e conta, IDOR antes do claim, mídia de outro workspace, IDs inválidos sem tocar o banco) e regressão contra promessas de renda em `autonomous-generator.test.ts`.
- SQL: 28 arquivos passando (sem migration nova).
- E2E: depende do Preview da Vercel (cota diária).

## Configuração necessária
- `INTEGRATION_TOKEN_ENCRYPTION_KEY` (32 bytes em base64) e `INTEGRATION_TOKEN_ENCRYPTION_KEY_ID` para o Metricool.
- `HOTMART_WEBHOOK_SECRET` e `METRICOOL_USER_TOKEN` deixam de ser usados.

## Fora deste PR (próximas fases)
- Proteção da `main`, deploy por commit vazio agendado, pipeline de migrations e alinhamento da produção (Fase 1, exige autorização).
- Unificar o envelope do Mercado Livre com o módulo compartilhado (o formato do AAD já é compatível).
- Geração de conteúdo por IA real com evidência (Fase 3). Os templates continuam sendo templates.
