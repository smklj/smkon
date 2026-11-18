# S10a — Calendário editorial e fila de publicação em dry-run

**Branch:** `feature/s10` → PR para `feature/smkon-production-readiness`

## O que mudou

| Área | Mudança |
|---|---|
| Banco | `publication_jobs` (fixa versão e hash aprovados; `mode` só aceita `dry_run`; sem delete; auditado) e `publication_job_events` (append-only). Funções `schedule_publication`, `run_publication_dry_run` e `cancel_publication` (owner/admin; viewer só lê) |
| Verifier (dry-run) | Bloqueia: versão aprovada mudou, vídeo de referência sem direitos, canal fora da peça, título > 100 (YouTube), texto > 5000 (YouTube) ou > 2200 (Instagram/TikTok), > 30 hashtags (Instagram), horário passado. Avisa: legenda vazia, mídia ainda não anexada |
| App | `/calendario`: fila por dia (horário de Brasília), checagens de cada job, rodar dry-run, cancelar com motivo, agendar conteúdo aprovado. Link no Content Studio |
| Testes | SQL `009_publication_queue` (32 checagens); unit `publication.test.ts`; E2E `calendar.spec.mjs` |

## Decisões
- **Nenhuma publicação real.** A coluna `mode` só aceita `dry_run`. A publicação de verdade (adaptador Metricool ou APIs nativas, ver `INTEGRACOES_E_AUTOMACAO.md`) vai exigir migration nova, revisão e autorização.
- **Hash fixado no agendamento:** se a peça for editada depois, o dry-run reprova. Para publicar a nova versão, é preciso aprová-la e agendar de novo.
- **Limites de texto conservadores** (YouTube 100/5000, Instagram 2200 e 30 hashtags, TikTok 2200). Ficam no banco e podem ser revistos quando os adaptadores reais forem conectados.
- **Mídia como aviso:** o campo `asset_url` do Studio é o link do produto, não o arquivo. O anexo de mídia chega no S10b.

## Ambientes
- Migration `20261118230000_publication_queue.sql` aplicada no **staging** (Previews e E2E).
- 🔐 Produção: aplicar só com autorização, junto da publicação na main.

## Pendências (S10b)
- Mídia no Supabase Storage (bucket privado por workspace, URLs assinadas).
- Registro de licenças e direitos ligado à mídia e ao conteúdo, substituindo o checkbox `rights_confirmed`.
