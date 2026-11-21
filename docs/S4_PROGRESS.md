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
| 2d | Financeiro (comissões) | ✅ feito | #65 |
| 2e | Tenancy (workspace, membros, convites) | ✅ feito | #68 |
| 2f | Audiência / CRM | ✅ feito | #72 |
| 2g | Agentes (por último; `docs/S14_HANDOFF.md` já existe na integração) | ✅ feito | #75 |
| 3 | `docs/S4_HANDOFF.md` + linha do S4 no ROADMAP | ✅ feito | #75 |

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
- PR #63 (2c) mergeado em 21/11 com CI verde: typecheck/lint/build, SQL e "Playwright · Staging" (run 44896997728, no commit 8646f80 com todo o código; o commit seguinte só trocou o número do PR neste arquivo e teve o Preview recusado pela Vercel por limite diário do plano gratuito, "api-deployments-free-per-day").

### Etapa 2e — tenancy: workspace, membros e convites (21/11/2026)

- `src/lib/tenancy/`: `members.ts` (regras puras e tipos, já existia, inalterado), `schema.ts` (`parseWorkspaceId`, `parseMemberId`, `parseMemberRoleChange` sobre `isUuid` central; mesmas mensagens e ordem membro → papel das Server Actions), `repository.ts` (memberships, preferência em `user_active_workspace`, RPCs `ensure_workspace`, `list_workspace_members`, `change_member_role`, `remove_member`, `set_active_workspace`; sem log e sem regra) e `service.ts` (`canEditContent`, `canManageInvitations`, `listWorkspaces`, `loadWorkspaceContext`, `findWorkspace`, `ensureWorkspace`, `setActiveWorkspace`, `listMembers` com a classificação `unavailable`/`forbidden`, `changeMemberRole`, `removeMember`). `admin.ts` removido (nenhum teste importava).
- `workspace.ts` ficou como **fachada de reexport** do service, documentada no próprio arquivo, só para chamadores de módulos que ainda não passaram pelo S4 (audiência, agentes) ou que são de outra frente (rotas do Mercado Livre, S11). Os chamadores de produtos, conteúdo, mídia, publicação, financeiro, admin, convite, shell, login e visão geral passaram a importar `@/lib/tenancy/service`. Os de audiência e agentes trocam nas etapas 2f e 2g; os do Mercado Livre ficam com a fachada para não mexer em arquivos do S11.
- `src/lib/invitations/`: `token.ts` (inalterado; o teste existente importa dele), `schema.ts` (`parseInvitationRequest` com `InvitationInputError`, subclasse de `ValidationError` que carrega os códigos `invalid_email`/`invalid_role` da API; `parseInvitationId`; `parseAcceptToken`), `repository.ts` (`listInvitations` sem `token_hash`, limite 100; RPCs `create_invitation`, `revoke_invitation`, `accept_invitation`) e `service.ts` (`createInvitation` gera o token e só envia o hash; devolve o token apenas quando o convite é novo; `revokeInvitation`; `acceptInvitation`).
- `api/invitations/route.ts`: mesma ordem (auth → papel → corpo JSON → e-mail → papel do convite → rate limit → criação), mesmos códigos e status (400 `invalid_input`/`invalid_email`/`invalid_role`, 401, 403, 429, 200/201). No DELETE, o id inválido agora sai como `ValidationError` e `toErrorResponse` devolve o mesmo 400 `invalid_input` "Identificador inválido." (sem log, como antes).
- `convite/actions.ts`, `(app)/actions.ts` e `admin/actions.ts` usam schema/service; validação continua antes da autenticação, com as mesmas mensagens.
- Validação local: `npm run typecheck` ✅, `npm run lint` ✅, `npm run test:unit` **275/275** (260 anteriores sem edição + 15 novos em `tenancy-domain.test.ts` e `invitations-domain.test.ts`, com cliente falso conferindo filtros por usuário/workspace, RPCs, hash do token e classificação de erros), `npm run build` ✅, `npm run test:db` **23/23 arquivos** (Postgres 16 local).
- Observação: o teste do S14 "prazo total: chamada lenta perto do fim do prazo falha com worker_timeout" voltou a falhar de forma intermitente (1 de 3 execuções; sensível a tempo sob carga). É tratado pelo PR #64 do S14, fora do escopo do S4.
- PR #65 (2d) mergeado em 21/11 com CI verde (typecheck/lint/build, SQL e "Playwright · Staging" run 44901601605 no head `fc240e7`).
- PR #68 (2e) mergeado em 21/11 com CI verde (typecheck/lint/build, SQL e "Playwright · Staging" run 44921974724 no head `feb19cc`).

