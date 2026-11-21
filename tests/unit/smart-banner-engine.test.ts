import { test } from "node:test";
import assert from "node:assert/strict";
import {
  inferSmartBannerConfig,
  getBannerDimensions,
  generateSmartBannerSvg,
  OFFICIAL_SMKON_PRESETS,
} from "../../src/lib/media/smart-banner-engine.ts";
import { BANNER_ARCHETYPES, MASCOT_EXPRESSIONS, SMKON_BRAND_TOKENS } from "../../src/lib/media/brand-system.ts";

test("SMKON Brand System: tokens fundamentais da marca", () => {
  assert.equal(SMKON_BRAND_TOKENS.brandName, "SMKON");
  assert.equal(SMKON_BRAND_TOKENS.slogan, "Achados inteligentes. Escolhas melhores.");
  assert.equal(SMKON_BRAND_TOKENS.colors.bgDark, "#080D12");
  assert.equal(SMKON_BRAND_TOKENS.colors.primaryBlue, "#2563FF");
  assert.equal(SMKON_BRAND_TOKENS.colors.electricBlue, "#287BFF");

  assert.ok(MASCOT_EXPRESSIONS.padrao);
  assert.ok(MASCOT_EXPRESSIONS.feliz);
  assert.ok(MASCOT_EXPRESSIONS.pensativo);
  assert.ok(MASCOT_EXPRESSIONS.surpreso);
  assert.ok(MASCOT_EXPRESSIONS.confirmado);
  assert.ok(MASCOT_EXPRESSIONS.oferta);

  assert.ok(BANNER_ARCHETYPES["top-list"]);
  assert.ok(BANNER_ARCHETYPES["review-verdict"]);
  assert.ok(BANNER_ARCHETYPES["cost-benefit"]);
  assert.ok(BANNER_ARCHETYPES["offer-blast"]);
  assert.ok(BANNER_ARCHETYPES["smart-recommend"]);
});

test("Smart Banner Engine: inferência para Review e Veredito (Pensativo)", () => {
  const config = inferSmartBannerConfig({
    title: "Headset Gamer Sem Fio: Vale a pena comprar em 2026?",
    product: "Headset Gamer Pro",
    category: "Reviews",
  });

  assert.equal(config.archetype, "review-verdict");
  assert.equal(config.mascotExpression, "pensativo");
  assert.equal(config.hudContent, "headphone");
  assert.ok(config.headline.includes("HEADSET"));
  assert.equal(config.watermark, true);
});

test("Smart Banner Engine: inferência para Achados Shopee e Oferta Relâmpago", () => {
  const config = inferSmartBannerConfig({
    title: "Achadinho da Shopee por R$ 39,90",
    product: "Mini Aspirador Portátil",
    price: "39,90",
  });

  assert.equal(config.archetype, "offer-blast");
  assert.equal(config.mascotExpression, "oferta");
  assert.equal(config.hudContent, "discount");
  assert.equal(config.priceTag, "R$ 39,90");
});

test("Smart Banner Engine: inferência para Setup Custo-Benefício", () => {
  const config = inferSmartBannerConfig({
    title: "Setup Gamer Custo-Benefício Completo",
    product: "Teclado Mecânico RGB",
    category: "Setup",
  });

  assert.equal(config.archetype, "cost-benefit");
  assert.equal(config.mascotExpression, "confirmado");
  assert.equal(config.hudContent, "tech");
});

test("Smart Banner Engine: inferência para Top Listas e Recomendações", () => {
  const config = inferSmartBannerConfig({
    title: "Top 5 Melhores Periféricos Baratos",
    product: "Mouse Ergonômico",
  });

  assert.equal(config.archetype, "top-list");
  assert.equal(config.mascotExpression, "confirmado");
});

test("Smart Banner Engine: inferência para Infoprodutos e Ebooks", () => {
  const config = inferSmartBannerConfig({
    title: "Manual dos Achadinhos Virais Ebook",
    product: "Infoproduto Digital",
  });

  assert.equal(config.archetype, "smart-recommend");
  assert.equal(config.mascotExpression, "feliz");
});

test("Smart Banner Engine: dimensões por aspect ratio", () => {
  const d169 = getBannerDimensions("16:9");
  assert.equal(d169.width, 1280);
  assert.equal(d169.height, 720);

  const d916 = getBannerDimensions("9:16");
  assert.equal(d916.width, 720);
  assert.equal(d916.height, 1280);

  const d11 = getBannerDimensions("1:1");
  assert.equal(d11.width, 1080);
  assert.equal(d11.height, 1080);
});

test("Smart Banner Engine: geração de SVG vetorial válido e fiel à marca", () => {
  const preset = OFFICIAL_SMKON_PRESETS["top-perifericos"];
  const svg = generateSmartBannerSvg(preset);

  assert.ok(svg.includes("<svg"));
  assert.ok(svg.includes("viewBox=\"0 0 1280 720\""));
  assert.ok(svg.includes("SMK"));
  assert.ok(svg.includes("ON"));
  assert.ok(svg.includes("Achados inteligentes. Escolhas melhores."));
  assert.ok(svg.includes("#080D12"));
  assert.ok(svg.includes("TOP 5 PERIFÉRICOS"));
  assert.ok(svg.includes("ATÉ R$300"));
});

test("Smart Banner Engine: geração de SVG vertical 9:16 para Reels e TikTok", () => {
  const preset = OFFICIAL_SMKON_PRESETS["shorts-achado-hoje"];
  const svg = generateSmartBannerSvg(preset);

  assert.ok(svg.includes("viewBox=\"0 0 720 1280\""));
  assert.ok(svg.includes("ACHADO DE HOJE"));
});
