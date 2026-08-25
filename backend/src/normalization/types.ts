/**
 * Normalized internal data types.
 * These are what the analytics engine operates on — not raw Monday data.
 */

export interface NormalizedDeal {
  id: string;
  dealName: string;
  ownerCode: string;
  clientCode: string;
  status: DealStatus;
  closeDate: Date | null;
  tentativeCloseDate: Date | null;
  probability: ProbabilityLevel | null;   // High | Medium | Low | null (never invented)
  probabilityNumeric: number | null;       // 0.8 | 0.5 | 0.2 | null
  dealValue: number | null;               // INR, null if missing
  stage: string;
  normalizedStage: DealStageCategory;
  product: string;
  sector: string;
  normalizedSector: string;
  createdDate: Date | null;
  // Data quality flags
  _issues: string[];
}

export type DealStatus = 'Open' | 'Won' | 'Lost' | 'Dead' | 'On Hold' | 'Unknown';

export type ProbabilityLevel = 'High' | 'Medium' | 'Low';

export type DealStageCategory =
  | 'lead'
  | 'qualified'
  | 'demo'
  | 'feasibility'
  | 'proposal'
  | 'negotiation'
  | 'won'
  | 'invoiced'
  | 'delivered'
  | 'lost'
  | 'on_hold'
  | 'not_relevant'
  | 'unknown';

export interface NormalizedWorkOrder {
  id: string;
  dealName: string;
  customerCode: string;
  serialNumber: string;
  natureOfWork: string;
  executionStatus: ExecutionStatus;
  normalizedExecutionStatus: ExecutionStatusCategory;
  dataDeliveryDate: Date | null;
  poDate: Date | null;
  probableStartDate: Date | null;
  probableEndDate: Date | null;
  personnelCode: string;
  sector: string;
  normalizedSector: string;
  typeOfWork: string;
  amountExclGST: number | null;
  amountInclGST: number | null;
  billedValueExclGST: number | null;
  billedValueInclGST: number | null;
  collectedAmount: number | null;
  unbilledExclGST: number | null;
  amountReceivable: number | null;
  invoiceStatus: string;
  woBilledStatus: string;
  billingStatus: string;
  isDelayed: boolean;
  // Data quality flags
  _issues: string[];
}

export type ExecutionStatus = string; // raw value preserved

export type ExecutionStatusCategory =
  | 'completed'
  | 'in_progress'
  | 'not_started'
  | 'on_hold'
  | 'cancelled'
  | 'unknown';

export interface DataQualityReport {
  deals: {
    total: number;
    missingDealValue: number;
    missingProbability: number;
    missingCloseDate: number;
    missingBothDates: number;
    missingSector: number;
    invalidDates: number;
    duplicateHeaders: number;
    unknownStatus: number;
  };
  workOrders: {
    total: number;
    missingAmount: number;
    missingStartDate: number;
    missingEndDate: number;
    missingSector: number;
    invalidDates: number;
  };
  warnings: string[];
}
