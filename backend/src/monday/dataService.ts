/**
 * Data service — fetches from Monday.com and returns normalized data.
 * Implements a short TTL cache (5 minutes) to avoid hammering the API
 * on every question while keeping data reasonably fresh.
 */

import { mondayClient } from './client';
import { normalizeDeals, normalizeWorkOrders, buildDataQualityReport } from '../normalization/normalizer';
import { NormalizedDeal, NormalizedWorkOrder, DataQualityReport } from '../normalization/types';

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface CacheEntry<T> {
  data: T;
  fetchedAt: number;
}

interface AppData {
  deals: NormalizedDeal[];
  workOrders: NormalizedWorkOrder[];
  quality: DataQualityReport;
  fetchedAt: Date;
}

let cache: CacheEntry<AppData> | null = null;

function isCacheValid(): boolean {
  if (!cache) return false;
  return Date.now() - cache.fetchedAt < CACHE_TTL_MS;
}

export async function getAppData(forceRefresh = false): Promise<AppData> {
  if (!forceRefresh && isCacheValid()) {
    return cache!.data;
  }

  const dealsBoardId = process.env.DEALS_BOARD_ID;
  const woBoardId = process.env.WORK_ORDERS_BOARD_ID;

  if (!dealsBoardId) {
    throw new Error('DEALS_BOARD_ID is not configured. Please set it in your .env file.');
  }
  if (!woBoardId) {
    throw new Error('WORK_ORDERS_BOARD_ID is not configured. Please set it in your .env file.');
  }

  // Fetch both boards in parallel
  const [dealsData, woData] = await Promise.all([
    mondayClient.getBoardData(dealsBoardId),
    mondayClient.getBoardData(woBoardId),
  ]);

  const { deals, quality: dealsQuality } = normalizeDeals(dealsData.items, dealsData.metadata);
  const { workOrders, quality: woQuality } = normalizeWorkOrders(woData.items, woData.metadata);
  const quality = buildDataQualityReport(dealsQuality, woQuality);

  console.log(
    `[DataService] Loaded ${deals.length} deals, ${workOrders.length} work orders. ` +
    `Quality warnings: ${quality.warnings.length}`
  );

  const appData: AppData = {
    deals,
    workOrders,
    quality,
    fetchedAt: new Date(),
  };

  cache = { data: appData, fetchedAt: Date.now() };
  return appData;
}

/** Invalidate cache manually (e.g., when user asks to refresh) */
export function invalidateCache(): void {
  cache = null;
}
