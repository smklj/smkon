import type { MetricoolPostPayload, MetricoolPostResponse, MetricoolRawAccount } from "./types.ts";

export interface MetricoolClient {
  listConnectedAccounts(blogId: string): Promise<MetricoolRawAccount[]>;
  publishPost(blogId: string, payload: MetricoolPostPayload): Promise<MetricoolPostResponse>;
}

export interface MetricoolClientOptions {
  userToken: string;
  baseUrl?: string;
  fetchFn?: typeof fetch;
}

const DEFAULT_BASE_URL = "https://app.metricool.com/api/v2";

/**
 * Cliente HTTP da API oficial do Metricool.
 */
export function createMetricoolClient(options: MetricoolClientOptions): MetricoolClient {
  const { userToken, baseUrl = DEFAULT_BASE_URL, fetchFn = fetch } = options;

  if (!userToken || typeof userToken !== "string" || userToken.trim().length === 0) {
    throw new Error("Metricool user token is required.");
  }

  const headers = {
    "X-Mc-Auth": userToken.trim(),
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  return {
    async listConnectedAccounts(blogId: string): Promise<MetricoolRawAccount[]> {
      if (!blogId) throw new Error("Metricool blogId is required.");
      const url = `${baseUrl}/blogs/${encodeURIComponent(blogId)}/providers`;
      const res = await fetchFn(url, { method: "GET", headers });
      if (!res.ok) {
        throw new Error(`Metricool list providers failed with status ${res.status}`);
      }
      const data = await res.json();
      if (!Array.isArray(data)) return [];
      return data.map((item: Record<string, unknown>) => ({
        network: String(item.provider || item.network || "").toLowerCase(),
        accountType: typeof item.accountType === "string" ? item.accountType.toLowerCase() : undefined,
        id: String(item.id || item.externalId || ""),
        username: typeof item.username === "string" ? item.username : undefined,
        name: typeof item.name === "string" ? item.name : undefined,
        picture: typeof item.picture === "string" ? item.picture : undefined,
      }));
    },

    async publishPost(blogId: string, payload: MetricoolPostPayload): Promise<MetricoolPostResponse> {
      if (!blogId) throw new Error("Metricool blogId is required.");
      const url = `${baseUrl}/blogs/${encodeURIComponent(blogId)}/posts`;
      const res = await fetchFn(url, {
        method: "POST",
        headers,
        body: JSON.stringify({
          provider: payload.network,
          text: payload.text,
          mediaUrls: payload.mediaUrls ?? [],
          publicationDate: payload.scheduledAt ?? new Date().toISOString(),
        }),
      });

      if (!res.ok) {
        const errorText = await res.text().catch(() => "");
        throw new Error(`Metricool post failed with status ${res.status}: ${errorText}`);
      }

      const json = await res.json().catch(() => ({}));
      return {
        id: String(json.id || json.postId || genTempRef()),
        status: "published",
        url: typeof json.url === "string" ? json.url : undefined,
      };
    },
  };
}

function genTempRef(): string {
  return `mc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
