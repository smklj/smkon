# Frente C — Inteligência e Integrações

**Escopo oficial:** S14, S17, S18 e S19  
**Responsabilidade:** agentes e execução controlada, hub de integrações, webhooks e conexões/publicação em canais externos.  
**Estado do documento:** baseline de trabalho; status deve ser revalidado antes de cada alteração.

## 1. Objetivo

Implementar automações e integrações externas confiáveis, auditáveis e reversíveis. A IA deve propor e executar somente ferramentas explicitamente permitidas, sob limites de custo, permissões, aprovação humana e verificação posterior. Integrações externas devem ser idempotentes, observar contratos oficiais e falhar de modo seguro.

## 2. Escopo

### S14 — Executor de IA

Arquitetura: Planner → Executor → Verifier, apoiada pela fundação de jobs S13.

Requisitos:
- allowlist de ferramentas e validação estrita de argumentos;
- limites de orçamento, timeout, tentativas e concorrência;
- kill switch efetivo e fail-closed;
- trilha de execução com run, steps, resultado e verificação;
- geração de conteúdo com evidências obrigatórias;
- ações externas somente após aprovação humana da versão exata;
- publicação somente por APIs oficiais, com hash aprovado e auditoria.

**Estado de referência:** S13 está documentado como base em produção. S14 tem executor implementado na branch de integração e PR #71 aberto Draft no registro mais recente disponível. O candidato isolado `release/s14-mainline-integration-20261121` foi criado a partir de `main` para integração controlada, mas precisa de reconciliação e validação. Não considerar S14 integrado em `main` ou pronto para produção. Há bloqueios registrados envolvendo configuração server-side, orçamento/créditos do AI Gateway, validação ponta a ponta e reconciliação de migrations. O executor não deve ser habilitado em produção sem critérios de segurança e autorização.

### S17 — Integration Hub

Objetivo:
- centralizar contas/conexões e ações externas;
- modelar providers e capabilities sem acoplar o domínio aos payloads específicos;
- registrar pedidos de ação com hash imutável do payload;
- exigir aprovação conforme risco e escopo;
- manter auditoria, idempotência e estado de execução;
- separar credenciais, metadados e eventos.

**Estado de referência:** PR #70 foi registrado como aberto, com migration `20261121180000_integration_hub.sql` não aplicada em staging nem produção. A migration exige revisão e autorização antes de qualquer aplicação remota.

### S18 — Hotmart

Objetivo:
- receber webhooks oficiais;
- validar assinatura/autenticidade conforme documentação vigente;
- proteger contra replay e duplicação;
- normalizar eventos de vendas, comissões, cancelamentos e reembolsos;
- registrar payload mínimo necessário, hash, origem e timestamps;
- encaminhar eventos para os domínios corretos sem criar lançamentos duplicados.

Critérios:
- assinatura inválida é rejeitada;
- evento repetido é idempotente;
- eventos fora de ordem seguem máquina de estados explícita;
- PII e segredos são removidos de logs;
- falhas transitórias têm retry limitado e observável;
- nenhum evento altera financeiro sem validação do domínio e autorização adequada.

**Estado:** planejado/follow-up; não declarar webhook operacional sem testes ponta a ponta.

### S19 — Conexões e publicação em redes sociais

Objetivo:
- conectar contas sociais via OAuth oficial e scopes mínimos;
- armazenar tokens de forma segura e server-side;
- suportar desconexão/revogação e renovação;
- criar adapters por plataforma;
- preparar mídia, formatos e metadados;
- submeter publicação à aprovação humana da versão exata;
- agendar/publicar com idempotência, rate limits e logs;
- reconciliar status e métricas após publicação.

**Estado:** planejado no escopo desta frente; não declarar canais conectados ou publicação funcional sem validação de cada plataforma.

## 3. Entregáveis

1. S14 com execução controlada, verificável e limites comprovados.
2. S17 como hub de conexões e ações externas com payload hash e aprovação.
3. S18 webhook Hotmart com validação de assinatura, replay protection e idempotência.
4. S19 modelo de contas sociais, OAuth, adapters, fila e aprovação de publicação.
5. Matriz de permissões/capabilities por provider.
6. Observabilidade de erros, retries, custos, latência e estados.
7. Testes de segurança, replay, concorrência e falha parcial.

## 4. Critérios de aceite

