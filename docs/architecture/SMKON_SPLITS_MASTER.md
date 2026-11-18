# SMKON — Documento Mestre dos Splits Operacionais

**Versão:** 1.0  
**Status:** especificação funcional e técnica em evolução  
**Repositório:** `smklj/smkon`  
**Branch de trabalho:** `feature/revenue-stream-split`  
**Escopo:** separar a operação da SMKON em domínios independentes, mantendo consolidação financeira e operacional no Control Center.

> Este documento descreve a arquitetura-alvo e o primeiro corte de implementação. Integrações, permissões, dados reais, automações e publicação só devem ser considerados ativos depois de conectados, testados e aprovados. Não há autorização para gastos, campanhas pagas ou publicação irrestrita.

---

## 1. Objetivo e princípios

A SMKON deve operar com três domínios de receita/custo claramente separados:

1. **Mídia e anúncios** — investimento em tráfego pago e desempenho de campanhas.
2. **Vendas próprias** — pedidos e recebimentos de produtos vendidos pela própria SMKON.
3. **Afiliados e comissões** — cliques encaminhados, conversões atribuídas e comissões de programas de afiliados.

Os três domínios compartilham identidade, catálogo de fontes, eventos, auditoria e camada de relatórios, mas não devem misturar conceitos financeiros.

### Princípios obrigatórios

- **Separação de origem:** cada registro mantém plataforma, conta, identificador externo, domínio e horário de origem.
- **Uma fonte de verdade por evento:** importar novamente o mesmo evento não pode duplicar receita, custo ou comissão.
- **Consolidação sem mistura:** o painel geral soma valores comparáveis, mas preserva a natureza contábil e operacional de cada valor.
- **Receita não é caixa:** pedido, faturamento, liquidação, comissão prevista e comissão paga são estados diferentes.
- **Custo não é receita:** investimento em anúncios deve aparecer como custo, nunca como venda.
- **Evidência e rastreabilidade:** todo valor deve apontar para sua origem e para a regra de normalização aplicada.
- **Menor privilégio:** cada integração recebe somente os escopos necessários.
- **Sem automação financeira autônoma:** pagamentos, compras, campanhas, assinaturas e qualquer despesa exigem autorização explícita do responsável.
- **Conformidade:** usar APIs oficiais, respeitar termos, limites, elegibilidade, privacidade e direitos de conteúdo.

---

## 2. Visão geral da arquitetura

```text
                         SMKON CONTROL CENTER
                                  |
             +--------------------+--------------------+
             |                    |                    |
       SPLIT 01              SPLIT 02              SPLIT 03
    Mídia e anúncios       Vendas próprias     Afiliados/comissões
             |                    |                    |
       Meta Ads*             Mercado Livre*       Amazon Associados*
       Google Ads*           TikTok Shop Seller*  TikTok Shop Affiliate*
             |                    |                    |
             +--------------------+--------------------+
                                  |
                         SOURCE CONNECTIONS
                                  |
                         EXTERNAL EVENT INBOX
                                  |
                    NORMALIZAÇÃO + IDEMPOTÊNCIA
                                  |
                 DOMÍNIOS TRANSACIONAIS SEPARADOS
                                  |
                    FINANCIAL LEDGER / AUDITORIA
                                  |
                  RELATÓRIOS POR DOMÍNIO E GERAL

  * Integrações planejadas; não presumir conectadas ou autorizadas.
```

### Camadas transversais

- **Control Center:** navegação, indicadores, estados das integrações, alertas e aprovações.
- **Product Intelligence:** pesquisa e avaliação de produtos, fontes, ofertas, histórico e critérios de seleção.
- **Content & Rights:** roteiros, versões de conteúdo, ativos, licenças, hash, disclosure e aprovação.
- **Growth:** calendário, canais, links rastreáveis, eventos e métricas orgânicas.
- **Finance:** ledger, conciliação, comissões, despesas e relatórios.
- **AI Workforce:** agentes e tarefas controladas por allowlist, limites, auditoria e aprovação humana.
- **Governança:** autenticação, organizações, papéis, RLS, trilha de auditoria, kill switch e limites operacionais.

