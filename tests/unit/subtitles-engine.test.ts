import { test } from "node:test";
import assert from "node:assert/strict";
import {
  detectWordEmoji,
  parseScriptToSubtitles,
  getActiveSubtitle,
  SUBTITLE_THEMES,
  type SubtitleStyle,
} from "../../src/lib/media/subtitles.ts";
import {
  VIRAL_HOOKS,
  DEFAULT_WATERMARK_CONFIG,
  createDefaultComposition,
} from "../../src/lib/media/video-composition.ts";

test("detectWordEmoji: detecta emojis virais para palavras-chave de e-commerce e afiliados", () => {
  assert.equal(detectWordEmoji("dinheiro"), "💰");
  assert.equal(detectWordEmoji("grana"), "💸");
  assert.equal(detectWordEmoji("pix"), "⚡");
  assert.equal(detectWordEmoji("fogo"), "🔥");
  assert.equal(detectWordEmoji("cupom"), "🎟️");
  assert.equal(detectWordEmoji("desconto"), "🏷️");
  assert.equal(detectWordEmoji("urgente"), "🚨");
  assert.equal(detectWordEmoji("shopee"), "📦");
  assert.equal(detectWordEmoji("shein"), "👗");
});

test("detectWordEmoji: trata pontuação e letras maiúsculas corretamente", () => {
  assert.equal(detectWordEmoji("DINHEIRO!"), "💰");
  assert.equal(detectWordEmoji("Pix,"), "⚡");
  assert.equal(detectWordEmoji("Cupom..."), "🎟️");
});

test("detectWordEmoji: retorna undefined para palavras neutras sem gatilho", () => {
  assert.equal(detectWordEmoji("qualquer"), undefined);
  assert.equal(detectWordEmoji("neutro"), undefined);
  assert.equal(detectWordEmoji("tabela"), undefined);
});

test("parseScriptToSubtitles: retorna array vazio para roteiro vazio ou apenas espaços", () => {
  assert.deepEqual(parseScriptToSubtitles("", 15), []);
  assert.deepEqual(parseScriptToSubtitles("   ", 15), []);
});

test("parseScriptToSubtitles: divide o roteiro em segmentos de até 5 palavras com temporização contínua", () => {
  const script = "Confira este produto incrível com desconto exclusivo no link da bio hoje";
  const duration = 10;
  const segments = parseScriptToSubtitles(script, duration);

  assert.ok(segments.length > 0);

  // Primeiro segmento inicia em 0
  assert.equal(segments[0].start, 0);

  // O fim do último segmento deve ser próximo à duração total
  const last = segments[segments.length - 1];
  assert.ok(Math.abs(last.end - duration) < 0.05);

  // Cada segmento possui lista de palavras
  for (const seg of segments) {
    assert.ok(seg.words.length > 0);
    assert.ok(seg.words.length <= 5);
    assert.ok(Boolean(seg.text));

    // O primeiro e último timestamps da palavra devem respeitar os limites do segmento
    assert.ok(seg.words[0].start >= seg.start);
    assert.ok(seg.words[seg.words.length - 1].end <= seg.end + 0.01);
  }
});

test("parseScriptToSubtitles: atribui emojis detectados às palavras individuais", () => {
  const script = "Ganhe dinheiro com cupom na shopee";
  const segments = parseScriptToSubtitles(script, 10);
  const allWords = segments.flatMap((s) => s.words);

  const dinheiroWord = allWords.find((w) => w.word.toLowerCase() === "dinheiro");
  assert.equal(dinheiroWord?.emoji, "💰");

  const cupomWord = allWords.find((w) => w.word.toLowerCase() === "cupom");
  assert.equal(cupomWord?.emoji, "🎟️");

  const shopeeWord = allWords.find((w) => w.word.toLowerCase() === "shopee");
  assert.equal(shopeeWord?.emoji, "📦");
});

