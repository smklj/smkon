# Frente D — Content Studio Pro & Motor Criativo (CapCut + Canva + Photoshop REA)

**Escopo oficial:** S20, S21 e S22  
**Responsabilidade:** motor de edição e remix de vídeo, gerador de criativos/mockups e interface unificada de aprovação com timeline.  
**Estado do documento:** especificação e planejamento executivo oficial.

---

## 1. Objetivo

Transformar o **Content Studio** do SMKON em um estúdio autônomo de produção criativa de alto impacto. O sistema aplica engenharia reversa das melhores funcionalidades do **CapCut** (legendas dinâmicas, cortes de silêncio, hooks, marca d'água), **Photoshop** (remoção de fundo, capas 3D, inpainting para limpeza de marcas de terceiros) e **Canva** (templates modulares, carrosséis e selos promocionais). O operador humano apenas visualiza a prévia final, faz ajustes pontuais se desejar e aprova com 1 clique.

---

## 2. Escopo dos Splits

### S20 — Motor de Remix & Vídeo Autônomo (CapCut REA)
- **Legendas Dinâmicas Estilo Viral (Word-by-Word Highlight):**
  - Transcrição automática de áudio via Whisper com alinhamento temporal por palavra.
  - Renderização de legendas estilizadas (karaokê, destaque da palavra falada em amarelo/verde, animação de pop e inserção automática de emojis relevantes).
- **Tratamento de Mídia & Limpeza de Marcas d'Água:**
  - Ingestão de vídeos demonstrativos de produtos (fornecedores / criadores).
  - Crop adaptativo 9:16 (vertical para Reels/TikTok/Shorts) e remoção de bordas pretas.
  - Inpainting / desfoque delimitado para ocultar identificadores ou marcas de terceiros.
- **Branding da Marca Própria (SMKON):**
  - Injeção automática da marca d'água, vinheta ou moldura transparente da SMKON.
  - Inserção de CTA animado nos últimos 3 segundos (*"Link na bio / Cupom nos comentários"*).
- **Locução por IA (Text-to-Speech):**
  - Geração de áudio com vozes neurais de alta conversão narrando o script persuasivo gerado pelo agente.
  - Ajuste de volume e mixagem com trilha de fundo sutil (background music royalty-free).

### S21 — Motor de Banners & Mockups 3D (Canva + Photoshop REA)
- **Remoção de Fundo por IA (Background Removal):**
  - Segmentação automática do produto em relação ao cenário original, gerando PNG transparente em alta definição.
- **Gerador de Capas & Mockups 3D de Infoprodutos:**
  - Renderização programática de mockups realistas: E-book 3D, Caixa de Curso Digital, Tablet/Smartphone com a interface do produto.
- **Templates Dinâmicos de Banners & Carrosséis:**
  - Geração em lote de formatos 1:1 (Feed) e 9:16 (Stories).
  - Composição automática com overlays de conversão: selo de *"Frete Grátis"*, etiqueta de *"De R$ 97 por R$ 29"*, estrelas de avaliação 5.0 e badges de urgência.
- **Formatos Interativos para Stories:**
  - Criação de artes com simulação de enquetes, caixas de pergunta (*"Você prefere o Modelo A ou B?"*) e quizzes para inflar o engajamento do Instagram.

### S22 — Content Studio Pro (Interface Unificada de Ajustes & Aprovação Ágil)
- **Player de Vídeo Vertical no Navegador:**
  - Reprodução instantânea de vídeos 9:16 com preview das legendas animadas sincronizadas.
- **Painel Lateral de Customização Rápida (Inspector):**
  - Edição imediata da legenda/copy do post sem sair da tela.
  - Seleção e substituição rápida do gancho inicial (Hook dos primeiros 3 segundos).
  - Ajuste do link/código de afiliado e tags associadas.
- **Fluxo de Decisão 1-Clique:**
  - Botão de **Aprovação Imediata**: assina o hash do conteúdo e o despacha diretamente para a fila de agendamento social da Metricool / canais oficiais.
  - Botão de **Regenerar Variação**: solicita à IA um novo roteiro ou novo criativo.

---

## 3. Entregáveis Técnicos

1. Módulo `src/lib/media/video-processor.ts` (pipeline de corte, crop, marca d'água e concatenação).
2. Módulo `src/lib/media/subtitles.ts` (geração de legendas dinâmicas animadas estilo CapCut).
3. Módulo `src/lib/media/image-processor.ts` (remoção de fundo, mockups 3D e banners com badges).
4. Componente `src/components/studio/VideoPreviewPlayer.tsx` integrado ao `/studio`.
5. Componente `src/components/studio/CreativeInspector.tsx` para edições rápidas pré-aprovação.
6. Testes unitários para manipulação de legendas, parsing de templates visuais e integridade de renderização.

---

## 4. Critérios de Aceite

- [ ] Vídeos gerados possuem formato 9:16 com legendas sincronizadas palavra a palavra.
- [ ] Marca d'água da SMKON é inserida no canal alpha sem perda de resolução.
- [ ] Banners promocionais suportam substituição de preços, títulos e badges de forma determinística.
- [ ] Mockups 3D de infoprodutos são renderizados com iluminação e perspectiva corretas.
- [ ] No Content Studio, o usuário visualiza o player, ajusta a copy e aprova com 1 clique.
- [ ] Conteúdo aprovado é gravado com hash imutável e enviado para a fila de publicação externa.
- [ ] Nenhum vídeo é publicado em redes sociais sem aprovação explícita do operador humano.
