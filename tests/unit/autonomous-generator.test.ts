import { test } from "node:test";
import assert from "node:assert/strict";
import { generateAutonomousDraft } from "../../src/lib/content/autonomous-generator.ts";

test("autonomous-generator: gera peça completa de Achadinho Shopee com gancho e link de afiliado", () => {
  const draft = generateAutonomousDraft("shopee-viral", "Mini Processador Elétrico", {
    customPromoCode: "SHOPEE20",
    productUrl: "https://shopee.com.br/item-top",
  });

  assert.ok(draft.title.includes("Shopee"));
  assert.ok(draft.title.includes("Mini Processador Elétrico"));
  assert.equal(draft.product, "Mini Processador Elétrico");
  assert.equal(draft.promoCode, "SHOPEE20");
  assert.ok(draft.assetUrl?.includes("s.shopee.com.br"));
  assert.ok(draft.assetUrl?.includes("sub_id=reels_auto"));

  // Estrutura do Roteiro 9:16
  assert.ok(draft.script.includes("[HOOK 0-3s]"));
  assert.ok(draft.script.includes("[DEMONSTRAÇÃO 3-10s]"));
  assert.ok(draft.script.includes("[FECHAMENTO 10-15s]"));
  assert.ok(draft.script.includes("Mini Processador Elétrico"));

  // Redes sociais
  assert.ok(draft.channels.includes("Instagram"));
  assert.ok(draft.channels.includes("TikTok"));
  assert.ok(draft.channels.includes("YouTube"));
  assert.ok(draft.hashtags.includes("#shopee"));
});

test("autonomous-generator: gera peça completa de Moda Shein com cupom e deep-link", () => {
  const draft = generateAutonomousDraft("shein-fashion", "Vestido Alfaiataria", {
    customPromoCode: "SHEIN15",
  });

  assert.ok(draft.title.includes("Shein"));
  assert.equal(draft.promoCode, "SHEIN15");
  assert.ok(draft.assetUrl?.includes("shein.top"));
  assert.ok(draft.assetUrl?.includes("coupon=SHEIN15"));
  assert.ok(draft.caption.includes("SHEIN15"));
  assert.ok(draft.hashtags.includes("#shein"));
});

test("autonomous-generator: gera peça de Infoproduto Digital com preço e checkout", () => {
  const draft = generateAutonomousDraft("digital-infoproduct", "Manual dos Achadinhos");

  assert.ok(draft.title.includes("Manual dos Achadinhos"));
  assert.ok(draft.script.includes("R$ 29.90") || draft.script.includes("R$ 29,90"));
  assert.ok(draft.cta.length > 0);
  assert.ok(draft.hashtags.includes("#kiwify"));
  assert.equal(draft.hook.category, "infoproduto");
});
