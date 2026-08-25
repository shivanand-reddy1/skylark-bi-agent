/**
 * Deterministic Analytics Engine.
 * ALL calculations here use TypeScript arithmetic — no LLM involved.
 * The LLM only receives the results of these functions to generate explanations.
 */

import { NormalizedDeal, NormalizedWorkOrder, DataQualityReport } from '../normalization/types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getCurrentQuarterRange(): { start: Date; end: Date } {
  const now = new Date();
  const quarter = Math.floor(now.getMonth() / 3);
  const start = new Date(now.getFullYear(), quarter * 3, 1);
  const end = new Date(now.getFullYear(), quarter * 3 + 3, 0, 23, 59, 59);
  return { start, end };
}

function isInQuarter(date: Date | null, quarter: 'current' | 'next' | 'last'): boolean {
  if (!date) return false;
  const now = new Date();
  const q = Math.floor(now.getMonth() / 3);
  let offset = 0;
  if (quarter === 'next') offset = 1;
  if (quarter === 'last') offset = -1;
  const targetQ = q + offset;
  const targetYear = now.getFullYear() + Math.floor(targetQ / 4);
  const normalizedQ = ((targetQ % 4) + 4) % 4;
  const start = new Date(targetYear, normalizedQ * 3, 1);
  const end = new Date(targetYear, normalizedQ * 3 + 3, 0, 23, 59, 59);
  return date >= start && date <= end;
}

function formatINR(value: number): string {
  if (value >= 10_000_000) return `₹${(value / 10_000_000).toFixed(2)} Cr`;
  if (value >= 100_000) return `₹${(value / 100_000).toFixed(2)} L`;
  return `₹${value.toLocaleString('en-IN')}`;
}

function getEffectiveCloseDate(deal: NormalizedDeal): Date | null {
  return deal.closeDate ?? deal.tentativeCloseDate;
}

// ─── Deal Filters ─────────────────────────────────────────────────────────────

function getOpenDeals(deals: NormalizedDeal[]): NormalizedDeal[] {
  return deals.filter((d) => d.status === 'Open');
}

function getWonDeals(deals: NormalizedDeal[]): NormalizedDeal[] {
  return deals.filter((d) => d.status === 'Won');
}

function getLostDeals(deals: NormalizedDeal[]): NormalizedDeal[] {
  return deals.filter((d) => d.status === 'Lost' || d.status === 'Dead');
}

function filterBySector(deals: NormalizedDeal[], sector: string): NormalizedDeal[] {
  if (!sector) return deals;
  const normalized = sector.toLowerCase();
  return deals.filter((d) => d.normalizedSector.toLowerCase().includes(normalized));
}

// ─── Pipeline Analytics ───────────────────────────────────────────────────────

export interface PipelineSummary {
  totalPipeline: number;
  totalPipelineFormatted: string;
  weightedPipeline: number;
  weightedPipelineFormatted: string;
  openDeals: number;
  dealsWithValue: number;
  dealsWithProbability: number;
  dealsExcludedFromWeighted: number;
  averageDealSize: number | null;
  averageDealSizeFormatted: string;
}

export function getTotalPipeline(deals: NormalizedDeal[]): PipelineSummary {
  const open = getOpenDeals(deals);
  const withValue = open.filter((d) => d.dealValue !== null);
  const total = withValue.reduce((sum, d) => sum + (d.dealValue ?? 0), 0);

  const withBoth = withValue.filter((d) => d.probabilityNumeric !== null);
  const weighted = withBoth.reduce(
    (sum, d) => sum + (d.dealValue ?? 0) * (d.probabilityNumeric ?? 0),
    0
  );
  const excluded = withValue.length - withBoth.length;

  const avg = withValue.length > 0 ? total / withValue.length : null;

  return {
    totalPipeline: total,
    totalPipelineFormatted: formatINR(total),
    weightedPipeline: weighted,
    weightedPipelineFormatted: formatINR(weighted),
    openDeals: open.length,
    dealsWithValue: withValue.length,
    dealsWithProbability: withBoth.length,
    dealsExcludedFromWeighted: excluded,
    averageDealSize: avg,
    averageDealSizeFormatted: avg !== null ? formatINR(avg) : 'N/A',
  };
}

export interface SectorPipelineResult {
  sector: string;
  totalPipeline: number;
  totalPipelineFormatted: string;
  weightedPipeline: number;
  weightedPipelineFormatted: string;
  dealCount: number;
  openDeals: number;
  wonDeals: number;
  averageDealSize: number | null;
  averageDealSizeFormatted: string;
  topStages: string[];
}

