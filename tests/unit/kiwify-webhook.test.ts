import { test } from "node:test";
import assert from "node:assert/strict";
import {
  verifyKiwifyToken,
  hashKiwifyToken,
  extractKiwifyToken,
  normalizeKiwifyWebhook,
  type KiwifyRawPayload,
} from "../../src/lib/integrations/kiwify/index.ts";

test("Kiwify: validação de token em tempo constante", () => {
  assert.equal(verifyKiwifyToken("secret123", "secret123"), true);
  assert.equal(verifyKiwifyToken("secret123", "wrongSecret"), false);
  assert.equal(verifyKiwifyToken("", "secret123"), false);
  assert.equal(verifyKiwifyToken(null, "secret123"), false);
});

test("Kiwify: hash de token seguro", () => {
  const hash1 = hashKiwifyToken("token_abc");
  const hash2 = hashKiwifyToken("token_abc");
  assert.equal(hash1, hash2);
  assert.equal(hash1.length, 64);
  assert.throws(() => hashKiwifyToken(""), /Token Kiwify inválido/);
});

test("Kiwify: token só é aceito em cabeçalho", () => {
  assert.equal(extractKiwifyToken(new Headers({ "x-kiwify-token": "sig_header_123" })), "sig_header_123");
  assert.equal(extractKiwifyToken(new Headers({ authorization: "Bearer bearer_token_xyz" })), "bearer_token_xyz");
  assert.equal(extractKiwifyToken(new Headers({ authorization: "Basic abc" })), null);
  assert.equal(extractKiwifyToken({ "X-Kiwify-Signature": "rec_sig" }), "rec_sig");
  assert.equal(extractKiwifyToken(new Headers()), null);
});

test("Kiwify: normalização de webhook PII-free e cálculo financeiro", () => {
  const payload: KiwifyRawPayload = {
    order_id: "kw_ord_999888",
    order_status: "paid",
    product_id: "prod_infoproduto_01",
    product_name: "Manual dos Achadinhos Virais",
    payment_method: "pix",
    approved_date: "2026-11-21T15:30:00Z",
    Commissions: {
      charge_amount_cents: 2990, // R$ 29,90
      kiwify_fee_cents: 269,     // R$ 2,69 taxa
      my_commission_cents: 2721, // R$ 27,21 líquido
      currency: "BRL",
    },
    Customer: {
      full_name: "João da Silva", // Deve ser descartado
      email: "joao@example.com",   // Deve ser descartado
      CPF: "123.456.789-00",       // Deve ser descartado
    },
  };

  const normalized = normalizeKiwifyWebhook(payload);

  assert.equal(normalized.platform, "kiwify");
  assert.equal(normalized.externalId, "kw_ord_999888");
  assert.equal(normalized.status, "approved");
  assert.equal(normalized.grossAmountBrl, 29.9);
  assert.equal(normalized.platformFeeBrl, 2.69);
  assert.equal(normalized.netCommissionBrl, 27.21);
  assert.equal(normalized.paymentMethod, "pix");
  assert.equal(normalized.currency, "BRL");
  assert.ok(normalized.payloadHash.length === 64);

  // Garante que nenhum PII vazou no objeto normalizado
  assert.equal((normalized as Record<string, unknown>).Customer, undefined);
  assert.equal((normalized as Record<string, unknown>).full_name, undefined);
  assert.equal((normalized as Record<string, unknown>).email, undefined);
});

test("Kiwify: classifica estorno e chargeback corretamente", () => {
  const refundPayload: KiwifyRawPayload = {
    order_id: "kw_ord_ref_1",
    order_status: "refunded",
  };
  const refundNorm = normalizeKiwifyWebhook(refundPayload);
  assert.equal(refundNorm.status, "refunded");
  assert.equal(refundNorm.eventType, "order_refunded");

  const cbPayload: KiwifyRawPayload = {
    order_id: "kw_ord_cb_2",
    order_status: "chargeback",
  };
  const cbNorm = normalizeKiwifyWebhook(cbPayload);
  assert.equal(cbNorm.status, "chargeback");
  assert.equal(cbNorm.eventType, "chargeback");
});
