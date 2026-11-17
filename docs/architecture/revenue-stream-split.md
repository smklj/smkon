# SMKON — Split operacional 01

**Objetivo:** separar a operação em três domínios financeiros e operacionais, preservando uma visão consolidada no Control Center.

## 1. Domínios

### A. Mídia e anúncios
- Responsabilidade: registrar investimento e desempenho de campanhas.
- Primeira fonte: Meta Ads, somente leitura para análise.
- Fontes posteriores: Google Ads e GA4, após validação.
- Métricas: spend, impressions, clicks, CPC, CPM, CPA, conversions e ROAS.
- Regra: gasto de mídia é custo; nunca deve ser somado à receita.

### B. Vendas próprias
- Responsabilidade: registrar vendas em que a SMKON é a vendedora.
- Primeira integração planejada: Mercado Livre via OAuth/API oficial.
- TikTok Shop entra como marketplace quando houver operação própria habilitada.
- Amazon Seller Central fica fora do primeiro corte até existir operação própria ativa.
- Métricas: pedidos, receita bruta, descontos, taxas, frete, reembolsos, receita líquida e margem.
- Regra: pedido não é receita recebida; pagamento e liquidação precisam de estados distintos.

### C. Afiliados e comissões
- Responsabilidade: registrar tráfego encaminhado, conversões atribuídas e comissões.
- Primeira integração planejada: Amazon Associados/Creators API, conforme elegibilidade e acesso aprovado.
- TikTok Shop também pode atuar como origem de comissão de afiliado, separado da venda própria.
- Métricas: clicks, attributed orders, commission pending, approved, reversed e paid; EPC e conversion rate.
- Regra: comissão prevista não é comissão recebida.

## 2. Fontes do primeiro corte

| Fonte | Domínio | Acesso inicial | Observação |
|---|---|---|---|
| Meta Ads | Mídia e anúncios | Read-only | Não criar/editar campanhas nem gastar |
| Mercado Livre | Vendas próprias | OAuth/API oficial | Escopo depende das permissões concedidas |
| TikTok Shop | Vendas próprias e afiliados | API/conta elegível | Separar seller e affiliate |
| Amazon Associados | Afiliados | API elegível | Não confundir com Seller Central |

## 3. Modelo de dados comum

- `source_connections`: plataforma, conta, status, escopos autorizados e última sincronização; nunca armazenar tokens em texto puro nesta tabela.
- `external_events`: eventos externos normalizados, identificador de origem, tipo, data e chave de idempotência.
- `ad_campaign_daily_metrics`: métricas diárias de campanhas e custos.
- `sales_orders`: pedidos próprios, moeda, status, valores brutos e líquidos.
- `sales_order_adjustments`: descontos, taxas, frete, reembolsos e estornos.
- `affiliate_clicks`: click ID, tracking ID, origem e destino, respeitando privacidade e políticas da plataforma.
- `affiliate_conversions`: conversões atribuídas, valor do pedido, valor da comissão e estado (`pending`, `approved`, `reversed`, `paid`). A comissão é registrada nesta tabela nesta primeira versão; uma tabela separada só será criada se a conciliação exigir múltiplas parcelas por conversão.
- `financial_ledger_entries`: lançamentos normalizados e vinculados ao evento original; não substituir os registros específicos dos domínios.

Valores monetários devem usar decimal de precisão fixa e moeda explícita (ISO 4217). Datas externas devem preservar timestamp original e timezone normalizado.

## 4. Regras de consolidação

1. Manter os três domínios independentes na origem.
2. Consolidar somente por uma camada de leitura/relatórios, sem apagar a natureza do valor.
3. Distinguir receita bruta, receita líquida, custo de mídia, comissão prevista e comissão recebida.
4. Não contar uma venda própria e uma comissão de afiliado como a mesma receita.
5. Deduplicar importações com `source + external_id + event_type` ou chave equivalente documentada.
6. Registrar origem, horário de captura, versão do normalizador e trilha de auditoria.
7. Não inventar dados quando a API não disponibilizar uma métrica; exibir “não disponível”.

## 5. Segurança e limites

- Tokens e refresh tokens ficam em armazenamento de segredos/servidor, nunca no navegador ou Git.
- OAuth com escopos mínimos; conexões iniciam desabilitadas até validação.
- Meta Ads permanece read-only neste primeiro corte.
- Nenhuma campanha, compra, anúncio pago, assinatura, contratação ou transferência é autorizada.
- Não contornar APIs, termos, limites, elegibilidade ou controles das plataformas.
- Publicação de conteúdo permanece sujeita à aprovação da versão exata, hash, direitos e disclosure.

## 6. Critérios de aceite do split 01

- [x] Três domínios documentados e separados na interface.
- [x] Fontes do primeiro corte mapeadas por domínio.
- [x] Regras para distinguir custos, vendas e comissões definidas.
- [ ] Schema SQL revisado, com RLS e migrations.
- [ ] OAuth/API de cada fonte conectado e testado.
- [ ] Importação idempotente com fixtures e testes.
- [ ] Relatórios consolidados validados com dados reais.
- [ ] CI, build e preview aprovados.

**Status:** modelagem e interface inicializadas. Nenhuma integração está marcada como conectada; ainda não há dados reais nem publicação automática.
