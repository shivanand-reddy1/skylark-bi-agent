/**
 * Data normalization layer.
 * Converts raw Monday.com board items into clean, typed internal records.
 * - Normalizes dates (Excel serial, ISO, text formats)
 * - Normalizes sectors (case-insensitive, alias mapping)
 * - Normalizes probability (text → numeric)
 * - Normalizes status values
 * - Tracks all data quality issues without discarding records
 */

import { MondayItem } from '../monday/client';
import {
  BoardMetadata,
} from '../monday/client';
import {
  buildColumnMap,
  getColumnText,
  reportUnmappedFields,
  DEAL_FIELD_ALIASES,
  WORK_ORDER_FIELD_ALIASES,
} from '../monday/columnMapper';
import {
  NormalizedDeal,
  NormalizedWorkOrder,
  DealStatus,
  DealStageCategory,
  ExecutionStatusCategory,
  DataQualityReport,
  ProbabilityLevel,
} from './types';

// ─── Date Normalization ────────────────────────────────────────────────────────

/**
 * Excel stores dates as days since 1899-12-30 (with a known leap year bug).
 * Monday stores them as ISO strings or as Excel serials depending on column type.
 */
function parseDate(raw: string): Date | null {
  if (!raw || raw.trim() === '') return null;

  const trimmed = raw.trim();

  // ISO format: 2026-01-15
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    const d = new Date(trimmed);
    return isNaN(d.getTime()) ? null : d;
  }

  // DD/MM/YYYY or D/M/YYYY
  const dmy = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmy) {
    const d = new Date(`${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`);
    return isNaN(d.getTime()) ? null : d;
  }

  // MM/DD/YYYY
  const mdy = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mdy) {
    const d = new Date(`${mdy[3]}-${mdy[1].padStart(2, '0')}-${mdy[2].padStart(2, '0')}`);
    return isNaN(d.getTime()) ? null : d;
  }

  // Excel serial number (e.g. "46079")
  if (/^\d{5}$/.test(trimmed)) {
    const serial = parseInt(trimmed, 10);
    if (serial > 25569 && serial < 60000) {
      // Convert: Excel epoch is 1899-12-30
      const ms = (serial - 25569) * 86400 * 1000;
      const d = new Date(ms);
      return isNaN(d.getTime()) ? null : d;
    }
  }

  // Monday.com date column JSON value: {"date":"2026-01-15"}
  if (trimmed.includes('"date"')) {
    try {
      const parsed = JSON.parse(trimmed) as { date?: string };
      if (parsed.date) return parseDate(parsed.date);
    } catch {
      // not JSON
    }
  }

  // Text formats: "Jan 15, 2026", "15 Jan 2026"
  const d = new Date(trimmed);
  if (!isNaN(d.getTime()) && d.getFullYear() > 2000) return d;

  return null;
}

// ─── Sector Normalization ──────────────────────────────────────────────────────

const SECTOR_ALIASES: Record<string, string> = {
  // Mining variants
  'mining': 'Mining',
  'mines': 'Mining',
  'coal': 'Mining',
  // Powerline variants
  'powerline': 'Powerline',
  'power line': 'Powerline',
  'power lines': 'Powerline',
  'power': 'Powerline',
  // Renewables variants
  'renewables': 'Renewables',
  'renewable': 'Renewables',
  'solar': 'Renewables',
  'wind': 'Renewables',
  'renewable energy': 'Renewables',
  // DSP variants
  'dsp': 'DSP',
  'digital survey': 'DSP',
  // Railways variants
  'railways': 'Railways',
  'railway': 'Railways',
  'rail': 'Railways',
  // Aviation variants
  'aviation': 'Aviation',
  'airport': 'Aviation',
  // Construction variants
  'construction': 'Construction',
  'infrastructure': 'Construction',
  // Manufacturing variants
  'manufacturing': 'Manufacturing',
  'industrial': 'Manufacturing',
  // Security variants
  'security and surveillance': 'Security & Surveillance',
  'security': 'Security & Surveillance',
  'surveillance': 'Security & Surveillance',
  // Others
  'others': 'Others',
  'other': 'Others',
  'tender': 'Tender',
  'government': 'Government',
};

function normalizeSector(raw: string): string {
  if (!raw || raw.trim() === '') return 'Unknown';
  const lower = raw.trim().toLowerCase();
  return SECTOR_ALIASES[lower] ?? raw.trim();
}

