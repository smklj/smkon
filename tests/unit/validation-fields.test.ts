import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DATE_ONLY,
  formDataToRaw,
  isHttpsUrl,
  isOneOf,
  isPlainObject,
  isUuid,
  isUuidShape,
  oneOf,
  optionalText,
  parseDecimal,
  parseUuid,
  readFlag,
  readScalar,
  readString,
  requireLength,
  workspaceDate,
} from "../../src/lib/validation/fields.ts";
import * as productSchema from "../../src/lib/products/schema.ts";
import * as productValidation from "../../src/lib/products/validation.ts";
import { isUuid as contentIsUuid } from "../../src/lib/content/server.ts";
import { ValidationError } from "../../src/lib/http/errors.ts";

const COLORS = ["red", "blue"] as const;

test("readString apara e ignora tipos que não são texto", () => {
  assert.equal(readString({ a: "  x  " }, "a"), "x");
  assert.equal(readString({ a: 12 }, "a"), "");
  assert.equal(readString({ a: null }, "a"), "");
  assert.equal(readString({}, "a"), "");
});

test("readScalar aceita número do JSON como texto", () => {
  assert.equal(readScalar({ a: 12.5 }, "a"), "12.5");
  assert.equal(readScalar({ a: " y " }, "a"), "y");
  assert.equal(readScalar({ a: true }, "a"), "");
});

test("readFlag reconhece checkbox e booleano", () => {
  assert.equal(readFlag({ a: "on" }, "a"), true);
  assert.equal(readFlag({ a: "true" }, "a"), true);
  assert.equal(readFlag({ a: true }, "a"), true);
  assert.equal(readFlag({ a: "off" }, "a"), false);
  assert.equal(readFlag({}, "a"), false);
});

test("formDataToRaw mantém só campos de texto", () => {
  const form = new FormData();
  form.set("name", "Curso");
  form.set("file", new Blob(["x"]), "a.txt");
  assert.deepEqual(formDataToRaw(form), { name: "Curso" });
});

test("isPlainObject recusa null, arrays e primitivos", () => {
  assert.equal(isPlainObject({}), true);
  assert.equal(isPlainObject(null), false);
  assert.equal(isPlainObject([]), false);
  assert.equal(isPlainObject("x"), false);
});

test("oneOf: lista fechada, padrão só para vazio", () => {
  assert.equal(oneOf("red", COLORS, "Cor inválida."), "red");
  assert.equal(oneOf("", COLORS, "Cor inválida.", "blue"), "blue");
  assert.throws(() => oneOf("green", COLORS, "Cor inválida.", "blue"), (error: unknown) => error instanceof ValidationError && error.message === "Cor inválida.");
  assert.throws(() => oneOf("", COLORS, "Cor inválida."), ValidationError);
  assert.equal(isOneOf("red", COLORS), true);
  assert.equal(isOneOf(1, COLORS), false);
});

test("UUID estrito (rotas) e por formato (formulários)", () => {
  const v4 = "7d2c9a7e-3f1b-4c55-9a51-0b6c1f5d2e10";
  const shapeOnly = "00000000-0000-0000-0000-000000000000";
  assert.equal(isUuid(v4), true);
  assert.equal(isUuid(shapeOnly), false);
  assert.equal(isUuidShape(shapeOnly), true);
  assert.equal(isUuidShape("x"), false);
  assert.equal(parseUuid(v4), v4);
  assert.throws(() => parseUuid("x", "Contato inválido."), (error: unknown) => error instanceof ValidationError && error.message === "Contato inválido.");
  assert.equal(contentIsUuid, isUuid, "content/server reexporta a definição central");
});

test("requireLength e optionalText", () => {
  assert.equal(requireLength("abc", 1, 3, "m"), "abc");
  assert.throws(() => requireLength("", 1, 3, "m"), ValidationError);
  assert.throws(() => requireLength("abcd", 1, 3, "m"), ValidationError);
  assert.equal(optionalText("", 3, "m"), null);
  assert.equal(optionalText("ab", 3, "m"), "ab");
  assert.throws(() => optionalText("abcd", 3, "m"), ValidationError);
});

test("parseDecimal, isHttpsUrl, datas", () => {
  assert.equal(parseDecimal("1.234,56"), 1234.56);
  assert.equal(parseDecimal(" "), null);
  assert.ok(Number.isNaN(parseDecimal("1,2,3")));
  assert.equal(isHttpsUrl("https://exemplo.com.br/a"), true);
  assert.equal(isHttpsUrl(`https://a.com/${"x".repeat(2048)}`), false);
  assert.equal(DATE_ONLY.test("2026-11-19"), true);
  assert.equal(DATE_ONLY.test("19/11/2026"), false);
  // 02:00 UTC ainda é o dia anterior em Brasília.
  assert.equal(workspaceDate(new Date("2026-11-19T02:00:00Z")), "2026-11-18");
  assert.equal(workspaceDate(new Date("2026-11-19T03:00:00Z")), "2026-11-19");
});

test("produtos: validation.ts é só um reexport do schema centralizado", () => {
  assert.equal(productValidation.parseProductInput, productSchema.parseProductInput);
  assert.equal(productValidation.isHttpsUrl, isHttpsUrl);
  assert.equal(productSchema.isProductStatus("selected"), true);
  assert.equal(productSchema.isProductStatus("published"), false);
});
