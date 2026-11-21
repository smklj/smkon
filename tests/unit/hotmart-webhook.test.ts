import test from "node:test";
import assert from "node:assert/strict";
import {
  extractHotmartToken,
  hashHotmartToken,
  verifyHotmartToken,
} from "../../src/lib/integrations/hotmart/validator.ts";
import { normalizeHotmartWebhook } from "../../src/lib/integrations/hotmart/normalizer.ts";
import type { HotmartRawPayload } from "../../src/lib/integrations/hotmart/types.ts";
import { isMachineRoute } from "../../src/lib/supabase/machine-routes.ts";
import { REVENUE_PROVIDERS } from "../../src/lib/integrations/registry.ts";

test("Hotmart validator: verifyHotmartToken compara em tempo constante", () => {
  const secret = "secret_hottok_token_abc123xyz456";
  assert.equal(verifyHotmartToken(secret, secret), true);
  assert.equal(verifyHotmartToken(" " + secret + " ", secret), true);
  assert.equal(verifyHotmartToken("wrong_token", secret), false);
  assert.equal(verifyHotmartToken("", secret), false);
  assert.equal(verifyHotmartToken(null, secret), false);
  assert.equal(verifyHotmartToken(undefined, secret), false);
  assert.equal(verifyHotmartToken(secret, ""), false);
  assert.equal(verifyHotmartToken(secret, null), false);
});

test("Hotmart validator: hashHotmartToken gera sha256 consistente", () => {
  const token = "my_token_123";
  const hash1 = hashHotmartToken(token);
  const hash2 = hashHotmartToken(token);
  assert.equal(hash1, hash2);
  assert.match(hash1, /^[a-f0-9]{64}$/);
  assert.throws(() => hashHotmartToken(""), /Invalid token/);
});

test("Hotmart validator: extractHotmartToken extrai de headers, query e body", () => {
  // Headers (Request/Headers object)
  const headersObj = new Headers();
  headersObj.set("x-hotmart-hottok", "header_token_1");
  assert.equal(extractHotmartToken(headersObj), "header_token_1");

  // Headers (record)
  assert.equal(extractHotmartToken({ "x-hotmart-hottok": "record_token_1" }), "record_token_1");
  assert.equal(extractHotmartToken({ hottok: "hottok_header" }), "hottok_header");

  // Query param
  const params = new URLSearchParams("hottok=query_token_123");
  assert.equal(extractHotmartToken(new Headers(), params), "query_token_123");

  // Body: body.hottok
  assert.equal(extractHotmartToken(new Headers(), null, { hottok: "body_token" }), "body_token");

  // Body: body.data.hottok
  assert.equal(extractHotmartToken(new Headers(), null, { data: { hottok: "data_token" } }), "data_token");

  // Nenhum token
  assert.equal(extractHotmartToken(new Headers(), null, {}), null);
});

test("Hotmart normalizer: normalização PII-free de owned_sales (venda própria)", () => {
  const rawPayload: HotmartRawPayload = {
    id: "evt-001",
    creation_date: 1700000000000,
    event: "PURCHASE_APPROVED",
    version: "2.0.0",
    data: {
      product: {
        id: 12345,
        name: "Curso de Testes",
        has_co_production: false,
      },
      buyer: {
        name: "Fulano de Tal",
        email: "fulano@example.com",
        checkout_phone: "11999999999",
        document: "12345678900",
      },
      purchase: {
        approved_date: 1700000000000,
        order_date: 1699999900000,
        status: "APPROVED",
        transaction: "HP001234567890",
        full_price: {
          value: 497.0,
          currency_value: "BRL",
        },
        price: {
          value: 497.0,
          currency_value: "BRL",
        },
      },
      commissions: [
        {
          source: "PRODUCER",
          value: 447.3,
          currency_value: "BRL",
        },
        {
          source: "MARKETPLACE",
          value: 49.7,
          currency_value: "BRL",
        },
      ],
    },
  };

  const normalized = normalizeHotmartWebhook(rawPayload, "owned_sales");

  assert.equal(normalized.external_id, "HP001234567890");
  assert.equal(normalized.event_type, "PURCHASE_APPROVED");
  assert.equal(normalized.domain, "owned_sales");
  assert.equal(normalized.currency, "BRL");
  assert.equal(normalized.gross_amount, 497.0);
  assert.equal(normalized.commission_amount, 447.3);
  assert.equal(normalized.fee_amount, 49.7);
  assert.equal(normalized.refund_amount, 0);
  assert.equal(normalized.order_status, "paid");
  assert.equal(normalized.product_id, "12345");
  assert.equal(normalized.product_name, "Curso de Testes");
  assert.match(normalized.payload_hash, /^[a-f0-9]{64}$/);
  assert.equal(normalized.normalization_version, 1);

  // Garantia estrita PII-free: nenhum dado pessoal do comprador pode existir no resultado
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawAny = normalized as any;
  assert.equal(rawAny.buyer, undefined);
  assert.equal(rawAny.email, undefined);
  assert.equal(rawAny.name, undefined);
  assert.equal(rawAny.document, undefined);
  assert.equal(rawAny.phone, undefined);
});

