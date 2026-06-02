// ── Enums ─────────────────────────────────────────────────────────────────────

export type MaterialReturnStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CLOSED';

export type ReturnReason =
  | 'DAMAGED'
  | 'BROKEN'
  | 'CLIENT_RESILIATION_RECOVERY'
  | 'UNUSED'
  | 'WRONG_DISTRIBUTION'
  | 'REPLACEMENT'
  | 'OTHER';

export type ReturnCondition =
  | 'GOOD'
  | 'RECONDITIONABLE'
  | 'DAMAGED'
  | 'BROKEN'
  | 'LOST'
  | 'UNKNOWN';

export type ReturnDestination =
  | 'USABLE_STOCK'
  | 'DAMAGED_STOCK'
  | 'REPAIR_CENTER'
  | 'RECONDITIONING'
  | 'CENTRAL_WAREHOUSE'
  | 'SCRAP';

/** Where the material physically comes from — determines whether STT stock is decremented */
export type ReturnSource =
  | 'STT_STOCK'
  | 'CLIENT_RECOVERY'
  | 'RESILIATION_RECOVERY'
  | 'DAMAGED_FIELD_RECOVERY'
  | 'UNUSED_FIELD_MATERIAL'
  | 'OTHER';

// ── Display label maps ────────────────────────────────────────────────────────

export const RETURN_REASON_LABELS: Record<ReturnReason, string> = {
  DAMAGED: 'Damaged material',
  BROKEN: 'Broken / not working',
  CLIENT_RESILIATION_RECOVERY: 'Recovered after résiliation',
  UNUSED: 'Unused material',
  WRONG_DISTRIBUTION: 'Wrongly distributed',
  REPLACEMENT: 'Replaced material',
  OTHER: 'Other',
};

export const RETURN_CONDITION_LABELS: Record<ReturnCondition, string> = {
  GOOD: 'Good condition',
  RECONDITIONABLE: 'Reconditionable',
  DAMAGED: 'Damaged',
  BROKEN: 'Broken',
  LOST: 'Lost',
  UNKNOWN: 'Unknown / needs inspection',
};

export const RETURN_DESTINATION_LABELS: Record<ReturnDestination, string> = {
  USABLE_STOCK: 'Usable stock',
  DAMAGED_STOCK: 'Damaged stock',
  REPAIR_CENTER: 'Repair center',
  RECONDITIONING: 'Reconditioning',
  CENTRAL_WAREHOUSE: 'Central warehouse',
  SCRAP: 'Scrap / disposal',
};

export const RETURN_SOURCE_LABELS: Record<ReturnSource, string> = {
  STT_STOCK: 'From STT stock',
  CLIENT_RECOVERY: 'Client recovery',
  RESILIATION_RECOVERY: 'Résiliation recovery',
  DAMAGED_FIELD_RECOVERY: 'Damaged field recovery',
  UNUSED_FIELD_MATERIAL: 'Unused field material',
  OTHER: 'Other / unclassified',
};

export const RETURN_STATUS_LABELS: Record<MaterialReturnStatus, string> = {
  PENDING: 'Pending Review',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  CLOSED: 'Closed',
};

// ── Models ────────────────────────────────────────────────────────────────────

export interface ReturnedItem {
  equipmentId: string;
  equipmentName?: string;
  articleCode?: string;
  description?: string;
  unit?: string;
  quantity: number;
  serialNumber?: string;
  macAddress?: string;
  imei?: string;
  condition?: ReturnCondition;
}

export interface MaterialReturn {
  id: string;
  returnCode: string;

  sttId: string;
  sttName?: string;
  sttEmail?: string;

  zmId?: string;
  zmName?: string;
  zmEmail?: string;

  relatedCaseId?: string;
  relatedCaseType?: string;
  crmCase?: string;

  /** Where the material physically comes from */
  returnSource?: ReturnSource;
  /** ISO date "YYYY-MM-DD" — planned handover date declared by the STT */
  plannedReturnDate?: string;

  reason: ReturnReason;
  condition: ReturnCondition;
  destination: ReturnDestination;

  items: ReturnedItem[];
  comment?: string;
  proofImageUrls?: string[];

  status: MaterialReturnStatus;

  createdAt?: string;
  submittedAt?: string;
  reviewedAt?: string;
  closedAt?: string;

  reviewedByZmId?: string;
  reviewedByZmName?: string;
  reviewComment?: string;
}

// ── Request DTOs ──────────────────────────────────────────────────────────────

export interface ReturnedItemRequest {
  equipmentId: string;
  quantity: number;
  serialNumber?: string;
  macAddress?: string;
  imei?: string;
  condition?: ReturnCondition;
}

export interface CreateMaterialReturnRequest {
  relatedCaseId?: string;
  relatedCaseType?: string;
  crmCase?: string;
  returnSource: ReturnSource;
  plannedReturnDate?: string;
  reason: ReturnReason;
  condition: ReturnCondition;
  destination: ReturnDestination;
  items: ReturnedItemRequest[];
  comment?: string;
  proofImageUrls?: string[];
}

export interface ReviewMaterialReturnRequest {
  reviewComment?: string;
}