### Etapa 2f — audiência / CRM (21/11/2026)

- `src/lib/audience/`: `validation.ts` → `schema.ts` sobre as primitivas centrais (`readString`, `oneOf`, `parseUuid`, `DATE_ONLY`, `WORKSPACE_OFFSET`, `workspaceDate`); o `oneOf` e o `parseUuid` locais, a regex de UUID e o cálculo de "hoje" duplicados saíram. Novo `missingDeletionConfirmation(raw)` (a guarda que estava inline na Server Action de resolver pedido). `validation.ts` ficou só como reexport (os testes `audience.test.ts` e `audience-contacts-page.test.ts` importam dele). E-mail e telefone (E.164) continuam no schema do módulo: só a audiência usa.
- `server.ts` → `repository.ts` (renomeado, sem mudança de consulta; imports relativos com `.ts` e cliente só como tipo, carregável em `node --test`; `SupabaseClient` exportado) e `service.ts` (`canManageAudience`, `registerContact`, `correctContact`, `recordConsentEvent`, `revokeAll`, `registerSubjectRequest`, `resolveSubjectRequest`, `eraseContact`).
- `audiencia/actions.ts`: cada ação chama o caso de uso do service dentro do mesmo `try` (validação e erro do banco continuam com o mesmo `log("warn", …)` e a mesma mensagem via `dbErrorMessage`); mesma ordem (auth → permissão → validação → RPC), mesmas mensagens e redirecionamentos; `formDataToRaw` central. `audiencia/page.tsx` e a rota de exportação importam `repository`/`service` e `isUuid` de `@/lib/validation/fields` (saiu o uso via `@/lib/content/server`).
- `findWorkspace` continua vindo de `@/lib/tenancy/workspace`, que existe tanto na integração quanto, como fachada, no PR #68 (2e). Assim a 2f não depende do merge da 2e; depois dele, o import pode ir para `@/lib/tenancy/service`.
- Divergências preservadas: só texto (`readString`), UUID de formulário pelo formato.
- Validação local: `npm run typecheck` ✅, `npm run lint` ✅, `npm run test:unit` **270/270** (260 existentes sem edição + 10 novos em `audience-domain.test.ts`: reexport, UUID, data no fuso do workspace, guarda da exclusão, papéis, filtro por workspace nas leituras com cliente falso, recusa antes de RPC, argumentos da RPC e propagação do erro do banco), `npm run build` ✅, `npm run test:db` **23/23 arquivos** (Postgres 16 local).
- PR #68 (2e) segue aberto com typecheck/lint/build e SQL verdes; o "Playwright · Staging" não rodou porque a Vercel recusou o Preview por limite diário do plano gratuito (`api-deployments-free-per-day`). Integração mesclada na branch da 2e (78b5c0b) para nova tentativa quando a cota voltar. — superado: mergeado depois, ver registro da 2e acima.

