import { test } from "node:test";
import assert from "node:assert/strict";
import {
  InvalidCursorError,
  MAX_PAGE_SIZE,
  applyKeyset,
  decodeCursor,
  encodeCursor,
  keysetFilter,
  parsePageSize,
  toPage,
  type KeysetQuery,
  type KeysetSpec,
} from "../../src/lib/pagination/keyset.ts";
import { ValidationError } from "../../src/lib/http/errors.ts";

const CONTENT: KeysetSpec = {
  id: "content:v1",
  direction: "desc",
  keys: [{ column: "updated_at", type: "timestamp" }, { column: "id", type: "uuid" }],
};
const PRODUCTS: KeysetSpec = {
  id: "products:v1",
  direction: "desc",
  keys: [{ column: "score_rank", type: "integer" }, { column: "updated_at", type: "timestamp" }, { column: "id", type: "uuid" }],
};

const ID_A = "0b6f1a5e-1d2c-4e3f-8a9b-0c1d2e3f4a5b";
const TS = "2026-11-19T10:00:00.123456+00:00";

test("cursor: ida e volta preserva os valores exatos (microssegundos e uuid em minúsculas)", () => {
  const cursor = encodeCursor(CONTENT, [TS, ID_A.toUpperCase()]);
  assert.match(cursor, /^[A-Za-z0-9_-]+$/, "base64url, seguro em query string");
  assert.deepEqual(decodeCursor(CONTENT, cursor), [TS, ID_A]);
  assert.deepEqual(decodeCursor(PRODUCTS, encodeCursor(PRODUCTS, [-1, TS, ID_A])), ["-1", TS, ID_A]);
});

test("cursor: ausente significa primeira página", () => {
  assert.equal(decodeCursor(CONTENT, null), null);
  assert.equal(decodeCursor(CONTENT, undefined), null);
  assert.equal(decodeCursor(CONTENT, ""), null);
});

