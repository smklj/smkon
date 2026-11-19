# SMKON — Status da integração

Mantido pela frente **Integração** (execução agendada de hora em hora). Branch de integração:
`feature/smkon-production-readiness`. Correções desta frente usam `fix/integration-*`.

**Última verificação:** 19/11/2026 ~13:30 UTC · commit `cdac2ad` (Merge S14 teto/consumo/OIDC, PR #42)

## 1. CI da branch de integração (push)

| Commit | Run | Resultado |
|---|---|---|
| `cdac2ad` Merge S14 teto/consumo/OIDC (#42) | [#208](https://github.com/smklj/smkon/actions/runs/44531378589) | ✅ success |
| `e86e71c` Merge Integração (#44) | [#203](https://github.com/smklj/smkon/actions/runs/44526289209) | ✅ success |
| `6cba37b` Merge S5.1 (#43) | [#199](https://github.com/smklj/smkon/actions/runs/44520230539) | ✅ success |

Nenhuma quebra de integração detectada; nenhuma correção de código `fix/integration-*` necessária nesta execução.

## 2. Validação local (Postgres 16 descartável, Node 22.23.5) — commit `cdac2ad`

| Etapa | Resultado real |
|---|---|
| `npm ci` | ✅ 0 vulnerabilidades |
| `npm run typecheck` | ✅ sem erros |
| `npm run lint` | ✅ sem erros |
| `npm run test:unit` | ✅ 156/156 (0 falhas, 0 pulados) |
| `npm run build` | ✅ |
| `npm run test:db` (19 migrations) | ✅ 17/17 arquivos de teste |

## 3. Migrations: repositório × staging × produção (comparação por nome)

Repositório (integração): 19 migrations, de `20261117183000_split_01_revenue_domains` a `20261119070000_workspace_members`.

| Migration | Integração | Staging `xoyasrizivadxnpmzzno` | Produção `hpplboyysmfcjsnjrdmw` |
|---|---|---|---|
| `split_01_revenue_domains` … `agent_claim_queue` (17) | ✅ | ✅ | ✅ |
| `20261119060000_agent_model_usage` (S14, PR #42 mergeado) | ✅ | ✅ (versão `20261119114718`) | ❌ falta 🔐 |
| `20261119070000_workspace_members` (S5.1, PR #43) | ✅ | ❌ **falta** | ❌ falta 🔐 |
| `20261119110000_audience_consent` (S15, PR #47 **draft**) | ❌ | ⚠️ aplicada (versão `20261119132522`) | ❌ |

**Falta no staging:** `workspace_members`.
**Falta na produção (🔐 Owner):** `agent_model_usage`, `workspace_members`.
**Desvio:** o staging tem `audience_consent` do PR #47 (S15), ainda não mergeado. Não é bloqueio, mas o PR #47 deve ser
mergeado sem alterar essa migration; se ela mudar, o staging precisa ser reconciliado. O arquivo `agent_model_usage` não
mudou desde o commit `a084f6d` (o mesmo aplicado no staging), então o desvio anterior foi resolvido com o merge do #42.

## 4. Pendências do S5.1 (desta frente)

- ⛔ **Aplicar `20261119070000_workspace_members` no staging** (autorizado pelo Owner em 19/11/2026) — **bloqueado**.
  Testes SQL passaram localmente antes da tentativa (17/17). Duas tentativas (execuções 1 e 3 de 19/11/2026):
  `apply_migration` do conector Supabase **pede confirmação interativa** e expira em 180 s sem resposta (execução agendada).
  **Nada foi aplicado** (conferido com `list_migrations` após a tentativa). Não usamos `execute_sql` para contornar a
  confirmação. Para destravar (Owner): aprovar `apply_migration` do Supabase como "sempre permitir" para esta tarefa
  agendada, ou aplicar manualmente pelo SQL Editor do staging o conteúdo do arquivo (registrando o nome `workspace_members`).
- ⏳ Depois de aplicada: conferir grants/RLS de `user_active_workspace` e das 4 funções, rodar `get_advisors` (security e
  performance) e endurecer o E2E de admin (`admin-finance.spec.mjs`) para exigir a lista de membros.
- 🔐 Decisão do Owner (não alterar): `ensure_workspace` cria workspace vazio para usuário removido de todos os workspaces.

## 5. Quadro das frentes

| Frente | Etapa atual | PR aberto | CI do PR | Pendências | Autorizações do Owner |
|---|---|---|---|---|---|
| S14 (agentes) | Etapas 1–7 + teto/consumo/OIDC mergeadas (#37–#42); etapas 8–9 (detalhe da execução + handoff) | #46 (draft, `feature/s14-run-detail`) | ✅ typecheck/build, ✅ SQL | Merge do #46; handoff | Produção de `agent_model_usage`; `SUPABASE_SECRET_KEY`/OIDC/AI Gateway na Vercel; Vercel Cron; gasto com modelo |
| S15 (CRM/LGPD) | Audiência e CRM com consentimento | #47 (draft, `feature/s15-audience-consent`) | ✅ typecheck/build, ✅ SQL, ⏳ Playwright | Merge do #47; migration já no staging (seção 3); handoff | Produção de `audience_consent` |
| S16 (performance) | Não iniciada (sem branch `feature/s16-*`) | — | — | — | — |
| S6.1 (CSP/logs) | CSP com nonce + destino externo de logs | #45 (draft, `feature/s6-1-csp-nonce-log-sink`) | ✅ typecheck/build, ✅ SQL | Merge do #45; handoff | Destino de logs (serviço/segredo) |
| S4 (camada de domínio) | Não iniciada (sem branch `feature/s4-*`) | — | — | — | — |
| S5.1 (membros) | ✅ concluída (#43) | — | ✅ | Staging + E2E (seção 4) | Produção da migration |
| Integração | Execução 3: CI e validação local verdes | este PR | — | Seção 4 (bloqueada por confirmação) | Liberar `apply_migration` no staging |

Handoffs finais pendentes: S14, S15, S16, S6.1, S4.

## 6. Autorizações necessárias para produção (acumulado)

1. Migrations na produção, em ordem: `20261119060000_agent_model_usage`, `20261119070000_workspace_members`
   (e `20261119110000_audience_consent` após merge do #47).
2. Merge de `feature/smkon-production-readiness` na `main` e promoção do deploy.
3. Variáveis/segredos (S14): `SUPABASE_SECRET_KEY` por ambiente, credencial OIDC/AI Gateway, `CRON_SECRET`, `AGENT_EXECUTOR_ENABLED`.
   (S6.1): destino externo de logs e seu segredo.
