# S18 — Webhook da Hotmart & Normalização Financeira · handoff

**Branch:** `feature/s18-hotmart-webhook` · **Base:** `feature/s17-integration-hub`
**Frente:** Frente C — Inteligência e Integrações (S14, S17, S18, S19)
**Escopo:** S18 — Webhook da Hotmart, recepção segura, normalização PII-free, conciliação e escrituração contábil no ledger.

---

## 1. Diagnóstico e Arquitetura

O S18 implementa a ingestão oficial de eventos de receita da Hotmart via Webhook (versão 2.0.0 e retrocompatibilidade 1.0), cobrindo tanto venda própria do produtor (`owned_sales`) quanto comissão de afiliado (`affiliate`).

### Segurança e Autenticação
- **Tempo constante:** Comparação do token secreto (Hottok) via `crypto.timingSafeEqual` sobre os hashes SHA-256 (`verifyHotmartToken`). Zero vazamento por timing attack.
- **Isolamento de segredos:** Tabela `hotmart_credentials` com RLS ativada, revogada de `anon` e `authenticated`, restrita exclusivamente a `service_role`. Tokens nunca trafegam para browser nem ficam em logs.
- **Lookup por Hash:** O token Hottok é indexado pelo seu digest SHA-256 (`hottok_hash`), permitindo que a rota de webhook localize automaticamente a conexão do tenant sem que o cliente precise declarar parâmetros se não quiser. Também suporta parâmetros explícitos `connection_id` ou `organization_id` + `domain`.
- **Machine Route no Proxy:** `/api/webhooks/hotmart` configurada como rota de máquina em `src/lib/supabase/machine-routes.ts`, permitindo recepção autenticada por token sem cookies de sessão Supabase.

### Privacidade e Conformidade LGPD (Zero PII)
- O normalizador `normalizeHotmartWebhook` descarta sumariamente todos os dados identificáveis do comprador (`buyer.name`, `buyer.email`, `buyer.document`, `buyer.checkout_phone`, endereços).
- A RPC `hotmart_persist_webhook_event` contém guarda estrita no PostgreSQL: rejeita qualquer payload que contenha atributos de dados pessoais (`buyer`, `email`, `name`, `phone`, `document`, etc.), garantindo conformidade física no banco.

### Ciclo de Vida e Integração Contábil
- **Venda Própria (`owned_sales`):**
  - Mapeia para `sales_orders` com status canônico (`paid`, `refunded`, `cancelled`, `pending`).
  - Escritura lançamentos no `financial_ledger_entries`:
    - `sales_gross`: valor bruto da venda.
    - `sales_fee`: taxa da plataforma Hotmart (negativo).
    - `sales_refund`: estorno total (negativo).
- **Comissão de Afiliado (`affiliate`):**
  - Mapeia para `affiliate_conversions` respeitando a máquina de estados do S8:
    - `PURCHASE_APPROVED` → `approved`.
    - `PURCHASE_COMPLETE` → `settled` (após período de garantia/liberação para saque).
    - `PURCHASE_REFUNDED` / `PURCHASE_CHARGEBACK` → `reversed`.
    - `PURCHASE_CANCELLED` / `PURCHASE_EXPIRED` → `cancelled`.
  - Dispara automaticamente os triggers do S8 (`affiliate_conversion_guard` e `affiliate_conversion_post`), registrando histórico append-only em `affiliate_commission_status_history` e lançamentos idempotentes em `financial_ledger_entries`.
- **Imutabilidade e Replay Idempotente:**
  - Reprocessamentos de webhooks repetidos (`same transaction + event_type`) realizam upsert em `external_events` e não duplicam registros em `sales_orders`, `affiliate_conversions` ou no ledger.
  - Estados terminais (`reversed` e `cancelled`) são protegidos contra regressão por eventos tardios fora de ordem.

---

## 2. O que mudou

### Banco de Dados
- `supabase/migrations/20261121190000_hotmart_webhook.sql`:
  - Cria tabela `public.hotmart_credentials` com RLS.
  - RPC `public.hotmart_lookup_connection_by_token_hash`: busca segura de conexão por hash de token.
  - RPC `public.hotmart_set_connection_credentials`: parametrização de credenciais pela aplicação.
  - RPC `public.hotmart_persist_webhook_event`: execução atômica, validação de schema, persistência e ledger idempotente.

### Aplicação
- `src/lib/integrations/hotmart/types.ts`: DTOs de eventos Hotmart (2.0.0 e 1.0) e evento normalizado.
- `src/lib/integrations/hotmart/validator.ts`: extração de tokens e verificação em tempo constante (`verifyHotmartToken`, `extractHotmartToken`, `hashHotmartToken`).
- `src/lib/integrations/hotmart/normalizer.ts`: extração monetária, arredondamento a 4 casas, mapeamento de status, cálculo de `payload_hash` SHA-256 e remoção estrita de PII.
- `src/lib/integrations/hotmart/repository.ts`: operações seguras via `service_role` com Supabase.
- `src/app/api/webhooks/hotmart/route.ts`: route handler POST para recebimento dos webhooks.
- `src/lib/supabase/machine-routes.ts` & `src/lib/supabase/proxy.ts`: inclusão das rotas `/api/webhooks/*` nas rotas de máquina.
- `src/lib/integrations/registry.ts`: Hotmart atualizado para status `phase: "active"`.

---

## 3. Validação e Testes

- **Testes Unitários:** `tests/unit/hotmart-webhook.test.ts` (10 novos testes).
  - Verificação de token constante: timingSafeEqual contra bypass e timing attacks.
  - Extração de token: cabeçalhos, query params e body.
  - Normalização PII-free: exclusão comprovada de campos de comprador.
  - Mapeamento de status e ciclo de vida S8.
  - Determinismo e sensibilidade a mutação do `payload_hash`.
  - Rota de máquina reconhecida pelo proxy.
  - Suíte completa de testes unitários: **277/277 passaram com 0 falhas**.
- **Testes de Banco (SQL):** `supabase/tests/hotmart_webhook.test.sql`.
  - RLS e security definer verificados.
  - Rejeição estrita de PII validada no banco.
  - Escrituração contábil em `owned_sales` e `affiliate` verificada.
  - Replay idempotente no ledger comprovado.
  - Isolamento entre organizações/tenants validado.
  - **Executado e aprovado com sucesso no ambiente Supabase de staging (`xoyasrizivadxnpmzzno`)**.
- **Typecheck & Lint:**
  - `npm run typecheck` (`tsc --noEmit`): 0 erros.
  - `npm run lint` (`eslint .`): 0 erros.
- **Build de Produção:**
  - `npm run build` (`next build`): compilado com sucesso, incluindo `/api/webhooks/hotmart`.

---

## 4. Estado de Staging e Produção

- **Staging (`xoyasrizivadxnpmzzno`):** migration `hotmart_webhook` aplicada e testada via SQL rollback-only com sucesso.
- **Produção (`hpplboyysmfcjsnjrdmw`):** nenhuma migration aplicada; aguarda aprovação do Owner.
- **Próximos passos (S19):** Adaptador Metricool para todas as redes sociais e tela de aprovação de ações externas com base nos pedidos de ação criados no S17.
