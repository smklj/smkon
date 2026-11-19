import { test } from "node:test";
import assert from "node:assert/strict";
import { ValidationError } from "../../src/lib/http/errors.ts";
import { parseCancelRequest, parseJobId, parseScheduleRequest } from "../../src/lib/publication/schema.ts";

const UUID = "7d2c9a7e-3f1b-4c55-9a51-0b6c1f5d2e10";
const now = new Date("2026-11-18T21:00:00Z"); // 18:00 em Brasília

function rejects(fn: () => unknown, message: RegExp) {
  assert.throws(fn, (error: unknown) => error instanceof ValidationError && message.test(error.message));
}

test("agendamento válido devolve ISO UTC", () => {
  const input = parseScheduleRequest({ content_id: UUID, channel: "Instagram", scheduled_for: "2026-11-19T10:00" }, now);
  assert.deepEqual(input, { contentId: UUID, channel: "Instagram", scheduledFor: "2026-11-19T13:00:00.000Z" });
});

test("agendamento: mesma ordem e mensagens das Server Actions", () => {
  rejects(() => parseScheduleRequest({ channel: "X" }, now), /conteúdo aprovado/);
  rejects(() => parseScheduleRequest({ content_id: ` ${UUID}`, channel: "Instagram" }, now), /conteúdo aprovado/);
  rejects(() => parseScheduleRequest({ content_id: UUID, channel: "instagram" }, now), /Canal inválido/);
  rejects(() => parseScheduleRequest({ content_id: UUID, channel: "TikTok", scheduled_for: "2026-11-18T18:00" }, now), /futuro/);
  rejects(() => parseScheduleRequest({ content_id: UUID, channel: "TikTok" }, now), /data e hora/);
});

test("dry-run e cancelamento", () => {
  assert.equal(parseJobId({ job_id: UUID }), UUID);
  rejects(() => parseJobId({}), /Agendamento inválido/);
  rejects(() => parseCancelRequest({ job_id: "x", reason: "" }), /Agendamento inválido/);
  rejects(() => parseCancelRequest({ job_id: UUID, reason: "  ab  " }), /motivo/);
  assert.deepEqual(parseCancelRequest({ job_id: UUID, reason: "  erro no roteiro " }), { jobId: UUID, reason: "erro no roteiro" });
});
