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
  // Sem link de afiliado inventado: usa exatamente o link informado pelo usuário.
  assert.equal(draft.assetUrl, "https://shopee.com.br/item-top");

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
  assert.equal(draft.assetUrl, undefined);
  assert.ok(draft.caption.includes("SHEIN15"));
  assert.ok(draft.hashtags.includes("#shein"));
});

test("autonomous-generator: gera peça de Infoproduto Digital com preço e checkout", () => {
  const draft = generateAutonomousDraft("digital-infoproduct", "Manual dos Achadinhos");

  assert.ok(draft.title.includes("Manual dos Achadinhos"));
  assert.ok(draft.script.includes("R$ 29.90") || draft.script.includes("R$ 29,90"));
  assert.ok(draft.cta.length > 0);
  assert.ok(draft.hashtags.includes("#infoprodutos"));
  assert.equal(draft.hook.category, "infoproduto");
});

test("autonomous-generator: nenhum preset promete renda nem inventa avaliação, frete ou cupom", () => {
  const forbidden = [/R\$ ?5\.000/i, /faturar/i, /#rendaextra/i, /frete grátis/i, /cupom secreto/i, /garantia total/i, /SHEIN15|SMKON10/];
  for (const preset of ["shopee-viral", "shein-fashion", "digital-infoproduct", "hotmart-course"] as const) {
    const draft = generateAutonomousDraft(preset, "Produto Teste");
    const text = [draft.title, draft.script, draft.caption, draft.cta, draft.hashtags].join("\n");
    for (const pattern of forbidden) assert.doesNotMatch(text, pattern, `${preset}: ${pattern}`);
  }
});