test("Hotmart normalizer: normalização PII-free de affiliate (comissão de afiliado)", () => {
  const rawPayload: HotmartRawPayload = {
    id: "evt-002",
    creation_date: 1700000000000,
    event: "PURCHASE_APPROVED",
    version: "2.0.0",
    data: {
      product: {
        id: 99999,
        name: "E-book Estratégia",
      },
      buyer: {
        name: "Beltrano",
        email: "beltrano@example.com",
      },
      purchase: {
        approved_date: 1700000000000,
        status: "APPROVED",
        transaction: "HP9988776655",
        full_price: {
          value: 100.0,
          currency_value: "BRL",
        },
      },
      commissions: [
        {
          source: "PRODUCER",
          value: 60.0,
          currency_value: "BRL",
        },
        {
          source: "AFFILIATE",
          value: 40.0,
          currency_value: "BRL",
        },
      ],
    },
  };

  const normalized = normalizeHotmartWebhook(rawPayload, "affiliate");

  assert.equal(normalized.external_id, "HP9988776655");
  assert.equal(normalized.domain, "affiliate");
  assert.equal(normalized.currency, "BRL");
  assert.equal(normalized.gross_amount, 100.0);
  assert.equal(normalized.commission_amount, 40.0);
  assert.equal(normalized.commission_status, "approved");
});

test("Hotmart normalizer: mapeamento de status e ciclo de vida S8", () => {
  const basePayload: HotmartRawPayload = {
    data: {
      purchase: {
        transaction: "HP11223344",
        full_price: { value: 200, currency_value: "BRL" },
        approved_date: 1700000000000,
      },
      commissions: [{ source: "AFFILIATE", value: 50, currency_value: "BRL" }],
    },
  };

  // PURCHASE_COMPLETE -> settled
  const settled = normalizeHotmartWebhook({ ...basePayload, event: "PURCHASE_COMPLETE" }, "affiliate");
  assert.equal(settled.commission_status, "settled");

  // PURCHASE_REFUNDED -> reversed / refund_amount
  const refunded = normalizeHotmartWebhook({ ...basePayload, event: "PURCHASE_REFUNDED" }, "affiliate");
  assert.equal(refunded.commission_status, "reversed");
  assert.equal(refunded.refund_amount, 200);

  // PURCHASE_CHARGEBACK -> reversed
  const chargeback = normalizeHotmartWebhook({ ...basePayload, event: "PURCHASE_CHARGEBACK" }, "affiliate");
  assert.equal(chargeback.commission_status, "reversed");

  // PURCHASE_CANCELLED -> cancelled
  const cancelled = normalizeHotmartWebhook({ ...basePayload, event: "PURCHASE_CANCELLED" }, "affiliate");
  assert.equal(cancelled.commission_status, "cancelled");

  // PURCHASE_DELAYED -> pending
  const delayed = normalizeHotmartWebhook({ ...basePayload, event: "PURCHASE_DELAYED" }, "affiliate");
  assert.equal(delayed.commission_status, "pending");
});

test("Hotmart normalizer: payload hash é determinístico e detecta mutações", () => {
  const payload1: HotmartRawPayload = {
    data: {
      purchase: {
        transaction: "HP12345",
        full_price: { value: 100, currency_value: "BRL" },
        approved_date: 1700000000000,
      },
    },
    event: "PURCHASE_APPROVED",
  };

  const norm1 = normalizeHotmartWebhook(payload1, "owned_sales");
  const norm2 = normalizeHotmartWebhook(payload1, "owned_sales");
  assert.equal(norm1.payload_hash, norm2.payload_hash);

  const payloadMutated: HotmartRawPayload = {
    ...payload1,
    data: {
      ...payload1.data,
      purchase: {
        ...payload1.data?.purchase,
        full_price: { value: 150, currency_value: "BRL" },
      },
    },
  };
  const normMutated = normalizeHotmartWebhook(payloadMutated, "owned_sales");
  assert.notEqual(norm1.payload_hash, normMutated.payload_hash);
});

test("Hotmart normalizer: rejeita transação ausente ou moeda inválida", () => {
  assert.throws(
    () => normalizeHotmartWebhook({ data: {} } as HotmartRawPayload, "owned_sales"),
    /Invalid or missing Hotmart transaction identifier/,
  );

  assert.throws(
    () =>
      normalizeHotmartWebhook(
        {
          data: {
            purchase: {
              transaction: "HP123",
              price: { currency_value: "INVALID" },
            },
          },
        } as HotmartRawPayload,
        "owned_sales",
      ),
    /Invalid Hotmart currency code/,
  );
});

test("Proxy: isMachineRoute reconhece rotas de webhook", () => {
  assert.equal(isMachineRoute("/api/agents/worker"), true);
  assert.equal(isMachineRoute("/api/webhooks/hotmart"), true);
  assert.equal(isMachineRoute("/api/webhooks/any-provider"), true);
  assert.equal(isMachineRoute("/api/products"), false);
  assert.equal(isMachineRoute("/login"), false);
});

test("Registry: Hotmart está ativo com domínios owned_sales e affiliate", () => {
  const hotmart = REVENUE_PROVIDERS.find((p) => p.provider === "hotmart");
  assert.ok(hotmart);
  assert.equal(hotmart?.phase, "active");
  assert.deepEqual(hotmart?.domains, ["owned_sales", "affiliate"]);
});
