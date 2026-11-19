import { test } from "node:test";
import assert from "node:assert/strict";
import { PostgrestClient } from "@supabase/postgrest-js";
import { CONTACTS_KEYSET, CONTACT_PAGE_SIZE, contactsListQuery, type ContactsQuery } from "../../src/lib/audience/contacts-page.ts";
import { sanitizeSearch } from "../../src/lib/audience/validation.ts";
import { AGENT_RUNS_KEYSET } from "../../src/lib/agents/runs-page.ts";
import { decodeCursor, encodeCursor, InvalidCursorError, toPage } from "../../src/lib/pagination/keyset.ts";

const ORG = "10000000-0000-4000-8000-000000000001";
const TS = "2026-11-19T10:00:00.123456+00:00";
const ID = "3f2b8c1e-4d5a-4b6c-8d7e-9f0a1b2c3d4e";

interface UrlQuery extends ContactsQuery<UrlQuery> {
  url: URL;
}

/** Constrói a consulta com o query builder real do supabase-js (sem rede) e devolve os parâmetros. */
function params(options: { term?: string; includeAnonymized?: boolean; after?: string[] | null }) {
  const client = new PostgrestClient("http://127.0.0.1:1/rest/v1") as unknown as {
    from(table: string): { select(columns: string): UrlQuery };
  };
  const query = contactsListQuery(client.from("contacts").select("id,created_at"), {
    organizationId: ORG,
    term: sanitizeSearch(options.term ?? ""),
    includeAnonymized: options.includeAnonymized ?? false,
    after: options.after ?? null,
    pageSize: CONTACT_PAGE_SIZE,
  });
  return query.url.searchParams;
}

test("contatos: 1ª página ordenada por created_at desc, id desc, 50 + 1 linhas, sem anonimizados", () => {
  const p = params({});
  assert.equal(CONTACT_PAGE_SIZE, 50);
  assert.equal(p.get("organization_id"), `eq.${ORG}`);
  assert.equal(p.get("anonymized_at"), "is.null");
  assert.equal(p.get("order"), "created_at.desc,id.desc");
  assert.equal(p.get("limit"), "51");
  assert.deepEqual(p.getAll("or"), []);
});

test("contatos: busca e cursor são dois filtros `or` independentes (combinados com AND pelo PostgREST)", () => {
  const p = params({ term: "maria", includeAnonymized: true, after: [TS, ID] });
  assert.equal(p.get("anonymized_at"), null);
  assert.equal(p.get("created_at"), `lte.${TS}`);
  assert.deepEqual(p.getAll("or"), [
    '(display_name.ilike."*maria*",email.ilike."*maria*",phone.ilike."*maria*")',
    `(created_at.lt."${TS}",and(created_at.eq."${TS}",id.lt."${ID}"))`,
  ]);
});

test("contatos: termo com sintaxe do PostgREST é saneado antes de entrar no filtro", () => {
  assert.deepEqual(params({ term: 'a),id.eq."x' }).getAll("or"), [
    '(display_name.ilike."*a id.eq. x*",email.ilike."*a id.eq. x*",phone.ilike."*a id.eq. x*")',
  ]);
});

test("contatos: cursor de outra lista (execuções, mesmas colunas) é recusado", () => {
  assert.throws(() => decodeCursor(CONTACTS_KEYSET, encodeCursor(AGENT_RUNS_KEYSET, [TS, ID])), InvalidCursorError);
  assert.deepEqual(decodeCursor(CONTACTS_KEYSET, encodeCursor(CONTACTS_KEYSET, [TS, ID])), [TS, ID]);
});

test("contatos: percorre 137 contatos com empates de created_at sem repetir nem perder", () => {
  const all = Array.from({ length: 137 }, (_, i) => ({
    created_at: `2026-11-${String(10 + (i % 4)).padStart(2, "0")}T10:00:00+00:00`,
    id: `00000000-0000-4000-8000-${String((i * 7919) % 1000).padStart(12, "0")}`,
  }));
  const sorted = [...all].sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id));
  const seen: string[] = [];
  let cursor: string | null = null;
  for (let guard = 0; guard < 10; guard += 1) {
    const after = decodeCursor(CONTACTS_KEYSET, cursor);
    const rows = sorted
      .filter((row) => !after || row.created_at < after[0] || (row.created_at === after[0] && row.id < after[1]))
      .slice(0, CONTACT_PAGE_SIZE + 1);
    const page = toPage(CONTACTS_KEYSET, rows, CONTACT_PAGE_SIZE);
    seen.push(...page.items.map((row) => row.id));
    if (!page.nextCursor) break;
    cursor = page.nextCursor;
  }
  assert.deepEqual(seen, sorted.map((row) => row.id));
});