export function getPipelineBySector(
  deals: NormalizedDeal[],
  sectorFilter?: string
): SectorPipelineResult[] {
  const allSectors = [...new Set(deals.map((d) => d.normalizedSector))].filter(
    (s) => s !== 'Unknown' && s !== ''
  );

  const sectors = sectorFilter
    ? allSectors.filter((s) => s.toLowerCase().includes(sectorFilter.toLowerCase()))
    : allSectors;

  return sectors
    .map((sector) => {
      const sectorDeals = deals.filter((d) => d.normalizedSector === sector);
      const openDeals = sectorDeals.filter((d) => d.status === 'Open');
      const wonDeals = sectorDeals.filter((d) => d.status === 'Won');
      const withValue = openDeals.filter((d) => d.dealValue !== null);
      const total = withValue.reduce((sum, d) => sum + (d.dealValue ?? 0), 0);
      const withBoth = withValue.filter((d) => d.probabilityNumeric !== null);
      const weighted = withBoth.reduce(
        (sum, d) => sum + (d.dealValue ?? 0) * (d.probabilityNumeric ?? 0),
        0
      );
      const avg = withValue.length > 0 ? total / withValue.length : null;

      // Find top stages for this sector
      const stageCounts: Record<string, number> = {};
      openDeals.forEach((d) => {
        if (d.stage) stageCounts[d.stage] = (stageCounts[d.stage] || 0) + 1;
      });
      const topStages = Object.entries(stageCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([s]) => s);

      return {
        sector,
        totalPipeline: total,
        totalPipelineFormatted: formatINR(total),
        weightedPipeline: weighted,
        weightedPipelineFormatted: formatINR(weighted),
        dealCount: sectorDeals.length,
        openDeals: openDeals.length,
        wonDeals: wonDeals.length,
        averageDealSize: avg,
        averageDealSizeFormatted: avg !== null ? formatINR(avg) : 'N/A',
        topStages,
      };
    })
    .sort((a, b) => b.totalPipeline - a.totalPipeline);
}

export interface QuarterlyPipeline {
  quarter: 'current' | 'next' | 'last';
  label: string;
  totalPipeline: number;
  totalPipelineFormatted: string;
  weightedPipeline: number;
  weightedPipelineFormatted: string;
  dealCount: number;
  closingDeals: NormalizedDeal[];
}

export function getQuarterlyPipeline(
  deals: NormalizedDeal[],
  quarter: 'current' | 'next' | 'last' = 'current'
): QuarterlyPipeline {
  const open = getOpenDeals(deals);
  const { start, end } = getCurrentQuarterRange();

  let label: string;
  const now = new Date();
  const q = Math.floor(now.getMonth() / 3) + 1;
  if (quarter === 'current') label = `Q${q} ${now.getFullYear()}`;
  else if (quarter === 'next') {
    const nextQ = q === 4 ? 1 : q + 1;
    const nextYear = q === 4 ? now.getFullYear() + 1 : now.getFullYear();
    label = `Q${nextQ} ${nextYear}`;
  } else {
    const lastQ = q === 1 ? 4 : q - 1;
    const lastYear = q === 1 ? now.getFullYear() - 1 : now.getFullYear();
    label = `Q${lastQ} ${lastYear}`;
  }

  const closingDeals = open.filter((d) => {
    const date = getEffectiveCloseDate(d);
    return date && isInQuarter(date, quarter);
  });

  const withValue = closingDeals.filter((d) => d.dealValue !== null);
  const total = withValue.reduce((sum, d) => sum + (d.dealValue ?? 0), 0);
  const withBoth = withValue.filter((d) => d.probabilityNumeric !== null);
  const weighted = withBoth.reduce(
    (sum, d) => sum + (d.dealValue ?? 0) * (d.probabilityNumeric ?? 0),
    0
  );

  return {
    quarter,
    label,
    totalPipeline: total,
    totalPipelineFormatted: formatINR(total),
    weightedPipeline: weighted,
    weightedPipelineFormatted: formatINR(weighted),
    dealCount: closingDeals.length,
    closingDeals,
  };
}

// ─── Revenue Analytics ────────────────────────────────────────────────────────

export interface RevenueResult {
  wonValue: number;
  wonValueFormatted: string;
  wonDealsCount: number;
  lostValue: number;
  lostValueFormatted: string;
  lostDealsCount: number;
  winRate: number;
  winRateFormatted: string;
  averageWonDealSize: number | null;
  averageWonDealSizeFormatted: string;
}