- Após o merge da 2e (#68) na integração: integração mesclada na branch da 2f; `audiencia/actions.ts`, `audiencia/page.tsx` e `api/audience/contacts/[id]/export/route.ts` passam a importar `findWorkspace`/`Workspace` de `@/lib/tenancy/service` (a fachada `workspace.ts` é reexport puro, sem mudança de comportamento; fica só para agentes e para a integração Mercado Livre). Validação local: `npm run typecheck` ✅, `npm run lint` ✅, `npm run test:unit` **285/285** (275 da integração sem edição + 10 da 2f), `npm run build` ✅, `npm run test:db` **23/23 arquivos**.
- PR #72 (2f) mergeado em 21/11 com CI verde (typecheck/lint/build, SQL e "Playwright · Staging" run 44927450872 no head `2b34283`).

### Etapa 2g — agentes (21/11/2026)

- `src/lib/agents/`: `schema.ts` (novo: `parseRunInput` e `parseLimits` movidos de `types.ts`, agora lançando `ValidationError`, subclasse de `Error`, com as mesmas mensagens; `parseRunForm`, `stepLimitFromForm`, `parseLimitsForm`, `parseCancelForm`, `parseKillSwitchForm`, `parseToolForm` com a mesma lógica que estava inline nas Server Actions; UUID estrito via `validation/fields`). `types.ts` reexporta `parseRunInput`/`parseLimits` porque `tests/unit/agents.test.ts` importa de lá.
- `server.ts` → `repository.ts` (renomeado, sem mudança de consulta nem de RPC; imports relativos com `.ts`, cliente só como tipo, `SupabaseClient` exportado). `service.ts` (novo): `canOperateRuns`/`canManageTools` (owner, admin), `canControlAgents` (owner), `queueRun`, `cancelAgentRun`, `switchAgents`, `setToolGrant`, `saveLimits`, e reexport de `loadAgents`/`loadRunDetail`.
- `agentes/actions.ts`, `agentes/page.tsx` e `agentes/[id]/page.tsx` usam schema/service; mesma ordem por ação (iniciar: auth → permissão → validação; cancelar, kill switch, ferramenta e limites: validação → auth → permissão), mesmas mensagens e mesmos logs (`agents.start`, `agents.cancel`, `agents.kill_switch`, `agents.tool`, `agents.limits`). As páginas usam as mesmas regras de papel do service (tabela-verdade idêntica à comparação inline anterior). `findWorkspace` vem de `@/lib/tenancy/service`.
- Executor e worker (`executor/*`, `worker/*`) **não** foram tocados: são o escopo ativo do S14 (PR #71) e já têm a sua interface de dados (`AgentRpcClient`). Decisão sobre os tipos: as funções `agent_record_step`/`agent_finish_run`/`agent_fail_run` continuam fora de `database.types.ts`, porque só o worker (service_role) as chama por essa interface própria e o arquivo compartilhado só deve ser regerado quando o staging estiver em dia com as migrations.
- Nenhum agente publica: a camada só enfileira, cancela e configura; `draft_content` continua só propondo rascunho para aprovação humana da versão exata.
- Validação local: `npm run typecheck` ✅, `npm run lint` ✅, `npm run test:unit` **284/284** (275 da integração sem edição + 9 novos em `agents-domain.test.ts`: reexport, `ValidationError`, teto de passos, cancelamento, kill switch, allowlist/limites, tabela de papéis, argumentos das RPCs com cliente falso, propagação de erro), `npm run build` ✅, `npm run test:db` **23/23 arquivos** (Postgres 16 local).
- Após o merge da 2f (#72): integração mesclada na branch da 2g (conflito só neste arquivo) e comentário da fachada `tenancy/workspace.ts` atualizado (só a integração Mercado Livre ainda a usa). Validação local: typecheck ✅, lint ✅, `test:unit` **294/294** (285 da integração sem edição + 9 da 2g), build ✅, `test:db` **23/23 arquivos**.
- 21/11 (17h UTC): integração mesclada de novo na branch da 2g (só `docs/INTEGRATION_STATUS.md` mudou). Validação local: typecheck ✅, lint ✅, `test:unit` **294/294**, build ✅, `test:db` **23/23 arquivos**.

### Etapa 3 — handoff (21/11/2026)

- `docs/S4_HANDOFF.md` escrito e linha do S4 atualizada em `docs/ROADMAP_SPLITS.md`, no mesmo PR #75 da 2g.