test("cursor: recusa lixo, cursor de outra lista e valores fora do tipo", () => {
  const forge = (payload: unknown) => btoa(JSON.stringify(payload)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const bad = [
    "não-é-base64!",
    "a".repeat(600),
    forge({ l: "outra:v1", v: [TS, ID_A] }),
    forge({ l: "content:v1", v: [TS] }),
    forge({ l: "content:v1", v: ["ontem", ID_A] }),
    // tentativa de injetar sintaxe do PostgREST pelo valor
    forge({ l: "content:v1", v: [TS, `${ID_A}),id.gt.(0`] }),
    forge({ l: "content:v1", v: [`${TS}",x.eq."1`, ID_A] }),
    forge({ l: "products:v1", v: [1.5, TS, ID_A] }),
    forge(["content:v1"]),
    btoa("{nao json"),
  ];
  for (const raw of bad) {
    assert.throws(() => decodeCursor(CONTENT, raw), InvalidCursorError, raw);
  }
  assert.throws(() => decodeCursor(PRODUCTS, forge({ l: "products:v1", v: ["1.5", TS, ID_A] })), InvalidCursorError);
  assert.throws(() => decodeCursor(PRODUCTS, encodeCursor(CONTENT, [TS, ID_A])), InvalidCursorError, "cursor de outra lista");
});

test("cursor inválido é erro de validação (400 com mensagem segura)", () => {
  try {
    decodeCursor(CONTENT, "xx");
    assert.fail("deveria falhar");
  } catch (error) {
    assert.ok(error instanceof ValidationError);
    assert.match((error as Error).message, /primeira página/);
  }
});

test("encodeCursor recusa valores que não poderiam ser filtrados", () => {
  assert.throws(() => encodeCursor(CONTENT, [null, ID_A]));
  assert.throws(() => encodeCursor(PRODUCTS, [Number.NaN, TS, ID_A]));
  assert.throws(() => encodeCursor(CONTENT, [TS]));
});

test("filtro: limite inicial na primeira chave e comparação lexicográfica com desempate", () => {
  const filter = keysetFilter(PRODUCTS, ["5550", TS, ID_A]);
  assert.deepEqual(filter.bound, { column: "score_rank", operator: "lte", value: "5550" });
  assert.equal(
    filter.or,
    `score_rank.lt."5550",and(score_rank.eq."5550",updated_at.lt."${TS}"),and(score_rank.eq."5550",updated_at.eq."${TS}",id.lt."${ID_A}")`,
  );
  const asc = keysetFilter({ ...CONTENT, direction: "asc" }, [TS, ID_A]);
  assert.equal(asc.bound.operator, "gte");
  assert.equal(asc.or, `updated_at.gt."${TS}",and(updated_at.eq."${TS}",id.gt."${ID_A}")`);
});

test("tamanho de página: padrão, limite máximo e entradas inválidas", () => {
  assert.equal(parsePageSize(null), 50);
  assert.equal(parsePageSize("20"), 20);
  assert.equal(parsePageSize("1000"), MAX_PAGE_SIZE);
  for (const raw of ["0", "-5", "abc", "1e3", "12.5", ""]) assert.equal(parsePageSize(raw), 50, raw);
});

class FakeQuery implements KeysetQuery<FakeQuery> {
  calls: string[] = [];
  order(column: string, options: { ascending: boolean }) { this.calls.push(`order:${column}:${options.ascending ? "asc" : "desc"}`); return this; }
  lte(column: string, value: string) { this.calls.push(`lte:${column}:${value}`); return this; }
  gte(column: string, value: string) { this.calls.push(`gte:${column}:${value}`); return this; }
  or(filters: string) { this.calls.push(`or:${filters}`); return this; }
  limit(count: number) { this.calls.push(`limit:${count}`); return this; }
}

test("applyKeyset: primeira página só ordena e pede uma linha a mais", () => {
  const query = applyKeyset(new FakeQuery(), CONTENT, null, 50);
  assert.deepEqual(query.calls, ["order:updated_at:desc", "order:id:desc", "limit:51"]);
});

test("applyKeyset: página seguinte aplica limite inicial, or e a mesma ordenação", () => {
  const query = applyKeyset(new FakeQuery(), CONTENT, [TS, ID_A], 20);
  assert.deepEqual(query.calls, [
    `lte:updated_at:${TS}`,
    `or:updated_at.lt."${TS}",and(updated_at.eq."${TS}",id.lt."${ID_A}")`,
    "order:updated_at:desc",
    "order:id:desc",
    "limit:21",
  ]);
});

test("toPage: corta a linha extra e gera cursor da última linha exibida", () => {
  const rows = [
    { updated_at: "2026-11-19T10:00:00+00:00", id: "00000000-0000-4000-8000-000000000003" },
    { updated_at: "2026-11-19T10:00:00+00:00", id: "00000000-0000-4000-8000-000000000002" },
    { updated_at: "2026-11-18T10:00:00+00:00", id: "00000000-0000-4000-8000-000000000001" },
  ];
  const page = toPage(CONTENT, rows, 2);
  assert.equal(page.items.length, 2);
  assert.deepEqual(decodeCursor(CONTENT, page.nextCursor), [rows[1].updated_at, rows[1].id]);
  assert.deepEqual(toPage(CONTENT, rows, 3), { items: rows, nextCursor: null });
  assert.deepEqual(toPage(CONTENT, [], 3), { items: [], nextCursor: null });
});

/**
 * Simulação ponta a ponta: aplica o mesmo critério do filtro em memória sobre uma
 * lista com muitos empates e confere que percorrer as páginas devolve cada linha
 * exatamente uma vez e na ordem certa.
 */
test("percorrer todas as páginas com empates não repete nem perde linhas", () => {
  const rows: { score_rank: number; updated_at: string; id: string }[] = [];
  for (let i = 0; i < 257; i++) {
    rows.push({
      score_rank: [-1, 0, 5000, 10000][i % 4],
      updated_at: `2026-11-${String(10 + (i % 3)).padStart(2, "0")}T10:00:00+00:00`,
      id: `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
    });
  }
  const compare = (a: (typeof rows)[number], b: (typeof rows)[number]) =>
    b.score_rank - a.score_rank || b.updated_at.localeCompare(a.updated_at) || b.id.localeCompare(a.id);
  const sorted = [...rows].sort(compare);

  const seen: string[] = [];
  let cursor: string | null = null;
  let pages = 0;
  do {
    const values = decodeCursor(PRODUCTS, cursor);
    const after = values
      ? sorted.filter((row) => compare(row, { score_rank: Number(values[0]), updated_at: values[1], id: values[2] }) > 0)
      : sorted;
    const page = toPage(PRODUCTS, after.slice(0, 31), 30);
    seen.push(...page.items.map((row) => row.id));
    cursor = page.nextCursor;
    pages += 1;
  } while (cursor && pages < 100);

  assert.equal(pages, 9);
  assert.deepEqual(seen, sorted.map((row) => row.id));
  assert.equal(new Set(seen).size, rows.length);
});
