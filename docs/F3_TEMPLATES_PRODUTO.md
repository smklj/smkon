# F3 — Templates ligados ao produto (ofertas em lote)

Terceira fase do plano do Content Studio. Usa o documento de cena (F1), o editor (F2) e as evidências de produto (`product_evidence`, com fonte, data e revisão humana).

## Regra central

**Preço sempre com fonte e data, e nunca digitado.** Uma camada de texto pode ser ligada (`bind`) a um dado do produto:

| Campo | Texto | Origem |
|---|---|---|
| `product.name` | nome do produto | cadastro |
| `price.value` | `R$ 1.299,90` | evidência de preço **verificada** |
| `price.source` | `Preço em loja.com.br em 19/11/2026` | mesma evidência: domínio do link e data da observação (Brasília) |
| `rating.value` | `★ 4,7/5` | evidência de avaliação verificada |

- O vínculo guarda o produto e a evidência. A evidência é imutável depois da revisão, então a versão aprovada fica presa àquele valor, fonte e data (o documento entra no `content_hash`).
- **Toda página com preço ligado tem a fonte e a data da mesma evidência**, e nenhuma das duas fica oculta. O editor recusa na hora e o servidor recusa ao salvar.
- O texto de uma camada ligada não se edita, nem no editor nem pela API.
  - `PUT /api/content/scene` recalcula cada campo a partir do banco e compara.
  - Se o texto foi trocado, a gravação é recusada com o valor esperado.
- Para usar um preço novo, registre e verifique a evidência e clique em **"Atualizar dados do produto"** no editor. O editor troca para a evidência verificada mais recente.

## Template "Oferta do produto" (`smkon-oferta`)

- Card de oferta com selo e chamada (texto livre da campanha), nome, preço com fonte e data, e avaliação opcional.
- Fundo, grade, halo, logo e mascote são da marca e ficam travados.
- Formatos 1:1, 4:5 e 9:16. Trocar o formato redesenha pelo template e mantém os vínculos.
- O nome não é cortado; o corpo da fonte diminui para nomes longos (mínimo 28 px).

## Ofertas em lote

No Studio, aba **"Ofertas de produto"**:

1. Busca produtos pelo nome (`GET /api/products?q=`). A lista mostra o preço verificado com fonte e data, ou "Sem preço verificado".
2. Você escolhe até 20 produtos, o formato, o selo, a chamada, o mascote, os canais e se mostra a avaliação.
3. A prévia mostra o primeiro produto escolhido. Ela pode ser salva na peça aberta ou aberta no editor.
4. **Gerar** (`POST /api/content/batch`) cria um rascunho por produto, já com o design.
   - A legenda também leva o preço com a fonte e a data.
   - Produtos sem preço verificado, arquivados ou de outro workspace ficam de fora, com o motivo.
   - Nada é aprovado nem publicado: cada rascunho segue o fluxo normal de aprovação da versão exata.

## Fila de publicação

Migration `20261124010000_scene_evidence_checks`. As checagens anteriores não mudam.

| Checagem | Gravidade | Regra |
|---|---|---|
| `scene_evidence` | erro | Produto do workspace; evidência do mesmo produto e verificada; preço observado **no máximo 7 dias** antes do dia da publicação (Brasília) |
| `scene_price_text` | aviso | Texto com preço (R$, US$, €) digitado sem vínculo a evidência |

As duas regras de negócio são decisões iniciais, fáceis de mudar: o prazo de 7 dias (`v_max_age`) e preço digitado à mão ser aviso, não erro.

## Arquivos

| Arquivo | Papel |
|---|---|
| `src/lib/scene/bindings.ts` | formatação dos campos, regra de preço com fonte, conferência e atualização |
| `src/lib/scene/templates/smkon-oferta.ts` | template da oferta |
| `src/lib/content/offer-batch.ts` | plano do lote (função pura) |
| `src/app/api/content/batch/route.ts` | cria os rascunhos |
| `src/app/api/products/bindings/route.ts` | dados verificados mais recentes dos produtos |
| `src/components/studio/OfferStudio.tsx` | aba "Ofertas de produto" |
| `supabase/migrations/20261124010000_scene_evidence_checks.sql` | checagens da fila |

## Testes

- Unidade: `tests/unit/scene-bindings.test.ts`.
  - Formatação; só evidência verificada.
  - Preço digitado recusado no editor e na conferência do servidor.
  - Preço sem fonte recusado.
  - Atualização para a evidência mais nova.
  - Troca de formato pelo template.
  - Plano do lote; preço digitado detectado.
- Banco: `supabase/tests/021_scene_evidence_checks.test.sql`.
  - Preço recente passa; preço com mais de 7 dias bloqueia.
  - Evidência pendente, inexistente ou de outro produto bloqueia; produto de outro workspace bloqueia.
  - Preço digitado gera só aviso.
- E2E: `tests/e2e/studio.spec.mjs`.
  1. Cadastra o produto, registra e verifica preço e avaliação.
  2. Gera em lote e confere a prévia com preço, fonte e data.
  3. Abre no editor: o preço não aceita digitação, e a API recusa um preço forjado.
  4. Troca para 9:16 pelo template e salva.

## Limites conhecidos

- O lote lê o catálogo em páginas de 100 (com busca por nome); não há seleção de "todos os resultados".
- A imagem do produto ainda não entra no template (o catálogo não guarda imagem; dá para adicionar pela biblioteca no editor).
- A legenda gerada não é conferida depois: se for editada à mão, segue as regras de texto atuais.
