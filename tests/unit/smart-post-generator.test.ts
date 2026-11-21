import { test } from "node:test";
import assert from "node:assert/strict";
import {
  generateAutonomousPost,
  generatePostSlideSvg,
  OFFICIAL_POST_PRESETS,
} from "../../src/lib/content/smart-post-generator.ts";

test("Smart Post Generator: gera carrossel completo de 5 slides com narrativa e CTA", () => {
  const post = generateAutonomousPost("carousel-tips", "Teclado Mecânico RGB");

  assert.equal(post.kind, "carousel-tips");
  assert.equal(post.slides.length, 5);
  assert.equal(post.aspectRatio, "1:1");
  assert.ok(post.title.includes("Teclado Mecânico RGB"));

  // Slide 1: Gancho
  assert.equal(post.slides[0].slideNumber, 1);
  assert.equal(post.slides[0].totalSlides, 5);
  assert.ok(post.slides[0].headline.includes("TECLADO MECÂNICO RGB"));

  // Slide 5: Oferta & CTA
  assert.equal(post.slides[4].slideNumber, 5);
  assert.ok(post.slides[4].callToAction?.includes("QUERO"));

  // Legenda e hashtags formatadas
  assert.ok(post.caption.includes("QUERO"));
  assert.ok(post.hashtags.includes("#smkon"));
  assert.ok(post.hashtags.includes("#carrossel"));
});

test("Smart Post Generator: gera batalha para pico de engajamento", () => {
  const post = generateAutonomousPost("battle-poll", "Mouse Sem Fio vs Mouse com Fio");

  assert.equal(post.kind, "battle-poll");
  assert.equal(post.slides.length, 1);
  assert.ok(post.slides[0].badge.includes("BATALHA"));
  assert.ok(post.caption.includes("comentários"));
  assert.ok(post.cta.includes("Vote nos comentários"));
});

test("Smart Post Generator: gera caixinha de pergunta da comunidade", () => {
  const post = generateAutonomousPost("question-box", "Qual o melhor achadinho que você já comprou?");

  assert.equal(post.kind, "question-box");
  assert.ok(post.slides[0].badge.includes("CAIXINHA"));
  assert.equal(post.slides[0].mascotExpression, "pensativo");
  assert.ok(post.caption.includes("opinião sincera"));
});

test("Smart Post Generator: gera post de feed estático com preço e cupom", () => {
  const post = generateAutonomousPost("feed-single", "Mini Aspirador Portátil", {
    customPrice: "R$ 39,90",
    promoCode: "SHOPEE30",
  });

  assert.equal(post.kind, "feed-single");
  assert.ok(post.slides[0].highlightText?.includes("R$ 39,90"));
  assert.ok(post.caption.includes("SHOPEE30"));
  assert.ok(post.caption.includes("R$ 39,90"));
});

test("Smart Post Generator: presets oficiais estão cadastrados e íntegros", () => {
  const presets = Object.keys(OFFICIAL_POST_PRESETS);
  assert.ok(presets.includes("carrossel-5-achados"));
  assert.ok(presets.includes("batalha-setup"));
  assert.ok(presets.includes("pergunta-comunidade"));

  const carrossel = OFFICIAL_POST_PRESETS["carrossel-5-achados"];
  assert.equal(carrossel.slides.length, 5);
});

test("Smart Post Generator: renderização de SVG vetorial para slides", () => {
  const post = OFFICIAL_POST_PRESETS["carrossel-5-achados"];
  const svg = generatePostSlideSvg(post.slides[0], "1:1");

  assert.ok(svg.includes("<svg"));
  assert.ok(svg.includes("viewBox=\"0 0 1080 1080\""));
  assert.ok(svg.includes("SMK"));
  assert.ok(svg.includes("ON"));
  assert.ok(svg.includes("5 ACHADOS DA SHOPEE"));
  assert.ok(svg.includes("1/5")); // Indicador de carrossel
});