test("getActiveSubtitle: identifica corretamente o segmento e a palavra ativa no segundo exato", () => {
  const segments = [
    {
      start: 0,
      end: 2,
      text: "Ganhe dinheiro rápido",
      words: [
        { word: "Ganhe", start: 0, end: 0.6 },
        { word: "dinheiro", start: 0.6, end: 1.3, emoji: "💰" },
        { word: "rápido", start: 1.3, end: 2.0 },
      ],
    },
    {
      start: 2,
      end: 4,
      text: "com cupom exclusivo",
      words: [
        { word: "com", start: 2.0, end: 2.5 },
        { word: "cupom", start: 2.5, end: 3.2, emoji: "🏷️" },
        { word: "exclusivo", start: 3.2, end: 4.0 },
      ],
    },
  ];

  // t = 0.3s -> Primeiro segmento, palavra 0 ("Ganhe")
  const at03 = getActiveSubtitle(segments, 0.3);
  assert.equal(at03.segment?.text, "Ganhe dinheiro rápido");
  assert.equal(at03.activeWordIndex, 0);

  // t = 1.0s -> Primeiro segmento, palavra 1 ("dinheiro")
  const at10 = getActiveSubtitle(segments, 1.0);
  assert.equal(at10.segment?.text, "Ganhe dinheiro rápido");
  assert.equal(at10.activeWordIndex, 1);

  // t = 2.8s -> Segundo segmento, palavra 1 ("cupom")
  const at28 = getActiveSubtitle(segments, 2.8);
  assert.equal(at28.segment?.text, "com cupom exclusivo");
  assert.equal(at28.activeWordIndex, 1);

  // t = 10s (fora do intervalo) -> null
  const at10s = getActiveSubtitle(segments, 10);
  assert.equal(at10s.segment, null);
  assert.equal(at10s.activeWordIndex, -1);
});

test("SUBTITLE_THEMES: todos os estilos possuem propriedades de renderização válidas", () => {
  const requiredStyles: SubtitleStyle[] = ["hormozi", "viral_neon", "cyber_pink", "clean_white"];

  for (const styleKey of requiredStyles) {
    const theme = SUBTITLE_THEMES[styleKey];
    assert.ok(theme, `Tema ${styleKey} deve existir`);
    assert.equal(theme.id, styleKey);
    assert.ok(/^#|rgba/.test(theme.activeColor));
    assert.ok(/^#|rgba/.test(theme.inactiveColor));
    assert.ok(Boolean(theme.fontSize));
    assert.ok(Boolean(theme.strokeWidth));
    assert.ok(Boolean(theme.fontWeight));
  }
});

test("Video Composition: possui catálogo de ganchos virais categorizados", () => {
  assert.ok(VIRAL_HOOKS.length >= 4);
  const categories = new Set(VIRAL_HOOKS.map((h) => h.category));
  assert.ok(categories.has("shein"));
  assert.ok(categories.has("shopee"));
  assert.ok(categories.has("curiosidade"));
  assert.ok(categories.has("infoproduto"));
});

test("Video Composition: configuração padrão de marca d'água SMKON é segura e oficial", () => {
  assert.equal(DEFAULT_WATERMARK_CONFIG.brandName, "SMKON");
  assert.equal(DEFAULT_WATERMARK_CONFIG.position, "top-right");
  assert.equal(DEFAULT_WATERMARK_CONFIG.showCtaOutro, true);
  assert.equal(DEFAULT_WATERMARK_CONFIG.outroDurationSeconds, 3);
});

test("Video Composition: createDefaultComposition inicializa objeto 9:16 completo", () => {
  const comp = createDefaultComposition("Teste Produto", "Meu roteiro de review", "Produto Top");
  assert.equal(comp.aspectRatio, "9:16");
  assert.equal(comp.title, "Teste Produto");
  assert.equal(comp.script, "Meu roteiro de review");
  assert.equal(comp.watermark.brandName, "SMKON");
  assert.ok(comp.hook);
});
