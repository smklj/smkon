# S7 — Design system e app shell · Handoff para validação

**Branch:** `feature/s7-design-system` — **empilhada sobre `feature/p0-security-integrity` (S1)**. Validar o S1 primeiro; o PR do S7 deve apontar para a branch do S1 (ou para a base, depois que o S1 entrar).
**Estado:** implementado · **aguardando validação independente (GPT/Codex)**. Nenhum teste, build ou push foi executado pelo Claude Code.

## 1. Objetivo
Aplicar a identidade oficial monocromática (kit de marca SMKON), criar navegação única entre os oito domínios e remover informações estáticas que se apresentavam como status validado.

## 2. O que mudou e por quê

| Mudança | Justificativa | Arquivos |
|---|---|---|
| Tokens de marca: base `#0B0B0B`, superfície `#1A1A1A`, elevação `#2A2A2A`, branco como primária; cor apenas para estado (ok, aviso, erro, info) e identificação de módulo | Brand kit oficial + instruções do projeto (preto, branco, neutros, cor estratégica) | `src/app/globals.css` (reescrito) |
| Fontes via `next/font/google` (Space Grotesk para títulos, Inter para texto) no lugar de `@import` do Google Fonts | Remove CSS bloqueante; fontes auto-hospedadas no build | `src/app/layout.tsx` |
| Logo oficial em componente SVG (`currentColor`), favicon, ícone Apple e SVGs da marca | Identidade única; ícones pelas convenções do App Router | `src/components/brand/Logo.tsx`, `src/app/icon.svg`, `src/app/apple-icon.png`, `src/app/favicon.ico`, `public/brand/*` |
| App shell: sidebar com os 8 domínios (estado real: disponível, em construção, planejado), menu móvel com scrim, link "pular para o conteúdo", e-mail do usuário e **Sair** | Navegação consistente; antes cada página tinha topbar próprio e o Studio perdia a navegação no celular | `src/components/shell/AppShell.tsx`, `src/app/(app)/layout.tsx`, `src/app/(app)/actions.ts`, `src/lib/navigation.ts` |
| Route group `(app)` para as páginas autenticadas (URLs inalteradas) | Shell aplicado só à área logada; `/login` fica fora | `src/app/(app)/page.tsx`, `src/app/(app)/admin/*`, `src/app/(app)/studio/*` (movidos) |
| Visão geral reescrita: contagens reais de conteúdo, fila de aprovação (rascunhos), módulos com estado real e regras de operação | Remove "STATUS VALIDADO" fixo e textos desatualizados (ex.: "repositório privado") | `src/app/(app)/page.tsx` |
| Admin: listas no lugar de grade de cards; badges de estado; skeleton de carregamento; vazio com link para o Studio | Menos cards, hierarquia clara, feedback de carregamento | `src/app/(app)/admin/page.tsx`, `src/components/admin/*` |
| Studio: cabeçalho padrão, indicadores e feedback padronizados, rótulos em português, campos com tamanho mínimo de 12–14 px | Consistência entre módulos e legibilidade | `src/app/(app)/studio/studio-client.tsx` |
| Login com logo oficial e botões do sistema | Identidade | `src/app/login/page.tsx` |
| Ícones de sistema próprios (SVG, sem dependência) | Sem acesso ao npm; conjunto mínimo coerente | `src/components/ui/Icon.tsx` |
| Primitivos `PageHeader`, `SectionHeading`, `Badge` | Componentes consistentes | `src/components/ui/PageHeader.tsx` |
| Proxy libera `/brand/*`, `/icon.svg`, `/apple-icon.png` | Logo do login e ícones acessíveis sem sessão | `src/lib/supabase/proxy.ts` |

## 3. Roteiro de validação (a executar)

### 3.1 Build e qualidade
```bash
npm ci && npm run typecheck && npm run lint && npm run build
```
Pontos de maior risco:
- `next/font/google` precisa de rede no build (Vercel e GitHub Actions têm).
- Regra `react-hooks/set-state-in-effect`: o shell fecha o menu ajustando estado durante o render (sem `useEffect`); confirmar que o lint aceita.
- `style={{ "--accent": ... } as React.CSSProperties}` em `AppShell`.
- Rotas movidas para `(app)`: confirmar que `/`, `/admin` e `/studio` continuam nas mesmas URLs.

### 3.2 Visual e acessibilidade (preview)
- Desktop ≥ 1100 px: sidebar fixa; item ativo com barra branca à esquerda e ícone na cor do módulo.
- Tablet/celular < 960 px: barra superior com logo e botão de menu; menu abre e fecha, fecha ao navegar e ao tocar no scrim.
- Teclado: Tab mostra "Pular para o conteúdo"; foco visível em todos os controles.
- Visão geral sem workspace: indicadores com "—" e mensagem de workspace não criado. Com conteúdo: números batem com o Studio.
- Admin: skeleton durante o carregamento; erro aparece como alerta.
- Favicon e ícone Apple corretos; título das abas no formato "Página | SMKON".
- Contraste: textos `--muted` (#8F8F8F) sobre `#121212` devem passar WCAG AA para texto pequeno (≈ 5,9:1, conferir).

## 4. Não concluído neste split
- Testes de UI/regressão visual: responsabilidade do validador.
- Páginas dos módulos marcados como "Em breve"/"Planejado" (Produtos, Agentes, Financeiro, Jurídico, Audiência): dependem dos splits S8–S15.
- Identidade azul com mascote (canal de conteúdo): não aplicada; aguarda confirmação do Owner sobre seu uso.
- Fonte "Space Grotesk Pro (personalizada)" do brand sheet: usada a Space Grotesk pública; trocar quando houver arquivo licenciado.