### S14
- [ ] Ferramentas fora da allowlist são recusadas.
- [ ] Argumentos inválidos não chegam ao executor.
- [ ] Timeout, budget e kill switch são aplicados no servidor.
- [ ] Verifier registra evidência do resultado e falhas.
- [ ] Retry não duplica efeitos externos.
- [ ] Ação de escrita exige aprovação humana da versão/hash exata.
- [ ] Custo real e uso são contabilizados de forma conservadora.
- [ ] E2E controlado em staging comprova o ciclo completo.

### S17
- [ ] Conexões isoladas por workspace e provider.
- [ ] Segredos não são expostos a browser roles.
- [ ] Payload hash é imutável e vinculado à aprovação.
- [ ] Ações têm idempotency key e trilha de auditoria.
- [ ] Revogação/desconexão bloqueia novas ações.
- [ ] Migration e RLS testadas em staging antes de qualquer produção.

### S18
- [ ] Assinatura é validada de acordo com o contrato oficial da Hotmart.
- [ ] Replay e duplicatas não geram eventos/lançamentos repetidos.
- [ ] Eventos inválidos ou fora de ordem são tratados explicitamente.
- [ ] Logs não contêm secrets ou PII desnecessária.
- [ ] Testes cobrem assinatura inválida, duplicata, timeout e retry.

### S19
- [ ] OAuth usa state one-time e scopes mínimos.
- [ ] Tokens cifrados e acessíveis apenas server-side.
- [ ] Cada plataforma tem adapter e validação de formatos próprios.
- [ ] Publicação exige aprovação da versão exata.
- [ ] Agendamento e retries são idempotentes.
- [ ] Status final é reconciliado com a API da plataforma.
- [ ] Nenhuma publicação real sem aprovação do Owner.

## 5. Contratos com outras frentes

- **Frente A:** depende de Auth, tenancy, RBAC, RLS, secrets, logs, rate limit e padrões de domínio. Não implementa autorização paralela.
- **Frente B:** S17/S18 podem transportar eventos financeiros, mas não definem nem alteram por conta própria o ledger, estados de comissão ou regras de conciliação. Eventos financeiros devem ser entregues ao contrato da Frente B.
- Toda integração deve publicar um contrato versionado de eventos e capabilities; alterações incompatíveis exigem coordenação prévia.

## 6. Fora do escopo

- Máquina de estados contábil S8 e conector Mercado Livre S11 (Frente B).
- Fundação geral de tenancy/RBAC S4/S5 e observabilidade transversal S6 (Frente A).
- Alterar produção, conectar contas reais, criar secrets, aplicar migrations remotas, publicar conteúdo ou gerar gastos sem autorização explícita.

## 7. Riscos prioritários

- Executor executar ação não aprovada ou fora do orçamento.
- Webhook falsificado, replay ou evento duplicado.
- Tokens OAuth vazarem ou refresh concorrente invalidar credenciais.
- API externa mudar contrato ou impor rate limit.
- Aprovação não corresponder ao payload efetivamente enviado.
- Eventos financeiros serem contabilizados em duplicidade entre S18 e S8/S11.
- Branch de integração divergente ser promovida integralmente sem reconciliação.

## 8. Plano de execução

1. Fechar a reconciliação S14 em branch isolada baseada em `main`; revisar PRs, migrations e contratos.
2. Validar S14 com CI, testes SQL/unitários e E2E controlado em staging.
3. Revisar S17/PR #70, migration, RLS, grants, payload hash e contrato de eventos.
4. Implementar S18 depois de confirmar a especificação oficial de assinatura e eventos da Hotmart.
5. Definir S19 por plataforma, começando por OAuth/read-only e avançando para publicação apenas após aprovação e testes.
6. Atualizar handoffs e roadmap com status comprovado.
7. Solicitar autorização antes de qualquer operação sensível ou de produção.

## 9. Fontes internas

- `docs/S13_HANDOFF.md`
- `docs/S14_HANDOFF.md`
- PR #70 — Integration Hub
- PR #71 — S14 timeout e contabilização do AI Gateway
- `docs/ROADMAP_SPLITS.md`
- Migrations S14 e S17 em `supabase/migrations/`

**Status geral:** S14 em integração/reconciliação; S17 em PR e migration não aplicada; S18 e S19 planejados. Nenhum desses estados deve ser promovido a “produção pronta” sem evidência atualizada.