// ─── Status Normalization ──────────────────────────────────────────────────────

function normalizeDealStatus(raw: string): DealStatus {
  const lower = raw.toLowerCase().trim();
  if (lower === 'open') return 'Open';
  if (lower === 'won' || lower === 'project won') return 'Won';
  if (lower === 'lost' || lower === 'dead' || lower === 'project lost') return 'Lost';
  if (lower === 'dead') return 'Dead';
  if (lower === 'on hold' || lower === 'projects on hold') return 'On Hold';
  return 'Unknown';
}

function normalizeDealStage(raw: string): DealStageCategory {
  const lower = raw.toLowerCase();
  if (lower.includes('lead generated') || lower.startsWith('a.')) return 'lead';
  if (lower.includes('sales qualified') || lower.startsWith('b.')) return 'qualified';
  if (lower.includes('demo') || lower.startsWith('c.')) return 'demo';
  if (lower.includes('feasibility') || lower.startsWith('d.')) return 'feasibility';
  if (lower.includes('proposal') || lower.includes('commercial') || lower.startsWith('e.')) return 'proposal';
  if (lower.includes('negotiation') || lower.startsWith('f.')) return 'negotiation';
  if (lower.includes('project won') || lower.startsWith('g.')) return 'won';
  if (lower.includes('work order') || lower.startsWith('h.')) return 'won';
  if (lower.includes('poc') || lower.includes('proof of concept') || lower.startsWith('i.')) return 'demo';
  if (lower.includes('invoice') || lower.startsWith('j.')) return 'invoiced';
  if (lower.includes('accrued') || lower.startsWith('k.')) return 'delivered';
  if (lower.includes('lost') || lower.startsWith('l.')) return 'lost';
  if (lower.includes('on hold') || lower.startsWith('m.')) return 'on_hold';
  if (lower.includes('not relevant') || lower.startsWith('n.') || lower.startsWith('o.')) return 'not_relevant';
  if (lower.includes('completed') || lower.includes('project completed')) return 'delivered';
  return 'unknown';
}

// Probability mapping — text to numeric
// We DON'T invent probabilities. If missing, both fields stay null.
const PROBABILITY_MAP: Record<ProbabilityLevel, number> = {
  High: 0.8,
  Medium: 0.5,
  Low: 0.2,
};

function parseProbability(raw: string): { level: ProbabilityLevel | null; numeric: number | null } {
  if (!raw || raw.trim() === '') return { level: null, numeric: null };
  const lower = raw.trim().toLowerCase();
  if (lower === 'high') return { level: 'High', numeric: PROBABILITY_MAP.High };
  if (lower === 'medium' || lower === 'med') return { level: 'Medium', numeric: PROBABILITY_MAP.Medium };
  if (lower === 'low') return { level: 'Low', numeric: PROBABILITY_MAP.Low };
  // Numeric percentage (e.g., "80%" or "0.8")
  const pct = parseFloat(raw.replace('%', ''));
  if (!isNaN(pct)) {
    const normalized = pct > 1 ? pct / 100 : pct;
    if (normalized >= 0.7) return { level: 'High', numeric: normalized };
    if (normalized >= 0.4) return { level: 'Medium', numeric: normalized };
    return { level: 'Low', numeric: normalized };
  }
  return { level: null, numeric: null };
}

