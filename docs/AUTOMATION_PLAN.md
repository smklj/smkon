# SMKON — Plano de Automação e Execução por Fases

**Versão:** 1.0  
**Data:** 18/11/2026  
**Baseado em:** docs/SMKON_MASTER_DOSSIER_ANTIGRAVITY.md (v1.0) e docs/ANTIGRAVITY_HANDOFF.md  
**Branch de referência:** feature/content-growth-studio-mvp

Este plano reflete as fases definidas no dossiê mestre. Novas fases ou restrições do dossiê foram incorporadas. Identidade operacional exclusiva: smkonlj@gmail.com / smklj. 

## Restrições permanentes (não negociáveis)

- Usar exclusivamente identidade smkonlj@gmail.com e GitHub smklj. Não misturar com contas pessoais ou outros projetos (NEXO, BMI9 etc.).
- Sem merge em main.
- Sem migration em Supabase hospedado.
- Sem deploy de produção.
- Sem publicação em perfis reais.
- Sem gastos, campanhas pagas, compras, assinaturas ou contratações sem autorização explícita do Owner.
- Conteúdo só após aprovação da versão exata + direitos + disclosure.
- Menor privilégio, RLS, auditoria, idempotência, retries limitados.
- Não declarar integrações operacionais sem teste ponta a ponta.
- Secrets nunca no Git, logs ou documentação.

## Fases

### Fase 0 — Preservar e auditar (primeira atividade)
1. Autenticar exclusivamente com identidade SMKON.
2. Clonar repositório e preservar branches existentes.
3. Ler dossiê mestre, ANTIGRAVITY_HANDOFF.md e docs/architecture/.
4. Revisar PRs #1, #2, #3, commits, diffs e checks de CI.
5. Rodar npm install, typecheck, lint e build.
6. Produzir matriz de status (feito / parcial / planejado / a validar).
7. Listar riscos e dependências.
8. Não alterar produção.

**Aceite:** relatório de auditoria reproduzível com evidências.

### Fase 1 — Estabilizar fundação
1. Revisar Auth, PKCE, sessão e refresh.
2. Revisar workspace/tenant e papéis.
3. Revisar RLS e bootstrap de workspace.
4. Testar isolamento multi-tenant.
5. Corrigir bugs de fundação identificados na auditoria.

**Aceite:** Auth e RLS validados localmente / Preview autorizado; testes multi-tenant passando.

### Fase 2 — Persistência cloud do Content Studio
1. Conectar UI do Studio à API CRUD autenticada (/api/content).
2. Migrar de localStorage para Supabase de forma segura (sem perda/duplicação).
3. Validar RLS na tabela content_items.
4. Testes de CRUD por workspace.

**Aceite:** rascunhos persistidos no banco, isolados por tenant, UI e API integrados.

### Fase 3 — Biblioteca de mídia e direitos
1. Definir Storage Supabase e permissões.
2. Upload seguro de mídia.
3. Registro de direitos, licenças e confirmação de autorização.
4. Integração com Content Studio.

**Aceite:** mídia associada a conteúdo com trilha de direitos.

### Fase 4 — Editor de vídeo (escopo técnico)
1. Projetar timeline, cortes, trilhas, legendas, templates, renderização e exportação.
2. Definir limites de formatos e duração.
3. Manter separação entre edição, aprovação e publicação.

**Aceite:** escopo técnico e protótipo validado antes de desenvolvimento pesado.

### Fase 5 — Conexões sociais e publicação
1. Inventariar perfis e permissões (Metricool etc.).
2. Revalidar analytics (Supermetrics).
3. Definir integrações oficiais por canal (OAuth, scopes).
4. Fila de publicação com retries limitados e idempotência.
5. Validação de versão exata aprovada + direitos + disclosure.
6. Publicação real somente após aprovação explícita.

**Aceite:** fluxo testado em ambiente permitido; nenhuma publicação real sem OK do Owner.

### Fase 6 — Inteligência e catálogo de produtos
1. Fontes oficiais e permitidas.
2. Padronizar produto, variante, preço, disponibilidade e origem.
3. Evidências, histórico e scoring explicável.
4. Separar oportunidade de afiliado de venda própria.

**Aceite:** toda recomendação com fonte, timestamp e justificativa auditável.

### Fase 7 — Integrações financeiras
1. Conectores oficiais (Meta Ads, Google Ads, GA4, Mercado Livre, TikTok Shop, Shopify, Shopee, Amazon etc.).
2. Normalizar pedidos, pagamentos, taxas, estornos e comissões.
3. Separar os três domínios: mídia (custo), vendas próprias e afiliados.
4. Ledger e conciliação.
5. Relatórios por período e origem.

**Aceite:** totais conciliáveis com plataformas originais + trilha de auditoria.

### Fase 8 — Agentes e automações
1. Planner → Executor → Verifier.
2. Allowlist de ferramentas.
3. Permissões por papel e workspace.
4. Limites de custo, frequência e volume.
5. Logs, avaliações, aprovação humana e kill switch.
6. Começar com leitura/análise antes de escrita/publicação.

**Aceite:** agentes não executam ações fora de escopo; ações sensíveis rastreáveis.

### Fase 9 — Operação, observabilidade e produção
1. Logs estruturados e correlação.
2. Alertas e monitoramento.
3. Backups e teste de restauração.
4. Segurança e testes de regressão.
5. Preview por PR e checklist de release.
6. Aprovação explícita antes de qualquer deploy de produção.

**Aceite:** checklist de release completo, rollback conhecido e autorização do Owner.

## Prioridade atual
Priorizar Fase 0 (auditoria) → Fase 1 (fundação) → Fase 2 (persistência do Content Studio). Integrações externas e agentes só depois da fundação estável.

