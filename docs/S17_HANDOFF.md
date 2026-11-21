# S17 — Hub de Conectores · handoff

**Branch:** `feature/s17-integration-hub` · **Base:** `feature/smkon-production-readiness`
**Plano:** `INTEGRACOES_E_AUTOMACAO.md` (Projeto) · decisões do Owner de 21/11: Hotmart, contas Business ou Creator, Metricool na fase 1, todas as redes juntas.

## Diagnóstico antes de implementar

O repositório já tinha a base de conectores de receita do S11: `source_connections`, `external_events` e o adapter do Mercado Livre (OAuth, tokens cifrados na aplicação, refresh com lease). Em vez de criar uma camada paralela (`integration_accounts`, como o plano sugeria), o S17 estende essa base e adiciona só o que faltava: contas sociais e pedidos de ação externa.

## O que mudou

### Banco — `supabase/migrations/20261121180000_integration_hub.sql`
- `source_connections` passa a aceitar **Hotmart** (venda própria ou afiliado), **Shopify** e **Stripe** (venda própria). As regras dos provedores anteriores ficam iguais.
- `social_accounts`: contas por workspace com rede, tipo de conta, caminho (`metricool` ou `native`), status e capacidades. Constraints: Instagram e Threads só Business ou Creator; Facebook só Página; YouTube só Canal; X nunca via Metricool; capacidades fora da lista recusadas. **Nenhum token nesta tabela.** Membros leem; escrita só pelo `service_role`.
- `external_action_requests`: toda escrita externa (publicar, bio, foto, link) vira um pedido com payload imutável e `payload_hash` (SHA-256 de ação + payload) calculado no servidor.
  - `request_external_action`: owner, admin ou analyst; a conta precisa estar conectada e ter a capacidade.
  - `decide_external_action`: só owner/admin, conferindo o hash exato exibido; idempotente.
  - `cancel_external_action`: quem pediu, owner ou admin, antes da execução.
  - `claim_external_action` e `finish_external_action`: só `service_role`; reivindica apenas pedido aprovado cujo hash ainda confere.
  - Transições: `pending_approval → approved/rejected/cancelled`, `approved → executing/cancelled`, `executing → executed/failed`. Sem delete. Decisão não pode ser reescrita.
  - Auditoria no `audit_log` com status, ação e hash, nunca o conteúdo do payload.

### Aplicação
- `src/lib/integrations/registry.ts`: catálogo puro do que cada rede e provedor permite por API oficial. `resolveCapabilities` (espelha as constraints; pelo Metricool só publicar e métricas), `canPerform`, `normalizeActionPayload` (payload estrito antes do hash).
- `src/components/admin/IntegrationHubPanel.tsx`: em `/admin`, mostra as contas sociais reais do workspace, o que só pode ser feito no app de cada rede, os provedores de receita por fase e quantas ações aguardam aprovação. Se a migration não estiver no ambiente, mostra aviso em vez de erro.
- Removido o painel "Integrações planejadas", que tinha textos desatualizados (citava Supermetrics e autenticação parcial).
- `PROVIDER_LABEL` com Hotmart, Shopify e Stripe; tipos do Supabase atualizados à mão para as duas tabelas e as RPCs novas.

## Testes (resultados reais, 21/11)
- SQL `supabase/tests/040_integration_hub.test.sql`: **39 asserções** (permissões, novos provedores, regras das contas, isolamento, papéis, hash, imutabilidade inclusive para o dono do banco, execução, auditoria). Suíte completa: **24 arquivos, 658 asserções**, todas passando (PostgreSQL 16 local; a CI usa 17).
- Unitários `tests/unit/integrations-registry.test.ts`: 7 testes; suíte **267/267**.
- `typecheck`, `lint`, `build`: sem erros.
- E2E no Preview do primeiro commit (antes da migration no staging): 35 de 36 passaram. Falhou "Convites" por regressão deste PR — o aviso estático do hub usava `role="status"` e duplicava o papel na página. Corrigido em `87d4211`.
- O Preview de `87d4211` não foi gerado: a Vercel recusou o deploy por limite diário do plano ("Deployment rate limited — retry in 24 hours"). O E2E da correção fica pendente até o limite liberar.

## Staging
Migration aplicada em `xoyasrizivadxnpmzzno` em 21/11 (autorização do Owner). MD5 das 9 funções e das 35 constraints idêntico ao banco local migrado pelo repositório. RLS ligada nas duas tabelas; `anon` sem acesso; `claim`/`finish` fora do alcance de `authenticated`. Advisors de segurança: só o aviso esperado de RPC `security definer` executável por `authenticated` nas 3 funções de pedido/decisão/cancelamento (mesmo padrão dos demais módulos).

Achados anteriores ao S17, registrados para tratar à parte: `rate_limit_consume` executável por `anon`, e proteção contra senhas vazadas desligada no Supabase Auth.

## Pendências
- **Produção:** migration `20261121180000` não aplicada; exige autorização do Owner.
- Ainda não há fluxo de conexão: as contas sociais entram quando o adapter do Metricool existir (S19).
- Tela de aprovação das ações externas: entra junto com o S19, quando existirem pedidos reais.
- Hotmart: uma mesma conta pode ser produtora e afiliada, mas `source_connections` tem `unique (organization_id, provider, external_account_id)`. O S18 precisa decidir entre duas conexões com identificadores distintos ou uma conexão que gere eventos nos dois domínios.

## Próxima etapa
S18 — webhook da Hotmart com assinatura validada → `external_events` → ledger, separando venda própria e comissão.
