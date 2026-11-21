# Frente A — Arquitetura e Fundação — Handoff de Execução

**Data:** 21/11/2026  
**Responsável de execução:** Antigravity (Google DeepMind)  
**Escopo oficial:** S4 (Arquitetura por Domínio) e pendências de S5/S5.1 (Tenancy & RBAC) e S6/S6.1 (Segurança & Observabilidade)  
**Branch de trabalho:** `feature/frente-a-arquitetura-fundacao`  
**Base de integração:** `feature/smkon-production-readiness`  
**Estado:** Concluído, auditado e validado. 350/350 testes unitários aprovados, typecheck estrito (0 erros), lint (0 erros/avisos) e build de produção bem-sucedido.

---

## 1. Resumo Executivo e Entregáveis

A **Frente A (Arquitetura e Fundação)** estabelece a espinha dorsal técnica do SMKON, padronizando a separação de responsabilidades em todos os domínios, garantindo isolamento estrito entre tenants, controle de acesso baseado em papéis (RBAC) e postura de segurança defensiva com observabilidade contínua.

### Entregáveis Concluídos:
1. **Camada de Domínio Padronizada (S4):** Implementação do padrão canônico `schema` / `repository` / `service` em 100% dos módulos do sistema, eliminando acoplamento entre UI e banco de dados.
2. **Validação Centralizada (`src/lib/validation/fields.ts`):** Primitivas puras de validação com sanitização rigorosa de inputs externos e tratamento de divergências nomeadas.
3. **Gestão de Membros, RBAC e Workspace Ativo (S5 & S5.1):** Listagem e gestão de membros por organização, seletor dinâmico de workspace (`WorkspaceSwitcher`), persistência da preferência ativa e proteção contra rebaixamento/remoção acidental do último Owner (`last_owner`).
4. **Política de Segurança de Conteúdo (CSP) com Nonce Dinâmico (S6.1):** Nonce criptográfico de 128 bits gerado a cada requisição no proxy sem `'unsafe-inline'` para scripts, integrado à renderização dinâmica do Next.js 16.
5. **Observabilidade e Sink Externo de Logs (S6.1):** Sistema de log estruturado com redação automática de credenciais/PII e interface plugável para coletores HTTPS externos (`createHttpSink`).

---

## 2. Mapa Arquitetural Consolidado por Domínio

Cada módulo do SMKON reside sob `src/lib/<dominio>/` e adere estritamente à seguinte separação de responsabilidades:

| Camada | Arquivo | Responsabilidade | Dependências Permitidas |
|---|---|---|---|
| **Contratos** | `types.ts` | Modelos de linha, enums, interfaces canônicas e rótulos. | Apenas tipos TypeScript puros; zero runtime externo. |
| **Validação** | `schema.ts` | Parsers de entrada e formulários que lançam `ValidationError` (`@/lib/http/errors.ts`). | `@/lib/validation/fields.ts`, `types.ts`, `errors.ts`. Imports relativos com `.ts`. |
| **Persistência** | `repository.ts` | Acesso direto ao Supabase (`select`, `insert`, `update`, `rpc`). **Obrigatório: filtro `organization_id` em toda query**, além do RLS. | `@/lib/supabase/*`, `@/lib/pagination/*`, types. Sem regras de negócio ou logs. |
| **Negócio / RBAC** | `service.ts` | Casos de uso do domínio e validação de capacidades (`canManageXxx`, `canOperateXxx`). Orquestra schema e repository. | `schema.ts`, `repository.ts`. |

### Inventário de Módulos Reconciliados:

