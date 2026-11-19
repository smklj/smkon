import { test } from "node:test";
import assert from "node:assert/strict";
import { affiliateOpen, costPerClick, emptyOverview, parseOverview, providerLabel, seriesTotal } from "../../src/lib/overview/types.ts";

test("resposta ausente vira painel zerado, sem lançar", () => {
  const empty = emptyOverview();
  assert.equal(empty.content.total, 0);
  assert.deepEqual(empty.approval_queue, []);
  assert.deepEqual(empty.finance.affiliate, []);
  assert.deepEqual(empty.connections.items, []);
  assert.equal(empty.finance.period_days, 30);
  assert.deepEqual(parseOverview("lixo"), empty);
  assert.deepEqual(parseOverview([1, 2]), empty);
});

test("normaliza a resposta do banco", () => {
  const parsed = parseOverview({
    generated_at: "2026-11-18T21:00:00Z",
    content: { total: 3, draft: 2, approved: 1, archived: 0 },
    approval_queue: [
      { id: "c1", title: "Peça", product: "P", version: 2, updated_at: "2026-11-18T20:00:00Z" },
      { title: "sem id é descartado" },
    ],
    products: { total: 1, discovered: 1, evidence_pending: "4" },
    publication: { next_7_days: 1, upcoming: [{ id: "j1", title: "Peça", channel: "Instagram", scheduled_for: "2026-11-20T13:00:00Z", status: "scheduled" }] },
    finance: {
      period_days: 30,
      affiliate: [{ currency: "BRL", conversions: 2, forecast: 10, approved: 5, settled: "1.5", paid: 3, reversed: 0 }],
      owned_sales: [{ currency: "BRL", orders: 2, gross: 150, refunds: 50, fees: 18 }],
      paid_media: [{ currency: "USD", spend: 50, impressions: 1500, clicks: 0 }],
    },
    connections: {
      total: 2,
      connected: 1,
      attention: 1,
      items: [
        { id: "s1", provider: "mercado_livre", domain: "owned_sales", status: "reauthorization_required", display_name: null, last_synced_at: null },
        { id: "s2", provider: "x", domain: "affiliate", status: "desconhecido" },
      ],
    },
  });
  assert.equal(parsed.approval_queue.length, 1);
  assert.equal(parsed.approval_queue[0].version, 2);
  assert.equal(parsed.products.evidence_pending, 4, "numeric em string é aceito");
  assert.equal(parsed.products.selected, 0, "campo ausente vira 0");
  assert.equal(parsed.publication.upcoming[0].channel, "Instagram");
  assert.equal(parsed.finance.affiliate[0].settled, 1.5);
  assert.equal(parsed.finance.affiliate[0].cancelled, 0);
  assert.equal(parsed.connections.items[0].status, "reauthorization_required");
  assert.equal(parsed.connections.items[1].status, "error", "estado desconhecido não aparece como conectado");
});

test("domínios financeiros: em aberto e CPC sem número inventado", () => {
  const [aff] = parseOverview({ finance: { affiliate: [{ currency: "BRL", forecast: 10, approved: 5, settled: 2, paid: 100, reversed: 7 }] } }).finance.affiliate;
  assert.equal(affiliateOpen(aff), 17, "pagas e estornadas não contam como em aberto");
  assert.equal(costPerClick({ currency: "BRL", spend: 50, impressions: 10, clicks: 0 }), null);
  assert.equal(costPerClick({ currency: "BRL", spend: 50, impressions: 10, clicks: 25 }), 2);
});

test("rótulo de provedor", () => {
  assert.equal(providerLabel("mercado_livre"), "Mercado Livre");
  assert.equal(providerLabel("novo_provedor"), "novo_provedor");
});

test("séries diárias: só datas válidas, contagens inteiras e não negativas", () => {
  const parsed = parseOverview({
    trends: {
      content_created: [{ day: "2026-11-18", count: 2 }, { day: "ontem", count: 5 }, { day: "2026-11-19", count: -1 }, { day: "2026-11-20", count: "3" }],
      publications_scheduled: "lixo",
    },
  });
  assert.deepEqual(parsed.trends.content_created, [
    { day: "2026-11-18", count: 2 },
    { day: "2026-11-19", count: 0 },
    { day: "2026-11-20", count: 3 },
  ]);
  assert.deepEqual(parsed.trends.publications_scheduled, []);
  assert.deepEqual(parsed.trends.agent_runs, []);
  assert.equal(seriesTotal(parsed.trends.content_created), 5);
});