Essas camadas apoiam os três splits; não são novas categorias de receita.

---

## 3. Split 01 — Mídia e anúncios

### 3.1 Missão

Medir quanto a SMKON investe em mídia paga e qual resultado é atribuído a esse investimento. Este domínio é de **custos de aquisição e performance**, não de receita de vendas.

### 3.2 Fontes previstas

| Plataforma | Prioridade | Acesso pretendido | Estado |
|---|---:|---|---|
| Meta Ads | Inicial | Somente leitura | Planejado; autenticação e permissões não validadas |
| Google Ads | Posterior | Somente leitura | Planejado |
| GA4 | Posterior | Leitura de analytics | Planejado |

Não criar, editar, pausar ou ativar campanhas por automação nesta etapa. Não inserir método de pagamento nem iniciar campanhas.

### 3.3 Entidades e dados

- Conta de anúncios e identificador externo.
- Campanha, conjunto/grupo de anúncios e anúncio, quando a API disponibilizar.
- Data de referência e moeda.
- Investimento (spend).
- Impressões, alcance, cliques e visualizações, conforme disponibilidade.
- Conversões e valor de conversão, mantendo a definição fornecida pela plataforma.
- Atribuição, janela e modelo de atribuição, quando disponíveis.
- Estado da sincronização, origem, captura e versão do normalizador.

### 3.4 Indicadores

- **CPM:** custo por mil impressões.
- **CPC:** custo por clique.
- **CTR:** cliques divididos por impressões.
- **CPA:** custo por conversão, quando a conversão for comparável.
- **ROAS:** valor de conversão atribuído dividido pelo investimento; exibir janela/modelo de atribuição.
- Investimento total por dia, campanha, plataforma e moeda.

Não calcular indicador quando faltar denominador ou quando as definições de origem forem incompatíveis. Exibir “não disponível” em vez de estimar.

### 3.5 Regras financeiras

- Spend é custo de mídia.
- Valor de conversão atribuído é métrica de atribuição, não prova de recebimento.
- Não somar valor de conversão de anúncios à receita própria sem deduplicar e reconciliar com o pedido de origem.
- Preservar moeda original; conversão cambial exige taxa, fonte e timestamp explícitos.

### 3.6 Critérios de aceite

- Conta e escopos identificados.
- Leitura de dados autorizada pela plataforma.
- Importação incremental e idempotente.
- Comparação de totais importados com a interface/API de origem.
- Indicadores com definições e janelas de atribuição documentadas.
- Nenhuma permissão de escrita ou gasto habilitada.

---

## 4. Split 02 — Vendas próprias

### 4.1 Missão

Controlar os pedidos em que a SMKON atua como vendedora, distinguindo pedido criado, pagamento aprovado, envio, liquidação, cancelamento e reembolso.

### 4.2 Fontes previstas

| Plataforma | Prioridade | Acesso pretendido | Estado |
|---|---:|---|---|
| Mercado Livre | Inicial | OAuth/API oficial, escopos mínimos de leitura | Planejado; operação e permissões a validar |
| TikTok Shop Seller | Posterior/inicial conforme elegibilidade | API oficial de seller | Planejado; elegibilidade a validar |
| Amazon Seller Central | Futuro | API oficial de seller, se houver operação própria | Fora do primeiro corte |

**Atenção:** Amazon Associados pertence ao Split 03, não ao Seller Central. TikTok Shop Seller e TikTok Shop Affiliate também são conexões e fluxos diferentes.

### 4.3 Entidades e dados

- Pedido e identificador externo.
- Itens, SKU, quantidade e preço unitário, se disponibilizados.
- Estado do pedido.
- Moeda.
- Valor bruto.
- Descontos e cupons.
- Taxas de marketplace e processamento.
- Frete cobrado e custo de frete, quando separados.
- Reembolsos, chargebacks e ajustes.
- Datas de criação, pagamento, envio, entrega e liquidação.
- Referência à conexão e evento externo de origem.

