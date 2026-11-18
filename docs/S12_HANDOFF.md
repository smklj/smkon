# S12 — Visão geral com dados reais

**Branch:** `feature/s12-dashboard-real-data` → PR para `feature/smkon-production-readiness`

## O que mudou

| Área | Mudança |
|---|---|
| Banco | `public.workspace_overview(p_organization_id)` (migration `20261119010000_workspace_overview.sql`): uma leitura com conteúdo por estado, fila de aprovação, produtos por estado e evidências pendentes, fila de publicação (7 dias, estados do dry-run, próximas 5), financeiro por domínio e conexões. `security invoker` + `stable`: tudo passa pela RLS de quem consulta. Não-membro recebe `forbidden`; sem sessão, `not_authenticated`; `anon` sem execução |
| Financeiro | Domínios nunca somados: afiliados (estado atual das comissões, via `affiliate_commission_summary`), vendas próprias (30 dias; bruto e taxas sem pedidos cancelados, reembolsos à parte) e mídia paga (30 dias; gasto como custo). Tudo por moeda |
| Conexões | Só metadados (`provider`, `domain`, `display_name`, `status`, `last_synced_at`). Conta externa, escopos e códigos de erro não saem do banco nessa leitura |
| App — Visão geral | Indicadores: aguardando aprovação, publicações em 7 dias, evidências para revisar, conexões ativas. Painéis de próximas publicações, financeiro por domínio (R1/R2/R3) e resumo de conteúdo/produtos/fila |
| App — Admin | "Integrações · nenhuma conectada" (texto fixo) virou **Conexões do workspace**, lida de `source_connections`. Os placeholders ficam em "Integrações planejadas". O estado das 8 áreas deixou de ser texto fixo (`state` em `AREAS`) e passou a vir de `NAV_ITEMS`, a mesma fonte da navegação |
| Implantação segura | Se o código chegar antes da migration (PostgREST `PGRST202` / `42883`), a visão geral cai para a contagem de conteúdo de antes, mostra um aviso informativo e exibe "—" nos demais indicadores em vez de zeros |

## Arquivos

- `supabase/migrations/20261119010000_workspace_overview.sql` (nova)
- `supabase/tests/011_workspace_overview.test.sql` (novo, 27 checagens)
- `src/lib/overview/types.ts`, `src/lib/overview/server.ts` (novos)
- `src/app/(app)/page.tsx`, `src/app/(app)/admin/page.tsx`
- `src/components/admin/ConnectionsPanel.tsx` (novo), `src/components/admin/AreaCard.tsx`, `src/lib/admin/constants.ts`
- `src/lib/supabase/database.types.ts` (assinatura da função), `src/app/globals.css`
- `tests/unit/overview.test.ts` (novo)

## Testes executados (resultados reais, 18/11/2026)

| Verificação | Ambiente | Resultado |
|---|---|---|
| `npm run test:db` | PostgreSQL 16.15 local + shim Supabase | ✅ 10/10 arquivos; `011_workspace_overview` 27/27 |
| `npm run test:unit` | Node 22 | ✅ 50/50 (4 novos) |
| `npm run typecheck` | local (npm disponível nesta execução) | ✅ sem erros |
| `npm run lint` | local | ✅ sem avisos |
| `npm run build` | local, sem variáveis do Supabase | ✅ rotas listadas, Proxy presente |
| CI GitHub Actions | após push | ver PR |
| E2E no Preview | staging | ⚠️ staging ainda não tem a migration; a visão geral deve abrir com o aviso informativo (sem `.feedback-error`) |

Cobertura do teste SQL: workspace vazio (zeros e `[]`, nunca null); contagens por estado; fila de aprovação só com rascunhos; produto sem evidência verificada fica sem score; job cancelado e job fora da janela fora da contagem de 7 dias; ordem e título das próximas publicações; comissões só do próprio workspace; vendas próprias excluem cancelado e pedido com mais de 30 dias; mídia paga em 30 dias; conexões por estado sem expor conta externa e escopos; viewer lê; membro de A não lê B; usuário sem workspace e sessão ausente recusados; `anon` sem execução; função `security invoker` e `stable`.

## Decisões

- **Uma função, não várias consultas:** antes a visão geral baixava todos os conteúdos e contava no servidor Next. Agora o banco agrega e devolve só os totais e as listas curtas.
- **`security invoker`:** a função não ganha privilégio nenhum; se uma política de RLS mudar, o painel acompanha.
- **Afiliados sem recorte de período:** o ciclo de vida da comissão (prevista → paga) dura semanas; recortar por data da conversão esconderia valores em aberto. Vendas e mídia usam 30 dias.
- **"Em aberto" (afiliados)** = prevista + aprovada + liquidada. Pagas e estornadas aparecem separadas.
- **CPC** só quando há cliques; sem clique, "—".

## Pendências e autorizações

- 🔐 Aplicar `20261119010000_workspace_overview.sql` no **staging** (`xoyasrizivadxnpmzzno`) para o E2E exercitar o painel completo, e depois em **produção** (`hpplboyysmfcjsnjrdmw`) junto da publicação na main. Esta execução não aplicou migrations remotas.
- Vendas próprias e mídia paga só terão números quando o primeiro conector existir (S11, 🔐).
- Fuso: a janela de 30 dias usa `now()`; a data das métricas de mídia é convertida para Brasília.
- A PR #22 (S10b) usa a migration `20261119000000` e o teste `010`; este split usa `20261119010000` e `011` para não colidir.

## Próxima etapa

Depois do merge: aplicar a migration no staging (com autorização) e acrescentar ao E2E uma checagem do bloco "Financeiro por domínio". Em seguida, S13 (infra de jobs e `agent_runs`).
