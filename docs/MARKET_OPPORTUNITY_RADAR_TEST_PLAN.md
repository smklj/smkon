# Market Opportunity Radar — Plano de Testes

**Branch:** `feature/market-opportunity-radar-spec`  
**Status:** plano de testes; ainda não executado  
**Escopo:** primeira entrega do Radar, comparação dos segmentos MEI/serviços locais, beleza/estética e IA para pequenos negócios.

> Este arquivo define cenários esperados. Não afirma que os testes foram implementados ou executados.

## 1. Estratégia

Pirâmide proposta:
- Unitários: scoring, cobertura, elegibilidade, normalização e regras de estado.
- Integração: serviços, repositórios, transações e autorização.
- Banco: constraints, RLS, FK tenant-scoped, append-only e auditoria.
- API: validação, autenticação, autorização, paginação e erros.
- E2E: fluxos de pesquisa, coleta, revisão, comparação, decisão e exportação.
- Regressão: Product Intelligence atual, workspace, navegação, Content Studio e Financeiro.

Testes devem rodar em ambiente local/CI isolado, nunca contra produção. Fixtures não podem ser confundidas com dados reais.

## 2. Fixtures mínimas

Criar fixtures determinísticas para:
- organização A com owner, admin, analyst e viewer;
- organização B com owner independente;
- pesquisa contendo os três segmentos-piloto;
- fontes primárias, secundárias, anedóticas e URLs inválidas;
- evidências verificadas, pendentes, rejeitadas, expiradas e conflitantes;
- concorrentes com preços em BRL e moedas diferentes;
- oportunidades em todos os estados;
- versões diferentes do algoritmo de score.

Toda fixture deve usar dados sintéticos, URLs reservadas para testes ou mocks. Não acessar redes externas.

## 3. Testes unitários

### 3.1 Scoring

| ID | Cenário | Resultado esperado |
|---|---|---|
| U-SCORE-01 | Todas as dimensões com evidência elegível | Score ponderado reproduzível |
| U-SCORE-02 | Cobertura abaixo de 50% | Score null/indisponível |
| U-SCORE-03 | Cobertura exatamente 50% | Score sinalizado como baixa cobertura; não aprovável |
| U-SCORE-04 | Cobertura entre 50% e 69,99% | Não aprovável |
| U-SCORE-05 | Cobertura exatamente 70% | Pode ser comparado, ainda requer decisão humana |
| U-SCORE-06 | Evidência rejeitada | Não contribui para score nem cobertura |
| U-SCORE-07 | Evidência pendente | Não contribui para score |
| U-SCORE-08 | Evidência expirada | Não pontua segundo a versão metodológica |
| U-SCORE-09 | Evidência anedótica apresentada como estatística | Validação rejeita classificação indevida |
| U-SCORE-10 | Alteração de pesos | Gera nova scoring_version; snapshot anterior permanece igual |
| U-SCORE-11 | Score com risco elevado | Risco é visível e não fica oculto pela média |
| U-SCORE-12 | Mesma entrada e versão | Resultado idêntico (determinismo) |

### 3.2 Normalização e validação

| ID | Cenário | Resultado esperado |
|---|---|---|
| U-NORM-01 | URL HTTPS válida | Aceita |
| U-NORM-02 | URL HTTP, javascript:, data:, file: | Rejeita |
| U-NORM-03 | URL com userinfo/credenciais | Rejeita ou exige sanitização sem persistir segredo |
| U-NORM-04 | Claim vazio ou acima do limite | Rejeita |
| U-NORM-05 | Valor sem unidade quando dimensão exige unidade | Rejeita |
| U-NORM-06 | Amostra negativa | Rejeita |
| U-NORM-07 | Data de observação futura além da tolerância | Rejeita |
| U-NORM-08 | Moeda desconhecida | Rejeita |
| U-NORM-09 | Fonte duplicada pela chave de deduplicação definida | Retorna conflito controlado ou reutiliza fonte |
| U-NORM-10 | Evidência com segmento de outra pesquisa | Rejeita |

### 3.3 Máquina de estados

- Pesquisa: draft → collecting → reviewing → completed → archived.
- Evidência: pending → verified ou rejected; revisão não pode ser repetida sem fluxo explícito de correção.
- Oportunidade: hypothesis → validating → shortlisted → approved/rejected; archived permitido conforme política.
- Transições inválidas retornam erro de domínio e não deixam alteração parcial.

## 4. Testes de integração

| ID | Cenário | Resultado esperado |
|---|---|---|
| I-01 | Criar pesquisa e segmentos iniciais | Pesquisa e três segmentos criados atomicamente |
| I-02 | Falha ao criar um segmento | Rollback da operação inteira |
| I-03 | Adicionar fonte e evidência | Evidência vinculada ao segmento e fonte corretos |
| I-04 | Revisar evidência como owner | Estado atualizado e auditoria criada |
| I-05 | Revisar evidência como analyst | 403/forbidden |
| I-06 | Recalcular score | Snapshot versionado e determinístico |
| I-07 | Aprovar oportunidade com cobertura baixa | Bloqueio |
| I-08 | Aprovar oportunidade com cobertura suficiente | Decisão humana registrada |
| I-09 | Exportar relatório | Inclui metodologia, fontes, limitações e timestamp |
| I-10 | Repetir decisão com idempotency key | Não cria eventos duplicados |
| I-11 | Simular erro de exportação | Erro controlado; pesquisa permanece íntegra |
| I-12 | Dados de segmentos em moedas distintas | Não comparar/somar sem conversão explícita |

## 5. Testes de banco e RLS