Dados pessoais de compradores devem ser minimizados. O painel financeiro não precisa exibir nome, telefone ou endereço do cliente para calcular receita.

### 4.4 Indicadores

- Pedidos por estado.
- Receita bruta de pedidos.
- Descontos.
- Taxas de plataforma e pagamento.
- Frete e outros ajustes.
- Reembolsos/estornos.
- Receita líquida estimada.
- Valor efetivamente liquidado.
- Ticket médio, somente sobre conjunto de pedidos definido.
- Margem, somente quando custo do produto e demais custos estiverem disponíveis e validados.

### 4.5 Regras financeiras

- Pedido criado não equivale a pagamento.
- Pagamento aprovado não equivale a liquidação bancária.
- Cancelamento, reembolso parcial e reembolso total devem gerar ajustes rastreáveis, sem apagar o pedido original.
- Taxas, descontos e frete devem permanecer em componentes separados.
- Receita líquida deve ter fórmula documentada; não inferir custos não fornecidos pela fonte.
- Cada pedido externo deve ser único por organização, plataforma e identificador externo.

### 4.6 Critérios de aceite

- OAuth/API oficial com escopos mínimos e consentimento explícito.
- Importação de pedidos e atualizações de estado.
- Idempotência em pedidos, itens e ajustes.
- Testes para cancelamento, reembolso parcial e total.
- Reconciliação de totais por período e moeda.
- Proteção de dados pessoais e acesso restrito.

---

## 5. Split 03 — Afiliados e comissões

### 5.1 Missão

Medir tráfego encaminhado por links de afiliado, conversões atribuídas e valores de comissão em cada etapa: prevista, aprovada, revertida e paga.

### 5.2 Fontes previstas

| Plataforma | Prioridade | Acesso pretendido | Estado |
|---|---:|---|---|
| Amazon Associados / Creators API | Inicial | API oficial, conforme elegibilidade e aprovação | Planejado; acesso não validado |
| TikTok Shop Affiliate | Conforme elegibilidade | API oficial de afiliados | Planejado |
| Outras redes | Futuro | Integração individual após avaliação | Não definido |

A disponibilidade de APIs, relatórios e permissões depende da conta, país, programa, elegibilidade e regras vigentes da plataforma.

### 5.3 Entidades e dados

- Link rastreável e identificador de tracking.
- Canal e conteúdo de origem.
- Clique e timestamp, respeitando privacidade e políticas da plataforma.
- Conversão/pedido atribuído e identificador externo.
- Valor do pedido atribuído, quando disponível.
- Comissão prevista.
- Estado da comissão: pending, approved, reversed ou paid.
- Data de aprovação, reversão e pagamento, quando fornecida.
- Moeda, fonte, janela e regra de atribuição.

### 5.4 Indicadores

- Cliques.
- Conversões atribuídas.
- Taxa de conversão, com denominador explícito.
- Comissão prevista.
- Comissão aprovada.
- Comissão revertida.
- Comissão paga/recebida.
- EPC (ganho por clique), somente quando numerador e período forem comparáveis.
- Desempenho por canal, conteúdo, produto e campanha.

### 5.5 Regras financeiras

- Comissão prevista não é receita recebida.
- Comissão aprovada pode ainda não ter sido paga.
- Reversões devem ser registradas como mudança de estado ou ajuste auditável.
- Não tratar o valor total do pedido do marketplace como receita da SMKON; a receita do afiliado é a comissão.
- Não contar uma mesma venda simultaneamente como venda própria e comissão.
- Deduplicar conversões pelo identificador externo da rede e organização.

### 5.6 Direitos, disclosure e conteúdo

- Informar claramente quando houver link de afiliado ou comissão.
- Não republicar vídeos, fotos, avaliações ou UGC de terceiros sem licença/permissão aplicável.
- Crédito não substitui autorização.
- Não afirmar teste pessoal quando o produto não foi efetivamente testado.
- Não representar cenas geradas por IA como demonstrações reais.
- Manter registro da licença, titular, escopo, prazo e prova de autorização.

### 5.7 Critérios de aceite

