# Market Opportunity Radar — Especificação Técnica

**Projeto:** SMKON  
**Entrega:** Radar (primeiro módulo comercial)  
**Branch:** `feature/market-opportunity-radar-spec`  
**Status:** especificação para revisão; não implementada  
**Mercado-piloto:** comparação de três segmentos — (A) MEI de serviços e negócios locais, (B) beleza/estética/serviços pessoais, (C) IA aplicada a pequenos negócios  
**Modelo comercial:** híbrido (afiliados + produtos próprios)  
**Aquisição:** multichannel  
**Orçamento de validação:** teto de R$ 300, sem compromisso de gasto  
**Restrições desta entrega:** documentação e desenho apenas. Não criar/aplicar migrations, não alterar Supabase hospedado, não conectar contas externas, não executar pesquisa paga, não publicar, não disparar campanhas e não fazer deploy.

---

## 1. Resumo executivo

O Market Opportunity Radar (MOR) é o módulo de inteligência comercial do SMKON para transformar sinais de mercado em oportunidades rastreáveis e revisáveis. Ele compara nichos, registra fontes e observações, identifica concorrentes e ofertas, estima a adequação comercial e apresenta uma recomendação explicável.

A primeira execução compara três segmentos sem presumir vencedor:

1. **MEI de serviços e negócios locais:** gestão, precificação, fluxo de caixa, atendimento e aquisição de clientes.
2. **Beleza, estética e serviços pessoais:** operação de profissionais autônomos, agenda, recorrência, precificação, relacionamento e conteúdo.
3. **IA aplicada a pequenos negócios:** automação acessível de tarefas de marketing, atendimento, organização e produtividade.

O Radar não é um motor de previsão de receita. É um sistema de apoio à decisão que explicita evidência, qualidade, lacunas, hipóteses e confiança. Nenhum score deve ser apresentado como dado de mercado observado.

### Resultado esperado da primeira entrega

- Criar uma pesquisa comparativa com os três segmentos.
- Guardar fontes, claims, datas, método e qualidade de evidência.
- Separar dados observados, estimativas e hipóteses.
- Comparar demanda, dor, disposição a pagar, concorrência, margem, aquisição, recorrência e risco.
- Registrar produtos/afiliados candidatos e produtos próprios hipotéticos.
- Gerar ranking explicável, sem decisão automática.
- Exigir aprovação humana para promover uma oportunidade a plano comercial.

## 2. Objetivos e não objetivos

### Objetivos

- Fornecer uma visão comparável e auditável de oportunidades.
- Reutilizar o catálogo `products` e o fluxo `product_evidence` quando a entidade representar um produto/offer real.
- Manter a pesquisa em nível de workspace/organization.
- Suportar coleta manual no MVP e conectores oficiais em fases futuras.
- Permitir anexar múltiplas fontes a uma mesma afirmação e registrar divergências.
- Versionar critérios e pesos para que mudanças no score não reescrevam decisões históricas.
- Facilitar exportação de um relatório de decisão sem publicar ou enviar automaticamente.

### Fora de escopo do MVP

- Scraping de páginas que proíbam ou limitem automação.
- Compra de bases, assinaturas, anúncios ou ferramentas.
- Acesso automatizado a contas sociais, marketplaces ou plataformas de afiliados.
- Previsão de vendas, lucro, TAM/SAM/SOM sem metodologia e fontes.
- Publicação automática, checkout, processamento de pagamento ou envio de mensagens.
- CRM completo, automação de prospecção e enriquecimento de dados pessoais.
- Treinamento de modelo próprio.
- Qualquer uso de dados pessoais sensíveis.

## 3. Personas e permissões

Usar os papéis já existentes em `organization_members`:

| Papel | Ler pesquisas | Criar/editar pesquisa | Registrar evidência | Revisar evidência | Aprovar oportunidade |
|---|---:|---:|---:|---:|---:|
| owner | Sim | Sim | Sim | Sim | Sim |
| admin | Sim | Sim | Sim | Sim | Sim |
| analyst | Sim | Sim | Sim | Não | Não |
| viewer | Sim | Não | Não | Não | Não |

Toda operação deve obter o usuário por `supabase.auth.getUser()`, resolver workspace por `findWorkspace` e aplicar autorização no servidor. Não confiar em role enviado pelo cliente nem em `user_metadata`. RLS é defesa adicional, não substituto da autorização da aplicação.

