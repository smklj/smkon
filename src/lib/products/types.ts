/** SMKON Product Intelligence — tipos compartilhados. */

export type ProductSource =
  | "kiwify"
  | "hotmart"
  | "shopify"
  | "amazon"
  | "manual"
  | "other";

export type ProductType = "digital" | "info" | "physical" | "service" | "unknown";

export type ProductStatus =
  | "discovered"
  | "selected"
  | "active"
  | "archived";

export type RevenueDomain = "own_sales" | "affiliate" | "media";

export type ProductEvidence = {
  source: string;
  url?: string;
  note?: string;
  capturedAt: string;
};

export type Product = {
  id: string;
  organizationId: string;
  name: string;
  source: ProductSource;
  externalId?: string;
  type: ProductType;
  priceCents?: number;
  currency: string;
  commissionPercent?: number;
  affiliateUrl?: string;
  status: ProductStatus;
  score?: number;
  scoreReasons?: string[];
  evidence: ProductEvidence[];
  revenueDomain: RevenueDomain;
  createdAt: string;
  updatedAt: string;
};

export type ProductPayload = Partial<
  Omit<Product, "id" | "organizationId" | "createdAt" | "updatedAt">
> & {
  name: string;
  source: ProductSource;
};