- Programa e conta elegíveis.
- API oficial e escopos autorizados.
- Tracking testado sem violar privacidade ou termos.
- Conversões e comissões reconciliadas com relatórios da rede.
- Estados pending/approved/reversed/paid validados.
- Disclosure aplicado nos materiais e links.

---

## 6. Modelo de dados compartilhado

O primeiro corte prevê as tabelas abaixo. A migration versionada é a referência de implementação; este documento explica a intenção funcional.

| Tabela | Finalidade | Domínio |
|---|---|---|
| `organizations` | Workspace/tenant | Compartilhado |
| `organization_members` | Associação de usuários e papéis | Compartilhado |
| `source_connections` | Metadados das conexões de plataformas | Compartilhado |
| `external_events` | Inbox de eventos externos e idempotência | Compartilhado |
| `ad_campaign_daily_metrics` | Métricas diárias e custos de anúncios | Split 01 |
| `sales_orders` | Pedidos próprios | Split 02 |
| `sales_order_adjustments` | Taxas, descontos, frete, reembolso e chargeback | Split 02 |
| `affiliate_clicks` | Cliques e tracking | Split 03 |
| `affiliate_conversions` | Conversões e comissão por estado | Split 03 |
| `financial_ledger_entries` | Visão financeira normalizada e auditável | Compartilhado |

### 6.1 Convenções

- IDs internos UUID.
- Valores financeiros em `numeric(18,4)`, com moeda ISO 4217 explícita.
- Datas em `timestamptz`; preservar timestamp de origem quando disponível.
- IDs externos sempre acompanhados de plataforma/conexão.
- Eventos normalizados registram hash do payload e versão do normalizador.
- Unicidade por organização + provedor + identificador externo + tipo de evento, conforme a entidade.
- Tokens e refresh tokens não ficam em tabelas acessíveis ao cliente; usar armazenamento seguro server-side.
- Dados pessoais devem ser minimizados e retidos pelo tempo necessário.

### 6.2 Ledger e consolidação

O ledger não substitui as tabelas de domínio. Ele registra lançamentos derivados com referência à origem, tipo, moeda, valor e data efetiva.

A camada de relatórios deve separar, no mínimo:

- Custo de mídia.
- Receita bruta de pedidos próprios.
- Descontos, taxas, frete e reembolsos.
- Receita líquida de vendas próprias, quando calculável.
- Comissão prevista.
- Comissão aprovada.
- Comissão paga.
- Resultado consolidado, somente quando todos os componentes e períodos forem comparáveis.

Não somar moedas diferentes sem conversão documentada. Não misturar datas de competência com datas de caixa.

---

## 7. Control Center — experiência operacional

O painel principal deve oferecer:

1. **Resumo geral:** indicadores de cada split em blocos independentes.
2. **Navegação por domínio:** entrar em Mídia, Vendas próprias ou Afiliados sem misturar filtros e métricas.
3. **Status das fontes:** conectada, pendente, reautorização necessária, desabilitada ou erro.
4. **Saúde da sincronização:** última execução, duração, registros importados, ignorados e falhas.
5. **Conciliação:** divergências entre origem, domínio e ledger.
6. **Alertas:** token expirado, queda de sincronização, duplicidade, mudança de escopo e discrepância.
7. **Filtros:** período, plataforma, conta, campanha/produto, moeda e estado.
8. **Detalhe de origem:** abrir o registro original ou referência externa quando permitido.

### Regras de apresentação

- Nunca mostrar integração como conectada antes de validar autenticação e leitura.
- Distinguir zero de indisponível/não sincronizado.
- Exibir moeda e período em todos os valores.
- Mostrar fórmula e origem dos indicadores.
- Não inventar dados demonstrativos como se fossem reais.

---

## 8. Segurança, papéis e governança

### 8.1 Papéis previstos

- **Owner:** controle integral do workspace, conexões e aprovações.
- **Admin:** administração operacional autorizada, sem poderes financeiros além do concedido.
- **Analyst:** leitura e análise dos dados permitidos.
- **Viewer:** leitura limitada.

