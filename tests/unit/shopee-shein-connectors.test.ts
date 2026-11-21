import { test } from "node:test";
import assert from "node:assert/strict";
import {
  generateShopeeTrackedLink,
  calculateShopeeCommission,
} from "../../src/lib/integrations/shopee/index.ts";
import {
  generateSheinTrackedLink,
  calculateSheinPricingAndCommission,
} from "../../src/lib/integrations/shein/index.ts";

test("Shopee: gera links universais rastreados com SubIDs sanitizados", () => {
  const link = generateShopeeTrackedLink({
    originalProductUrl: "https://shopee.com.br/product/12345/67890",
    appId: "smkon_studio",
    subIds: {
      subId1: "reels_post_42",
      subId2: "instagram",
      subId3: "achadinhos_semana",
    },
  });

  assert.ok(link.startsWith("https://s.shopee.com.br/universal-link"));
  assert.ok(link.includes("utm_source=an_smkon"));
  assert.ok(link.includes("utm_medium=affiliates"));
  assert.ok(link.includes("sub_id=reels_post_42"));
  assert.ok(link.includes("sub_id2=instagram"));
  assert.ok(link.includes("sub_id3=achadinhos_semana"));
});

test("Shopee: lança erro se a URL do produto estiver vazia", () => {
  assert.throws(() => {
    generateShopeeTrackedLink({ originalProductUrl: "" });
  }, /URL original do produto Shopee é obrigatória/);
});

test("Shopee: calcula comissão corretamente", () => {
  const comm = calculateShopeeCommission(50.0, 10);
  assert.equal(comm.grossPrice, 50.0);
  assert.equal(comm.commissionRate, 10);
  assert.equal(comm.estimatedEarningsBrl, 5.0);

  const zeroComm = calculateShopeeCommission(-10, -5);
  assert.equal(zeroComm.grossPrice, 0);
  assert.equal(zeroComm.commissionRate, 0);
  assert.equal(zeroComm.estimatedEarningsBrl, 0);
});

test("Shein: gera deep-links com cupons e tags de campanha", () => {
  const link = generateSheinTrackedLink({
    goodsUrl: "https://br.shein.com/goods-p-998877.html",
    affiliateId: "smkon_vip",
    couponCode: "SMKON15",
    campaignTag: "reels_moda",
    creatorTag: "canal_oficial",
  });

  assert.ok(link.startsWith("https://shein.top/m"));
  assert.ok(link.includes("aff_id=smkon_vip"));
  assert.ok(link.includes("coupon=SMKON15"));
  assert.ok(link.includes("cid=reels_moda"));
  assert.ok(link.includes("subid=canal_oficial"));
});

test("Shein: lança erro se a URL estiver vazia", () => {
  assert.throws(() => {
    generateSheinTrackedLink({ goodsUrl: "" });
  }, /URL do produto Shein é obrigatória/);
});

test("Shein: calcula preço final com cupom e comissão do afiliado", () => {
  const result = calculateSheinPricingAndCommission(100.0, 20, 12);
  assert.equal(result.retailPrice, 100.0);
  assert.equal(result.customerSavingsBrl, 20.0); // 20% off
  assert.equal(result.finalCustomerPriceBrl, 80.0);
  assert.equal(result.estimatedCommissionBrl, 9.6); // 12% de R$ 80
});
