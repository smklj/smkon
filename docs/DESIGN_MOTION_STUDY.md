# Estudo — design, animação e dinâmica da interface

**Data:** 18/11/2026 · **Base:** `feature/smkon-production-readiness` (S13 incluso)
**Escopo:** diagnóstico com evidência no código e plano de implementação. Nada foi alterado na interface ainda.
**Restrições do Owner:** identidade monocromática oficial (preto, branco, neutros; cor só com função) e interface predominantemente escura.

## 1. Diagnóstico (o que existe hoje)

| Tema | Evidência no código | Efeito para quem usa |
|---|---|---|
| Movimento | Só **2 animações** no `globals.css` inteiro: a gaveta do menu no celular (`transform 0.2s`) e o shimmer do skeleton | A interface parece estática e "seca" |
| Transições de estado | Hover de botões, linhas e itens da navegação troca a cor **sem `transition`** | O hover pisca em vez de responder |
| Carregamento entre páginas | **Nenhum** `loading.tsx`, `error.tsx` ou `not-found.tsx` em `src/app`. Todas as páginas são dinâmicas e consultam o banco | Ao clicar no menu, nada acontece até a página nova chegar. Parece travado |
| Feedback de ações | Mensagens `feedback-ok/error` aparecem e somem de uma vez, presas no formulário. Não há toast, nem confirmação visual na linha alterada | Fica difícil saber se a ação funcionou, principalmente em listas longas |
| Botões em envio | Só o texto muda ("Salvando…"), sem indicador | Pouca percepção de progresso |
| Dados | A visão geral e o financeiro mostram só números. Não há gráfico, sparkline nem tendência | Falta "pulso" de operação; não dá para ver evolução |
| Hierarquia | Tudo é `panel` com a mesma borda e o mesmo peso. Métricas, listas e formulários competem | Telas longas (`/agentes`, `/admin`) cansam |
| Navegação | Módulos em construção já usáveis (Produtos, Financeiro, Agentes) mostram a etiqueta **"Em breve"** (`AppShell.tsx`) | Etiqueta enganosa: o módulo funciona |
| Acessibilidade de movimento | `prefers-reduced-motion` coberto só nas 2 animações existentes | Precisa virar regra global antes de adicionar movimento |
| Tipografia | Space Grotesk (títulos) + Inter (texto) via `next/font`, com números tabulares nas métricas | **Ponto forte**: manter |
| Foco e contraste | `:focus-visible` com anel duplo, skip link, textos `--text-2`/`--muted` sobre `#0b0b0b` | **Ponto forte**: manter |

Divergência a decidir: o *Brand Guidelines v1* propõe azul elétrico (`#287BFF`) e a fonte Sora, mas a decisão do Owner foi a identidade monocromática. O plano abaixo segue o monocromático e usa o "brilho" só em branco e neutros.

## 2. Princípios propostos

1. **Movimento com função**: confirmar uma ação, mostrar uma relação ou dar continuidade. Nada decorativo em loop.
2. **Rápido e discreto**: 120–200 ms nas interações, até 320 ms em entradas de conteúdo. Uma curva só, `cubic-bezier(0.2, 0, 0, 1)`, na saída.
3. **Só `transform` e `opacity`**, para rodar a 60 fps e não causar re-layout.
4. **Respeito ao `prefers-reduced-motion`**: uma regra global reduz tudo a fade curto ou nada.
5. **Monocromático**: profundidade com luz (branco em baixa opacidade, bordas, sombras suaves), não com cor. Cor só para estado (ok, aviso, erro, info) e para o ícone do módulo.

## 3. Plano de implementação (split S7.2 — "Movimento e feedback")

### Fase A — fundação (baixo risco, alto impacto)
- **Tokens de movimento** no `:root`: `--ease-out`, `--dur-1: 120ms`, `--dur-2: 200ms`, `--dur-3: 320ms`, mais a regra global de `prefers-reduced-motion`.
- **Transições** em botões, linhas, itens da navegação, inputs (borda no foco) e badges. Botão com `:active` em `scale(0.98)`.
- **`loading.tsx` por módulo** com skeleton no formato real de cada página (métricas, lista, formulário), para a navegação responder na hora.
- **`error.tsx` e `not-found.tsx`** no padrão visual, com ação "Tentar de novo".
- **Corrigir a etiqueta da navegação**: "Em construção" para módulos usáveis; "Planejado" só onde não há página.

### Fase B — dinâmica e feedback
- **Toasts** acessíveis (`role="status"`, empilháveis, 4 s, pausam no hover) para resultados de Server Actions, mantendo a mensagem de erro junto do campo.
- **Linha alterada destacada** por ~1 s depois de aprovar, cancelar ou mudar um estado (fade de fundo).
- **Entrada escalonada** de listas e painéis no primeiro render (fade + 4 px, 30 ms entre itens, máximo de 8 itens animados).
- **Contagem animada** nas métricas da visão geral (só na primeira carga, `requestAnimationFrame`, sem biblioteca).
- **Indicador no botão em envio** (spinner monocromático de 14 px) e bloqueio de duplo clique.
- **Transição entre páginas** com a View Transitions API (fade curto do conteúdo, sidebar fixa), onde o navegador suportar.

### Fase C — leitura de dados
- **Sparklines e barras finas** em SVG (sem dependência nova): comissões por estado, publicações por dia, execuções de agentes. Paleta neutra com cor só no estado.
- **Hierarquia**: métricas sem caixa (números grandes sobre o fundo), painéis secundários com borda mais leve, e seções recolhíveis em `/admin` e `/agentes`.
- **Estados vazios com ação** (botão para o próximo passo) em vez de só texto.

### Fora de escopo agora
Mascote animado, Lottie e vídeo na interface: pesam e não ajudam a operação. Ficam para materiais de marca e conteúdo.

## 4. Como validar
- Screenshots e vídeo do E2E (o Playwright já grava) antes e depois de cada fase.
- Checagem com `prefers-reduced-motion: reduce` emulado.
- Nenhuma dependência nova de animação (CSS + Web APIs). Bundle e build verificados no CI.
- Lighthouse de acessibilidade e desempenho no Preview.

## 5. Decisões para o Owner
1. Confirmar o monocromático também para gráficos (cinzas + cor só de estado) ou liberar um acento único.
2. Começar pela Fase A e B juntas (recomendado) ou só pela A.
