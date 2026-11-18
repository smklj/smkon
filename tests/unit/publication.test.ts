import { test } from "node:test";
import assert from "node:assert/strict";
import { defaultScheduleValue, isPublicationChannel, parseScheduleInput, toChecks } from "../../src/lib/publication/types.ts";

const now = new Date("2026-11-18T21:00:00Z"); // 18:00 em Brasília

test("datetime-local é lido como horário de Brasília", () => {
  assert.equal(parseScheduleInput("2026-11-19T10:00", now), "2026-11-19T13:00:00.000Z");
});

test("janela de agendamento: futuro e até 1 ano", () => {
  assert.throws(() => parseScheduleInput("2026-11-18T18:00", now), /futuro/);
  assert.throws(() => parseScheduleInput("2026-11-18T18:01", now), /futuro/);
  assert.throws(() => parseScheduleInput("2028-01-01T10:00", now), /1 ano/);
  assert.throws(() => parseScheduleInput("amanhã", now), /data e hora/);
  assert.throws(() => parseScheduleInput("2026-11-19", now), /data e hora/);
});

test("valor padrão é amanhã às 10h em Brasília", () => {
  assert.equal(defaultScheduleValue(now), "2026-11-19T10:00");
  // 23h30 em Brasília (02:30Z do dia seguinte) ainda conta como o mesmo dia local.
  assert.equal(defaultScheduleValue(new Date("2026-11-19T02:30:00Z")), "2026-11-19T10:00");
});

test("canais aceitos espelham o banco", () => {
  assert.ok(isPublicationChannel("Instagram"));
  assert.equal(isPublicationChannel("instagram"), false);
  assert.equal(isPublicationChannel("X"), false);
});

test("toChecks ignora formatos inesperados", () => {
  assert.deepEqual(toChecks(null), []);
  assert.deepEqual(toChecks([{ check: "a", severity: "error", ok: true, detail: "ok" }, 3, null]), [
    { check: "a", severity: "error", ok: true, detail: "ok" },
  ]);
});