## 4. Arquitetura proposta

### 4.1 Componentes

1. **UI /app/mercado (ou /radar):** lista de pesquisas, comparação, detalhe de segmento, evidências, concorrentes, ofertas e decisões.
2. **Application layer:** serviços de domínio para criar pesquisa, registrar fonte, revisar evidência, calcular score e aprovar oportunidade.
3. **Source adapters:** no MVP, entrada manual e importação de arquivo estruturado. Futuramente, conectores oficiais e APIs permitidas.
4. **Evidence registry:** persistência append-only de observações, URL, data, método, claim, valor/unidade e revisão.
5. **Scoring engine:** cálculo determinístico e versionado, executado no servidor; retorna score, componentes, justificativas e lacunas.
6. **Decision workflow:** estados de pesquisa e oportunidade, aprovação humana, histórico e trilha de auditoria.
7. **Reporting:** relatório comparativo exportável; nenhuma publicação externa.

### 4.2 Fluxo lógico

```text
Pesquisa criada
   |
   +--> Segmentos (3 hipóteses iniciais)
           |
           +--> Fontes e observações
           |       |
           |       +--> validação de URL / data / método
           |       +--> evidência pendente
           |       +--> revisão humana
           |
           +--> Concorrentes e ofertas
           |
           +--> Entrevistas / sinais primários
           |
           +--> Score versionado + lacunas
                   |
                   +--> Comparativo
                           |
                           +--> Aprovação humana
                                   |
                                   +--> Brief comercial (fora do MVP de publicação)
```

### 4.3 Padrões técnicos

- Next.js App Router e TypeScript, seguindo os padrões existentes no repositório.
- Supabase/Postgres como persistência multi-tenant.
- Server Components para leitura inicial; Route Handlers/Server Actions conforme convenção atual do projeto.
- Zod (ou o validador já padronizado no repositório) para validar payloads.
- Funções puras para normalização, cálculo e ranking.
- Sem chamada de LLM como autoridade de score. LLM pode futuramente resumir fontes e sugerir perguntas, sempre com citação e revisão humana.
- Sem dependência nova até confirmar necessidade e política de versões do projeto.
- Logs estruturados sem tokens, conteúdo sensível ou payloads completos de terceiros.

## 5. Modelo de domínio e dados proposto

**Importante:** este é um modelo lógico para revisão. Não é migration e não representa tabelas já existentes.

### 5.1 Entidades

#### `market_research_projects`

Uma pesquisa comparativa pertencente a uma organização.

| Campo | Tipo lógico | Regra |
|---|---|---|
| id | uuid | PK |
| organization_id | uuid | FK organizations |
| title | text | 3–160 caracteres |
| objective | text | 3–2000 caracteres |
| geography | text | padrão inicial: Brasil |
| currency | char(3) | BRL no piloto |
| status | enum/text | draft, collecting, reviewing, completed, archived |
| methodology_version | text | obrigatório |
| scoring_version | text | obrigatório |
| created_by | uuid | auth.users |
| created_at / updated_at | timestamptz | auditáveis |
| completed_at | timestamptz nullable | preenchido ao concluir |

#### `market_segments`

Segmentos comparados dentro de uma pesquisa.

| Campo | Tipo lógico | Regra |
|---|---|---|
| id | uuid | PK |
| organization_id | uuid | tenant |
| research_project_id | uuid | FK research |
| key | text | slug estável e único por pesquisa |
| name | text | nome legível |
| hypothesis | text | problema e público hipotéticos |
| target_persona | jsonb | perfil não sensível; sem PII |
| status | enum/text | proposed, researching, scored, shortlisted, rejected |
| score | numeric nullable | calculado, nunca editável pelo cliente |
| score_breakdown | jsonb | componentes, razões, lacunas |
| created_at / updated_at | timestamptz | auditáveis |

#### `market_sources`

Registro de uma fonte consultada, reutilizável dentro da pesquisa.

| Campo | Tipo lógico | Regra |
|---|---|---|
| id | uuid | PK |
| organization_id | uuid | tenant |
| research_project_id | uuid | FK |
| source_type | text | official_stats, marketplace, search_trend, competitor, interview, survey, report, other |
| title | text | obrigatório |
| publisher | text | obrigatório quando conhecido |
| canonical_url | text nullable | HTTPS; não aceitar javascript/data/file |
| published_at | timestamptz/date nullable | data da publicação |
| accessed_at | timestamptz | data/hora da consulta |
| geography | text nullable | escopo geográfico |
| methodology | text | como a informação foi obtida |
| reliability_tier | text | primary, authoritative_secondary, secondary, anecdotal |
| notes | text nullable | limite de tamanho |
| created_by | uuid | autoria |