export function getRevenue(deals: NormalizedDeal[]): RevenueResult {
  const won = getWonDeals(deals);
  const lost = getLostDeals(deals);

  const wonWithValue = won.filter((d) => d.dealValue !== null);
  const lostWithValue = lost.filter((d) => d.dealValue !== null);

  const wonValue = wonWithValue.reduce((s, d) => s + (d.dealValue ?? 0), 0);
  const lostValue = lostWithValue.reduce((s, d) => s + (d.dealValue ?? 0), 0);

  const totalClosed = won.length + lost.length;
  const winRate = totalClosed > 0 ? won.length / totalClosed : 0;

  const avgWon = wonWithValue.length > 0 ? wonValue / wonWithValue.length : null;

  return {
    wonValue,
    wonValueFormatted: formatINR(wonValue),
    wonDealsCount: won.length,
    lostValue,
    lostValueFormatted: formatINR(lostValue),
    lostDealsCount: lost.length,
    winRate,
    winRateFormatted: `${(winRate * 100).toFixed(1)}%`,
    averageWonDealSize: avgWon,
    averageWonDealSizeFormatted: avgWon !== null ? formatINR(avgWon) : 'N/A',
  };
}

// ─── Work Order Analytics ─────────────────────────────────────────────────────

export interface WorkOrderMetrics {
  total: number;
  completed: number;
  inProgress: number;
  notStarted: number;
  onHold: number;
  delayed: number;
  completionRate: number;
  completionRateFormatted: string;
  totalContractValue: number;
  totalContractValueFormatted: string;
  totalBilledValue: number;
  totalBilledValueFormatted: string;
  totalCollected: number;
  totalCollectedFormatted: string;
  totalReceivable: number;
  totalReceivableFormatted: string;
  billingEfficiency: number;
  billingEfficiencyFormatted: string;
}

export function getOperationalMetrics(workOrders: NormalizedWorkOrder[]): WorkOrderMetrics {
  const total = workOrders.length;
  const completed = workOrders.filter((w) => w.normalizedExecutionStatus === 'completed').length;
  const inProgress = workOrders.filter((w) => w.normalizedExecutionStatus === 'in_progress').length;
  const notStarted = workOrders.filter((w) => w.normalizedExecutionStatus === 'not_started').length;
  const onHold = workOrders.filter((w) => w.normalizedExecutionStatus === 'on_hold').length;
  const delayed = workOrders.filter((w) => w.isDelayed).length;

  const completionRate = total > 0 ? completed / total : 0;

  const withAmount = workOrders.filter((w) => w.amountExclGST !== null);
  const totalContract = withAmount.reduce((s, w) => s + (w.amountExclGST ?? 0), 0);

  const withBilled = workOrders.filter((w) => w.billedValueExclGST !== null);
  const totalBilled = withBilled.reduce((s, w) => s + (w.billedValueExclGST ?? 0), 0);

  const withCollected = workOrders.filter((w) => w.collectedAmount !== null);
  const totalCollected = withCollected.reduce((s, w) => s + (w.collectedAmount ?? 0), 0);

  const withReceivable = workOrders.filter((w) => w.amountReceivable !== null);
  const totalReceivable = withReceivable.reduce((s, w) => s + (w.amountReceivable ?? 0), 0);

  const billingEfficiency = totalContract > 0 ? totalBilled / totalContract : 0;

  return {
    total,
    completed,
    inProgress,
    notStarted,
    onHold,
    delayed,
    completionRate,
    completionRateFormatted: `${(completionRate * 100).toFixed(1)}%`,
    totalContractValue: totalContract,
    totalContractValueFormatted: formatINR(totalContract),
    totalBilledValue: totalBilled,
    totalBilledValueFormatted: formatINR(totalBilled),
    totalCollected,
    totalCollectedFormatted: formatINR(totalCollected),
    totalReceivable,
    totalReceivableFormatted: formatINR(totalReceivable),
    billingEfficiency,
    billingEfficiencyFormatted: `${(billingEfficiency * 100).toFixed(1)}%`,
  };
}

export function getDelayedWorkOrders(workOrders: NormalizedWorkOrder[]): NormalizedWorkOrder[] {
  return workOrders.filter((w) => w.isDelayed);
}

// ─── Sector Performance ───────────────────────────────────────────────────────

export interface SectorPerformance {
  sector: string;
  deals: number;
  openDeals: number;
  wonDeals: number;
  openPipeline: number;
  openPipelineFormatted: string;
  workOrders: number;
  completedWorkOrders: number;
  inProgressWorkOrders: number;
  delayedWorkOrders: number;
  contractValue: number;
  contractValueFormatted: string;
}

