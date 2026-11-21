import type { MercadoLivreOrderInput } from "./order-snapshot.ts";

export const MERCADO_LIVRE_ORDER_PAGE_SIZE = 50;
export const MERCADO_LIVRE_ORDER_MAX_OFFSET = 10_000;

export type MercadoLivreOrderSyncWindow = {
  createdFrom: string;
  createdTo: string;
};

export type MercadoLivreOrderSyncPageRequest = MercadoLivreOrderSyncWindow & {
  offset: number;
};

export type MercadoLivreOrderSyncPageRequestResult =
  | { ok: true; value: MercadoLivreOrderSyncPageRequest }
  | { ok: false; error: string };

export type MercadoLivreOrderSyncAction = "next" | "restart";

export type MercadoLivreOrderSyncActionResult =
  | { ok: true; value: MercadoLivreOrderSyncAction }
  | { ok: false; error: string };

export type MercadoLivreOrderSearchPage = {
  orders: MercadoLivreOrderInput[];
  providerTotal: number | null;
  hasMore: boolean;
  nextOffset: number;
};

export type MercadoLivreOrderSearchPageResult =
  | { ok: true; value: MercadoLivreOrderSearchPage }
  | { ok: false; error: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isMercadoLivreOrderInput(value: unknown): value is MercadoLivreOrderInput {
  if (!isRecord(value)) return false;
  if (
    (typeof value.id !== "string" && typeof value.id !== "number") ||
    typeof value.status !== "string" ||
    typeof value.currency_id !== "string" ||
    typeof value.total_amount !== "number" ||
    typeof value.date_created !== "string"
  ) return false;
  if (
    value.date_last_updated !== undefined &&
    value.date_last_updated !== null &&
    typeof value.date_last_updated !== "string"
  ) return false;
  if (value.order_items !== undefined) {
    if (!Array.isArray(value.order_items)) return false;
    if (!value.order_items.every((item) => {
      if (!isRecord(item)) return false;
      const validFee = item.sale_fee === undefined || item.sale_fee === null || typeof item.sale_fee === "number";
      const validQuantity = item.quantity === undefined || item.quantity === null || typeof item.quantity === "number";
      return validFee && validQuantity;
    })) return false;
  }
  return true;
}

function floorToHour(value: Date): Date {
  const result = new Date(value);
  result.setUTCMinutes(0, 0, 0);
  return result;
}

function oneYearBefore(value: Date): Date {
  const year = value.getUTCFullYear() - 1;
  const month = value.getUTCMonth();
  const day = value.getUTCDate();
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, month, Math.min(day, lastDay), value.getUTCHours()));
}

function parseDate(value: unknown): Date | null {
  if (typeof value !== "string" || value.length > 64 || !/(?:Z|[+-]\d{2}:\d{2})$/i.test(value)) return null;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? floorToHour(parsed) : null;
}

/** The browser can choose only resume or an explicit restart; offsets/windows live server-side. */
export function parseMercadoLivreOrderSyncAction(input: unknown): MercadoLivreOrderSyncActionResult {
  if (input === undefined) return { ok: true, value: "next" };
  if (!isRecord(input)) {
    return { ok: false, error: "Invalid sync request." };
  }

  const body = input;
  if (Object.keys(body).some((key) => key !== "action")) {
    return { ok: false, error: "Sync cursor fields are managed by the server." };
  }
  const action = body.action === undefined ? "next" : body.action;
  if (action !== "next" && action !== "restart") {
    return { ok: false, error: "Invalid sync action." };
  }
  return { ok: true, value: action };
}

/**
 * Validates the Mercado Livre /orders/search response before any snapshot or
 * checkpoint write. A short page is terminal only when paging.total confirms
 * that the returned range reaches the provider's total.
 */
