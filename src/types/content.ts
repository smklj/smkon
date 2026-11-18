export type ContentStatus = "draft" | "pending_review" | "approved" | "scheduled";

export interface ContentItem {
  id: string;
  title: string;
  body: string;
  status: ContentStatus;
  contentHash?: string;
  updatedAt: string;
}
