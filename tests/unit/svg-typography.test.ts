import { test } from "node:test";
import assert from "node:assert/strict";
import { applySvgTypography } from "../../src/lib/media/svg-typography.ts";
import { generateSmartBannerSvg, OFFICIAL_SMKON_PRESETS } from "../../src/lib/media/smart-banner-engine.ts";
import { generatePostSlideSvg, OFFICIAL_POST_PRESETS } from "../../src/lib/content/smart-post-generator.ts";

test("applySvgTypography: acrescenta atributos pela classe sem duplicar os existentes", () => {
  const out = applySvgTypography('<text class="sora-badge" x="1" font-weight="700">A</text><text class="inter-body">B</text><rect class="x"/>');
  assert.match(out, /<text class="sora-badge" x="1" font-weight="700" font-family="[^"]+" letter-spacing="0.04em">A<\/text>/);
  assert.equal((out.match(/font-weight=/g) ?? []).length, 1, "font-weight original é mantido");
  assert.match(out, /<text class="inter-body" font-family="Inter, system-ui, sans-serif">B<\/text>/);
  assert.match(out, /<rect class="x"\/>/);
});

test("applySvgTypography: tag autofechada e várias classes", () => {
  assert.match(applySvgTypography('<tspan class="a sora-title"/>'), /^<tspan class="a sora-title" font-family="[^"]+" font-weight="900" letter-spacing="-0.03em"\/>$/);
});

function assertCspSafeSvg(svg: string) {
  assert.ok(!/<style[\s>]/i.test(svg), "SVG não pode ter <style>: a CSP só aceita <style> com nonce");
  assert.ok(!svg.includes("fonts.googleapis.com"), "nenhuma fonte externa");
  // Cada tag de abertura tem atributos únicos (atributo repetido quebra o XML da exportação PNG).
  for (const tag of svg.match(/<[a-zA-Z][^<>]*>/g) ?? []) {
    const names = [...tag.matchAll(/\s([\w:-]+)=/g)].map((match) => match[1]);
    assert.equal(new Set(names).size, names.length, `atributo repetido em ${tag}`);
  }
}

test("banners oficiais: sem <style>, com a tipografia nos atributos", () => {
  for (const config of Object.values(OFFICIAL_SMKON_PRESETS)) {
    const svg = generateSmartBannerSvg(config);
    assertCspSafeSvg(svg);
    assert.match(svg, /class="sora-title"[^>]*font-weight="900"/);
  }
});

test("slides de post: sem <style>, com a tipografia nos atributos", () => {
  for (const pack of Object.values(OFFICIAL_POST_PRESETS)) {
    for (const slide of pack.slides) {
      const svg = generatePostSlideSvg(slide);
      assertCspSafeSvg(svg);
      assert.match(svg, /class="sora-title"[^>]*font-family=/);
    }
  }
});
