# F1 — Documento de cena do Content Studio

Primeira fase do plano do estudo "Content Studio — engenharia reversa de CapCut, Canva, Adobe Express e Photoshop" (22/11/2026).

## O que é

`content_items.scene` guarda o design da peça como um documento JSON em camadas (`src/lib/scene`). É a fonte única da verdade da peça visual:

- o editor (F2) e o agente de IA (F5) só mudam o documento por **operações** validadas (`operations.ts`), com desfazer/refazer (`history.ts`);
- prévia e exportação saem do **mesmo renderizador** (`render.ts`), determinístico e com todo texto escapado;
- o documento entra no **`content_hash`**: mudar o design cria versão nova e uma peça aprovada volta para rascunho.

## Modelo (v1)

| Parte | Conteúdo |
|---|---|
| Documento | `schema: 1`, `kind` (`image` ou `carousel`), largura/altura (64–4096), até 10 páginas, `template` opcional |
| Camadas | `text`, `rect` (com `fitText` para selos que acompanham o texto), `image` (só `media_assets`, licença rastreada), `brand` (elemento oficial parametrizado) |
| Travas | `locked: "brand"` só owner/admin muda; `locked: "position"` permite trocar conteúdo, não geometria |
| Template | id, versão e os parâmetros do formulário, para reabrir a peça no mesmo formulário; `detached: true` quando editada à mão |
| Limites | 256 KB (aplicação e `check` no banco), 120 camadas por página, textos até 2000 caracteres, chaves desconhecidas recusadas |

Elementos de marca (`elements.ts`): `smk-backdrop`, `smk-grid`, `smk-halo`, `smk-logo`, `smk-mascot`, `carousel-dots`, `check-bullet`. Os desenhos foram extraídos dos geradores anteriores sem mudança visual.

## Migração do banner e do carrossel

`generateSmartBannerSvg` e `generatePostSlideSvg` agora renderizam pelos templates `smkon-banner` e `smkon-post`.

Verificação visual (resvg): 275 variações (5 presets × 3 proporções × 6 expressões × combinações de HUD, destaque, preço e subtítulo, mais os posts oficiais em 1:1 e 4:5). Diferença máxima: 1 pixel de antialiasing por peça (0,0001%). Os hashes do SVG dos presets oficiais ficaram em `tests/unit/fixtures/scene-render-snapshots.json`.

Correções que vieram junto:

- **Exportação PNG quebrada:** 180 das 275 variações geravam XML inválido, porque `&` e `<` do texto não eram escapados (ex.: "Tecnologia & Setup"). No navegador a prévia aparecia, mas o `<img>` usado para exportar o PNG falhava em silêncio. O renderizador escapa todo texto.
- Rodapé sem categoria imprimia "UNDEFINED · SMKON CURADORIA INTELIGENTE".
- Ids de gradiente prefixáveis (`idPrefix`), para várias peças na mesma tela não colidirem.

## Banco

Migration `20261122140000_content_scene.sql`:

- coluna `scene jsonb` com `check` de forma mínima e tamanho;
- `content_canonical_hash` inclui a cena **só quando ela existe**: peças sem cena mantêm o hash anterior, então nada aprovado ou agendado muda;
- `content_versions.snapshot` passa a guardar a cena.

Teste SQL `018_content_scene.test.sql`: hash anterior preservado, versão e queda da aprovação, jsonb com chaves em outra ordem não gera versão, snapshot por versão, aprovação pelo hash novo, limites do `check`, viewer só lê, outro workspace não vê.

## API e interface

- `GET /api/content/scene?id=` devolve a cena com versão e hash. A lista da biblioteca não carrega a cena.
- `PUT /api/content/scene` `{ id, scene | null, expectedHash }`: valida o documento inteiro. Responde 409 `stale_version` se a peça mudou desde que foi aberta.
- No Studio, "Salvar capa na peça" e "Salvar carrossel na peça" gravam o design da peça aberta. Ao abrir uma peça, o design salvo volta no formulário de origem.

## Testes

- Unitários: `scene.test.ts` (22) e `content-scene.test.ts` (4). A suíte completa tem 451 testes.
- SQL: 29 arquivos, incluindo o 018.
- E2E: "design da capa salvo na peça cria versão nova, é aprovado e reabre".

## Próximo (F2)

Editor de imagem em camadas sobre este documento: seleção, mover/redimensionar na tela, texto editável, painel de camadas e travas checadas também no servidor (comparar camadas `brand` antes/depois quando houver papel sem permissão de marca).
