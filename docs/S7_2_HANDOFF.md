# S7.2 — Movimento e feedback (fases A e B)

**Branch:** `feature/s7-2-motion-feedback` → PR para `feature/smkon-production-readiness`
**Base:** `docs/DESIGN_MOTION_STUDY.md`. Decisão do Owner: fases A e B juntas. A fase C (gráficos) aguarda a escolha de cor.

## O que mudou

| Fase | Mudança | Arquivos |
|---|---|---|
| A | Tokens de movimento (`--ease-out`, `--dur-1/2/3`) e regra global de `prefers-reduced-motion` | `src/app/globals.css` |
| A | Transições em botões, navegação, links, campos, badges e linhas; `:active` com `scale(0.98)`; indicador da navegação animado | `globals.css` |
| A | `loading.tsx` com esqueleto no formato das páginas (geral, financeiro, studio e listas): a navegação responde na hora | `src/app/(app)/**/loading.tsx`, `src/components/ui/PageSkeleton.tsx` |
| A | `error.tsx` (tentar de novo, código para suporte, sem detalhe interno) e `not-found.tsx` no app e na raiz | `src/app/(app)/error.tsx`, `src/app/(app)/not-found.tsx`, `src/app/not-found.tsx` |
| A | Etiqueta da navegação: módulos usáveis em construção mostram "Beta", não "Em breve" | `src/components/shell/AppShell.tsx` |
| B | Toasts (fila externa ao React, até 3, 4 s, pausam no hover/foco, fecham no botão) para ações de linha que não tinham mensagem de sucesso: dry-run, cancelar agendamento, liberar ferramenta, cancelar execução, revisar evidência, revogar licença, arquivar mídia | `src/lib/ui/toast-store.ts`, `src/components/ui/Toaster.tsx` |
| B | Destaque de ~1,2 s na linha onde a ação aconteceu (Web Animations API) | `Toaster.tsx` (`flashRow`) |
| B | Entrada em sequência dos blocos da página e das primeiras 8 linhas das listas (`fill-mode: backwards`, sem transform residual) | `globals.css` |
| B | Contagem animada nas métricas da visão geral; o HTML do servidor já traz o valor final | `src/components/ui/CountUp.tsx`, `src/app/(app)/page.tsx` |
| B | Indicador de envio (`aria-busy`) em 20 botões de formulário | componentes de formulário |

## Decisões
- **Sem biblioteca nova:** CSS, Web Animations API e `requestAnimationFrame`.
- **Mensagens inline mantidas** onde já existiam (testadas e acessíveis). O toast só entra onde não havia confirmação, para não duplicar anúncios em leitores de tela.
- **Transição entre páginas:** a View Transitions API para navegação no cliente ainda é experimental no Next 16. O efeito equivalente vem do esqueleto (resposta imediata) mais a entrada do conteúdo novo.

## Correção encontrada pelo E2E (não relacionada ao movimento)
A primeira execução do E2E falhou em `products.spec` com "A data de observação não pode estar no futuro." Causa raiz: a data de uma evidência (campo date) virava meio-dia **UTC**, e o valor padrão do campo era o dia em UTC. Resultado: antes das 9h em Brasília, "hoje" era recusado como futuro; depois das 21h, o campo já sugeria o dia seguinte. Era um bug real para quem usa o sistema, e só apareceu porque o teste rodou às 23h20 de Brasília.
- Correção: `workspaceDate()` calcula o dia no fuso de Brasília. "Hoje" usa o instante atual, e um dia passado vira meio-dia de Brasília. Arquivos: `src/lib/products/validation.ts` e `src/app/(app)/produtos/[id]/page.tsx`. Teste unitário novo para 23h20 e 8h de Brasília.

## Testes
- `npm run test:unit`: 67/67 (5 da fila de toasts e 1 do fuso das evidências).
- `typecheck`, `lint` e `build`: sem erros.
- Revisão visual em página de teste local com o CSS compilado: métricas, linhas, botão em envio, esqueleto e toasts.
- CI e E2E: ver PR.

## Pendências
- Fase C: gráficos e hierarquia. Depende da decisão de cor (monocromático ou acento único).
