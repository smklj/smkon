import test from "node:test";
import assert from "node:assert/strict";
import { createMetricoolClient } from "../../src/lib/integrations/metricool/client.ts";
import {
  canPerform,
  normalizeActionPayload,
  resolveCapabilities,
} from "../../src/lib/integrations/registry.ts";

test("Metricool client: exige userToken e blogId", async () => {
  assert.throws(() => createMetricoolClient({ userToken: "" }), /Metricool user token is required/);

  const client = createMetricoolClient({ userToken: "test_token" });
  await assert.rejects(() => client.listConnectedAccounts(""), /Metricool blogId is required/);
  await assert.rejects(
    () => client.publishPost("", { network: "instagram", text: "Olá" }),
    /Metricool blogId is required/,
  );
});

test("Metricool client: listConnectedAccounts consulta provedores conectados", async () => {
  const mockFetch: typeof fetch = async (input, init) => {
    const url = String(input);
    assert.match(url, /\/blogs\/blog-123\/providers$/);
    assert.equal((init?.headers as Record<string, string> | undefined)?.["X-Mc-Auth"], "valid_token");
    return {
      ok: true,
      json: async () => [
        { provider: "instagram", accountType: "business", id: "ig-100", username: "loja_ig", name: "Loja IG" },
        { provider: "facebook", accountType: "page", id: "fb-200", username: "loja_fb", name: "Loja FB" },
      ],
    } as unknown as Response;
  };

  const client = createMetricoolClient({
    userToken: "valid_token",
    fetchFn: mockFetch,
  });

  const accounts = await client.listConnectedAccounts("blog-123");
  assert.equal(accounts.length, 2);
  assert.equal(accounts[0].network, "instagram");
  assert.equal(accounts[0].username, "loja_ig");
  assert.equal(accounts[1].network, "facebook");
  assert.equal(accounts[1].accountType, "page");
});

test("Metricool client: publishPost envia payload e cabeçalho de autenticação", async () => {
  let capturedBody = "";
  const mockFetch: typeof fetch = async (input, init) => {
    capturedBody = String(init?.body);
    return {
      ok: true,
      json: async () => ({ id: "post_999", url: "https://instagram.com/p/123" }),
    } as unknown as Response;
  };

  const client = createMetricoolClient({
    userToken: "auth_token_xyz",
    fetchFn: mockFetch,
  });

  const result = await client.publishPost("blog-123", {
    network: "instagram",
    text: "Novo post promocional!",
    mediaUrls: ["https://example.com/image.jpg"],
  });

  assert.equal(result.id, "post_999");
  assert.equal(result.status, "published");
  const parsed = JSON.parse(capturedBody);
  assert.equal(parsed.provider, "instagram");
  assert.equal(parsed.text, "Novo post promocional!");
  assert.deepEqual(parsed.mediaUrls, ["https://example.com/image.jpg"]);
});

test("Metricool constraints & capabilities: espelha regras do S17", () => {
  // Instagram via Metricool: Business ou Creator permitido
  assert.deepEqual(resolveCapabilities("instagram", "business", "metricool"), ["publish", "read_metrics"]);
  assert.deepEqual(resolveCapabilities("instagram", "creator", "metricool"), ["publish", "read_metrics"]);
  // Instagram Personal é rejeitado
  assert.equal(resolveCapabilities("instagram", "personal", "metricool"), null);

  // Facebook só Page
  assert.deepEqual(resolveCapabilities("facebook", "page", "metricool"), ["publish", "read_metrics"]);
  assert.equal(resolveCapabilities("facebook", "personal", "metricool"), null);

  // YouTube só Channel
  assert.deepEqual(resolveCapabilities("youtube", "channel", "metricool"), ["publish", "read_metrics"]);
  assert.equal(resolveCapabilities("youtube", "personal", "metricool"), null);

  // X NUNCA via Metricool
  assert.equal(resolveCapabilities("x", "business", "metricool"), null);
  assert.equal(resolveCapabilities("x", "personal", "metricool"), null);
});

test("Action payload & permissions: canPerform e normalizeActionPayload", () => {
  const metricoolCaps = ["publish", "read_metrics"] as const;

  // Metricool só permite publish
  assert.equal(canPerform("publish_post", metricoolCaps), true);
  assert.equal(canPerform("update_bio", metricoolCaps), false);
  assert.equal(canPerform("update_photo", metricoolCaps), false);
  assert.equal(canPerform("update_link", metricoolCaps), false);

  // Normalização de publish_post
  const validPost = normalizeActionPayload("publish_post", {
    caption: "Legenda do post",
    mediaIds: ["00000000-0000-0000-0000-000000000001"],
  });
  assert.equal(validPost.ok, true);

  // Post sem legenda nem mídia é rejeitado
  const emptyPost = normalizeActionPayload("publish_post", { caption: "" });
  assert.equal(emptyPost.ok, false);

  // Legenda maior que 2200 caracteres é rejeitada
  const longPost = normalizeActionPayload("publish_post", { caption: "a".repeat(2201) });
  assert.equal(longPost.ok, false);

  // Normalização de update_link exige URL https
  assert.equal(normalizeActionPayload("update_link", { url: "https://example.com" }).ok, true);
  assert.equal(normalizeActionPayload("update_link", { url: "http://insecure.com" }).ok, false);
  assert.equal(normalizeActionPayload("update_link", { url: "not-a-url" }).ok, false);
});
