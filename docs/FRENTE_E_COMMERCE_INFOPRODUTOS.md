# Frente E — Expansão de Marketplaces & Infoprodutos (Shein, Shopee, Kiwify e Fábrica de Digitais)

**Escopo oficial:** S23, S24 e S25  
**Responsabilidade:** conectores de afiliados físicos (Shein, Shopee), conector de infoprodutos (Kiwify) e gerador autônomo de infoprodutos digitais completos.  
**Estado do documento:** especificação e planejamento executivo oficial.

---

## 1. Objetivo

Expandir o ecossistema de monetização do SMKON além do Mercado Livre e Hotmart, integrando os maiores geradores de comissão do mercado brasileiro: **Shein** e **Shopee** (para produtos físicos e achadinhos virais) e **Kiwify** (para infoprodutos digitais de alta margem com checkout Pix instantâneo). Adicionalmente, implementa a **Fábrica Autônoma de Infoprodutos**, permitindo que o SMKON crie e venda seus próprios produtos digitais (e-books, guias, templates e kits) com margens líquidas superiores a 90%.

---

## 2. Escopo dos Splits

### S23 — Conector de Afiliados Shopee & Shein (Physical Commerce Growth)
- **Adaptador Shopee Open Platform:**
  - Autenticação e geração automatizada de links encurtados de afiliado com SubIDs exclusivos por campanha/vídeo.
  - Aproveitamento da janela de atribuição de cookies de 7 dias (comissões sobre todo o carrinho do comprador).
- **Adaptador Shein Creator & Afiliados:**
  - Mapeamento de catálogo de moda, beleza, acessórios e utilidades domésticas.
  - Injeção automatizada de cupons de desconto proprietários e URLs de afiliado rastreadas.
- **Radar de Produtos em Alta (Viral Trend Radar):**
  - Mapeamento de produtos com alta taxa de conversão e comissão diferenciada (10% a 20%) para alimentar a esteira de conteúdo da Frente D.

### S24 — Conector Kiwify & Checkout Instantâneo Pix (Digital Commerce Engine)
- **Receptor de Webhooks Kiwify:**
  - Endpoint seguro `/api/webhooks/kiwify` com validação de token de autenticidade no cabeçalho.
  - Normalização de eventos: `order_approved`, `pix_generated`, `chargeback`, `refund`.
  - Tratamento contra replay, idempotência estrita e descarte de PII desnecessária.
- **Integração com o Ledger Contábil do SMKON:**
  - Lançamento automático das receitas brutas e deduções de taxas da Kiwify na tabela `affiliate_financial_ledger`, unificando a visão financeira no `/financeiro`.
- **Checkout Dinâmico & Order Bumps:**
  - Geração de links de checkout de 1 clique otimizados para mobile/Pix com order bumps para inflar o ticket médio.

### S25 — Fábrica Autônoma de Infoprodutos Digitais (AI Product Factory)
- **Agente Estruturador de Infoprodutos:**
  - O agente analisa as dores do público-alvo ou produtos físicos correlatos (ex: comprador de maquiagem → *Guia de Visagismo e Automaquiagem*; comprador de utilidades → *Manual de Organização Residencial Minimalista*).
  - Gera a estrutura temática completa: Introdução, 5 a 10 capítulos com conteúdo aprofundado, cronogramas práticos, checklists acionáveis e prompts bônus.
- **Compilador e Diagramador de PDF Profissional:**
  - Geração automatizada do arquivo PDF com tipografia elegante, índice clicável, cabeçalhos/rodapés institucionais e paleta de cores da marca.
  - Vinculação com o gerador de mockups 3D do **S21** (capa de livro 3D de alta qualidade).
- **Cadastro e Disponibilização Comercial:**
  - Cadastro automático do produto na esteira do SMKON com precificação estratégica (R$ 19,90 a R$ 97,00) para conversão por impulso.
  - Geração de copy da página de vendas e chamada de conversão para o Content Studio.

---

## 3. Entregáveis Técnicos

1. Módulo `src/lib/integrations/shopee/{client,service,types}.ts` (geração de links de afiliado).
2. Módulo `src/lib/integrations/shein/{client,service,types}.ts` (gestão de catálogo e cupons).
3. Módulo `src/lib/integrations/kiwify/{validator,normalizer,repository,types}.ts` e rota `/api/webhooks/kiwify`.
4. Módulo `src/lib/infoproducts/{generator,compiler,types}.ts` (motor de criação de infoprodutos em PDF).
5. Migrations de credenciais e catálogos para Shopee, Shein e Kiwify com isolamento multi-tenant (RLS).
6. Testes unitários para geração de links, validação de webhooks Kiwify e compilação de infoprodutos.

---

## 4. Critérios de Aceite

- [ ] Links de afiliados da Shopee e Shein são gerados com tags de rastreamento exclusivas por postagem.
- [ ] Webhook da Kiwify rejeita tokens inválidos e processa vendas Pix em tempo real de forma idempotente.
- [ ] Vendas da Kiwify e Hotmart reconciliam perfeitamente no ledger contábil unificado do SMKON.
- [ ] A Fábrica de Infoprodutos gera materiais digitais completos em PDF com capa 3D e diagramação profissional sem necessidade de diagramação manual externa.
- [ ] Toda receita e comissão gerada (física ou digital) é segregada por workspace/organização.
- [ ] Nenhuma credencial de marketplace é exposta ao browser ou armazenada em texto plano.
