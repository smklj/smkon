# S4 — Camada de domínio · progresso

Frente: camada de domínio por módulo (`schema` / `service` / `repository`), validação de entrada centralizada e tipos do Supabase conferidos com o staging.
Branches `feature/s4-*` · **sem migrations** · sem dependências novas.

## Checklist

| # | Etapa | Estado | PR |
|---|---|---|---|
| 1 | Plano (este arquivo) + conferência dos tipos gerados do staging | ✅ feito | #54 |
| 2 | Validação centralizada `src/lib/validation/fields.ts` + testes | ✅ feito | #54 |
| 2a | Produtos | ✅ feito | #54 |
| 2b | Conteúdo (Studio) e publicação/calendário | ✅ feito | #55 |
| 2c | Mídia e licenças | ✅ feito | #63 |
| 2d | Financeiro (comissões) | ✅ código pronto na branch `feature/s4-finance-domain` (empilhada sobre a 2c; PR depois do merge do #63) | — |
| 2e | Tenancy (workspace, membros, convites) | ⏳ | — |
| 2f | Audiência / CRM | ⏳ | — |
| 2g | Agentes (por último; `docs/S14_HANDOFF.md` já existe na integração) | ⏳ | — |
| 3 | `docs/S4_HANDOFF.md` + linha do S4 no ROADMAP | ⏳ | — |

## 1. Padrão por módulo

Cada módulo em `src/lib/<modulo>/` passa a ter:

| Arquivo | Responsabilidade | Pode importar |
|---|---|---|
| `types.ts` | Tipos de linha, listas fechadas, rótulos (já existia) | nada de runtime externo |
| `schema.ts` | Tipos de entrada + `parseXxx(raw)` que lançam `ValidationError` | `validation/fields.ts`, `http/errors.ts`, `types.ts` — **imports relativos com `.ts`** para rodar em `node --test` |
| `repository.ts` | Acesso a dados: `select`/`insert`/`update`/`rpc` no Supabase, colunas, keyset; filtro `organization_id` em toda consulta (além da RLS) | `supabase`, `pagination`, `observability`, `schema` (só tipos) |
| `service.ts` | Regras de negócio: permissões por papel (`canXxx`) e casos de uso que combinam `schema` + `repository` | `schema`, `repository` |

Regras:

- Server Actions e rotas de API **não** chamam `parseXxx` + repository separadamente quando há caso de uso no service; chamam o service. Cada chamador mantém a sua própria mensagem de permissão (formulário x API), porque elas já são diferentes e fazem parte do comportamento.
- Arquivos antigos (`server.ts`, `validation.ts`) só permanecem como reexport quando um teste existente importa deles (os testes não são editados). Imports da aplicação vão direto para os arquivos novos.
- Nada muda de comportamento: mesmas mensagens, mesma ordem de checagem (validação barata → autenticação → permissão → dados), mesmos status HTTP.

## 2. Validação centralizada

`src/lib/validation/fields.ts` reúne as primitivas que estavam copiadas em produtos, mídia, audiência e conteúdo:

`readString` (só texto), `readScalar` (texto ou número do JSON), `readFlag`, `formDataToRaw`, `isPlainObject`, `oneOf` (com padrão opcional para vazio), `isOneOf`, `isUuid` (estrito RFC, o das rotas), `isUuidShape`/`parseUuid` (formato 8-4-4-4-12, o dos formulários), `requireLength`, `optionalText`, `parseDecimal`, `isHttpsUrl`, `DATE_ONLY`, `WORKSPACE_OFFSET`, `workspaceDate`.

Divergências encontradas e **preservadas** (variantes nomeadas em vez de unificar em silêncio, porque unificar mudaria comportamento):

- Produtos aceitava número no JSON como texto (`readScalar`); mídia e audiência não (`readString`).
- Rotas usam UUID estrito (versão 1–8, variante 10xx); parsers de produtos e audiência aceitam qualquer UUID no formato. Unificar exigiria decisão (o estrito é o mais seguro, mas recusaria IDs hoje aceitos pelo Postgres).

`isUuid` de `src/lib/content/server.ts` passou a reexportar a definição central (uma única regex).

## 3. Tipos do Supabase (staging × repositório)

`generate_typescript_types` do staging (`xoyasrizivadxnpmzzno`) em 19/11/2026, comparado tabela a tabela e função a função com `src/lib/supabase/database.types.ts`:

- **Tabelas em comum: colunas idênticas**, exceto `products.score_rank`, que só existe no repositório (migration `20261119120000` do S16, ainda não aplicada no staging).
- Só no repositório: `user_active_workspace` e as funções `change_member_role`, `list_workspace_members`, `remove_member`, `set_active_workspace`, `workspace_overview`, `archive_media_asset`, `export_contact_data`, `agent_model_spend_since` — migrations ainda não aplicadas no staging (S5.1, S12, S10, S15, S14).
- Só no staging: `rate_limit_buckets` e funções internas (`agent_fail_run`, `agent_finish_run`, `agent_record_step`, `agent_require_role`, `agent_settings_for`, `audience_*`, `media_active_license`, `product_evidence_score`, `product_recompute_score`, `publication_checks`). A aplicação web não as chama; `agent_record_step`, `agent_finish_run` e `agent_fail_run` são chamadas pelo worker (service_role) através da interface própria `AgentRpcClient` (`src/lib/agents/executor/rpc.ts`), sem passar pelo tipo `Database`. Avaliar tipá-las na etapa 2g (agentes), de forma aditiva.
- Assinaturas: o arquivo do repositório declara `| null` em parâmetros de `create_contact`/`update_contact` que o gerador marca como `string` (o gerador não infere nulabilidade de argumentos). A versão do repositório é a correta para o código.

**Decisão:** não substituir `database.types.ts` pelo gerado. O arquivo do repositório é um superconjunto correto do que o código usa, e trocar pelo gerado quebraria o typecheck até o staging receber as migrations pendentes. Regerar quando o staging estiver em dia com `supabase/migrations` (depende de autorização do Owner para aplicar as migrations pendentes).

## 4. Ordem dos módulos

Produtos (menor e com testes de validação) → conteúdo/publicação → mídia/licenças (usa `isHttpsUrl` de produtos) → financeiro → tenancy → audiência (maior parser) → agentes (por último, mais acoplado ao executor).

## Registro das etapas

### Etapas 1, 2 e 2a (19/11/2026)

- `src/lib/validation/fields.ts` (novo) e `tests/unit/validation-fields.test.ts` (10 testes novos).
- Produtos: `validation.ts` → `schema.ts` (reexport mantido para o teste existente); `server.ts` → `repository.ts` (dados) + `service.ts` (`canEditProducts`, `canAddEvidence`, `registerProduct`, `submitEvidence`, `decideEvidence`); `server.ts` removido, imports atualizados em `produtos/actions.ts`, `produtos/page.tsx`, `produtos/[id]/page.tsx` e `api/products/route.ts`.
- Validação local: `npm run typecheck` ✅, `npm run lint` ✅, `npm run test:unit` **226/226** (216 existentes sem edição + 10 novos), `npm run build` ✅, `npm run test:db` **19/19 arquivos** (Postgres 16 local).

### Etapa 2b — conteúdo e publicação (19/11/2026)

- `src/lib/content/`: `schema.ts` (`parseContentPayload`, `readContentJson`, `parseContentId`, `parseApproveInput`, `parseContentStatusFilter`, `CONTENT_HASH_PATTERN`, `CONTENT_STATUSES`), `repository.ts` (`CONTENT_SELECT_COLUMNS`, `CONTENT_KEYSET`, `listContentPage`, `countByStatus`, `insertContent`, `updateContent`, `deleteContent`, `approveContentVersion`) e `service.ts` (`canEditContent`, `listLibrary`, `approveExactVersion`). `server.ts` virou só reexport (o teste `content-server.test.ts` e o `validation-fields.test.ts` importam dele). O repository usa imports relativos com `.ts` e o cliente só como tipo, para ser carregável em `node --test`.
- `src/app/api/content/route.ts` e `src/app/api/content/approve/route.ts` passam a usar schema/repository/service; mesma ordem (auth → validação → workspace → permissão → dados), mesmas mensagens e status HTTP. A validação do approve agora lança `ValidationError`, que `toErrorResponse` converte no mesmo 400 `invalid_input` com a mesma mensagem (sem log, como antes).
- `src/lib/publication/`: `server.ts` → `repository.ts` (renomeado, sem mudança de consulta), `schema.ts` (`parseScheduleRequest`, `parseJobId`, `parseCancelRequest`, mesmas mensagens e mesma ordem; campos não aparados como antes, só o motivo) e `service.ts` (`canOperateCalendar`, `scheduleDryRun`, `runJobDryRun`, `cancelJob`). Imports atualizados em `calendario/actions.ts`, `calendario/page.tsx` e `components/publication/ScheduleForm.tsx` (só tipo).
- Divergência preservada: o Studio aceita link HTTPS vazio, host sem ponto e credenciais na URL (corta em 2048), mais permissivo que `isHttpsUrl` de produtos. Virou a variante nomeada `isOptionalHttpsUrl` em `validation/fields.ts`.
- Os demais usos de `isUuid` via `@/lib/content/server` (convites, audiência, agentes, admin, mídia) continuam funcionando pelo reexport e serão trocados para `@/lib/validation/fields` na etapa de cada módulo.
- Validação local: `npm run typecheck` ✅, `npm run lint` ✅, `npm run test:unit` **238/238** (226 existentes sem edição + 12 novos em `content-schema.test.ts` e `publication-schema.test.ts`), `npm run build` ✅, `npm run test:db` **19/19 arquivos** (Postgres 16 local).

### Etapa 2c — mídia e licenças (21/11/2026)

- `src/lib/media/`: `validation.ts` → `schema.ts` (`parseLicenseInput` sobre `readString`/`readFlag`/`oneOf`/`DATE_ONLY`/`isHttpsUrl` centrais, mais `parseMediaId` e `parseRevokeInput`, com as mesmas mensagens e a mesma ordem das Server Actions); `validation.ts` ficou só como reexport (o teste `media.test.ts` importa dele). `server.ts` → `repository.ts` (renomeado, sem mudança de consulta; `SupabaseClient` exportado) e `service.ts` (`canManageMedia`, que reexporta `canEditContent` do tenancy, e `registerLicense`).
- `midia/actions.ts`: valida antes da autenticação via schema (erro de entrada vira a mesma mensagem; qualquer outro erro propaga, como o `redirect`), usa o service para registrar licença e importa `formDataToRaw` central. `midia/page.tsx` e `api/media/route.ts` só trocaram o import para `repository`. O uso de `isUuid` via `@/lib/content/server` saiu do módulo de mídia.
- Divergência preservada: a mídia continua aceitando só texto (`readString`), não número do JSON (`readScalar`) como produtos.
- Validação local: `npm run typecheck` ✅, `npm run lint` ✅, `npm run test:unit` **256/256** (250 existentes sem edição + 6 novos em `media-schema.test.ts`), `npm run build` ✅, `npm run test:db` **23/23 arquivos** (Postgres 16 local).
- Observação: numa das execuções o teste do S14 "prazo total: chamada lenta perto do fim do prazo falha com worker_timeout" falhou uma vez e passou nas duas repetições seguintes (sensível a tempo sob carga; o PR #61 do S14 trata a classificação de timeout). Não é do escopo do S4.

### Etapa 2d — financeiro / comissões (21/11/2026)

- `src/lib/finance/`: `commissions.ts` (regras puras do ciclo de vida, já existia, inalterado), `types.ts` (`CommissionSummary`, `CommissionHistoryRow`, antes locais em `financeiro/page.tsx`), `schema.ts` (`isCommissionStatus` sobre `isOneOf` central), `repository.ts` (`listCommissionSummaries`, `listRecentCommissionChanges`, colunas e limite de 10 como constantes; filtro `organization_id` em ambas) e `service.ts` (`loadCommissionOverview`, as duas consultas em paralelo; se ambas falharem propaga o erro do resumo, como a página fazia).
- O módulo é somente leitura: transições e ledger continuam no banco (`commission_lifecycle`). Vendas próprias e mídia paga seguem fora deste módulo (domínios separados).
- `financeiro/page.tsx` passa a usar o service; mesma ordem (auth → workspace → dados), mesmos estados de tela e log `page.financeiro`.
- Diferença mínima e documentada: a guarda de estado usava `value in COMMISSION_LABEL` (aceitaria nomes do protótipo, como `toString`); agora é a lista fechada. Para os valores possíveis no banco (check constraint com os seis estados) o resultado é idêntico.
- Validação local: `npm run typecheck` ✅, `npm run lint` ✅, `npm run test:unit` **260/260** (256 anteriores sem edição + 4 novos em `finance-domain.test.ts`, com cliente falso conferindo filtro por workspace, ordem e limite), `npm run build` ✅, `npm run test:db` **23/23 arquivos**.
- **Bloqueio do merge da 2c (#63):** typecheck/lint/build e SQL verdes no CI, mas o Preview da Vercel foi recusado com "Deployment rate limited — retry in 24 hours", então o "Playwright · Staging" (disparado por `deployment_status`) não rodou. O PR fica aberto até o E2E rodar; a próxima execução retoma.
