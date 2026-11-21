import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import {
  decryptToken,
  encryptToken,
  isTokenEnvelope,
  loadTokenKeyring,
} from "../../src/lib/integrations/shared/token-envelope.ts";
import { openMetricoolToken, sealMetricoolToken } from "../../src/lib/integrations/metricool/credentials.ts";
import { executeApprovedAction, type ServiceDb } from "../../src/lib/integrations/metricool/executor.ts";
import type { MetricoolClient } from "../../src/lib/integrations/metricool/client.ts";

const ORG_A = "11111111-1111-4111-8111-111111111111";
const ORG_B = "22222222-2222-4222-8222-222222222222";
const REQ = "33333333-3333-4333-8333-333333333333";
const ACCOUNT = "44444444-4444-4444-8444-444444444444";
const MEDIA = "55555555-5555-4555-8555-555555555555";

const keyring = { activeKeyId: "primary", keys: { primary: randomBytes(32) } };

test("envelope: cifra, decifra e recusa outro workspace ou conta", () => {
  const ctx = { scope: "metricool", provider: "metricool", organizationId: ORG_A, externalAccountId: "blog-1" };
  const env = encryptToken("token-secreto", ctx, keyring);
  assert.ok(isTokenEnvelope(env));
  assert.ok(!JSON.stringify(env).includes("token-secreto"));
  assert.equal(decryptToken(env, ctx, keyring), "token-secreto");
  assert.throws(() => decryptToken(env, { ...ctx, organizationId: ORG_B }, keyring), /authentication failed/);
  assert.throws(() => decryptToken(env, { ...ctx, externalAccountId: "blog-2" }, keyring), /authentication failed/);
});

test("envelope: recusa texto puro, envelope adulterado e chave ausente", () => {
  const ctx = { scope: "metricool", provider: "metricool", organizationId: ORG_A, externalAccountId: "blog-1" };
  assert.throws(() => decryptToken({ token: "texto-puro" }, ctx, keyring), /Unsupported/);
  const env = encryptToken("x", ctx, keyring);
  assert.throws(() => decryptToken({ ...env, kid: "outra" }, ctx, keyring), /unavailable/);
  assert.throws(() => loadTokenKeyring("K", "KID", {}), /K is not configured/);
  assert.throws(() => loadTokenKeyring("K", "KID", { K: Buffer.alloc(16).toString("base64") }), /Invalid/);
});

test("metricool: token amarrado ao workspace e ao blog", () => {
  const env = sealMetricoolToken("  mc-token  ", ORG_A, "blog-9", keyring);
  assert.equal(openMetricoolToken(env, ORG_A, "blog-9", keyring), "mc-token");
  assert.throws(() => openMetricoolToken(env, ORG_B, "blog-9", keyring));
});

type Call = { table?: string; rpc?: string; filters: Record<string, unknown> };

function fakeDb(state: {
  requestOrg: string;
  payload?: Record<string, unknown>;
  media?: { id: string; storage_path: string }[];
}) {
  const calls: Call[] = [];
  const rows: Record<string, unknown> = {
    external_action_requests: { organization_id: state.requestOrg },
    social_accounts: { network: "instagram", account_type: "business", via: "metricool", external_account_id: "ig" },
  };
  const db = {
    from(table: string) {
      const call: Call = { table, filters: {} };
      calls.push(call);
      const builder = {
        select: () => builder,
        eq: (col: string, val: unknown) => ((call.filters[col] = val), builder),
        is: () => builder,
        in: () => Promise.resolve({ data: state.media ?? [], error: null }),
        maybeSingle: () => Promise.resolve({ data: rows[table] ?? null, error: null }),
        single: () => Promise.resolve({ data: rows[table] ?? null, error: null }),
      };
      return builder;
    },
    rpc(name: string, args: Record<string, unknown>) {
      calls.push({ rpc: name, filters: args });
      if (name === "claim_external_action") {
        return Promise.resolve({
          data: { social_account_id: ACCOUNT, action: "publish_post", payload: state.payload ?? { caption: "oi" } },
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: null });
    },
    storage: {
      from: () => ({
        createSignedUrls: (paths: string[]) =>
          Promise.resolve({ data: paths.map((p) => ({ signedUrl: `https://signed/${p}` })), error: null }),
      }),
    },
  };
  return { db: db as unknown as ServiceDb, calls };
}

function fakeClient(sink: unknown[]): MetricoolClient {
  return {
    listConnectedAccounts: async () => [],
    publishPost: async (_blog, payload) => {
      sink.push(payload);
      return { id: "mc-post-1" } as never;
    },
  } as MetricoolClient;
}

test("executor: pedido de outro workspace é recusado antes de reivindicar", async () => {
  const { db, calls } = fakeDb({ requestOrg: ORG_B });
  const result = await executeApprovedAction(db, REQ, ORG_A, { client: fakeClient([]), blogId: "b" });
  assert.deepEqual(result, { ok: false, errorCode: "action_request_not_found", message: "Pedido não encontrado." });
  assert.ok(!calls.some((c) => c.rpc === "claim_external_action"), "não pode reivindicar pedido alheio");
});

test("executor: ids inválidos não tocam o banco", async () => {
  const { db, calls } = fakeDb({ requestOrg: ORG_A });
  const result = await executeApprovedAction(db, "../x", ORG_A);
  assert.equal(result.ok, false);
  assert.equal(calls.length, 0);
});

test("executor: publica com mídia resolvida do próprio workspace", async () => {
  const sent: unknown[] = [];
  const { db, calls } = fakeDb({
    requestOrg: ORG_A,
    payload: { caption: "Legenda", mediaIds: [MEDIA] },
    media: [{ id: MEDIA, storage_path: `${ORG_A}/${MEDIA}.jpg` }],
  });
  const result = await executeApprovedAction(db, REQ, ORG_A, { client: fakeClient(sent), blogId: "blog" });
  assert.deepEqual(result, { ok: true, externalRef: "mc-post-1" });
  assert.deepEqual(sent, [{ network: "instagram", text: "Legenda", mediaUrls: [`https://signed/${ORG_A}/${MEDIA}.jpg`] }]);
  const account = calls.find((c) => c.table === "social_accounts");
  assert.equal(account?.filters.organization_id, ORG_A);
});

test("executor: mídia de outro workspace falha e encerra o pedido", async () => {
  const { db, calls } = fakeDb({ requestOrg: ORG_A, payload: { caption: "x", mediaIds: [MEDIA] }, media: [] });
  const result = await executeApprovedAction(db, REQ, ORG_A, { client: fakeClient([]), blogId: "blog" });
  assert.deepEqual(result, { ok: false, errorCode: "media_not_found", message: "Não foi possível executar a ação externa." });
  const finish = calls.find((c) => c.rpc === "finish_external_action");
  assert.equal(finish?.filters.p_ok, false);
  assert.equal(finish?.filters.p_error_code, "media_not_found");
});