#### `market_evidence`

Uma observação/afirmação individual apoiada por uma ou mais fontes.

| Campo | Tipo lógico | Regra |
|---|---|---|
| id | uuid | PK |
| organization_id | uuid | tenant |
| research_project_id | uuid | FK |
| segment_id | uuid | FK |
| source_id | uuid | FK source |
| dimension | text | demand, pain, willingness_to_pay, competition, margin, acquisition, retention, risk, regulation |
| claim | text | afirmação atômica e verificável |
| evidence_kind | text | statistic, price_observation, offer_observation, interview_quote, survey_result, policy, estimate |
| value | numeric nullable | somente quando aplicável |
| unit | text nullable | %, BRL, count, score, days etc. |
| sample_size | integer nullable | obrigatório para pesquisas amostrais quando conhecido |
| observed_at | timestamptz | data da observação |
| confidence | text | high, medium, low |
| limitation | text nullable | viés, cobertura e ressalvas |
| review_status | text | pending, verified, rejected |
| reviewed_by / reviewed_at | nullable | owner/admin |
| created_by | uuid | autoria |

Evidência não deve ser apagada nem sobrescrita depois da revisão. Correção deve ser feita por nova evidência ou evento de supersessão, preservando histórico.

#### `market_competitors`

| Campo | Tipo lógico | Regra |
|---|---|---|
| id | uuid | PK |
| organization_id | uuid | tenant |
| research_project_id | uuid | FK |
| segment_id | uuid | FK |
| name | text | obrigatório |
| website_url | text nullable | HTTPS |
| offer_summary | text | descrição objetiva |
| positioning | text nullable | proposta observada |
| observed_price_cents | bigint nullable | preço observado |
| currency | char(3) nullable | moeda |
| observed_at | timestamptz | obrigatório |
| source_id | uuid nullable | fonte de referência |

#### `market_opportunities`

Oportunidade comercial resultante da análise de um segmento.

| Campo | Tipo lógico | Regra |
|---|---|---|
| id | uuid | PK |
| organization_id | uuid | tenant |
| research_project_id | uuid | FK |
| segment_id | uuid | FK |
| title | text | obrigatório |
| problem_statement | text | dor e público |
| proposed_solution | text | hipótese de solução |
| business_model | text | affiliate, owned_product, hybrid |
| status | text | hypothesis, validating, shortlisted, approved, rejected, archived |
| score | numeric nullable | derivado |
| score_breakdown | jsonb | versão, pesos e componentes |
| validation_plan | jsonb | experimento e metas |
| decision_note | text nullable | justificativa humana |
| decided_by / decided_at | nullable | aprovação/rejeição |
| created_at / updated_at | timestamptz | auditáveis |

#### `market_decision_events`

Histórico append-only de mudanças de estado, score publicado e decisões humanas. Campos: id, organization_id, opportunity_id, actor_id, event_type, from_status, to_status, detail jsonb, occurred_at.

### 5.2 Relações

- Uma organização possui muitas pesquisas.
- Uma pesquisa possui três ou mais segmentos.
- Um segmento possui fontes, evidências, concorrentes e oportunidades.
- Uma fonte pode sustentar várias evidências.
- Uma oportunidade pertence a um segmento e mantém snapshots da versão de score/metodologia.
- Aprovações são eventos imutáveis.

### 5.3 Integridade e índices

- FK composta por `(id, organization_id)` nas relações entre entidades tenant-scoped para impedir cruzamento de organizações.
- Índices em `(organization_id, research_project_id, status)`, `(segment_id, dimension, observed_at desc)`, `(organization_id, status, score desc)` e FKs.
- Unicidade de slug/key por pesquisa.
- CHECKs para enums, tamanhos, intervalos e coerência de estado.
- `numeric` para score e valores monetários; não usar float para dinheiro.
- URL normalizada e HTTPS; bloquear esquemas não web.
- Toda tabela em schema exposto com RLS habilitado.
- SELECT limitado a membros do workspace.
- INSERT/UPDATE limitados aos papéis definidos; decisões somente owner/admin.
- Score e breakdown não podem ser escritos pelo browser.
- Views, se necessárias, devem usar `security_invoker = true` no Postgres 15+.
- Não criar SECURITY DEFINER sem necessidade documentada, revisão e grants explícitos.
- Não expor service_role no cliente.

