# S10 — Calendário, fila de publicação em dry-run, mídia e licenças

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

## S10b — Mídia no Storage e licenças

| Área | Mudança |
|---|---|
| Storage | Bucket privado `content-media` (50 MB; MP4, MOV, JPG, PNG, WebP). Caminho `<workspace>/<uuid>.<ext>`. Upload só por owner/admin no diretório do próprio workspace; leitura só por membros; sem update/delete pela API |
| Banco | `media_assets` (tipo, tamanho e autor lidos do Storage por `register_media_asset`, não do cliente; sem delete; arquivar com autoria) e `media_licenses` (append-only; comprovação https obrigatória exceto produção própria; período coerente; revogação única com motivo) |
| Conteúdo | `content_items.media_asset_id`: entra no hash e no snapshot da versão. Trocar a mídia cria versão nova e exige nova aprovação. Mídia de outro workspace ou arquivada é recusada |
| Fila | `media` e `license` passam a **bloquear**: o dry-run só passa com mídia anexada e licença para uso comercial válida na data agendada (horário de Brasília) |
| App | `/midia` (Jurídico): envio direto do navegador ao Storage, biblioteca com link assinado de 10 min, registro e revogação de licenças, arquivar. Seletor "Mídia da peça" no Content Studio. CSP libera imagens e vídeos do Storage do projeto |
| Testes | SQL `010_media_licenses`; unit `media.test.ts`; E2E `media.spec.mjs` e calendário com mídia licenciada |

### Decisões
- Upload direto ao Storage (sem passar pelo servidor do app): evita o limite de corpo das Server Actions e não expõe chave privilegiada. O banco confere o arquivo antes de registrar.
- O checkbox `rights_confirmed` continua valendo para **vídeo de referência de terceiros** (URL). Licenças cobrem a **mídia publicada**.
- Arquivos não são apagados: a trilha de direitos depende deles. Limpeza de arquivos órfãos fica para um job futuro.

### Ambientes
- Migrations `20261118230000_publication_queue` e `20261119000000_media_and_licenses` aplicadas no **staging** (funções conferidas por md5 contra o arquivo).
