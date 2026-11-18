# SMKON — Matriz de Status Atual

**Data de referência:** 18/11/2026  
**Baseado em:** docs/SMKON_MASTER_DOSSIER_ANTIGRAVITY.md (versão 1.0 de 18/11/2026)  
**Branch de referência:** feature/admin-dashboard-mvp  
**Classificação:** feito / parcial / planejado / a validar

## Regras de identidade e proibições (explícitas)

### Identidade operacional exclusiva
- **Somente** `smkonlj@gmail.com` / GitHub `smklj`.
- Repositório oficial: `smklj/smkon`.
- Não misturar com conta pessoal ou identidades de outros projetos (NEXO, BMI9 etc.).
- Confirmar identidade/organização em cada serviço (GitHub, Supabase, Vercel) antes de qualquer ação.
- Não usar conta pessoal como fallback.

### Proibições absolutas (sem autorização explícita do Owner)
- **Sem merge em main**.
- **Sem migration host** (não aplicar migrations no Supabase hospedado).
- **Sem deploy** (especialmente produção; Preview somente se autorizado).
- **Sem publicar** (nenhuma publicação em perfis reais de redes sociais).
- Sem gastos, campanhas pagas, compras, assinaturas, contratações ou transferências.
- Sem conectar contas que não pertençam à identidade SMKON.
- Sem compartilhar dados entre SMKON e outros projetos.
- Secrets nunca no Git, frontend, logs ou documentação.

Estas regras prevalecem sobre qualquer outra instrução. Trabalho permitido: auditoria, testes locais, branches de feature, PRs, documentação e implementação em ambiente local/Preview autorizado.

## Matriz de status (conforme dossiê mestre)

| Área / Item | Status | Observações / Próxima ação |
|---|---|---|
| Identidade SMKON (smkonlj@gmail.com / smklj) | feito | Definida e documentada. Confirmar em cada serviço. |
| Repositório GitHub (smklj/smkon) | feito | Existe, com branches e PRs. Revisar CI atual. |
| Control Center (interface inicial) | parcial | Fundação presente. Link para Admin adicionado. |
| Admin Dashboard (/admin) | parcial | Nova rota de leitura: 8 áreas + 3 domínios + listagem /api/content + placeholders Metricool/Instagram/TikTok. Componentes reutilizam estilos existentes. |
| Oito áreas operacionais | parcial | Visualizadas no dashboard (leitura). Ainda sem dados vivos. |
| Três domínios financeiros | parcial | Exibidos no dashboard. Separação documentada. |
| Auth Supabase (login/signup/PKCE/SSR) | parcial | Fundação no código. A validar com teste E2E. |
| Multi-tenant / RLS | parcial | Migrations e políticas versionadas. A validar isolamento real. |
| Content Studio UI (MVP) | parcial | Implementado (briefing, rascunhos, filtros, prévia). Persistência local. |
| Content Studio API (/api/content CRUD) | parcial | Criada e autenticada. Consumida em leitura no /admin (com fallback de auth). |
| Persistência do Studio | parcial | Ainda em localStorage. Integrar à API (Fase 2). |
| Migration content_items | parcial | Versionada no Git. Não aplicar em host sem autorização. |
| Biblioteca de mídia | planejado | Não pronta. Definir Storage e permissões. |
| Editor de vídeo timeline | planejado | Não pronto. Escopo técnico em fase própria. |
| OAuth redes sociais / publicação | planejado | Não concluído. Mapear escopos; publicação só após aprovação. |
| Agendamento / publicação | planejado | Não validado. Implementar fila + idempotência. |
| Analytics (Metricool/Supermetrics) | a validar | Snapshots históricos. Revalidar contas e dados. |
| Financeiro real (integrações) | planejado | Não integrado ponta a ponta. APIs e conciliação. |
| Agentes IA | planejado | Arquitetura proposta (Scout, Analyst etc.). Implementar com limites. |
| Observabilidade / backup | planejado | Pendente. Definir alertas, logs e restore. |
| Deploy produção / Vercel | a validar | Não presumir concluído. Verificar vínculo; sem deploy sem OK. |
| CI (typecheck/lint/build) | a validar | Workflow existe. Confirmar status dos checks nos PRs. |
| PRs (#1, #2, #3) | parcial | Abertos/draft. Não mesclados. Verificar estado atual. |

## Próximos passos prioritários
1. Completar Fase 0 (auditoria completa com evidências).
2. Estabilizar fundação (Auth + RLS multi-tenant).
3. Integrar Content Studio UI → API (sair do localStorage).
4. Expandir Admin Dashboard com dados reais quando Auth/RLS estiverem validados.
5. Manter todas as proibições acima.

**Nota:** Status "feito" significa registrado/documentado ou implementado no código da branch. Não implica validação ponta a ponta ou operação em produção. Sempre revalidar.

