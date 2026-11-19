# SMKON — Status da integração

Mantido pela frente **Integração** (execução agendada de hora em hora). Branch de integração:
`feature/smkon-production-readiness`. Correções desta frente usam `fix/integration-*`.

**Última verificação:** 19/11/2026 · commit `6cba37b` (Merge S5.1, PR #43)

## 1. CI da branch de integração (push)

| Commit | Run | Resultado |
|---|---|---|
| `6cba37b` Merge S5.1 (#43) | [#199](https://github.com/smklj/smkon/actions/runs/44520230539) | ✅ success |
| `0812d8e` Merge S14 etapa 7 (#41) | #194 | ✅ success |
| `71cf2be` Merge S14 etapa 6 (#40) | #191 | ✅ success |

Nenhuma quebra de integração detectada; nenhum PR `fix/integration-*` necessário nesta execução.

## 2. Validação local (Postgres 16 descartável, Node 22.23.5) — commit `6cba37b`

| Etapa | Resultado real |
|---|---|
| `npm ci` | ✅ |
| `npm run typecheck` | ✅ sem erros |
| `npm run lint` | ✅ sem erros |
| `npm run test:unit` | ✅ 148/148 (0 falhas, 0 pulados) |
| `npm run build` | ✅ |
| `npm run test:db` (shim, 18 migrations) | ✅ 16/16 arquivos de teste |

## 3. Migrations: repositório × staging × produção (comparação por nome)

Repositório (integração): 18 migrations, de `20261117183000_split_01_revenue_domains` a `20261119070000_workspace_members`.

| Migration | Integração | Staging `xoyasrizivadxnpmzzno` | Produção `hpplboyysmfcjsnjrdmw` |
|---|---|---|---|
| `split_01_revenue_domains` … `agent_claim_queue` (17) | ✅ | ✅ | ✅ |
| `20261119060000_agent_model_usage` (S14, PR #42 **não mergeado**) | ❌ | ⚠️ aplicada (versão `20261119114718`) | ❌ |
| `20261119070000_workspace_members` (S5.1, PR #43) | ✅ | ❌ **falta** | ❌ falta 🔐 |

**Falta no staging:** `workspace_members`.
**Falta na produção (🔐 Owner):** `workspace_members` (e, quando o PR #42 for mergeado, `agent_model_usage`).
**Desvio:** o staging já tem `agent_model_usage`, de um PR ainda em draft (#42). Não é bloqueio (as duas migrations são
independentes), mas o PR #42 deve ser mergeado sem alterar essa migration; se ela mudar, o staging precisa ser reconciliado.

## 4. Pendências do S5.1 (desta frente)

- ⏳ **Aplicar `20261119070000_workspace_members` no staging** (autorizado pelo Owner em 19/11/2026).
  Tentativa em 19/11/2026: `apply_migration` do conector Supabase **pediu confirmação interativa** e expirou sem resposta
  (execução agendada, sem ninguém para confirmar). **Nada foi aplicado** (conferido com `list_migrations`). Para destravar:
  aprovar a ferramenta `apply_migration` do Supabase como "sempre permitir" para esta tarefa agendada, ou aplicar
  manualmente pelo SQL Editor do staging o conteúdo do arquivo (registrando o nome `workspace_members`).
- ⏳ Depois de aplicada: conferir grants/RLS de `user_active_workspace` e das 4 funções, rodar `get_advisors` (security e
  performance) e endurecer o E2E de admin (`admin-finance.spec.mjs`) para exigir a lista de membros.
- 🔐 Decisão do Owner (não alterar): `ensure_workspace` cria workspace vazio para usuário removido de todos os workspaces.

## 5. Quadro das frentes

| Frente | Etapa atual | PR aberto | CI | Pendências | Autorizações do Owner |
|---|---|---|---|---|---|
| S14 (agentes) | Etapas 1–7 mergeadas (#37–#41); complemento teto/consumo/OIDC | #42 (draft, `feature/s14-budget-oidc`) | ver PR | Merge do #42; migration `agent_model_usage` já no staging | Produção da migration; `SUPABASE_SECRET_KEY`/OIDC/AI Gateway na Vercel; Vercel Cron; gasto com modelo |
| S15 (CRM/LGPD) | Não iniciada (sem branch `feature/s15-*`) | — | — | — | — |
| S16 (performance) | Não iniciada (sem branch `feature/s16-*`) | — | — | — | — |
| S6.1 (CSP/logs) | Não iniciada (sem branch `feature/s6-1-*`) | — | — | CSP com nonce, destino externo de logs | Destino de logs (serviço/segredo) |
| S4 (camada de domínio) | Não iniciada (sem branch `feature/s4-*`) | — | — | — | — |
| S5.1 (membros) | ✅ concluída (#43) | — | ✅ | Staging + E2E (seção 4) | Produção da migration |
| Integração | Status inicial criado | este PR | — | Seção 4 | — |

Handoffs finais pendentes: S14, S15, S16, S6.1, S4.

## 6. Autorizações necessárias para produção (acumulado)

1. Migrations na produção, em ordem: `20261119060000_agent_model_usage` (após merge do #42), `20261119070000_workspace_members`.
2. Merge de `feature/smkon-production-readiness` na `main` e promoção do deploy.
3. Variáveis/segredos (S14): `SUPABASE_SECRET_KEY` por ambiente, credencial OIDC/AI Gateway, `CRON_SECRET`, `AGENT_EXECUTOR_ENABLED`.
