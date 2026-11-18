import { test } from "node:test";
import assert from "node:assert/strict";
import { ValidationError, toErrorResponse } from "../../src/lib/http/errors.ts";

async function body(response: Response) {
  return (await response.json()) as { error: string; code: string };
}

test("ValidationError vira 400 com a mensagem segura", async () => {
  const response = toErrorResponse("t", new ValidationError("Título obrigatório."), "falha");
  assert.equal(response.status, 400);
  assert.deepEqual(await body(response), { error: "Título obrigatório.", code: "invalid_input" });
});

test("erros de negócio do banco são mapeados", async () => {
  const cases: Array<[unknown, number, string]> = [
    [{ message: "hash_mismatch" }, 409, "hash_mismatch"],
    [{ message: "forbidden" }, 403, "forbidden"],
    [{ message: "content_not_found" }, 404, "content_not_found"],
    [{ message: "rights_required" }, 422, "rights_required"],
    [{ code: "23503", message: "violates foreign key constraint" }, 409, "has_dependencies"],
    [{ code: "42501", message: "permission denied for table x" }, 403, "forbidden"],
  ];
  for (const [error, status, code] of cases) {
    const response = toErrorResponse("t", error, "falha");
    assert.equal(response.status, status, code);
    assert.equal((await body(response)).code, code);
  }
});

test("erro desconhecido não vaza detalhes internos", async (t) => {
  t.mock.method(console, "error", () => {});
  const response = toErrorResponse("t", new Error('relation "public.secret_table" does not exist'), "Não foi possível salvar.");
  assert.equal(response.status, 500);
  const payload = await body(response);
  assert.equal(payload.error, "Não foi possível salvar.");
  assert.equal(JSON.stringify(payload).includes("secret_table"), false);
});