export function getSectorPerformance(
  deals: NormalizedDeal[],
  workOrders: NormalizedWorkOrder[]
): SectorPerformance[] {
  const allSectors = [
    ...new Set([
      ...deals.map((d) => d.normalizedSector),
      ...workOrders.map((w) => w.normalizedSector),
    ]),
  ].filter((s) => s !== 'Unknown' && s !== '');

  return allSectors
    .map((sector) => {
      const sectorDeals = deals.filter((d) => d.normalizedSector === sector);
      const sectorWOs = workOrders.filter((w) => w.normalizedSector === sector);
      const openDeals = sectorDeals.filter((d) => d.status === 'Open');
      const wonDeals = sectorDeals.filter((d) => d.status === 'Won');
      const openPipeline = openDeals
        .filter((d) => d.dealValue !== null)
        .reduce((s, d) => s + (d.dealValue ?? 0), 0);
      const contractValue = sectorWOs
        .filter((w) => w.amountExclGST !== null)
        .reduce((s, w) => s + (w.amountExclGST ?? 0), 0);

      return {
        sector,
        deals: sectorDeals.length,
        openDeals: openDeals.length,
        wonDeals: wonDeals.length,
        openPipeline,
        openPipelineFormatted: formatINR(openPipeline),
        workOrders: sectorWOs.length,
        completedWorkOrders: sectorWOs.filter((w) => w.normalizedExecutionStatus === 'completed').length,
        inProgressWorkOrders: sectorWOs.filter((w) => w.normalizedExecutionStatus === 'in_progress').length,
        delayedWorkOrders: sectorWOs.filter((w) => w.isDelayed).length,
        contractValue,
        contractValueFormatted: formatINR(contractValue),
      };
    })
    .sort((a, b) => b.openPipeline - a.openPipeline);
}

// ─── Customer Analytics ───────────────────────────────────────────────────────

export interface CustomerPerformance {
  customerCode: string;
  openDeals: number;
  totalDealValue: number;
  totalDealValueFormatted: string;
  wonDeals: number;
  workOrders: number;
  activeWorkOrders: number;
  contractValue: number;
  contractValueFormatted: string;
  sectors: string[];
}

export function getCustomerPerformance(
  deals: NormalizedDeal[],
  workOrders: NormalizedWorkOrder[],
  limit = 10
): CustomerPerformance[] {
  const customers = new Map<string, CustomerPerformance>();

  for (const deal of deals) {
    const key = deal.clientCode || deal.dealName;
    if (!key) continue;
    if (!customers.has(key)) {
      customers.set(key, {
        customerCode: key,
        openDeals: 0,
        totalDealValue: 0,
        totalDealValueFormatted: '',
        wonDeals: 0,
        workOrders: 0,
        activeWorkOrders: 0,
        contractValue: 0,
        contractValueFormatted: '',
        sectors: [],
      });
    }
    const c = customers.get(key)!;
    if (deal.status === 'Open') c.openDeals++;
    if (deal.status === 'Won') c.wonDeals++;
    if (deal.dealValue) c.totalDealValue += deal.dealValue;
    if (deal.normalizedSector && !c.sectors.includes(deal.normalizedSector)) {
      c.sectors.push(deal.normalizedSector);
    }
  }

  for (const wo of workOrders) {
    const key = wo.customerCode || wo.dealName;
    if (!key) continue;
    if (!customers.has(key)) {
      customers.set(key, {
        customerCode: key,
        openDeals: 0,
        totalDealValue: 0,
        totalDealValueFormatted: '',
        wonDeals: 0,
        workOrders: 0,
        activeWorkOrders: 0,
        contractValue: 0,
        contractValueFormatted: '',
        sectors: [],
      });
    }
    const c = customers.get(key)!;
    c.workOrders++;
    if (wo.normalizedExecutionStatus === 'in_progress') c.activeWorkOrders++;
    if (wo.amountExclGST) c.contractValue += wo.amountExclGST;
  }

  return Array.from(customers.values())
    .map((c) => ({
      ...c,
      totalDealValueFormatted: formatINR(c.totalDealValue),
      contractValueFormatted: formatINR(c.contractValue),
    }))
    .sort((a, b) => b.totalDealValue - a.totalDealValue)
    .slice(0, limit);
}

// ─── Cross-Board Analysis ─────────────────────────────────────────────────────

export interface CrossBoardCustomer {
  name: string;
  sector: string;
  openDeals: number;
  totalDealValue: number;
  totalDealValueFormatted: string;
  activeWorkOrders: number;
  completedWorkOrders: number;
  totalContractValue: number;
  totalContractValueFormatted: string;
  relationship: 'deals_only' | 'wo_only' | 'both';
}

