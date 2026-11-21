# SMKON Handover & Status Report para Continuidade (Claude & Equipe)

Este documento descreve o estado atual do projeto **SMKON**, as arquiteturas implementadas recentemente, os testes, o deploy e como dar continuidade ao desenvolvimento sem atritos.

---

## 1. Visão Geral do Sistema & Últimos Commits (Branch `main`)

- **Repositório:** `smklj/smkon` (GitHub)
- **Branch Ativa:** `main` (100% limpa e sincronizada com a origem)
- **Status de Deploy (Vercel):** `SUCCESS`
  - **URL de Produção:** [smkon-71hfji4y7-smkon.vercel.app](https://smkon-71hfji4y7-smkon.vercel.app)
  - **Deploy ID:** `7969636902` no commit `5973b23`
- **Métricas de Qualidade:**
  - **Testes Unitários:** **404 testes passando (0 falhas)** via Node.js native test runner (`npm run test:unit`)
  - **TypeScript:** **0 erros** (`tsc --noEmit`)
  - **ESLint:** **0 erros, 0 avisos** (`eslint .`)
  - **Build de Produção:** **Compilado com sucesso** via Turbopack (`next build`)

---

## 2. Principais Funcionalidades Recentes

### A. SMKON Data Studio (Engenharia Reversa do Prisma Studio)
- **Caminho:** `/admin/studio` (com links rápidos a partir de `/produtos` e `/admin`).
- **Arquivos:**
  - `src/lib/data-studio/types.ts`: Definição de schemas para `products`, `content` e `transactions`.
  - `src/lib/data-studio/staging-engine.ts`: Motor de diffing em memória com buffer de staging (`pristine`, `modified`, `created`, `deleted`), descarte e commit em lote.
  - `src/components/data-studio/DataStudioGrid.tsx`: Tabela interativa estilo planilha com edição inline por duplo clique, busca universal, filtros por coluna e exportação CSV.
  - `src/components/data-studio/RelationalDrawer.tsx`: Gaveta lateral que desliza suavemente para exibir registros relacionados sem recarregar ou perder o contexto da planilha.

### B. Criação Automatizada de Posts & Carrosséis (IA)
- **Caminho:** Content Studio (`/studio`), aba *"🎠 Posts & Carrosséis (IA)"*.
- **Arquivos:**
  - `src/lib/content/smart-post-generator.ts`: Gerador autônomo de Carrosséis (5 slides com Gancho, Dor, Solução, Benefícios e CTA), Posts Estáticos de Feed, Batalhas de Votação (A vs B) e Caixinhas de Perguntas.
  - `src/components/studio/PostCarouselStudio.tsx`: Prévia ao vivo com régua de miniaturas, navegação slide a slide, edição manual e exportação em PNG Retina 2x.

### C. Padronização Oficial de Banners & Mascote SMK 3D
- **Caminho:** Content Studio (`/studio`), aba *"🎨 Banners SMKON Oficial (IA)"*.
- **Arquivos:**
  - `src/lib/media/brand-system.ts`: Tokens oficiais da marca (Sora, Inter, cores cósmicas `#080D12`, `#2563FF`, `#00F0FF`, `#F59E0B`), 6 expressões do Mascote SMK 3D e 5 arquétipos visuais.
  - `src/lib/media/smart-banner-engine.ts`: Heurística inteligente que deduz o arquétipo, mascote e HUD neon a partir do título do produto.
  - `src/components/studio/SMKONBannerCanvas.tsx`: Renderizador SVG vetorial com exportação PNG Retina 2x e SVG para Figma/Canva.

### D. Esteira de Geração Autônoma por IA (1-Clique)
- **Caminho:** Content Studio (`/studio`).
- **Botões no Cabeçalho:**
  - `⚡ Gerar Shopee`: Criação de peça viral com link rastreado Shopee.
  - `👗 Gerar Shein`: Peça de moda com cupom e link Shein VIP.
  - `📚 Gerar Infoproduto`: Lançamento digital com blueprint Kiwify.
  - `🎠 Post Carrossel`: Geração de carrossel de 5 slides para Instagram.
  - `⚔️ Batalha / Enquete`: Post interativo para pico de comentários.

---

## 3. Comandos Úteis para o Claude / Novos Desenvolvedores

```bash
# Rodar todos os testes unitários (404 testes)
npm run test:unit

# Checagem estrita de tipos TypeScript
npm run typecheck

# Validação do Linter ESLint
npm run lint

# Compilação de Produção Turbopack
npm run build

# Execução em ambiente local de desenvolvimento
npm run dev
```

> **Atenção:** Em ambiente Windows PowerShell, encadeie comandos utilizando `;` em vez de `&&` (ex: `npm run typecheck ; npm run lint`).

---

## 4. Próximos Passos Sugeridos

1. **Persistência Real do Data Studio no Supabase:**
   - Atualmente o Data Studio usa estado reativo em memória com dados mockados sincronizados com o modelo. A camada de commit pode ser conectada diretamente via Supabase Server Actions em transação atômica.
2. **Integração Real com Agendamento Social (Metricool/Instagram API):**
   - Integrar os carrosséis e posts gerados no Data Studio diretamente com o fluxo de aprovação e publicação do Metricool (`src/lib/social/metricool-client.ts`).
3. **Download em Lote de Carrossel (ZIP):**
   - Adicionar geração de arquivo `.zip` com todos os 5 slides em PNG 2x com 1 clique (usando `jszip`).
