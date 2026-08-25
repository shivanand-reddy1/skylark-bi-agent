/**
 * Dynamic column mapper.
 * Maps Monday.com column IDs (auto-generated, e.g. "status_1", "date_2") 
 * to semantic field names based on column titles.
 * This means the code never needs to hardcode Monday column IDs.
 */

import { BoardMetadata, MondayItem } from './client';

// Canonical semantic field names for the Deals board
export const DEAL_FIELD_ALIASES: Record<string, string[]> = {
  dealName:          ['deal name', 'name', 'deal'],
  ownerCode:         ['owner code', 'owner', 'sales owner', 'bd owner'],
  clientCode:        ['client code', 'client', 'customer', 'company', 'account'],
  dealStatus:        ['deal status', 'status'],
  closeDate:         ['close date', 'actual close date', 'close date (a)', 'closed date'],
  closureProbability:['closure probability', 'probability', 'close probability', 'win probability'],
  dealValue:         ['deal value', 'value', 'masked deal value', 'amount', 'deal amount'],
  tentativeCloseDate:['tentative close date', 'expected close date', 'target close', 'tentative close'],
  dealStage:         ['deal stage', 'stage', 'pipeline stage'],
  productDeal:       ['product deal', 'product', 'product type', 'deal type'],
  sector:            ['sector', 'sector/service', 'industry', 'vertical'],
  createdDate:       ['created date', 'created at', 'create date', 'creation date'],
};

// Canonical semantic field names for the Work Orders board
export const WORK_ORDER_FIELD_ALIASES: Record<string, string[]> = {
  dealName:          ['deal name', 'deal name masked', 'name', 'project name'],
  customerCode:      ['customer name code', 'customer code', 'client code', 'company'],
  serialNumber:      ['serial #', 'serial number', 'wo number', 'work order number', 'id'],
  natureOfWork:      ['nature of work', 'type', 'work type', 'project type'],
  lastExecutedMonth: ['last executed month', 'last execution month', 'last month'],
  executionStatus:   ['execution status', 'status', 'project status', 'wo status'],
  dataDeliveryDate:  ['data delivery date', 'delivery date'],
  poDate:            ['date of po/loi', 'po date', 'loi date', 'purchase order date'],
  documentType:      ['document type', 'doc type', 'po type'],
  probableStartDate: ['probable start date', 'start date', 'planned start'],
  probableEndDate:   ['probable end date', 'end date', 'planned end', 'expected completion'],
  personnelCode:     ['bd/kam personnel code', 'owner', 'personnel', 'kam'],
  sector:            ['sector', 'sector/service', 'industry', 'vertical'],
  typeOfWork:        ['type of work', 'work category', 'service type'],
  softwarePlatform:  ['is any skylark software platform', 'software platform', 'platform'],
  lastInvoiceDate:   ['last invoice date', 'invoice date'],
  invoiceNumber:     ['latest invoice no', 'invoice number', 'invoice no'],
  amountExclGST:     ['amount in rupees (excl of gst)', 'amount excl gst', 'amount (excl gst)', 'contract value'],
  amountInclGST:     ['amount in rupees (incl of gst)', 'amount incl gst', 'amount (incl gst)'],
  billedValueExclGST:['billed value in rupees (excl of gst.)', 'billed excl gst', 'billed value excl gst'],
  billedValueInclGST:['billed value in rupees (incl of gst.)', 'billed incl gst', 'billed value incl gst'],
  collectedAmount:   ['collected amount in rupees (incl of gst.)', 'collected amount', 'collections'],
  unbilledExclGST:   ['amount to be billed in rs. (exl. of gst)', 'unbilled excl gst', 'to be billed excl'],
  unbilledInclGST:   ['amount to be billed in rs. (incl. of gst)', 'unbilled incl gst', 'to be billed incl'],
  amountReceivable:  ['amount receivable', 'receivable', 'outstanding'],
  arPriority:        ['ar priority account', 'ar priority'],
  quantityByOps:     ['quantity by ops', 'ops qty'],
  quantityPerPO:     ['quantities as per po', 'po quantity', 'contracted qty'],
  quantityBilled:    ['quantity billed (till date)', 'billed qty'],
  balanceQuantity:   ['balance in quantity', 'balance qty'],
  invoiceStatus:     ['invoice status', 'billing status'],
  expectedBillingMonth: ['expected billing month', 'billing month'],
  actualBillingMonth:['actual billing month'],
  actualCollectionMonth: ['actual collection month'],
  woBilledStatus:    ['wo status (billed)', 'wo status'],
  collectionStatus:  ['collection status'],
  collectionDate:    ['collection date'],
  billingStatusNote: ['billing status'],
};

/** Find the Monday column ID for a semantic field */
function findColumnId(
  columns: BoardMetadata['columns'],
  aliases: string[]
): string | null {
  for (const col of columns) {
    const title = col.title.toLowerCase().trim();
    for (const alias of aliases) {
      if (title === alias || title.includes(alias) || alias.includes(title)) {
        return col.id;
      }
    }
  }
  return null;
}

/** Build a mapping of semantic field → column ID for a board */
export function buildColumnMap(
  columns: BoardMetadata['columns'],
  fieldAliases: Record<string, string[]>
): Record<string, string | null> {
  const map: Record<string, string | null> = {};
  for (const [fieldName, aliases] of Object.entries(fieldAliases)) {
    map[fieldName] = findColumnId(columns, aliases);
  }
  return map;
}

/** Extract a column value from an item by column ID */
export function getColumnText(item: MondayItem, columnId: string | null): string {
  if (!columnId) return '';
  const cv = item.column_values.find((c) => c.id === columnId);
  return cv?.text?.trim() ?? '';
}

/** Extract raw JSON value from an item by column ID */
export function getColumnRawValue(item: MondayItem, columnId: string | null): string | null {
  if (!columnId) return null;
  const cv = item.column_values.find((c) => c.id === columnId);
  return cv?.value ?? null;
}

/** Log which semantic fields couldn't be mapped (data quality awareness) */
export function reportUnmappedFields(
  map: Record<string, string | null>,
  boardName: string
): void {
  const unmapped = Object.entries(map)
    .filter(([, id]) => id === null)
    .map(([field]) => field);

  if (unmapped.length > 0) {
    console.warn(
      `[ColumnMapper] ${boardName}: Could not map fields: ${unmapped.join(', ')}. ` +
      `These may be missing from the board or use different column names.`
    );
  }
}
