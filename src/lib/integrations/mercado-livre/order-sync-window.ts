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
  if (typeof value !== "string" || value.length > 64 || !/(?:Z|[+-]\\d{2}:\\d{2})$/i.test(value)) return null;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? floorToHour(parsed) : null;
}

/**
 * Validates a manual page request. The date window is fixed by the client
 * after page 1, so later pages query the same 12-month snapshot window.
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
