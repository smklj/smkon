import { test } from "node:test";
import assert from "node:assert/strict";
import { AGENT_RUNS_KEYSET, AGENT_RUNS_PAGE_SIZE } from "../../src/lib/agents/runs-page.ts";
import {
  applyKeyset,
  decodeCursor,
  encodeCursor,
  InvalidCursorError,
  toPage,
  type KeysetQuery,
  type KeysetSpec,
} from "../../src/lib/pagination/keyset.ts";

const MEDIA: KeysetSpec = { id: "media", direction: "desc", keys: [{ column: "created_at", type: "timestamp" }, { column: "id", type: "uuid" }] };
const TS = "2026-11-19T10:00:00.123456+00:00";
const ID = "3f2b8c1e-4d5a-4b6c-8d7e-9f0a1b2c3d4e";

class FakeQuery implements KeysetQuery<FakeQuery> {
  calls: string[] = [];
  order(column: string, options: { ascending: boolean }) { this.calls.push(`order:${column}:${options.ascending ? "asc" : "desc"}`); return this; }
  lte(column: string, value: string) { this.calls.push(`lte:${column}:${value}`); return this; }
  gte(column: string, value: string) { this.calls.push(`gte:${column}:${value}`); return this; }
  or(filters: string) { this.calls.push(`or:${filters}`); return this; }
  limit(count: number) { this.calls.push(`limit:${count}`); return this; }
}

test("execuções: ordem created_at desc, id desc e 20 + 1 linhas (empates resolvidos pelo id)", () => {
  assert.equal(AGENT_RUNS_PAGE_SIZE, 20);
  const query = applyKeyset(new FakeQuery(), AGENT_RUNS_KEYSET, null, AGENT_RUNS_PAGE_SIZE);
  assert.deepEqual(query.calls, ["order:created_at:desc", "order:id:desc", "limit:21"]);
});

test("execuções: página seguinte começa estritamente depois da última execução exibida", () => {
  const query = applyKeyset(new FakeQuery(), AGENT_RUNS_KEYSET, [TS, ID], AGENT_RUNS_PAGE_SIZE);
  assert.deepEqual(query.calls, [
    `lte:created_at:${TS}`,
    `or:created_at.lt."${TS}",and(created_at.eq."${TS}",id.lt."${ID}")`,
    "order:created_at:desc",
    "order:id:desc",
    "limit:21",
  ]);
});

test("execuções: cursor da mídia (mesmas colunas) não serve para a lista de execuções", () => {
  assert.throws(() => decodeCursor(AGENT_RUNS_KEYSET, encodeCursor(MEDIA, [TS, ID])), InvalidCursorError);
  assert.deepEqual(decodeCursor(AGENT_RUNS_KEYSET, encodeCursor(AGENT_RUNS_KEYSET, [TS, ID])), [TS, ID]);
});

test("execuções: percorre 95 execuções com empates de created_at sem repetir nem perder", () => {
  const all = Array.from({ length: 95 }, (_, i) => ({
    created_at: `2026-11-${String(10 + (i % 5)).padStart(2, "0")}T10:00:00+00:00`,
    id: `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
  }));
  const sorted = [...all].sort((a, b) => (b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id)));
  const seen: string[] = [];
  let cursor: string | null = null;
  for (let guard = 0; guard < 20; guard += 1) {
    const after = decodeCursor(AGENT_RUNS_KEYSET, cursor);
    const rows = sorted
      .filter((row) => !after || row.created_at < after[0] || (row.created_at === after[0] && row.id < after[1]))
      .slice(0, AGENT_RUNS_PAGE_SIZE + 1);
    const page = toPage(AGENT_RUNS_KEYSET, rows, AGENT_RUNS_PAGE_SIZE);
    seen.push(...page.items.map((row) => row.id));
    if (!page.nextCursor) break;
    cursor = page.nextCursor;
  }
  assert.deepEqual(seen, sorted.map((row) => row.id));
});
