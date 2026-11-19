import { test } from "node:test";
import assert from "node:assert/strict";
import { createToastStore } from "../../src/lib/ui/toast-store.ts";

function fakeTimers() {
  let seq = 0;
  const pending = new Map<number, () => void>();
  return {
    timers: {
      setTimer: (fn: () => void) => { const id = ++seq; pending.set(id, fn); return id; },
      clearTimer: (id: unknown) => { pending.delete(id as number); },
    },
    runAll: () => { for (const [id, fn] of [...pending]) { pending.delete(id); fn(); } },
    count: () => pending.size,
  };
}

test("toast entra, avisa assinantes e sai sozinho", () => {
  const clock = fakeTimers();
  const store = createToastStore(clock.timers);
  let calls = 0;
  store.subscribe(() => { calls++; });
  store.push("Salvo.");
  assert.equal(store.snapshot().length, 1);
  assert.equal(calls, 1);
  clock.runAll();
  assert.equal(store.snapshot().length, 0);
  assert.equal(calls, 2);
});

test("mensagem vazia é ignorada e repetida não empilha", () => {
  const clock = fakeTimers();
  const store = createToastStore(clock.timers);
  assert.equal(store.push("   "), null);
  const a = store.push("Salvo.");
  const b = store.push("Salvo.");
  assert.equal(a, b);
  assert.equal(store.snapshot().length, 1);
  assert.equal(clock.count(), 1, "um único timer ativo");
});

test("limite de toasts visíveis descarta o mais antigo e seu timer", () => {
  const clock = fakeTimers();
  const store = createToastStore(clock.timers, 4000, 3);
  ["a", "b", "c", "d"].forEach((m) => store.push(m));
  assert.deepEqual(store.snapshot().map((t) => t.message), ["b", "c", "d"]);
  assert.equal(clock.count(), 3);
});

test("pausar segura os toasts; retomar volta a contar", () => {
  const clock = fakeTimers();
  const store = createToastStore(clock.timers);
  store.push("x");
  store.pause();
  assert.equal(clock.count(), 0);
  clock.runAll();
  assert.equal(store.snapshot().length, 1, "não some enquanto pausado");
  store.resume();
  clock.runAll();
  assert.equal(store.snapshot().length, 0);
});

test("fechar manualmente remove e cancela o timer", () => {
  const clock = fakeTimers();
  const store = createToastStore(clock.timers);
  const id = store.push("x", "error")!;
  store.dismiss(id);
  assert.equal(store.snapshot().length, 0);
  assert.equal(clock.count(), 0);
});
