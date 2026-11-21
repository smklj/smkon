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
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, error: "Invalid sync request." };
  }

  const body = input as Record<string, unknown>;
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
 * Validates the legacy/manual date window shape. Kept for deterministic unit
 * coverage and migration compatibility; the active endpoint now owns the cursor.
 */
export function parseMercadoLivreOrderSyncPageRequest(
  input: unknown,
  now = new Date(),
): MercadoLivreOrderSyncPageRequestResult {
  const body = input === undefined
    ? {}
    : input !== null && typeof input === "object" && !Array.isArray(input)
      ? input as Record<string, unknown>
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