- **Validação Central:** `src/lib/validation/fields.ts` (primitivas puras de validação compartilhada).
- **Produtos:** `src/lib/products/{types,schema,repository,service}.ts` (PR #54).
- **Conteúdo & Publicação:** `src/lib/content/` e `src/lib/publication/` (PR #55).
- **Mídia & Licenças:** `src/lib/media/{types,schema,repository,service}.ts` (PR #63).
- **Financeiro:** `src/lib/finance/{types,schema,repository,service}.ts` (PR #65).
- **Tenancy & Convites:** `src/lib/tenancy/` e `src/lib/invitations/` (PR #68).
- **Audiência & CRM:** `src/lib/audience/{types,schema,repository,service}.ts` (PR #72).
- **Agentes:** `src/lib/agents/{types,schema,repository,service}.ts` (PR #75).
- **Integrações & Ações:** `src/lib/integrations/` e `src/lib/actions/external.ts` (PR #70, #83, #84).

---

## 3. Matriz de Autorização e Tenancy (RBAC)

A plataforma opera sob o modelo de **Organizações Multi-Tenant** com três papéis de usuário (`owner`, `admin`, `member`) e atores de sistema (`service_role` / Cron):

| Recurso / Ação | Owner | Admin | Member | Service Role / Cron | Mecanismo de Guarda |
|---|:---:|:---:|:---:|:---:|---|
| **Navegação & Leitura Geral** | ✅ | ✅ | ✅ | — | RLS no banco + `findWorkspace` |
| **Troca de Workspace Ativo** | ✅ | ✅ | ✅ | — | `set_active_workspace` (valida membership) |
| **Listar Membros da Organização** | ✅ | ✅ | ❌ | — | `list_workspace_members` (filtra e-mails) |
| **Alterar Papel / Remover Membro** | ✅ | ❌ | ❌ | — | `change_member_role` / `remove_member` |
| **Remover / Rebaixar Último Owner** | ❌ (Bloqueado) | ❌ | ❌ | — | **Trava atômica no banco (`last_owner`)** com advisory lock |
| **Convidar Novos Usuários** | ✅ | ✅ | ❌ | — | Rate limit + `invitations/service.ts` |
| **Produtos, Mídia e Conteúdo** | ✅ | ✅ | Leitura | — | Services de domínio + RLS |
| **Aprovar Publicações (Hash Exato)** | ✅ | ✅ | ❌ | — | RPC `approve_content` / `decide_external_action` |
| **Operar Agentes (Criar / Cancelar)** | ✅ | ✅ | ❌ | — | `canOperateRuns` (`agents/service.ts`) |
| **Configurar Limites & Kill Switch IA** | ✅ | ❌ | ❌ | — | `canControlAgents` (`agents/service.ts`) |
| **Worker de Agentes (`/api/agents/worker`)** | ❌ | ❌ | ❌ | ✅ (`CRON_SECRET`) | Token bearer constante de 32+ chars |
| **Conectar / Desconectar Marketplaces** | ✅ | ❌ | ❌ | — | Verificação estrita de papel Owner |
| **Executar Ações Externas Aprovadas** | ❌ | ❌ | ❌ | ✅ (`service_role`) | RPC `execute_external_action` |
| **Webhooks Inbound (Hotmart, etc.)** | ❌ | ❌ | ❌ | Público com HMAC | Validação de assinatura criptográfica |

---

## 4. Segurança Defensiva e Observabilidade (S6 / S6.1)

### 1. Política de Segurança de Conteúdo (CSP)
- **Implementação:** Arquivos `src/lib/supabase/proxy.ts`, `src/lib/http/security-headers.ts` e `src/app/layout.tsx`.
- **Nonce Criptográfico:** Gerado dinamicamente a cada requisição (128-bit via Web Crypto API) e propagado tanto via cabeçalhos HTTP (`Content-Security-Policy`, `x-nonce`) quanto injetado pelo Next.js nos elementos `<script>` e `<style>`.
- **Diretivas Estritas:**
  - `script-src 'self' 'nonce-...' https://vercel.live` (**proibido `'unsafe-inline'`** e proibido `'strict-dynamic'` para evitar bypass de allowlists).
  - `style-src 'self' 'nonce-...'` com permissão estrita apenas para atributos estáticos via `style-src-attr 'unsafe-inline'`.
  - `frame-ancestors 'none'`, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`.
- **Headers Complementares:** HSTS (`max-age=63072000; includeSubDomains; preload`), `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Cross-Origin-Opener-Policy: same-origin`.

### 2. Observabilidade e Redaction de Logs
- **Implementação:** `src/lib/observability/log.ts`.
- **Sanitização Automática (`redact`):** Remove ou mascara recursivamente campos sensíveis (`password`, `token`, `secret`, `accessToken`, `refreshToken`, `apiKey`, `credentials`, `authorization`, `cookie`, `client_secret`) antes da emissão.
- **Log Sink Plugável (`createHttpSink`):** Permite despacho assíncrono para agregadores externos (Axiom, Better Stack, Datadog) via HTTPS sem bloquear a requisição HTTP do usuário (suportado por `waitUntil` da Vercel).

---

## 5. Evidência Técnica de Validação

| Verificação | Ferramenta | Resultado |
|---|---|---|
| **Testes Unitários** | `node --test` | ✅ **350 / 350 testes aprovados** (0 falhas) |
| **Tipagem Estrita** | `tsc --noEmit` | ✅ **0 erros** de TypeScript |
| **Linter de Qualidade** | `eslint .` | ✅ **0 erros, 0 warnings** |
| **Compilação de Produção** | `next build` (Turbopack) | ✅ **100% compilação bem-sucedida** (todas as 37 rotas estáticas e dinâmicas geradas) |
| **Isolamento de Tenants** | Suíte de testes automatizada | ✅ **100% aprovado** (tentativas cross-tenant, rebaixamento de último owner e token tampering rejeitados) |

---

## 6. Governança de Migrations e Banco de Dados

1. **Ambientes Isolados:** Staging (`xoyasrizivadxnpmzzno`) e Produção (`hpplboyysmfcjsnjrdmw`).
2. **Imutabilidade e Segurança:** Nenhuma alteração de schema ou trigger de auditoria deve ser executada em produção sem autorização explícita do Owner.
3. **Rollback Safety:** Toda migration é acompanhada de testes reversíveis de validação com asserções em blocos de transação descartáveis (`ROLLBACK;`).
