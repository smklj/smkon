import type { SocialAccountType, SocialCapability, SocialNetwork } from "../registry.ts";

export type MetricoolRawAccount = {
  network: string;
  accountType?: string;
  id: string;
  username?: string;
  name?: string;
  picture?: string;
};

export type MetricoolPostPayload = {
  network: SocialNetwork;
  text: string;
  mediaUrls?: string[];
  scheduledAt?: string;
};

export type MetricoolPostResponse = {
  id: string;
  status: "published" | "scheduled" | "draft" | "error";
  url?: string;
  error?: string;
};

export type MetricoolSyncAccountItem = {
  network: SocialNetwork;
  account_type: SocialAccountType;
  external_account_id: string;
  handle: string | null;
  display_name: string | null;
  capabilities: SocialCapability[];
};