function parseNumber(raw: string): number | null {
  if (!raw || raw.trim() === '') return null;
  const cleaned = raw.replace(/[₹,\s]/g, '');
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

function normalizeExecutionStatus(raw: string): ExecutionStatusCategory {
  const lower = raw.toLowerCase().trim();
  if (lower === 'completed' || lower === 'done' || lower === 'complete') return 'completed';
  if (lower === 'in progress' || lower === 'ongoing' || lower === 'active') return 'in_progress';
  if (lower === 'not started' || lower === 'pending') return 'not_started';
  if (lower === 'on hold' || lower === 'paused') return 'on_hold';
  if (lower === 'cancelled' || lower === 'canceled') return 'cancelled';
  return 'unknown';
}

// ─── Public API ────────────────────────────────────────────────────────────────

export function normalizeDeals(
  items: MondayItem[],
  boardMetadata: BoardMetadata
): { deals: NormalizedDeal[]; quality: DataQualityReport['deals'] } {
  const colMap = buildColumnMap(boardMetadata.columns, DEAL_FIELD_ALIASES);
  reportUnmappedFields(colMap, 'Deals');

  const deals: NormalizedDeal[] = [];
  const quality: DataQualityReport['deals'] = {
    total: 0,
    missingDealValue: 0,
    missingProbability: 0,
    missingCloseDate: 0,
    missingBothDates: 0,
    missingSector: 0,
    invalidDates: 0,
    duplicateHeaders: 0,
    unknownStatus: 0,
  };

  for (const item of items) {
    const issues: string[] = [];

    // Get raw values using dynamic column mapping
    const rawStatus = getColumnText(item, colMap.dealStatus) || item.name;
    const rawStage = getColumnText(item, colMap.dealStage);
    const rawSector = getColumnText(item, colMap.sector);
    const rawValue = getColumnText(item, colMap.dealValue);
    const rawProb = getColumnText(item, colMap.closureProbability);
    const rawCloseDate = getColumnText(item, colMap.closeDate);
    const rawTentativeClose = getColumnText(item, colMap.tentativeCloseDate);
    const rawCreated = getColumnText(item, colMap.createdDate);

    // Skip duplicate header rows (a common Excel import artifact)
    if (
      rawStatus.toLowerCase() === 'deal status' ||
      item.name.toLowerCase() === 'deal name'
    ) {
      quality.duplicateHeaders++;
      continue;
    }

    quality.total++;

    const status = normalizeDealStatus(rawStatus);
    if (status === 'Unknown' && rawStatus) {
      quality.unknownStatus++;
      issues.push(`Unknown status: "${rawStatus}"`);
    }

    const prob = parseProbability(rawProb);
    if (prob.level === null) {
      quality.missingProbability++;
      issues.push('Missing closure probability — excluded from weighted pipeline');
    }

    const dealValue = parseNumber(rawValue);
    if (dealValue === null) {
      quality.missingDealValue++;
      issues.push('Missing deal value');
    }

    const closeDate = parseDate(rawCloseDate);
    const tentativeCloseDate = parseDate(rawTentativeClose);

    if (rawCloseDate && !closeDate) {
      quality.invalidDates++;
      issues.push(`Invalid close date: "${rawCloseDate}"`);
    }

    if (!closeDate && !tentativeCloseDate) {
      quality.missingBothDates++;
      quality.missingCloseDate++;
      issues.push('No close date available');
    } else if (!closeDate) {
      quality.missingCloseDate++;
    }

    const normalizedSector = normalizeSector(rawSector);
    if (!rawSector || rawSector.trim() === '') {
      quality.missingSector++;
      issues.push('Missing sector');
    }

    deals.push({
      id: item.id,
      dealName: item.name,
      ownerCode: getColumnText(item, colMap.ownerCode),
      clientCode: getColumnText(item, colMap.clientCode),
      status,
      closeDate,
      tentativeCloseDate,
      probability: prob.level,
      probabilityNumeric: prob.numeric,
      dealValue,
      stage: rawStage,
      normalizedStage: normalizeDealStage(rawStage),
      product: getColumnText(item, colMap.productDeal),
      sector: rawSector,
      normalizedSector,
      createdDate: parseDate(rawCreated),
      _issues: issues,
    });
  }

  return { deals, quality };
}

export function normalizeWorkOrders(
  items: MondayItem[],
  boardMetadata: BoardMetadata
): { workOrders: NormalizedWorkOrder[]; quality: DataQualityReport['workOrders'] } {
  const colMap = buildColumnMap(boardMetadata.columns, WORK_ORDER_FIELD_ALIASES);
  reportUnmappedFields(colMap, 'WorkOrders');

  const workOrders: NormalizedWorkOrder[] = [];
  const quality: DataQualityReport['workOrders'] = {
    total: 0,
    missingAmount: 0,
    missingStartDate: 0,
    missingEndDate: 0,
    missingSector: 0,
    invalidDates: 0,
  };

  const today = new Date();

  for (const item of items) {
    const issues: string[] = [];

    // Skip header-duplicate rows
    if (
      item.name.toLowerCase() === 'deal name masked' ||
      item.name.toLowerCase() === 'deal name'
    ) {
      continue;
    }

    quality.total++;

    const rawStartDate = getColumnText(item, colMap.probableStartDate);
    const rawEndDate = getColumnText(item, colMap.probableEndDate);
    const rawAmount = getColumnText(item, colMap.amountExclGST);
    const rawSector = getColumnText(item, colMap.sector);

    const startDate = parseDate(rawStartDate);
    const endDate = parseDate(rawEndDate);
    const executionStatus = getColumnText(item, colMap.executionStatus);
    const normalizedStatus = normalizeExecutionStatus(executionStatus);

    if (!rawAmount || rawAmount.trim() === '') {
      quality.missingAmount++;
      issues.push('Missing contract amount');
    }

    if (!startDate) {
      quality.missingStartDate++;
      if (rawStartDate) {
        quality.invalidDates++;
        issues.push(`Invalid start date: "${rawStartDate}"`);
      } else {
        issues.push('Missing start date');
      }
    }

    if (!endDate) {
      quality.missingEndDate++;
      if (rawEndDate) {
        quality.invalidDates++;
      }
    }

    const normalizedSector = normalizeSector(rawSector);
    if (!rawSector || rawSector.trim() === '') {
      quality.missingSector++;
      issues.push('Missing sector');
    }

    // Determine if delayed: end date is past and not completed
    const isDelayed =
      endDate !== null &&
      endDate < today &&
      normalizedStatus !== 'completed' &&
      normalizedStatus !== 'cancelled';

    workOrders.push({
      id: item.id,
      dealName: item.name,
      customerCode: getColumnText(item, colMap.customerCode),
      serialNumber: getColumnText(item, colMap.serialNumber),
      natureOfWork: getColumnText(item, colMap.natureOfWork),
      executionStatus,
      normalizedExecutionStatus: normalizedStatus,
      dataDeliveryDate: parseDate(getColumnText(item, colMap.dataDeliveryDate)),
      poDate: parseDate(getColumnText(item, colMap.poDate)),
      probableStartDate: startDate,
      probableEndDate: endDate,
      personnelCode: getColumnText(item, colMap.personnelCode),
      sector: rawSector,
      normalizedSector,
      typeOfWork: getColumnText(item, colMap.typeOfWork),
      amountExclGST: parseNumber(rawAmount),
      amountInclGST: parseNumber(getColumnText(item, colMap.amountInclGST)),
      billedValueExclGST: parseNumber(getColumnText(item, colMap.billedValueExclGST)),
      billedValueInclGST: parseNumber(getColumnText(item, colMap.billedValueInclGST)),
      collectedAmount: parseNumber(getColumnText(item, colMap.collectedAmount)),
      unbilledExclGST: parseNumber(getColumnText(item, colMap.unbilledExclGST)),
      amountReceivable: parseNumber(getColumnText(item, colMap.amountReceivable)),
      invoiceStatus: getColumnText(item, colMap.invoiceStatus),
      woBilledStatus: getColumnText(item, colMap.woBilledStatus),
      billingStatus: getColumnText(item, colMap.billingStatusNote),
      isDelayed,
      _issues: issues,
    });
  }

  return { workOrders, quality };
}

export function buildDataQualityReport(
  dealsQuality: DataQualityReport['deals'],
  woQuality: DataQualityReport['workOrders']
): DataQualityReport {
  const warnings: string[] = [];

  if (dealsQuality.missingProbability > 0) {
    warnings.push(
      `${dealsQuality.missingProbability} deal(s) have no closure probability — excluded from weighted pipeline calculations.`
    );
  }
  if (dealsQuality.missingDealValue > 0) {
    warnings.push(
      `${dealsQuality.missingDealValue} deal(s) have no deal value — excluded from revenue calculations.`
    );
  }
  if (dealsQuality.missingBothDates > 0) {
    warnings.push(
      `${dealsQuality.missingBothDates} deal(s) have no close date — excluded from time-based pipeline filters.`
    );
  }
  if (dealsQuality.duplicateHeaders > 0) {
    warnings.push(
      `${dealsQuality.duplicateHeaders} duplicate header row(s) were detected and skipped.`
    );
  }
  if (woQuality.missingAmount > 0) {
    warnings.push(
      `${woQuality.missingAmount} work order(s) have no contract amount.`
    );
  }

  return { deals: dealsQuality, workOrders: woQuality, warnings };
}
