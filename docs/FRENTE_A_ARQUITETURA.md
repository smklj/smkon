# Frente A — Arquitetura e Fundação

**Escopo oficial:** S4 e pendências de S5/S6  
**Responsabilidade:** arquitetura, fundação técnica, tenancy, autorização e infraestrutura transversal.  
**Estado do documento:** baseline de trabalho; status deve ser revalidado no GitHub, Supabase e Vercel antes de cada execução.

## 1. Objetivo

Manter uma fundação coerente, segura e evolutiva para os módulos do SMKON. A Frente A define contratos e padrões que as Frentes B e C devem consumir, sem duplicar regras de domínio nem criar caminhos paralelos de autenticação, autorização ou persistência.

## 2. Escopo

### S4 — Arquitetura por domínio
- Organizar módulos em camadas de schema/validação, service e repository.
- Padronizar validação de entrada e saída.
- Manter tipos do Supabase gerados e alinhados com migrations reconciliadas.
- Atualizar toolchain de lint e qualidade sem upgrades breaking não avaliados.
- Definir convenções para erros, transações, autorização e acesso ao banco.
- Evitar dependência circular e acesso direto ao Supabase a partir de componentes de UI.

### S5 — Tenancy e RBAC
O fluxo de convites está documentado como entregue. Permanecem no escopo de acompanhamento:
- S5.1: listar membros, alterar papéis e remover membros;
- proteger o último Owner;
- seletor de organização/workspace;
- RBAC centralizado e consistente entre páginas, APIs, RPCs e jobs;
- migration `20261119070000` com aplicação remota a confirmar/autorização pendente conforme roadmap de integração.

### S6 — Segurança e observabilidade
A fundação S6 está documentada como em produção. Pendências:
- S6.1: CSP com nonce e sink de logs já implementados na branch de integração/PR #45, conforme handoff;
- destino externo de logs aguarda decisão do Owner;
- revalidar HSTS, rate limiting, logs estruturados, correlação de requisições e ausência de dados sensíveis;
- confirmar que os controles são aplicados em todos os caminhos server-side relevantes.

## 3. Entregáveis

1. Mapa atualizado dos módulos e dependências.
2. Padrão de schema/service/repository com exemplos reais.
3. Matriz de autorização por papel, tenant, rota, RPC e job.
4. Tipos Supabase reconciliados com o schema aprovado.
5. Relatório de CSP, headers, rate limit e observabilidade.
6. Plano de migração e rollback para cada alteração de banco.
7. Testes automatizados de isolamento multi-tenant e controle de acesso.

## 4. Critérios de aceite

- [ ] Módulos novos seguem o padrão de domínio definido.
- [ ] Validação server-side cobre todos os inputs externos.
- [ ] Não há acesso cross-tenant em rotas, repositories, RPCs ou jobs.
- [ ] Último Owner não pode ser removido/rebaixado acidentalmente.
- [ ] RBAC tem testes positivos e negativos para cada papel relevante.
- [ ] Tipos gerados correspondem ao schema realmente aplicado no ambiente-alvo.
- [ ] CSP usa nonce corretamente e não quebra recursos legítimos.
- [ ] Logs têm correlação, retenção e redaction definidos.
- [ ] CI passa no commit candidato.
- [ ] Nenhuma migration remota ou mudança de produção ocorre sem autorização explícita.

## 5. Dependências e contratos com outras frentes

- **Frente B — Operação financeira:** fornece tenancy, contexto autenticado, RBAC, repositories, tipos e trilha de auditoria. Não define estados contábeis nem regras de conciliação.
- **Frente C — Inteligência e integrações:** fornece limites de execução, isolamento, secrets, logs, filas e contratos de integração. Não implementa lógica específica de provedores financeiros.
- Toda mudança em contratos compartilhados deve ser comunicada às outras frentes antes de integrar.

## 6. Fora do escopo

- Implementação do ciclo de comissão S8 e conector financeiro S11 (Frente B).
- Executor S14 e Integration Hub S17/S18/S19 (Frente C).
- Promoção de produção, alteração de secrets, DNS, grants ou migrations remotas sem aprovação do Owner.

## 7. Riscos prioritários

- Divergência entre migrations do Git, staging e produção.
- Branches de integração divergentes de `main`.
- Tipos gerados desatualizados.
- Regras de autorização duplicadas ou inconsistentes.
- CSP/logging incompletos ou excessivamente permissivos.
- Mudanças transversais que quebrem S8, S11 ou o Executor.

## 8. Fluxo de trabalho

1. Auditar código, branches, PRs, migrations e estado remoto.
2. Definir contrato e arquivos afetados antes de alterar.
3. Implementar em branch isolada e commits pequenos.
4. Executar testes unitários, SQL, typecheck, lint e build.
5. Validar isolamento e regressões dos módulos consumidores.
6. Abrir PR e documentar riscos, evidências e pendências.
7. Não fazer merge em `main`, aplicar migrations remotas ou publicar produção sem autorização.

## 9. Fontes internas

- `docs/ROADMAP_SPLITS.md`
- `docs/S5_HANDOFF.md`
- `docs/S5_1_HANDOFF.md`
- `docs/S6_HANDOFF.md`
- `docs/S6_1_HANDOFF.md`
- `docs/PRODUCTION_READINESS.md` (quando presente na branch de integração)

**Status geral:** S4 e pendências S5/S6 constituem o escopo da Frente A. Este documento não declara S4 concluído; os critérios acima precisam ser comprovados no código e CI atuais.