## 6. Taxonomia de avaliação e score

### 6.1 Princípio

O score do Radar é uma **priorização interna**, não uma probabilidade de sucesso. A UI deve sempre mostrar componentes, fonte, recência, confiança e evidências faltantes.

### 6.2 Pesos iniciais propostos

| Dimensão | Peso |
|---|---:|
| Intensidade e frequência da dor | 20 |
| Evidência de demanda | 20 |
| Disposição a pagar / preço validado | 15 |
| Margem e viabilidade econômica | 15 |
| Facilidade de aquisição multichannel | 10 |
| Concorrência e diferenciação | 10 |
| Recorrência / potencial de retenção | 5 |
| Risco operacional, regulatório e de direitos | 5 |
| **Total** | **100** |

Risco deve ser pontuado como atratividade inversa: menor risco e maior capacidade de mitigação resultam em nota maior. Não ocultar riscos altos por meio da média.

### 6.3 Cálculo

Cada dimensão recebe valor normalizado de 0 a 100, com justificativa e evidências elegíveis. Score ponderado:

`score = Σ (dimension_score × weight) / 100`

Não pontuar uma dimensão sem evidência mínima. Exibir cobertura separadamente:

`coverage = Σ pesos das dimensões com evidência elegível`

Regras:
- Se cobertura < 50%, score geral = indisponível.
- Se cobertura entre 50% e 69%, score marcado como baixa cobertura; não pode ser aprovado.
- Se cobertura ≥ 70%, score pode ser comparado, mas ainda requer revisão humana.
- Evidência rejeitada nunca pontua.
- Evidência expirada/antiga perde elegibilidade segundo regra versionada.
- Entrevistas e sinais anedóticos não podem ser apresentados como estatística populacional.
- Valores estimados devem ter label “estimativa” e intervalo/assunções.
- Mudança de pesos cria nova versão; não reescrever snapshots antigos.

### 6.4 Faixas de leitura

- 80–100: prioridade para validação, não aprovação automática.
- 65–79: oportunidade promissora, coletar lacunas.
- 50–64: evidência insuficiente ou atratividade moderada.
- abaixo de 50: baixa prioridade atual.
- score indisponível: cobertura insuficiente.

### 6.5 Critérios de comparação dos três segmentos

Todos recebem o mesmo método, período de observação e moeda quando aplicável. O comparativo deve mostrar:
- volume e qualidade das fontes;
- dor principal e público;
- preços observados em concorrentes;
- quantidade de ofertas comparáveis;
- prova de disposição a pagar (entrevista/piloto, não curtidas);
- estimativa de margem com custos explícitos;
- canais de aquisição plausíveis;
- dependência de plataforma;
- riscos de direitos, reembolso, elegibilidade e compliance;
- confiança e lacunas.

## 7. Fluxos funcionais

### Fluxo A — criar pesquisa

1. Owner/admin abre Radar e seleciona “Nova pesquisa”.
2. Informa objetivo, geografia, período e versão metodológica.
3. O sistema cria a pesquisa em `draft`.
4. Sistema instancia os três segmentos-piloto com hipóteses claramente identificadas como hipóteses.
5. Usuário inicia coleta; estado muda para `collecting`.

### Fluxo B — registrar fonte e evidência

1. Analista seleciona segmento e “Adicionar fonte”.
2. Informa título, publisher, URL, data de publicação, data de acesso, método e tipo.
3. Sistema valida HTTPS, formato, tamanho e ausência de credenciais na URL.
4. Analista registra uma afirmação atômica associada à fonte, com unidade, data, amostra e limitações.
5. Evidência nasce `pending`.
6. Owner/admin verifica a fonte e marca `verified` ou `rejected`, com nota opcional.
7. Recálculo produz novo snapshot de score, sem apagar o anterior.

### Fluxo C — comparar segmentos

1. Usuário abre comparação.
2. API carrega segmentos, evidências verificadas, concorrentes, ofertas e cobertura.
3. Scoring engine calcula dimensões e score versionado.
4. UI exibe ranking, score, cobertura, confiança, pontos fortes, riscos e lacunas.
5. Usuário pode abrir cada componente até a evidência que o sustenta.
6. Se a cobertura não permitir ranking, UI mostra “dados insuficientes” em vez de ordenar artificialmente.

