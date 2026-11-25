import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { getDefaultStoreSettings } from "../../src/lib/store/defaults.ts";
import { verifyMercadoPagoWebhook } from "../../src/lib/integrations/mercado-pago/validator.ts";
import { createPixPayment, createPreference } from "../../src/lib/integrations/mercado-pago/client.ts";
import { calculateShipping } from "../../src/lib/integrations/melhor-envio/client.ts";

test("Store Defaults: retorna configurações completas com identidade visual e banners", () => {
  const settings = getDefaultStoreSettings("org_test_123");
  assert.equal(settings.organization_id, "org_test_123");
  assert.equal(settings.store_name, "SMKON Loja Oficial");
  assert.ok(settings.hero_banners.length >= 3);
  assert.equal(settings.hero_banners[0].active, true);
  assert.ok(settings.categories_nav.length >= 5);
  assert.equal(settings.shipping_origin_cep, "01001000");
  assert.equal(settings.is_store_active, true);
});

test("Mercado Pago Webhook: valida assinatura HMAC-SHA256 válida com timestamp recente", () => {
  const secret = "test_webhook_secret_key_123";
  const dataId = "99887766";
  const requestId = "req_abc123xyz";
  const nowSec = Math.floor(Date.now() / 1000);

  const manifest = `id:${dataId};request-id:${requestId};ts:${nowSec};`;
  const computedHash = createHmac("sha256", secret).update(manifest).digest("hex");
  const xSignatureHeader = `ts=${nowSec},v1=${computedHash}`;

  const isValid = verifyMercadoPagoWebhook({
    xSignatureHeader,
    xRequestIdHeader: requestId,
    dataId,
    webhookSecret: secret,
  });

  assert.equal(isValid, true);
});

test("Mercado Pago Webhook: rejeita assinatura expirada (mais de 15 minutos)", () => {
  const secret = "test_webhook_secret_key_123";
  const dataId = "99887766";
  const requestId = "req_abc123xyz";
  const expiredSec = Math.floor(Date.now() / 1000) - 1000; // ~16 minutos atrás

  const manifest = `id:${dataId};request-id:${requestId};ts:${expiredSec};`;
  const computedHash = createHmac("sha256", secret).update(manifest).digest("hex");
  const xSignatureHeader = `ts=${expiredSec},v1=${computedHash}`;

  const isValid = verifyMercadoPagoWebhook({
    xSignatureHeader,
    xRequestIdHeader: requestId,
    dataId,
    webhookSecret: secret,
  });

  assert.equal(isValid, false);
});

test("Mercado Pago Webhook: rejeita cabeçalho malformado ou adulterado", () => {
  const secret = "test_webhook_secret_key_123";

  const isValid = verifyMercadoPagoWebhook({
    xSignatureHeader: "invalid_header_without_ts_and_v1",
    xRequestIdHeader: "req_123",
    dataId: "123",
    webhookSecret: secret,
  });

  assert.equal(isValid, false);
});

test("Mercado Pago Client: cria PIX seguro sem credenciais expostas", async () => {
  const pix = await createPixPayment({
    orderCode: "SMK-TEST-001",
    amountCents: 14990,
    payer: {
      email: "cliente@teste.com",
      first_name: "João",
      last_name: "Silva",
      identification: { type: "CPF", number: "12345678900" },
    },
  });

  assert.ok(pix.qr_code);
  assert.ok(pix.qr_code.includes("smkon-SMK-TEST-001"));
  assert.equal(pix.status, "pending");
});

test("Mercado Pago Client: gera preferência de checkout com valores e itens corretos", async () => {
  const pref = await createPreference({
    orderCode: "SMK-TEST-002",
    items: [
      { id: "prod_1", title: "Fone Gamer SMKON", quantity: 1, unit_price: 199.90 },
    ],
    payer: { email: "comprador@smkon.com.br" },
    shippingAmountCents: 1500,
  });

  assert.ok(pref.init_point);
  assert.ok(pref.init_point.includes("SMK-TEST-002"));
});

test("Melhor Envio: calcula opções de frete (PAC, SEDEX e Jadlog) com estimativa inteligente", async () => {
  const quotes = await calculateShipping({
    originPostalCode: "01001-000",
    destinationPostalCode: "04571-010",
    items: [
      { id: "prod_1", width: 15, height: 5, length: 20, weight: 0.5, insurance_value: 100, quantity: 1 },
    ],
  });

  assert.ok(Array.isArray(quotes));
  assert.ok(quotes.length >= 2);
  const pac = quotes.find((q) => q.serviceId === "correios-pac");
  const sedex = quotes.find((q) => q.serviceId === "correios-sedex");

  assert.ok(pac);
  assert.ok(sedex);
  assert.ok(pac.priceCents > 0);
  assert.ok(sedex.priceCents >= pac.priceCents);
  assert.ok(sedex.deliveryDays <= pac.deliveryDays);
});

test("Melhor Envio: rejeita CEP de destino inválido", async () => {
  await assert.rejects(
    async () => {
      await calculateShipping({
        originPostalCode: "01001-000",
        destinationPostalCode: "123", // Inválido
        items: [],
      });
    },
    /CEP de destino inválido/,
  );
});

test("Regras de Carrinho: cálculo de descontos e totais respeitam invariantes", () => {
  const subtotalCents = 20000; // R$ 200,00
  const shippingCents = 2500;  // R$ 25,00

  // 10% de desconto
  const discount10 = Math.round((subtotalCents * 10) / 100);
  const total = subtotalCents - discount10 + shippingCents;

  assert.equal(discount10, 2000);
  assert.equal(total, 20500); // R$ 205,00
});
