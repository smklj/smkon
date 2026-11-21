import { test } from "node:test";
import assert from "node:assert/strict";
import {
  checksSummaryLabel,
  defaultScheduleValue,
  isPublicationChannel,
  parseScheduleInput,
  summarizeChecks,
  toChecks,
} from "../../src/lib/publication/types.ts";

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

test("resumo das verificações: bloqueios, avisos e aprovadas", () => {
  const checks = [
    { check: "approved", severity: "error" as const, ok: true, detail: "Versão aprovada." },
    { check: "media", severity: "error" as const, ok: false, detail: "Sem mídia." },
    { check: "license", severity: "warning" as const, ok: false, detail: "Licença vence logo." },
    { check: "caption", severity: "warning" as const, ok: true, detail: "Legenda ok." },
  ];
  assert.deepEqual(summarizeChecks(checks), { total: 4, passed: 2, errors: 1, warnings: 1 });
  assert.equal(checksSummaryLabel(summarizeChecks(checks)), "4 verificações · 1 bloqueio · 1 aviso");
  assert.equal(checksSummaryLabel(summarizeChecks(checks.filter((check) => check.ok))), "2 verificações · todas aprovadas");
  assert.equal(checksSummaryLabel(summarizeChecks([checks[0]])), "1 verificação · aprovada");
  assert.deepEqual(summarizeChecks([]), { total: 0, passed: 0, errors: 0, warnings: 0 });
});
