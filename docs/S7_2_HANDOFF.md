# S7.2 — Movimento e feedback (fases A e B)

**Branch:** `feature/s7-2-motion-feedback` → PR para `feature/smkon-production-readiness`
**Base:** `docs/DESIGN_MOTION_STUDY.md`. Decisão do Owner: fases A e B juntas. Fase C delegada ("faça o que achar melhor"): **monocromático, cor só para estado**, seguindo a decisão oficial de identidade.

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
- `npm run test:unit`: 68/68 (inclui toasts, fuso das evidências e séries diárias).
- `npm run test:db`: 13/13 arquivos; `013_overview_trends` 10/10.
- `typecheck`, `lint` e `build`: sem erros.
- Revisão visual em página de teste local com o CSS compilado: métricas, linhas, botão em envio, esqueleto e toasts.
- CI e E2E: ver PR.

## Fase C — leitura de dados e hierarquia

| Mudança | Arquivos |
|---|---|
| `workspace_overview` passa a devolver `trends`: conteúdos criados (14 dias), publicações agendadas (próximos 7 dias) e execuções de agentes (14 dias), por dia no fuso de Brasília, com todos os dias preenchidos. As chaves anteriores não mudam | `supabase/migrations/20261119030000_workspace_overview_trends.sql`, `supabase/tests/013_overview_trends.test.sql` (10 checagens) |
| Barras diárias (série única, escala a partir de zero, dia atual destacado, tooltip ao passar o mouse, tabela para leitores de tela) | `src/components/charts/DailyBars.tsx` |
| Barra segmentada dos estados da comissão: degraus de cinza (estágio mais avançado mais claro) e vermelho só para estorno, com legenda em texto e valores | `src/components/charts/StateBar.tsx` |
| Visão geral: indicadores sem caixa (números maiores), painel "Ritmo da operação" e barra de estados em Afiliados | `src/app/(app)/page.tsx`, `globals.css` |
| Admin: "Modelo operacional" e "Integrações planejadas" viram seções recolhíveis (referência) | `src/app/(app)/admin/page.tsx` |
| Estados vazios da visão geral com o próximo passo (criar conteúdo, agendar) | `src/app/(app)/page.tsx` |

Ambientes: migration aplicada no **staging**. A função confere por md5 (`cbe6fe06…`) com um banco local montado a partir do Git e foi executada como membro real (14/7/14 dias; último dia = hoje em Brasília). A produção é aplicada junto do release.

## Pendências
- Gráficos de financeiro por período (comissões por dia) quando houver ingestão real (S11).
