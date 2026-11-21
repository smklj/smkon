# S4 — Camada de domínio · handoff

**Branches:** `feature/s4-*` · **PRs:** #54 (plano, validação central, produtos), #55 (conteúdo e publicação), #63 (mídia e licenças), #65 (financeiro), #68 (tenancy e convites), #72 (audiência), #75 (agentes + este handoff) — todos com base `feature/smkon-production-readiness`.
**Plano e registro detalhado:** `docs/S4_PROGRESS.md` · **Sem migrations** · **sem dependências novas**.

## O que mudou

### Padrão por módulo
Cada módulo em `src/lib/<modulo>/` passou a ter:

- `schema.ts` — tipos de entrada e `parseXxx(raw)` que lançam `ValidationError` (`src/lib/http/errors.ts`), com as mesmas mensagens de antes; imports relativos com `.ts`, para rodar em `node --test`.
- `repository.ts` — acesso a dados (`select`/`insert`/`update`/`rpc`), colunas e keyset; filtro por `organization_id` em toda leitura, além da RLS. Sem regra de negócio e sem log.
- `service.ts` — permissões por papel (`canXxx`) e casos de uso que combinam schema + repository.

Server Actions e rotas chamam o service; cada uma mantém a sua mensagem de permissão e a mesma ordem de checagem (validação barata → autenticação → permissão → dados), mesmos status HTTP e mesmos logs.

### Validação centralizada — `src/lib/validation/fields.ts`
`readString`, `readScalar`, `readFlag`, `formDataToRaw`, `isPlainObject`, `oneOf`, `isOneOf`, `isUuid` (estrito), `isUuidShape`/`parseUuid` (formato), `requireLength`, `optionalText`, `parseDecimal`, `isHttpsUrl`, `isOptionalHttpsUrl`, `DATE_ONLY`, `WORKSPACE_OFFSET`, `workspaceDate`. Substituem cópias que existiam em produtos, conteúdo, mídia, audiência e agentes.

Divergências encontradas e **preservadas** como variantes nomeadas (unificar mudaria comportamento): produtos aceita número no JSON (`readScalar`), os demais só texto; rotas usam UUID estrito, formulários de produtos e audiência aceitam qualquer UUID no formato; o Studio aceita link HTTPS mais permissivo (`isOptionalHttpsUrl`).

### Módulos

| Módulo | Arquivos | PR |
|---|---|---|
| Produtos | `products/{schema,repository,service}.ts`; `validation.ts` reexport; `server.ts` removido | #54 |
| Conteúdo / publicação | `content/{schema,repository,service}.ts` (`server.ts` reexport); `publication/{schema,repository,service}.ts` | #55 |
| Mídia e licenças | `media/{schema,repository,service}.ts`; `validation.ts` reexport | #63 |
| Financeiro (comissões, só leitura) | `finance/{types,schema,repository,service}.ts`; `commissions.ts` inalterado | #65 |
| Tenancy e convites | `tenancy/{schema,repository,service}.ts`, `workspace.ts` fachada de reexport; `invitations/{schema,repository,service}.ts`; `admin.ts` removido | #68 |
| Audiência / CRM | `audience/{schema,repository,service}.ts`; `validation.ts` reexport | #72 |
| Agentes | `agents/{schema,repository,service}.ts`; `types.ts` reexporta os parsers | #75 |

Arquivos antigos só ficaram como reexport quando um teste existente importa deles (testes não foram editados).

### Tipos do Supabase
`generate_typescript_types` do staging comparado tabela a tabela com `src/lib/supabase/database.types.ts` (19/11): colunas idênticas nas tabelas em comum; o repositório tem a mais o que vem de migrations ainda não aplicadas no staging, e o staging tem funções internas que a aplicação web não chama. **Decisão:** não substituir o arquivo pelo gerado — ele é um superconjunto correto do que o código usa, e trocar quebraria o typecheck até o staging receber as migrations pendentes.

## Regras de negócio
- Nenhuma mudança de comportamento. Nenhum agente publica: a camada de agentes só enfileira, cancela e configura.
- Financeiro continua só leitura na aplicação (transições no banco); vendas próprias, afiliados e mídia seguem em domínios separados.
- Aprovação da versão exata continua no banco (`approve_content`), chamada pelo service de conteúdo.

## Testes (resultados reais, local, após o merge da integração em 21/11)
- `npm run typecheck` ✅ · `npm run lint` ✅ · `npm run build` ✅
- `npm run test:unit` **294/294** — inclui **66 testes novos do S4** (`validation-fields`, `content-schema`, `publication-schema`, `media-schema`, `finance-domain`, `tenancy-domain`, `invitations-domain`, `audience-domain`, `agents-domain`); os testes que já existiam passaram sem edição de asserções.
- `npm run test:db` **23/23 arquivos** (Postgres 16 local).
- CI dos PRs #54–#72 verde antes de cada merge; os runs do "Playwright · Staging" de #63, #65, #68 e #72 estão registrados no progresso.

## Problemas encontrados
- O teste do S14 "prazo total: chamada lenta perto do fim do prazo falha com worker_timeout" falhou de forma intermitente em execuções locais (sensível a tempo sob carga). Fora do escopo do S4; tratado pela frente S14.
- O "Playwright · Staging" depende do Preview da Vercel; em alguns dias o plano gratuito recusou deploys (`api-deployments-free-per-day`), atrasando merges.

## Pendências
- `src/lib/tenancy/workspace.ts` segue como fachada de reexport só para a integração Mercado Livre (escopo S11). Quando o S11 trocar o import para `@/lib/tenancy/service`, a fachada pode ser removida.
- Executor e worker de agentes (`agents/executor/*`, `agents/worker/*`) não foram reorganizados: são escopo do S14 e já têm interface própria (`AgentRpcClient`).
- Unificar as variantes de validação (UUID estrito em todo lugar, só texto no JSON) exige decisão do Owner, porque passaria a recusar entradas hoje aceitas.
- Regerar `database.types.ts` a partir do staging quando ele estiver em dia com `supabase/migrations` (depende de autorização para aplicar as migrations pendentes).
- Atualização do toolchain de lint, citada no escopo original do ROADMAP, não fez parte deste checklist.

## Próxima etapa recomendada
Usar o padrão schema/repository/service para módulos novos (ex.: S17, conciliação do S11) e, após decisão do Owner, unificar a validação de UUID para a forma estrita.