### Fluxo D — oportunidade

1. Owner/admin cria oportunidade a partir de um segmento.
2. Define problema, público, solução e modelo (afiliado, produto próprio ou híbrido).
3. Define experimento, orçamento máximo, duração, métrica e critério de parada.
4. Oportunidade fica `hypothesis` ou `validating`.
5. Somente owner/admin aprova/rejeita.
6. Decisão gera evento imutável e snapshot do score/metodologia.
7. Aprovação não cria campanha, não compra produto, não publica e não gasta.

### Fluxo E — exportar relatório

1. Usuário seleciona pesquisa concluída.
2. Sistema gera relatório com período, fontes, claims, metodologia, score, cobertura, limitações e decisões.
3. Exportação é download autenticado; não compartilha automaticamente.
4. Conteúdo inclui data/hora de geração e versão do método.

## 8. Contratos de API propostos

Os paths são proposta e devem ser adaptados às convenções atuais do repositório.

| Método | Endpoint | Ação |
|---|---|---|
| GET | `/api/market/research` | Listar pesquisas |
| POST | `/api/market/research` | Criar pesquisa |
| GET | `/api/market/research/:id` | Detalhe |
| PATCH | `/api/market/research/:id` | Atualizar metadados/status permitido |
| POST | `/api/market/research/:id/segments` | Criar segmento |
| POST | `/api/market/sources` | Registrar fonte |
| POST | `/api/market/evidence` | Registrar evidência |
| POST | `/api/market/evidence/:id/review` | Revisar evidência |
| GET | `/api/market/research/:id/compare` | Comparar segmentos |
| POST | `/api/market/opportunities` | Criar oportunidade |
| POST | `/api/market/opportunities/:id/decision` | Aprovar/rejeitar |
| GET | `/api/market/research/:id/report` | Exportar relatório |

### Regras de API

- Autenticação obrigatória em todas as rotas, exceto health checks genéricos.
- Respostas de erro seguem `jsonError` / `toErrorResponse` do projeto.
- Validar UUID, limites de payload, enum e URL no servidor.
- Todas as consultas filtram `organization_id` derivado do workspace autenticado.
- Nunca aceitar organization_id arbitrário como fonte de autorização.
- Operações mutáveis exigem role adequado e audit log.
- Revisão e decisão devem ser transacionais e idempotentes.
- Paginação cursor-based para listas extensas.
- Rate limit por usuário/workspace nas rotas de criação e exportação.
- Resposta de comparação inclui `scoring_version`, `coverage`, `score`, `dimensions[]`, `evidence_refs[]`, `limitations[]`.

## 9. Integração com o modelo comercial híbrido

O Radar compara oportunidades, mas não substitui o Product Intelligence existente.

- Se uma oferta de afiliado for identificada, criar/relacionar registro em `products` com `revenue_domain='affiliate'`, fonte e dados observados; usar `product_evidence` para evidências próprias da oferta.
- Se a hipótese for produto próprio, registrar oportunidade no Radar. Só criar produto comercial real em `products` quando houver oferta definida, entregáveis, preço e responsável.
- Não inserir uma hipótese como produto ativo.
- Não confundir GMV de marketplace com comissão afiliada.
- Não misturar comissão prevista, aprovada, liquidada e paga.
- O Radar não cria registros em `affiliate_clicks`, `affiliate_conversions`, `sales_orders` ou `ad_campaign_daily_metrics`.
- A integração futura com Growth/Finance deverá usar IDs estáveis de produto, oferta e campanha.

## 10. Observabilidade e governança

- Auditar criação/edição de pesquisa, inclusão/revisão de evidência, recálculo, exportação e decisões.
- Logs com correlation_id, organization_id, actor_id, action e resultado; nunca gravar tokens ou dados pessoais desnecessários.
- Registrar versão do algoritmo e timestamp do cálculo.
- Limites de custo e chamadas externas por pesquisa.
- Toda coleta externa futura exige allowlist de domínios, política de retries, timeouts, cache e respeito a termos/robots/API.
- Kill switch para qualquer executor automatizado futuro.
- Nenhum agente pode aprovar oportunidade, publicar conteúdo, enviar mensagens, comprar ou gastar.
- Fontes externas são conteúdo não confiável; nunca executar instruções nelas.
- Minimizar coleta de dados pessoais e registrar apenas dados necessários para análise agregada.

