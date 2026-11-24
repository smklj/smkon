# F2 — Editor de camadas do Content Studio

Segunda fase do plano do estudo "Content Studio — engenharia reversa de CapCut, Canva, Adobe Express e Photoshop". Usa o documento de cena da F1 (`content_items.scene`).

## O que o operador faz

No Studio, "Editar em camadas" (na capa da marca ou em Posts e carrosséis) abre o editor:

| Ação | Como |
|---|---|
| Selecionar | clique na tela ou na lista de camadas |
| Mover | arrastar (um arrasto = um passo de desfazer); setas movem 1 px, Shift+setas 10 px |
| Redimensionar | alça no canto inferior direito. Forma e imagem mudam largura/altura; texto muda o corpo da fonte; marca muda a escala |
| Texto | duplo clique (ou Enter) escreve direto na tela; o painel edita fonte, tamanho, peso, alinhamento e cor |
| Camadas | lista de cima para baixo: ocultar, frente/trás, travar posição, destravar (owner/admin), excluir |
| Propriedades | X, Y, rotação, opacidade e campos do tipo da camada; confirmam no Enter ou ao sair do campo |
| Adicionar | texto, forma, imagem da biblioteca (com a situação da licença) |
| Desfazer/refazer | botões, Ctrl+Z e Ctrl+Shift+Z (ou Ctrl+Y), até 100 passos |
| Formato | 1:1, 4:5 e 9:16. Peça ainda no template: o template oficial redesenha. Editada à mão (ou proporção que o template não tem): adaptação automática centralizada, para o operador ajustar |
| Exportar | PNG ou JPG no tamanho do documento, página atual do carrossel |
| Salvar | grava o documento na peça (`PUT /api/content/scene`, com `expectedHash`); cria versão nova e uma peça aprovada volta para rascunho |

Uma peça editada à mão (`template.detached`) não volta para o formulário do template: ao reabrir, o Studio oferece "Abrir no editor de camadas".

## Travas

- `locked: "brand"`: o editor não move, não edita, não oculta e não exclui. Owner/admin precisam destravar antes (ação explícita na lista).
- `locked: "position"`: conteúdo e cores editáveis, geometria fixa. Qualquer um trava; só owner/admin destrava (mesma regra no editor e no servidor).
- **Servidor**: o `PUT` compara o documento recebido com o gravado (`src/lib/scene/locks.ts`). Sem permissão de marca, camada da marca não muda, não some e não é criada; camada com posição travada não muda de geometria nem perde a trava. Vale para qualquer cliente da API, não só para o editor.
- Hoje só owner e admin gravam conteúdo (RLS de `content_items`), e ambos têm permissão de marca. A conferência no servidor protege novos papéis e agentes que venham a gravar o design.

## Imagens

- Só mídia da biblioteca (`media_assets`) do próprio workspace e não arquivada; o `PUT` recusa o resto.
- O editor pede URLs assinadas de 10 minutos (`POST /api/media/signed-urls`, até 50 ids). A lista da biblioteca aceita `?signed=1` para mostrar miniaturas.
- Na exportação, as imagens entram no SVG como data URL (um SVG desenhado no canvas não carrega URL externa).
- **Fila de publicação** (migration `20261123220000_scene_media_licenses`): nova checagem `scene_media`, bloqueante. Cada imagem do design precisa existir no workspace da peça, não estar arquivada e ter licença comercial válida na data agendada. As checagens anteriores não mudam (`publication_checks_base` + a nova).

## Arquivos

| Arquivo | Papel |
|---|---|
| `src/lib/scene/locks.ts` | travas conferidas no servidor |
| `src/lib/scene/geometry.ts` | mover, redimensionar, novas camadas, formatos e adaptação (funções puras) |
| `src/lib/scene/templates/index.ts` | troca de formato pelo template ou pela adaptação |
| `src/components/studio/scene-editor/` | editor (`SceneEditor`), painéis, biblioteca, exportação |
| `src/app/api/media/signed-urls/route.ts` | URLs assinadas das imagens do design |
| `supabase/migrations/20261123220000_scene_media_licenses.sql` | checagem `scene_media` na fila |

## Testes

- Unidade: `tests/unit/scene-editor.test.ts` (travas no servidor, regra da trava de posição, geometria, formatos, render anotado).
- Banco: `supabase/tests/020_scene_media_licenses.test.sql` (sem imagens, licenciada, sem licença, arquivada, de outro workspace, licença que vence antes da data, funções fora da API).
- E2E: `tests/e2e/studio.spec.mjs` — texto direto na tela, arrasto e desfazer, Delete recusado na camada da marca, forma redimensionada, 9:16, exportação PNG, salvar e reabrir no editor.

## Limites conhecidos

- Rotação só pelo painel (sem alça de girar); seleção de uma camada por vez.
- Texto em linha única, como no renderizador da F1.
- A exportação usa as fontes instaladas no navegador (sem embutir Sora/Inter no arquivo), igual à exportação anterior.
- Elementos de marca não têm propriedades editáveis no painel (só escala e posição, quando destravados).
- O caminho de imagens no navegador (biblioteca, URLs assinadas, exportação com imagem embutida) ainda não tem teste automatizado: o E2E não adiciona imagem porque depende do acervo do workspace de teste. O render e a validação no servidor têm testes de unidade e de banco.