Executar em Postgres local/CI.

- [ ] RLS habilitado em todas as tabelas novas no schema exposto.
- [ ] Usuário anônimo não lê nem escreve.
- [ ] Membro da organização A não acessa dados da organização B.
- [ ] Viewer lê, mas não cria/edita/revisa/aprova.
- [ ] Analyst registra evidência, mas não revisa nem aprova.
- [ ] Admin pode revisar e aprovar segundo a matriz de papéis.
- [ ] Owner pode executar todas as operações permitidas.
- [ ] FK composta impede associar evidência/concorrente/oportunidade a segmento de outro tenant.
- [ ] Score e breakdown não podem ser alterados pelo cliente.
- [ ] Evidência revisada não pode ter claim, URL, valor ou data alterados.
- [ ] Eventos de decisão são append-only.
- [ ] UPDATE tem policy SELECT e USING + WITH CHECK coerentes.
- [ ] Views usam security_invoker ou ficam inacessíveis a papéis públicos.
- [ ] Funções privilegiadas têm grants mínimos e não são SECURITY DEFINER sem justificativa.
- [ ] Índices cobrem filtros por tenant, pesquisa, segmento, status e data.
- [ ] Auditoria registra ator, ação, entidade e timestamp sem payload sensível.

## 6. Testes de API

- Sem sessão: 401.
- Sessão sem workspace: resposta de domínio consistente, sem criação silenciosa de workspace.
- Workspace inexistente/ID de outra organização: não vaza existência.
- Payload inválido: 400 com código estável.
- Papel insuficiente: 403.
- UUID inexistente: 404 ou resposta uniforme definida pelo padrão do app.
- Payload acima do limite: rejeitado.
- Paginação: sem duplicação nem perda em páginas consecutivas.
- Rate limit: resposta controlada e Retry-After quando aplicável.
- Erro do banco: resposta genérica sem SQL, stack ou segredo.
- Todas as rotas mutáveis: auditadas e idempotentes onde necessário.

## 7. Testes E2E

### E2E-01 — comparação inicial
1. Owner cria pesquisa “Comparação de mercados — piloto 01”.
2. Sistema apresenta os três segmentos definidos.
3. Usuário abre cada segmento.
4. Estado vazio informa que ainda faltam fontes e observações.
5. Nenhum segmento aparece como vencedor sem evidência.

### E2E-02 — coleta e revisão
1. Analyst adiciona fonte e duas evidências.
2. Evidências aparecem como pendentes.
3. Analyst não vê ação de revisão.
4. Owner verifica uma e rejeita outra.
5. Score recalcula somente com a verificada.

### E2E-03 — cobertura insuficiente
1. Pesquisa possui fontes, mas evidências em poucas dimensões.
2. Comparação mostra score indisponível ou baixa cobertura.
3. Aprovação é bloqueada.
4. UI lista dimensões faltantes.

### E2E-04 — oportunidade e decisão
1. Owner cria oportunidade a partir de segmento.
2. Define hipótese, modelo híbrido e experimento.
3. Aprova depois de satisfazer cobertura e critérios.
4. Histórico registra ator, decisão, nota e snapshot do score.
5. Nenhuma campanha, compra ou publicação é iniciada.

### E2E-05 — isolamento multi-tenant
1. Usuário A cria pesquisa na organização A.
2. Usuário B tenta acessar IDs de A.
3. API retorna resposta de acesso negado/não encontrado sem revelar dados.
4. UI não apresenta nome, score ou fontes da organização A.

### E2E-06 — exportação
1. Owner exporta pesquisa.
2. Arquivo contém as três comparações, fontes, observações, limitações, pesos, score e versão.
3. Dados pessoais não aparecem.
4. Download não cria link público.

## 8. Regressão obrigatória

- Product catalog: listar, criar, atualizar estado e arquivar.
- Product evidence: criar, revisar, rejeitar e score existente.
- Workspace lookup e papéis.
- Navegação e layout responsivo.
- Content Studio e versionamento.
- Calendário em dry-run.
- Financeiro: separar afiliado, venda própria e mídia paga.
- Agentes: Radar não concede ferramentas de publicação nem altera allowlist sem revisão separada.

## 9. Testes de performance e robustez

Metas iniciais para ambiente local/CI, a revisar com dados reais:
- Comparação de até 10 segmentos e 2.000 evidências em p95 < 1,5 s sem fontes externas.
- Listagem paginada em p95 < 500 ms sob dataset de teste.
- Score calculado em memória sem consultas N+1.
- Exportação de relatório de até 2.000 evidências em p95 < 5 s.
- Paginação cursor-based.
- Consultas sempre indexadas por organization_id.
- Timeouts e retries somente para operações externas futuras.
- Nenhuma dependência de rede para unitários, integração ou E2E.

## 10. Gate de release (não autorizado nesta fase)

A entrega não pode ser considerada pronta para release até:
- testes unitários, integração, banco, API e E2E aprovados;
- revisão de RLS e grants;
- reconciliação de migrations main/staging/produção;
- verificação de build, lint e typecheck;
- revisão de acessibilidade e responsividade;
- validação manual do comparativo e das evidências;
- aprovação explícita para migration remota, merge ou deploy em etapa separada.

## 11. Registro de execução

| Suíte | Estado atual | Evidência |
|---|---|---|
| Unitários | Não implementados | — |
| Integração | Não implementados | — |
| Banco/RLS | Não implementados | — |
| API | Não implementados | — |
| E2E | Não implementados | — |
| Performance | Não implementados | — |
| Regressão | Não executada | — |