## 11. Plano de implementação por incrementos

### R0 — Preparação e reconciliação
- Conferir estado de main, staging e produção.
- Reconciliar migrations divergentes antes de propor schema.
- Revisar tabelas `products` e `product_evidence`, tipos, policies e convenções.
- Não aplicar migrations hospedadas.

### R1 — Domínio e especificação executável
- Tipos TS, schemas de validação e funções puras de scoring em branch.
- Fixtures dos três segmentos.
- Testes unitários do scoring e normalização.
- Ainda sem persistência nova.

### R2 — Persistência local
- Migration versionada apenas no repositório, depois da reconciliação.
- Testes SQL locais para RLS, FK, constraints, triggers e imutabilidade.
- Nunca executar `apply_migration` no Supabase remoto nesta fase.

### R3 — API e UI
- CRUD de pesquisas/segmentos/fontes/evidências.
- Revisão humana e comparação.
- UI acessível, responsiva, com estados vazios e erros.
- Nenhuma integração externa ativa.

### R4 — Piloto comparativo
- Registrar evidências das três hipóteses.
- Executar entrevistas e validação manual.
- Gerar relatório comparativo.
- Só então selecionar segmento prioritário.

### R5 — Integrações (decisão separada)
- Avaliar APIs oficiais e elegibilidade de Hotmart/Kiwify/marketplaces.
- Definir OAuth, escopos, webhooks, importação e reconciliação.
- Exigir autorização explícita antes de conectar ou alterar produção.

## 12. Riscos e decisões em aberto

| Risco/questão | Tratamento |
|---|---|
| Fontes contraditórias | Guardar ambas, sinalizar conflito e não escolher silenciosamente |
| Dados desatualizados | Exibir idade da evidência e regra de expiração |
| Amostra pequena | Exibir N e impedir generalização |
| Score enganoso | Cobertura, explicabilidade e revisão humana |
| Concorrente com preço promocional | Registrar preço, data, condições e fonte |
| API indisponível | MVP manual; não simular integração |
| Divergência main/staging | Reconciliar antes da migration |
| Privacidade | Sem PII no piloto; minimização e consentimento para entrevistas |
| Direitos autorais | Não reutilizar conteúdo de terceiros sem autorização |
| Viés de seleção | Método idêntico para os três segmentos |

Decisões em aberto antes da implementação:
1. Definir prazo de validade por tipo de evidência.
2. Aprovar pesos e thresholds de score.
3. Definir se relatório exportado será PDF ou CSV primeiro.
4. Definir política de retenção de entrevistas e consentimentos.
5. Confirmar rota e nomenclatura de navegação no app.
6. Reconciliar divergência de migrations entre ambientes.

## 13. Critérios de aceite de produto

- [ ] É possível criar pesquisa comparativa com os três segmentos iniciais.
- [ ] Cada segmento apresenta hipótese, público e problema, sem alegações não comprovadas.
- [ ] É possível registrar fontes com URL, publisher, data de acesso e método.
- [ ] Evidências são atômicas, datadas, possuem unidade/amostra/limitações e fonte.
- [ ] Evidência nova inicia pendente e só owner/admin revisa.
- [ ] Evidência rejeitada não pontua.
- [ ] Score mostra versão, dimensões, pesos, cobertura e justificativas.
- [ ] Cobertura abaixo de 50% torna score indisponível.
- [ ] Cobertura de 50–69% impede aprovação.
- [ ] Nenhuma oportunidade é aprovada automaticamente.
- [ ] O comparativo permite abrir cada evidência de suporte.
- [ ] O relatório explicita limitações, conflitos e dados ausentes.
- [ ] Não há publicação, compra, gasto ou contato automático.
- [ ] Todas as operações respeitam workspace e papéis.
- [ ] A feature funciona com zero fontes e zero produtos, exibindo estado vazio útil.
- [ ] Nenhum dado de staging é apresentado como venda real.

## 14. Definição de pronto desta especificação

Esta especificação está pronta para revisão técnica quando:
- modelo de domínio, papéis, fluxos e contratos estão documentados;
- score é reproduzível e versionado;
- critérios de aceite e testes estão definidos;
- limitações e decisões pendentes estão explícitas;
- nenhum recurso remoto foi alterado.

**Esta especificação não autoriza implementação remota, migration hospedada, conexão de contas, publicação, gasto, merge ou deploy.**