A implementação deve validar o papel no servidor e no banco. Não confiar em `user_metadata` editável pelo usuário para decisões de autorização.

### 8.2 RLS

- RLS habilitada em todas as tabelas expostas.
- Isolamento por organização.
- Políticas de leitura e escrita separadas.
- UPDATE exige políticas de SELECT/USING e WITH CHECK adequadas.
- Sem acesso anônimo a dados operacionais ou financeiros.
- Testes negativos: usuário A não acessa organização B; viewer não escreve; usuário não altera seu próprio papel.
- Views que exponham dados devem usar `security_invoker = true` quando aplicável.
- Evitar `SECURITY DEFINER`; se indispensável, manter função em schema privado, validar identidade e revisar permissões.

### 8.3 Segredos e OAuth

- Nunca colocar secrets, service role ou refresh tokens em variáveis `NEXT_PUBLIC_*`, Git ou browser.
- Escopos mínimos por integração.
- Rotação/revogação e reautorização documentadas.
- Logs não podem conter tokens, dados pessoais desnecessários ou payloads sensíveis.
- Desabilitar conexão quando houver suspeita de comprometimento.

### 8.4 Kill switch e limites

- Kill switch global e por integração.
- Quotas por tarefa e por plataforma.
- Idempotência e retries limitados.
- Dead-letter queue para falhas persistentes.
- Auditoria de ações, aprovações e alterações de configuração.
- Ações irreversíveis ou com custo exigem confirmação explícita do Owner.

---

## 9. Integração e pipeline de dados

Fluxo padrão:

1. Validar conexão, escopos e status da conta.
2. Consultar API oficial com paginação, limites e janela permitidos.
3. Guardar evento bruto de forma segura, minimizada e com retenção definida.
4. Calcular hash e chave idempotente.
5. Normalizar para o domínio correto.
6. Validar moeda, datas, tipos e campos obrigatórios.
7. Fazer upsert transacional sem duplicar.
8. Gerar/atualizar lançamentos de ledger quando aplicável.
9. Registrar métricas da execução e trilha de auditoria.
10. Comparar totais com a origem e sinalizar divergências.

### Tratamento de falhas

- 401/403: interromper chamadas e solicitar reautorização.
- 429: respeitar rate limit e backoff indicado pela plataforma.
- 5xx/timeouts: retry limitado com jitter.
- Payload inválido: quarentena e registro de erro; não descartar silenciosamente.
- Duplicidade: ignorar idempotentemente e contabilizar como duplicado.
- Divergência: criar alerta de conciliação, sem ajustar valores automaticamente.

---

## 10. Relatórios e métricas executivas

### Relatório de Mídia
Investimento, impressões, cliques, conversões atribuídas, CPC, CPM, CTR, CPA e ROAS com fonte e janela de atribuição.

### Relatório de Vendas próprias
Pedidos por estado, bruto, descontos, taxas, frete, reembolsos, líquido estimado e liquidação confirmada.

### Relatório de Afiliados
Cliques, conversões atribuídas, comissão pendente, aprovada, revertida e paga, EPC e taxa de conversão.

### Relatório consolidado
- Custo de mídia.
- Receita líquida de vendas próprias.
- Comissões efetivamente pagas.
- Comissões ainda pendentes/aprovadas em separado.
- Resultado por domínio e consolidado, com moeda e período.
- Conciliações pendentes e dados indisponíveis.

O relatório geral não deve somar comissão pendente como caixa recebido nem conversão atribuída como venda liquidada.

---

## 11. Roadmap de implementação

### Sprint 0 — Fundação
- [x] Repositório e aplicação Next.js/TypeScript iniciados.
- [x] Estrutura visual inicial do Control Center.
- [x] CI inicial criado; estado precisa ser confirmado por execução.
- [x] PR de trabalho do Split 01 aberto.
- [ ] Integração GitHub–Vercel estável e Preview validado.

