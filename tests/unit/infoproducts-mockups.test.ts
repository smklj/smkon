import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MOCKUP_THEMES,
  getMockup3DTransforms,
  type MockupKind,
  type MockupColorTheme,
} from "../../src/lib/media/mockup-generator.ts";
import {
  CONVERSION_BADGE_PRESETS,
  createDefaultBannerConfig,
} from "../../src/lib/media/banner-templates.ts";
import {
  INFOPRODUCT_BLUEPRINTS,
  getBlueprintByNiche,
  compileInfoproductToHtml,
} from "../../src/lib/infoproducts/index.ts";

test("MOCKUP_THEMES: todos os temas possuem paletas e gradientes válidos", () => {
  const themes: MockupColorTheme[] = ["gold-black", "cyber-neon", "clean-minimal", "royal-purple"];

  for (const t of themes) {
    const style = MOCKUP_THEMES[t];
    assert.ok(style, `Tema ${t} deve existir`);
    assert.equal(style.id, t);
    assert.ok(style.backgroundGradient.includes("linear-gradient"));
    assert.ok(style.accentColor.startsWith("#"));
    assert.ok(style.textColor.startsWith("#"));
    assert.ok(style.spineColor.startsWith("#"));
  }
});

test("getMockup3DTransforms: calcula transformações CSS 3D coerentes para cada tipo", () => {
  const kinds: MockupKind[] = ["ebook-3d", "bundle-box-3d", "tablet-app", "device-mockup"];

  for (const k of kinds) {
    const t = getMockup3DTransforms(k);
    assert.ok(t.containerPerspective.includes("px"));
    assert.ok(t.bookTransform.includes("rotateY"));
    assert.ok(t.spineWidth.includes("px"));
    assert.ok(t.shadow.length > 0);
  }

  // E-book 3D tem rotação Y negativa e sombra profunda
  const ebook = getMockup3DTransforms("ebook-3d");
  assert.ok(ebook.bookTransform.includes("-24deg"));
  assert.equal(ebook.spineWidth, "32px");
});

test("Banner Templates: cria configurações com badges de conversão e stickers interativos", () => {
  const feedBanner = createDefaultBannerConfig("Achadinho Shopee", "R$ 39,90", "feed-square");
  assert.equal(feedBanner.format, "feed-square");
  assert.equal(feedBanner.headline, "Achadinho Shopee");
  assert.equal(feedBanner.salePrice, "R$ 39,90");
  assert.equal(feedBanner.badge, "best-seller");
  assert.equal(feedBanner.interactiveSticker, undefined);

  const storyBanner = createDefaultBannerConfig("Top Moda Shein", "R$ 49,90", "story-vertical");
  assert.equal(storyBanner.format, "story-vertical");
  assert.ok(storyBanner.interactiveSticker);
  assert.equal(storyBanner.interactiveSticker?.type, "poll");
  if (storyBanner.interactiveSticker?.type === "poll") {
    assert.ok(storyBanner.interactiveSticker.question.length > 0);
    assert.ok(storyBanner.interactiveSticker.optionA.length > 0);
  }

  // Verifica presets de badges
  assert.ok(CONVERSION_BADGE_PRESETS["free-shipping"].label.includes("FRETE GRÁTIS"));
  assert.ok(CONVERSION_BADGE_PRESETS["discount-tag"].label.includes("OFF"));
});

test("Infoproduct Blueprints: catálogo contém produtos digitais completos e estruturados", () => {
  assert.ok(INFOPRODUCT_BLUEPRINTS.length >= 2);

  for (const bp of INFOPRODUCT_BLUEPRINTS) {
    assert.ok(bp.id);
    assert.ok(bp.title);
    assert.ok(bp.subtitle);
    assert.ok(bp.authorOrBrand);
    assert.ok(bp.targetAudience);
    assert.ok(bp.recommendedPriceBrl > 0);
    assert.ok(bp.chapters.length >= 1);
    assert.ok(bp.salesCopySummary.length > 0);
    assert.ok(bp.checkoutCta.length > 0);

    for (const chap of bp.chapters) {
      assert.ok(chap.number > 0);
      assert.ok(chap.title.length > 0);
      assert.ok(chap.hookSummary.length > 0);
      assert.ok(chap.contentParagraphs.length > 0);
    }
  }

  const achadinhos = getBlueprintByNiche("ecommerce-afiliados");
  assert.equal(achadinhos.id, "blue_achadinhos_virais");
  assert.equal(achadinhos.chapters.length, 3);
});

test("compileInfoproductToHtml: compila infoproduto em documento HTML independente para impressão/PDF", () => {
  const bp = INFOPRODUCT_BLUEPRINTS[0];
  const html = compileInfoproductToHtml(bp);

  assert.ok(html.includes("<!DOCTYPE html>"));
  assert.ok(html.includes(`<title>${bp.title} — ${bp.authorOrBrand}</title>`));
  assert.ok(html.includes(bp.title));
  assert.ok(html.includes(bp.subtitle));
  assert.ok(html.includes(`R$ ${bp.recommendedPriceBrl.toFixed(2)}`));

  // Verifica renderização dos capítulos e checklists
  for (const chap of bp.chapters) {
    assert.ok(html.includes(chap.title));
    assert.ok(html.includes(chap.hookSummary));
  }

  // Verifica regras de impressão @media print
  assert.ok(html.includes("@media print"));
  assert.ok(html.includes("page-break"));
  assert.ok(html.includes("infoproduct-container"));
});
