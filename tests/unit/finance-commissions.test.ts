import { test } from "node:test";
import assert from "node:assert/strict";
import {
  COMMISSION_LABEL,
  COMMISSION_STATUSES,
  canTransition,
  formatMoney,
  isFinal,
  ledgerAmount,
  nextCommissionStatuses,
} from "../../src/lib/finance/commissions.ts";

test("seis estados com rótulos distintos (não confundir prevista, aprovada, liquidada, cancelada, paga)", () => {
  assert.equal(COMMISSION_STATUSES.length, 6);
  assert.equal(new Set(Object.values(COMMISSION_LABEL)).size, 6);
});

test("transições espelham o banco", () => {
  assert.deepEqual(nextCommissionStatuses("pending"), ["approved", "cancelled"]);
  assert.equal(canTransition("pending", "paid"), false);
  assert.equal(canTransition("pending", "reversed"), false);
  assert.equal(canTransition("approved", "settled"), true);
  assert.equal(canTransition("settled", "paid"), true);
  assert.equal(canTransition("paid", "reversed"), true);
  assert.equal(canTransition("cancelled", "approved"), false);
  assert.equal(canTransition("approved", "approved"), true);
});

test("cancelada e estornada são finais", () => {
  assert.equal(isFinal("cancelled"), true);
  assert.equal(isFinal("reversed"), true);
  assert.equal(isFinal("paid"), false);
});

test("lançamento negativo em cancelamento e estorno", () => {
  assert.equal(ledgerAmount("approved", 12), 12);
  assert.equal(ledgerAmount("cancelled", 5), -5);
  assert.equal(ledgerAmount("reversed", 12), -12);
});

test("formata moeda em pt-BR", () => {
  assert.match(formatMoney(1234.5, "BRL"), /1\.234,50/);
  assert.match(formatMoney(null, "BRL"), /0,00/);
});