export function parseMercadoLivreOrderSearchPage(
  input: unknown,
  offset: number,
  pageSize = MERCADO_LIVRE_ORDER_PAGE_SIZE,
): MercadoLivreOrderSearchPageResult {
  if (!isRecord(input)) {
    return { ok: false, error: "Mercado Livre returned an invalid order search page." };
  }
  if (
    !Number.isSafeInteger(offset) ||
    offset < 0 ||
    !Number.isSafeInteger(pageSize) ||
    pageSize < 1 ||
    pageSize > MERCADO_LIVRE_ORDER_PAGE_SIZE
  ) {
    return { ok: false, error: "Mercado Livre order search pagination parameters are invalid." };
  }
  if (!Array.isArray(input.results)) {
    return { ok: false, error: "Mercado Livre order search results must be an array." };
  }
  if (input.results.length > pageSize) {
    return { ok: false, error: "Mercado Livre returned more orders than the requested page size." };
  }
  if (!input.results.every(isMercadoLivreOrderInput)) {
    return { ok: false, error: "Mercado Livre order search contains a malformed order." };
  }

  let providerTotal: number | null = null;
  if (Object.prototype.hasOwnProperty.call(input, "paging")) {
    const paging = input.paging;
    if (!isRecord(paging)) {
      return { ok: false, error: "Mercado Livre order search paging metadata is malformed." };
    }
    if (Object.prototype.hasOwnProperty.call(paging, "total")) {
      const total = paging.total;
      if (typeof total !== "number" || !Number.isSafeInteger(total) || total < 0) {
        return { ok: false, error: "Mercado Livre order search total is invalid." };
      }
      providerTotal = total;
    }
  }

  const orders = input.results as MercadoLivreOrderInput[];
  const nextOffset = offset + orders.length;
  if (!Number.isSafeInteger(nextOffset)) {
    return { ok: false, error: "Mercado Livre order search offset overflowed." };
  }

  let hasMore: boolean;
  if (providerTotal !== null) {
    if (offset > providerTotal || nextOffset > providerTotal) {
      return { ok: false, error: "Mercado Livre order search page exceeds the provider total." };
    }
    hasMore = nextOffset < providerTotal;
    if (hasMore && orders.length < pageSize) {
      return { ok: false, error: "Mercado Livre returned a partial page before the provider total was reached." };
    }
  } else {
    // Without a provider total, a short page cannot prove that the history is complete.
    // Fail closed so the caller releases the lease instead of advancing the checkpoint.
    if (orders.length < pageSize) {
      return { ok: false, error: "Mercado Livre returned a short page without a trustworthy provider total." };
    }
    hasMore = true;
  }

  return {
    ok: true,
    value: { orders, providerTotal, hasMore, nextOffset },
  };
}

/**
 * Validates the legacy/manual date window shape. Kept for deterministic unit
 * coverage and migration compatibility; the active endpoint now owns the cursor.
 */
export function parseMercadoLivreOrderSyncPageRequest(
  input: unknown,
  now = new Date(),
): MercadoLivreOrderSyncPageRequestResult {
  const body = input === undefined
    ? {}
    : isRecord(input)
      ? input
      : null;

  if (body === null) return { ok: false, error: "Invalid sync request." };

  const offset = body.offset === undefined ? 0 : body.offset;
  if (
    typeof offset !== "number" ||
    !Number.isSafeInteger(offset) ||
    offset < 0 ||
    offset > MERCADO_LIVRE_ORDER_MAX_OFFSET ||
    offset % MERCADO_LIVRE_ORDER_PAGE_SIZE !== 0
  ) {
    return { ok: false, error: "Invalid page offset." };
  }

  let createdFrom: Date;
  let createdTo: Date;
  if (offset > 0 && body.createdFrom === undefined && body.createdTo === undefined) {
    return { ok: false, error: "A fixed date window is required after the first page." };
  }
  if (body.createdFrom === undefined && body.createdTo === undefined) {
    createdTo = floorToHour(now);
    createdFrom = oneYearBefore(createdTo);
  } else {
    if (body.createdFrom === undefined || body.createdTo === undefined) {
      return { ok: false, error: "Both createdFrom and createdTo are required." };
    }
    const from = parseDate(body.createdFrom);
    const to = parseDate(body.createdTo);
    if (!from || !to) return { ok: false, error: "Invalid date window." };
    createdFrom = from;
    createdTo = to;
  }

  const nowHour = floorToHour(now);
  const windowMs = createdTo.getTime() - createdFrom.getTime();
  if (
    createdFrom.getTime() >= createdTo.getTime() ||
    createdTo.getTime() > nowHour.getTime() ||
    windowMs > 367 * 24 * 60 * 60 * 1000
  ) {
    return { ok: false, error: "Date window must be valid, at most 12 months, and not in the future." };
  }

  return {
    ok: true,
    value: {
      offset,
      createdFrom: createdFrom.toISOString(),
      createdTo: createdTo.toISOString(),
    },
  };
}