### Sprint 1 — Tenancy e segurança
- [x] Primeira proposta de schema com organizações, membros e isolamento por tenant versionada na branch.
- [x] RLS inicial incluída na migration.
- [ ] Revisão SQL e execução em banco descartável.
- [ ] Testes positivos e negativos de RLS.
- [ ] Fluxo de criação de organização e bootstrap de Owner validado.
- [ ] Auditoria e aprovação básica.

### Sprint 2 — Split 01: Mídia e anúncios
- [ ] Validar elegibilidade e acesso Meta Ads.
- [ ] Implementar OAuth e conexão read-only.
- [ ] Importar campanhas e métricas diárias.
- [ ] Testar idempotência e reconciliação.
- [ ] Exibir painel de custos e performance.

### Sprint 3 — Split 02: Vendas próprias
- [ ] Validar operação e permissões do Mercado Livre.
- [ ] Implementar conexão oficial e importação de pedidos.
- [ ] Tratar estados, taxas, frete, cancelamentos e reembolsos.
- [ ] Reconciliar pedidos e liquidações.
- [ ] Avaliar TikTok Shop Seller conforme elegibilidade.

### Sprint 4 — Split 03: Afiliados
- [ ] Validar elegibilidade Amazon Associados/Creators API.
- [ ] Implementar tracking e importação de conversões.
- [ ] Modelar comissões por estado e reversões.
- [ ] Validar TikTok Shop Affiliate conforme elegibilidade.
- [ ] Implementar disclosure e QA de links.

### Sprint 5 — Finance e relatórios
- [ ] Ledger idempotente.
- [ ] Conciliação por origem, domínio, período e moeda.
- [ ] Relatórios independentes e consolidados.
- [ ] Exportação e auditoria.

### Sprint 6 — AI Workforce controlada
- [ ] Registro de agentes e ferramentas allowlist.
- [ ] Planejador, executor e verificador com escopo limitado.
- [ ] Aprovação humana para ações externas.
- [ ] Limites, custos, logs, kill switch e avaliações.
- [ ] Publicação somente da versão exata aprovada, com direitos e disclosure validados.

---

## 12. Critérios gerais de pronto

Um split só pode ser marcado como **operacional** quando:

- A fonte oficial está conectada com consentimento e escopos mínimos.
- O pipeline passou por testes e importa dados sem duplicar.
- RLS e isolamento entre organizações passaram por testes negativos.
- Os totais reconciliam com a origem dentro de tolerâncias documentadas.
- Os estados financeiros são semanticamente corretos.
- Logs e auditoria não expõem segredos ou dados pessoais desnecessários.
- CI, build e Preview foram aprovados.
- O Owner aprovou a ativação da integração.

Um split pode existir na interface e no schema sem estar operacional. O status deve refletir essa diferença.

---

## 13. Estado real desta entrega

Na data desta revisão, o repositório contém a estrutura inicial do Control Center, documentação do Split 01, migration SQL e teste estrutural versionados na branch de trabalho.

**Ainda não está confirmado:**

- CI verde para o último commit.
- Migration executada em banco isolado.
- Testes reais de RLS.
- Tabelas aplicadas no Supabase hospedado.
- Integrações OAuth/API conectadas.
- Dados reais importados ou conciliados.
- Deploy de produção.

O Supabase hospedado permanece sem tabelas criadas para este split; a migration não deve ser aplicada antes de revisão e validação isolada.

---

## 14. Decisões em aberto

1. Confirmar quais plataformas serão efetivamente usadas na operação própria e quais programas de afiliados estão elegíveis.
2. Definir política de retenção de eventos brutos e dados pessoais.
3. Definir tolerância de conciliação e regra de câmbio.
4. Confirmar papéis e membros do workspace.
5. Decidir se comissões terão múltiplas parcelas por conversão; a primeira versão mantém estados na entidade de conversão.
6. Definir quais indicadores serão exibidos no resumo executivo por padrão.

**Regra final:** a SMKON deve automatizar coleta, organização, análise, conciliação e preparação de conteúdo dentro das permissões concedidas. Gastos, campanhas, pagamentos e publicação externa permanecem bloqueados até autorização explícita e validações próprias.
