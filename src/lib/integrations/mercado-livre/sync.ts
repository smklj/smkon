import {
  normalizeMercadoLivreOrder,
  type MercadoLivreOrderInput,
  type MercadoLivreOrderSnapshot,
} from "./order-snapshot.ts";

export type MercadoLivreOrderPage = {
  paging?: {
    total?: number;
    offset?: number;
    limit?: number;
  };
  results?: MercadoLivreOrderInput[];
};

export type SyncCheckpoint = {
  pageIndex: number;
  offset: number;
  batchSize: number;
  persistedCount: number;
  occurredAtRange: {
    earliest: string | null;
    latest: string | null;
  };
  syncedAt: string;
};

export type PaginatedSyncOptions = {
  pageSize?: number;
  maxPages?: number;
  initialOffset?: number;
  dateFrom?: string;
  dateTo?: string;
  dryRun?: boolean;
};

export type PaginatedSyncResult = {
  success: boolean;
  pagesProcessed: number;
  ordersFetched: number;
  ordersPersisted: number;
  totalProviderOrders: number | null;
  hasMore: boolean;
  nextOffset: number | null;
  checkpoints: SyncCheckpoint[];
  stoppedReason?: "completed" | "max_pages_reached" | "empty_page" | "error";
  error?: string;
};

export type PageFetcher = (options: {
  seller: string;
  limit: number;
  offset: number;
  sort: "date_desc";
  dateFrom?: string;
  dateTo?: string;
}) => Promise<MercadoLivreOrderPage>;

export type SnapshotPersister = (
  snapshots: MercadoLivreOrderSnapshot[],
  syncedAt: string,
) => Promise<number>;

export async function executePaginatedSync(
  fetchPage: PageFetcher,
  persistSnapshots: SnapshotPersister | null,
  sellerId: string,
  options: PaginatedSyncOptions = {},
): Promise<PaginatedSyncResult> {
  const pageSize = Math.min(Math.max(options.pageSize ?? 50, 1), 50);
  const maxPages = Math.min(Math.max(options.maxPages ?? 10, 1), 100);
  let currentOffset = Math.max(options.initialOffset ?? 0, 0);
  const dryRun = Boolean(options.dryRun);

  let pagesProcessed = 0;
  let ordersFetched = 0;
  let ordersPersisted = 0;
  let totalProviderOrders: number | null = null;
  let hasMore = false;
  const checkpoints: SyncCheckpoint[] = [];

  while (pagesProcessed < maxPages) {
    let page: MercadoLivreOrderPage;
    try {
      page = await fetchPage({
        seller: sellerId,
        limit: pageSize,
        offset: currentOffset,
        sort: "date_desc",
        dateFrom: options.dateFrom,
        dateTo: options.dateTo,
      });
    } catch (err) {
      return {
        success: false,
        pagesProcessed,
        ordersFetched,
        ordersPersisted,
        totalProviderOrders,
        hasMore: true,
        nextOffset: currentOffset,
        checkpoints,
        stoppedReason: "error",
        error: err instanceof Error ? err.message : "Failed to fetch order page",
      };
    }

    if (page.paging?.total !== undefined && page.paging.total !== null) {
      totalProviderOrders = page.paging.total;
    }

    const rawOrders = Array.isArray(page.results) ? page.results : [];
    if (rawOrders.length === 0) {
      return {
        success: true,
        pagesProcessed,
        ordersFetched,
        ordersPersisted,
        totalProviderOrders,
        hasMore: false,
        nextOffset: currentOffset,
        checkpoints,
        stoppedReason: "empty_page",
      };
    }

    const snapshots = rawOrders.map(normalizeMercadoLivreOrder);
    const nowIso = new Date().toISOString();

    let earliestDate: string | null = null;
    let latestDate: string | null = null;
    for (const snap of snapshots) {
      if (!earliestDate || snap.occurred_at < earliestDate) earliestDate = snap.occurred_at;
      if (!latestDate || snap.occurred_at > latestDate) latestDate = snap.occurred_at;
    }

    let batchPersisted = 0;
    if (!dryRun && persistSnapshots) {
      try {
        batchPersisted = await persistSnapshots(snapshots, nowIso);
      } catch (err) {
        return {
          success: false,
          pagesProcessed,
          ordersFetched,
          ordersPersisted,
          totalProviderOrders,
          hasMore: true,
          nextOffset: currentOffset,
          checkpoints,
          stoppedReason: "error",
          error: err instanceof Error ? err.message : "Failed to persist order snapshots",
        };
      }
    } else {
      batchPersisted = snapshots.length;
    }

    checkpoints.push({
      pageIndex: pagesProcessed,
      offset: currentOffset,
      batchSize: snapshots.length,
      persistedCount: batchPersisted,
      occurredAtRange: { earliest: earliestDate, latest: latestDate },
      syncedAt: nowIso,
    });

    ordersFetched += snapshots.length;
    ordersPersisted += batchPersisted;
    pagesProcessed += 1;
    currentOffset += snapshots.length;

    if (totalProviderOrders !== null && currentOffset >= totalProviderOrders) {
      hasMore = false;
      break;
    }

    if (rawOrders.length < pageSize) {
      hasMore = false;
      break;
    }

    hasMore = true;
  }

  return {
    success: true,
    pagesProcessed,
    ordersFetched,
    ordersPersisted,
    totalProviderOrders,
    hasMore,
    nextOffset: hasMore ? currentOffset : null,
    checkpoints,
    stoppedReason: hasMore ? "max_pages_reached" : "completed",
  };
}
