# S19 — Conexões Sociais, Adaptador Metricool & Aprovações de Ações Externas · handoff

**Branch:** `feature/s19-social-metricool-approvals` · **Base:** `feature/s18-hotmart-webhook`
**Frente:** Frente C — Inteligência e Integrações (S14, S17, S18, S19)
**Escopo:** S19 — Adaptador Metricool para redes sociais, credenciais seguras, sincronização de contas com restrições e painel de aprovação humana de ações externas por conferência de hash SHA-256 exato.

---

## 1. O que foi implementado

### Adaptador Metricool (`src/lib/integrations/metricool/`)
- `client.ts`: Cliente HTTP para API oficial do Metricool com suporte a `listConnectedAccounts` (descoberta de provedores e contas conectadas) e `publishPost` (publicação de posts agendados ou imediatos com mídia).
- `types.ts`: DTOs de contas do Metricool, payloads de postagem e sincronização.
- `service.ts`:
  - `syncMetricoolAccountsForOrg`: sincroniza contas do Metricool para a tabela `public.social_accounts`.
    - Respeita rigorosamente o catálogo oficial de restrições do S17:
      - Instagram e Threads: somente contas profissionais (`business` ou `creator`).
      - Facebook: somente páginas (`page`).
      - YouTube: somente canais (`channel`).
      - X (Twitter): nunca sincronizado via Metricool (exige API nativa).
    - Aplica as capacidades oficiais via `resolveCapabilities(network, accountType, "metricool")` (`publish`, `read_metrics`).
  - `executeExternalActionRequest`: executor (service_role) que reivindica pedidos de ação aprovados via `claim_external_action`, executa a postagem no Metricool e finaliza o pedido atomicamente via `finish_external_action`.

### Banco de Dados & Segurança
- `supabase/migrations/20261121200000_metricool_credentials.sql`:
  - Tabela `public.metricool_credentials`: armazenamento server-side de tokens Metricool cifrados (`user_token_hash`, `encrypted_token`, `blog_id`). RLS ativa, revogada de `anon` e `authenticated`, restrita exclusivamente a `service_role`.
  - RPC `public.metricool_set_credentials`: parametrização de credenciais do workspace.
  - RPC `public.metricool_sync_social_accounts`: sincronização atômica em lote no PostgreSQL, validando constraints de rede social antes do upsert.
  - **Migration aplicada com sucesso no Supabase de Staging (`xoyasrizivadxnpmzzno`)**.

### Fluxo de Aprovação Humana de Ações Externas
- Serviço `src/lib/actions/external.ts`:
  - `listPendingExternalActions`: lista pedidos com status `pending_approval` do workspace.
  - `decideExternalAction`: invoca a RPC `decide_external_action` conferindo o `expected_hash` (apenas Owner ou Admin). Rejeita com `hash_mismatch` se o payload foi alterado.
  - `cancelExternalAction`: permite ao solicitante ou admin cancelar o pedido antes da execução.
  - `createExternalActionRequest`: cria pedido de ação externa validando payload com `normalizeActionPayload` e calculando `payload_hash` no servidor.
- Rotas de API:
  - `GET /api/actions/external`: listagem de ações pendentes.
  - `POST /api/actions/external/decide`: decisão humana (aprovação ou recusa com verificação de hash).
  - `POST /api/actions/external/cancel`: cancelamento de pedido.
  - `POST /api/integrations/metricool/sync`: disparo de sincronização de contas.

### Interface de Administração (`/admin`)
- Componente `src/components/admin/ExternalActionsPanel.tsx`:
  - Painel interativo adicionado em `src/app/(app)/admin/page.tsx` ("Ações externas e publicações").
  - Exibe contas associadas, tipo de ação (`Publicar post`, `Atualizar bio`, etc.), prévia do conteúdo (legenda, mídias, URLs) e o destaque visual do `payload_hash` SHA-256.
  - Botões para "Aprovar (Hash Exato)", "Recusar" e "Cancelar" com feedback visual e atualização instantânea.

---

## 2. Testes e Validações

1. **Testes Unitários:** `tests/unit/social-metricool.test.ts` (5 testes adicionados).
   - Suíte unitária completa: **282/282 testes aprovados (0 falhas)**.
2. **Testes de Banco (SQL):** `supabase/tests/metricool_credentials.test.sql`
   - RLS, Security Definer, permissões e restrições de contas executados no Supabase Staging (`xoyasrizivadxnpmzzno`) com transação rollback-only: **aprovados com 100% de sucesso**.
3. **Tipagem (`tsc --noEmit`):** 0 erros.
4. **Lint (`eslint .`):** 0 erros, 0 avisos.
5. **Build de Produção (`next build`):** Compilação bem-sucedida de todas as rotas e páginas.