export function getCrossBoardCustomerAnalysis(
  deals: NormalizedDeal[],
  workOrders: NormalizedWorkOrder[],
  sectorFilter?: string
): CrossBoardCustomer[] {
  // Build normalized name maps (lowercase trim for comparison)
  const dealCustomers = new Map<string, { deals: NormalizedDeal[]; key: string }>();
  const woCustomers = new Map<string, { wos: NormalizedWorkOrder[]; key: string }>();

  for (const deal of deals) {
    const rawKey = (deal.clientCode || deal.dealName || '').toLowerCase().trim();
    if (!rawKey) continue;
    if (!dealCustomers.has(rawKey)) dealCustomers.set(rawKey, { deals: [], key: rawKey });
    dealCustomers.get(rawKey)!.deals.push(deal);
  }

  for (const wo of workOrders) {
    const rawKey = (wo.customerCode || wo.dealName || '').toLowerCase().trim();
    if (!rawKey) continue;
    if (!woCustomers.has(rawKey)) woCustomers.set(rawKey, { wos: [], key: rawKey });
    woCustomers.get(rawKey)!.wos.push(wo);
  }

  const allKeys = new Set([...dealCustomers.keys(), ...woCustomers.keys()]);
  const results: CrossBoardCustomer[] = [];

  for (const key of allKeys) {
    const dealEntry = dealCustomers.get(key);
    const woEntry = woCustomers.get(key);

    const dealsForCustomer = dealEntry?.deals ?? [];
    const wosForCustomer = woEntry?.wos ?? [];

    // Sector filter
    const allSectors = [
      ...new Set([
        ...dealsForCustomer.map((d) => d.normalizedSector),
        ...wosForCustomer.map((w) => w.normalizedSector),
      ]),
    ];
    if (
      sectorFilter &&
      !allSectors.some((s) => s.toLowerCase().includes(sectorFilter.toLowerCase()))
    ) {
      continue;
    }

    const openDeals = dealsForCustomer.filter((d) => d.status === 'Open').length;
    const totalDealValue = dealsForCustomer
      .filter((d) => d.dealValue !== null)
      .reduce((s, d) => s + (d.dealValue ?? 0), 0);
    const activeWOs = wosForCustomer.filter(
      (w) => w.normalizedExecutionStatus === 'in_progress'
    ).length;
    const completedWOs = wosForCustomer.filter(
      (w) => w.normalizedExecutionStatus === 'completed'
    ).length;
    const totalContract = wosForCustomer
      .filter((w) => w.amountExclGST !== null)
      .reduce((s, w) => s + (w.amountExclGST ?? 0), 0);

    const relationship: CrossBoardCustomer['relationship'] =
      dealsForCustomer.length > 0 && wosForCustomer.length > 0
        ? 'both'
        : dealsForCustomer.length > 0
        ? 'deals_only'
        : 'wo_only';

    results.push({
      name: key,
      sector: allSectors[0] ?? 'Unknown',
      openDeals,
      totalDealValue,
      totalDealValueFormatted: formatINR(totalDealValue),
      activeWorkOrders: activeWOs,
      completedWorkOrders: completedWOs,
      totalContractValue: totalContract,
      totalContractValueFormatted: formatINR(totalContract),
      relationship,
    });
  }

  return results.sort((a, b) => b.totalDealValue - a.totalDealValue);
}

// ─── Leadership Update ─────────────────────────────────────────────────────────

export interface LeadershipUpdate {
  pipeline: PipelineSummary;
  currentQuarterPipeline: QuarterlyPipeline;
  revenue: RevenueResult;
  operations: WorkOrderMetrics;
  topSectors: SectorPerformance[];
  topCustomers: CustomerPerformance[];
  delayedCount: number;
  qualityWarnings: string[];
  generatedAt: string;
}

export function generateLeadershipUpdate(
  deals: NormalizedDeal[],
  workOrders: NormalizedWorkOrder[],
  quality: DataQualityReport
): LeadershipUpdate {
  return {
    pipeline: getTotalPipeline(deals),
    currentQuarterPipeline: getQuarterlyPipeline(deals, 'current'),
    revenue: getRevenue(deals),
    operations: getOperationalMetrics(workOrders),
    topSectors: getSectorPerformance(deals, workOrders).slice(0, 5),
    topCustomers: getCustomerPerformance(deals, workOrders, 5),
    delayedCount: getDelayedWorkOrders(workOrders).length,
    qualityWarnings: quality.warnings,
    generatedAt: new Date().toISOString(),
  };
}

export function getDataQualityReport(quality: DataQualityReport): DataQualityReport {
  return quality;
}

// Export the formatter for use in AI layer
export { formatINR };
