import { test } from "node:test";
import assert from "node:assert/strict";
import { COMMISSION_STATUSES } from "../../src/lib/finance/commissions.ts";
import {
  COMMISSION_HISTORY_COLUMNS,
  COMMISSION_HISTORY_LIMIT,
  COMMISSION_SUMMARY_COLUMNS,
  listCommissionSummaries,
  listRecentCommissionChanges,
  type SupabaseClient,
} from "../../src/lib/finance/repository.ts";
import { isCommissionStatus } from "../../src/lib/finance/schema.ts";
import { loadCommissionOverview } from "../../src/lib/finance/service.ts";

const ORG = "11111111-2222-4333-8444-555555555555";

type Call = { table: string; ops: Array<[string, ...unknown[]]> };
type Result = { data: unknown; error: unknown };

/** Cliente falso: registra a cadeia de chamadas por tabela e devolve o resultado configurado. */
function fakeClient(results: Record<string, Result>) {
  const calls: Call[] = [];
  const client = {
    from(table: string) {
      const call: Call = { table, ops: [] };
      calls.push(call);
      const builder: Record<string, unknown> = {
        then(resolve: (value: Result) => unknown, reject: (reason: unknown) => unknown) {
          return Promise.resolve(results[table]).then(resolve, reject);
        },
      };
      for (const op of ["select", "eq", "order", "limit"]) {
        builder[op] = (...args: unknown[]) => {
          call.ops.push([op, ...args]);
          return builder;
        };
      }
      return builder;
    },
  };
  return { client: client as unknown as SupabaseClient, calls };
}

test("isCommissionStatus: só os seis estados; protótipo e não-texto são recusados", () => {
  for (const status of COMMISSION_STATUSES) assert.equal(isCommissionStatus(status), true);
  for (const value of ["", "toString", "constructor", "PAID", null, undefined, 1]) assert.equal(isCommissionStatus(value), false);
});

test("resumo: view por moeda filtrada pelo workspace, com as colunas de cada estado", async () => {
  const rows = [{ currency: "BRL", conversions: 2 }];
  const { client, calls } = fakeClient({ affiliate_commission_summary: { data: rows, error: null } });
  assert.deepEqual(await listCommissionSummaries(client, ORG), rows);
  assert.deepEqual(calls, [
    { table: "affiliate_commission_summary", ops: [["select", COMMISSION_SUMMARY_COLUMNS], ["eq", "organization_id", ORG]] },
  ]);
});

test("histórico: workspace, mais recente primeiro, limite de 10", async () => {
  const { client, calls } = fakeClient({ affiliate_commission_status_history: { data: null, error: null } });
  assert.deepEqual(await listRecentCommissionChanges(client, ORG), []);
  assert.equal(COMMISSION_HISTORY_LIMIT, 10);
  assert.deepEqual(calls[0].ops, [
    ["select", COMMISSION_HISTORY_COLUMNS],
    ["eq", "organization_id", ORG],
    ["order", "changed_at", { ascending: false }],
    ["limit", 10],
  ]);
});

test("visão geral: consulta as duas fontes; com as duas falhando, propaga o erro do resumo", async () => {
  const ok = fakeClient({
    affiliate_commission_summary: { data: [{ currency: "BRL" }], error: null },
    affiliate_commission_status_history: { data: [{ id: 1 }], error: null },
  });
  assert.deepEqual(await loadCommissionOverview(ok.client, ORG), { summaries: [{ currency: "BRL" }], history: [{ id: 1 }] });

  const summaryError = { message: "summary down" };
  const both = fakeClient({
    affiliate_commission_summary: { data: null, error: summaryError },
    affiliate_commission_status_history: { data: null, error: { message: "history down" } },
  });
  await assert.rejects(loadCommissionOverview(both.client, ORG), (error) => error === summaryError);

  const historyError = { message: "history down" };
  const onlyHistory = fakeClient({
    affiliate_commission_summary: { data: [], error: null },
    affiliate_commission_status_history: { data: null, error: historyError },
  });
  await assert.rejects(loadCommissionOverview(onlyHistory.client, ORG), (error) => error === historyError);
});
