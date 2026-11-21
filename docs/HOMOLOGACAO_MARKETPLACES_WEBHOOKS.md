# Guia de Homologação: Marketplaces, Webhooks & Afiliados (SMKON)

Este documento orienta o operador na configuração de contas reais e chaves de produção para os conectores de marketplaces integrados ao SMKON.

---

## 1. Kiwify (Infoprodutos & Checkout Instantâneo Pix)

### Configuração no Painel da Kiwify
1. Acesse o painel da Kiwify: [https://dashboard.kiwify.com.br/](https://dashboard.kiwify.com.br/).
2. No menu lateral, acesse **Apps > Webhooks**.
3. Clique em **Criar Webhook** e preencha:
   - **Nome:** `SMKON Production Webhook`
   - **URL do Webhook:** `https://<seu-dominio-ou-vercel>/api/webhooks/kiwify`
   - **Eventos:** Selecione `Pedido Aprovado` (Pix/Cartão), `Pix Gerado`, `Reembolso` e `Chargeback`.
   - **Token / Assinatura:** Copie o token de validação exibido e adicione na sua variável de ambiente `KIWIFY_WEBHOOK_SECRET` na Vercel / `.env.local`.

### Como o SMKON Processa
- Valida o token recebido no header `x-kiwify-signature` ou query string `?token=...` usando comparação em tempo constante (`timingSafeEqual`).
- Todos os dados pessoais de clientes (CPF, nome, e-mail, telefone) são **descartados** (Zero PII).
- O valor líquido da venda (`netCommissionBrl`) e a taxa da Kiwify (`platformFeeBrl`) são integrados ao painel financeiro do SMKON.

---

## 2. Shopee Afiliados (Achadinhos Físicos & 7 Dias de Cookie)

### Configuração no Portal Shopee
1. Acesse o [Shopee Affiliate Program](https://affiliate.shopee.com.br/).
2. Obtenha seu **App ID** e seu link base de afiliado.
3. Configure `SHOPEE_APP_ID` nas variáveis de ambiente do SMKON.

### Atribuição por Vídeo / Post
- Ao gerar uma peça no Content Studio, o conector injeta automaticamente os SubIDs:
  - `sub_id`: ID único da peça de conteúdo
  - `sub_id2`: Canal de publicação (`instagram_reels`, `tiktok`, `youtube_shorts`)
  - `sub_id3`: Tag da campanha
- O comprador que clicar no seu link garante **comissão de 8% a 20%** sobre qualquer item adicionado ao carrinho e comprado dentro da janela de **7 dias**.

---

## 3. Shein Afiliados & Creator Portal

### Configuração no Shein Creator
1. Acesse o portal de criadores da Shein e copie seu `aff_id` e seu cupom de criador exclusivo (ex.: `SMKON15`).
2. Defina `SHEIN_AFFILIATE_ID` e `SHEIN_DEFAULT_COUPON` no seu `.env`.

### Geração de Deep-Links
- O SMKON embute o cupom na URL encurtada (`https://shein.top/m?...&coupon=SMKON15`), aplicando o desconto de 15% a 20% diretamente na finalização da compra do cliente e registrando sua comissão de 10% a 15%.

---

## 4. Hotmart (Produtos Digitais & Assinaturas)

### Configuração no Hotmart Tools
1. Acesse **Ferramentas > Webhook (API e Notificações)**.
2. Cadastre a URL: `https://<seu-dominio>/api/webhooks/hotmart`.
3. Copie o token **Hottok** e configure na variável `HOTMART_WEBHOOK_SECRET`.

---

## 5. Metricool (Distribuição Social Autônoma)

1. Acesse **Conexões > API** no painel da Metricool.
2. Copie seu `userToken` e adicione em `METRICOOL_USER_TOKEN`.
3. As peças aprovadas com 1 clique no Content Studio são despachadas automaticamente para o agendamento de Reels, TikTok e Shorts.
