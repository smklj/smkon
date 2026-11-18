# SMKON — Arquitetura das 8 Áreas Operacionais

**Versão:** 1.1  
**Status:** arquitetura-alvo em construção; não confundir módulos documentados com integrações operacionais.  
**Repositório:** `smklj/smkon`  
**Branch:** `feature/revenue-stream-split`

## 1. Correção de arquitetura

A SMKON possui **oito áreas operacionais de primeiro nível**. Os três domínios de mídia/anúncios, vendas próprias e afiliados/comissões são uma subdivisão do Financeiro/Receita, não substituem as oito áreas.

## 2. As oito áreas

### 01 — Estratégia e gestão
Metas, OKRs, roadmap, prioridades, decisões do Owner, indicadores executivos e governança do portfólio. Deve mostrar o estado real de cada área e dependências críticas.

### 02 — Inteligência de produtos
Pesquisa de mercado, catálogo de produtos, fontes, vendedores, preço/histórico, avaliação, risco, potencial demonstrável e scoring versionado. Nenhum produto deve ser recomendado sem evidência e data de atualização.

### 03 — Conteúdo e distribuição
Pipeline de ideia → pesquisa → roteiro → produção → revisão → direitos → aprovação → agendamento/publicação → métricas. Guardar versões, hashes, licença/escopo de uso, disclosure e origem dos ativos. Conteúdo de terceiros exige autorização aplicável; crédito não substitui licença.

### 04 — IA e agentes
Registro de agentes, tarefas, planner/executor/verifier, ferramentas allowlist, limites, avaliação, logs, custos e kill switch. Agentes podem pesquisar, classificar, preparar e verificar; ações externas ficam limitadas às permissões e aprovações concedidas.

### 05 — Financeiro
Ledger, receitas, custos, comissões, conciliação, fluxo de caixa, relatórios por domínio e consolidados. Três domínios financeiros:
1. **Mídia e anúncios:** Meta Ads, Google Ads e GA4; gasto é custo de aquisição, não receita.
2. **Vendas próprias:** Mercado Livre, TikTok Shop Seller e Shopify, conforme operação e acesso; separar pedido, pagamento, liquidação, taxas e reembolso.
3. **Afiliados e comissões:** Shopee, Amazon Associados/Creators e TikTok Shop Affiliate, conforme elegibilidade; separar clique, conversão, comissão prevista, aprovada, revertida e paga.

Não contar a mesma venda em mais de um domínio. Comissão prevista não é caixa recebido. Valores de moedas diferentes não podem ser somados sem conversão documentada.

### 06 — Jurídico e conformidade
Políticas das plataformas, elegibilidade, contratos, direitos autorais/licenças, disclosure de publicidade/afiliados, privacidade, retenção de dados, obrigações fiscais e trilhas de consentimento. A operação não deve contornar API, termos, limites ou restrições.

### 07 — Audiência e relacionamento
Perfis e canais, audiência, comunidade, feedback, atendimento, relacionamento, parcerias e CRM. Separar métricas de alcance, engajamento, leads e clientes. Não inferir dados pessoais desnecessários.

### 08 — Segurança e infraestrutura
GitHub, Vercel, Supabase, autenticação, OAuth, RLS, gestão de segredos, observabilidade, backups, ambientes, CI/CD, quotas, idempotência, auditoria e kill switch global/por integração.

## 3. Conexões e estado conhecido em 17/11/2026

| Serviço | Estado | Limitação / próximo passo |
|---|---|---|
| GitHub | Repositório privado `smklj/smkon`; branch de trabalho e PR #1 | PR ainda não deve ser mesclado sem CI e revisão |
| Vercel | Projeto `smkon`; deployment `READY` | Deployment direto sem vínculo Git, sem alias; configurar integração Git e validar Preview |
| Supabase | Projeto ativo | Schema `public` sem tabelas; migration ainda não aplicada |
| Metricool | Marca SMKON e perfis cadastrados | Publicação funcional ainda não testada |
| Supermetrics | Instagram Insights, TikTok Organic e Pinterest autenticados | YouTube requer validação final; Meta Ads/Amazon Ads não autenticados |
| Meta Business | Não configurado | Criar/validar portfólio, Página e permissões; não criar campanhas nem adicionar cartão |

Status “autenticado” significa que o conector reportou autenticação; não prova que a importação de dados, publicação ou todos os escopos funcionam. Cada fluxo exige teste próprio.

## 4. Regras de status

- **Planejado:** ainda não implementado.
- **Estruturado:** interface/documentação/schema proposto existe.
- **Conectado:** autenticação e escopos concedidos foram confirmados.
- **Validado:** teste funcional com dados de origem e reconciliação passou.
- **Operacional:** CI, segurança, testes, observabilidade e aprovação do Owner concluídos.

Não usar “conectado” para uma integração apenas cadastrada na interface. Não usar “operacional” para uma migration ainda não executada/testada.

## 5. Ordem de construção recomendada

1. Consolidar navegação e ownership das oito áreas no Control Center.
2. Completar fundação: GitHub–Vercel, CI verde, preview e Supabase com schema validado em ambiente isolado.
3. Autenticação, workspaces, papéis, RLS e auditoria.
4. Product Intelligence e Content & Rights.
5. Financeiro: três domínios, ledger e conciliação.
6. Growth e conexões de canais.
7. IA Workforce controlada.
8. Jurídico/compliance e Segurança como gates transversais em todas as etapas.

## 6. Restrições permanentes

- Orçamento de implantação: R$ 0; usar planos gratuitos e limites existentes.
- Não criar serviços/projetos pagos, contratar, comprar, impulsionar ou adicionar forma de pagamento.
- Não publicar automaticamente sem aprovação da versão exata, direitos válidos, disclosure e revalidação de oferta/link.
- Não executar campanhas, compras, pagamentos, transferências ou assinaturas sem autorização explícita.
- Não expor secrets, tokens ou dados pessoais no browser, Git ou logs.
- Respeitar APIs oficiais, termos, rate limits e elegibilidade.

## 7. Critério de conclusão

Uma área só será marcada como operacional quando seus fluxos principais estiverem implementados, testados, protegidos por autorização/RLS, observáveis e aceitos. Uma conexão só será marcada como validada após leitura/escrita permitida (conforme escopo), teste funcional, tratamento de falhas e reconciliação.
