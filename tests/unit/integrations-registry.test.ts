import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  REVENUE_PROVIDERS,
  SOCIAL_NETWORKS,
  canPerform,
  normalizeActionPayload,
  resolveCapabilities,
} from "../../src/lib/integrations/registry.ts";

const migration = readFileSync(
  new URL("../../supabase/migrations/20261121180000_integration_hub.sql", import.meta.url),
  "utf8",
);

test("Instagram and TikTok never expose profile editing, via Metricool or native API", () => {
  for (const network of ["instagram", "tiktok"] as const) {
    for (const via of ["metricool", "native"] as const) {
      const caps = resolveCapabilities(network, "creator", via) ?? [];
      assert.ok(caps.includes("publish"));
      assert.ok(!caps.includes("update_photo") && !caps.includes("update_bio") && !caps.includes("update_link"));
    }
  }
});

test("Metricool only grants publish and metrics", () => {
  for (const info of SOCIAL_NETWORKS) {
    if (!info.via.includes("metricool")) continue;
    const caps = resolveCapabilities(info.network, info.accountTypes[0], "metricool") ?? [];
    assert.ok(caps.every((cap) => cap === "publish" || cap === "read_metrics"), info.network);
  }
});

test("invalid combinations mirror database constraints", () => {
  assert.equal(resolveCapabilities("instagram", "personal", "metricool"), null);
  assert.equal(resolveCapabilities("threads", "personal", "native"), null);
  assert.equal(resolveCapabilities("facebook", "business", "native"), null);
  assert.equal(resolveCapabilities("youtube", "creator", "native"), null);
  assert.equal(resolveCapabilities("x", "personal", "metricool"), null);
  assert.deepEqual(resolveCapabilities("x", "personal", "native", ["publish"]), ["publish"]);
});

test("registry networks, capabilities and providers exist in the migration", () => {
  for (const info of SOCIAL_NETWORKS) {
    assert.ok(migration.includes(`'${info.network}'`), info.network);
    for (const cap of info.nativeCapabilities) assert.ok(migration.includes(`'${cap}'`), cap);
  }
  for (const provider of ["hotmart", "shopify", "stripe"]) {
    assert.ok(REVENUE_PROVIDERS.some((item) => item.provider === provider));
    assert.ok(migration.includes(`'${provider}'`), provider);
  }
});

test("canPerform maps actions to capabilities", () => {
  assert.equal(canPerform("publish_post", ["publish"]), true);
  assert.equal(canPerform("update_photo", ["publish", "read_metrics"]), false);
});

test("publish payload is normalized and strict", () => {
  const id = "11111111-1111-4111-8111-111111111111";
  assert.deepEqual(normalizeActionPayload("publish_post", { caption: "  oi  ", mediaIds: [id], extra: 1 }), {
    ok: true,
    payload: { caption: "oi", mediaIds: [id] },
  });
  assert.deepEqual(normalizeActionPayload("publish_post", {}), { ok: false, error: "post_requires_caption_or_media" });
  assert.deepEqual(normalizeActionPayload("publish_post", { caption: "x".repeat(2201) }), { ok: false, error: "caption_too_long" });
  assert.deepEqual(normalizeActionPayload("publish_post", { mediaIds: ["../etc"] }), { ok: false, error: "invalid_media_ids" });
  assert.deepEqual(normalizeActionPayload("publish_post", []), { ok: false, error: "payload_must_be_object" });
});

test("profile payloads require valid values", () => {
  assert.deepEqual(normalizeActionPayload("update_link", { url: "http://x.com" }), { ok: false, error: "https_url_required" });
  assert.deepEqual(normalizeActionPayload("update_link", { url: "https://smkon.com/p" }), { ok: true, payload: { url: "https://smkon.com/p" } });
  assert.deepEqual(normalizeActionPayload("update_bio", { bio: "  " }), { ok: false, error: "bio_required" });
  assert.deepEqual(normalizeActionPayload("update_photo", { mediaId: "nope" }), { ok: false, error: "invalid_media_id" });
});
