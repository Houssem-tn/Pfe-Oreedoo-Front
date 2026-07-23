import { ReturnCondition } from './material-return.model';

/**
 * What actually happened when a technician tried to retrieve one expected piece of equipment
 * from a customer. Only RETRIEVED/DAMAGED represent equipment physically held by the technician
 * (and therefore appear in Retrieved Stock); the other three are declared for audit/visibility but
 * never enter Retrieved Stock.
 */
export type RecoveryDisposition = 'RETRIEVED' | 'DAMAGED' | 'MISSING' | 'NOT_FOUND' | 'ALREADY_RETURNED';

/**
 * Lifecycle: Customer → Technician (pending STT collection) → STT Collected Stock → Material Return.
 * The two legacy values (`PENDING_COLLECTION` / `COLLECTED`) are kept for historical documents.
 */
export type RetrievedStockItemStatus =
  | 'PENDING_STT_COLLECTION'
  | 'COLLECTED_BY_STT'
  | 'IN_RETURN_REQUEST'
  | 'RETURNED'
  | 'PENDING_COLLECTION' // legacy
  | 'COLLECTED';         // legacy

/** Values are translation keys (statuses.recoveryDisposition.*). */
export const RECOVERY_DISPOSITION_LABELS: Record<RecoveryDisposition, string> = {
  RETRIEVED: 'statuses.recoveryDisposition.retrieved',
  DAMAGED: 'statuses.recoveryDisposition.damaged',
  MISSING: 'statuses.recoveryDisposition.missing',
  NOT_FOUND: 'statuses.recoveryDisposition.notFound',
  ALREADY_RETURNED: 'statuses.recoveryDisposition.alreadyReturned',
};

/** Values are translation keys (statuses.retrievedStockStatus.*). */
export const RETRIEVED_STOCK_STATUS_LABELS: Record<RetrievedStockItemStatus, string> = {
  PENDING_STT_COLLECTION: 'statuses.retrievedStockStatus.pendingSttCollection',
  COLLECTED_BY_STT: 'statuses.retrievedStockStatus.collectedByStt',
  IN_RETURN_REQUEST: 'statuses.retrievedStockStatus.inReturnRequest',
  RETURNED: 'statuses.retrievedStockStatus.returned',
  // Legacy fallbacks (historical documents)
  PENDING_COLLECTION: 'statuses.retrievedStockStatus.pendingCollection',
  COLLECTED: 'statuses.retrievedStockStatus.collected',
};

/**
 * One piece of equipment retrieved from a customer during a Complaint (PLT) or Résiliation (RES)
 * intervention, held against the technician who retrieved it until a ZM physically collects it.
 *
 * Deliberately separate from `MaterialReturn`: that model is an STT-identity, schedule-negotiation
 * workflow with no technician dimension; this one is technician-centric with a direct ZM
 * multi-select "confirm collection" action instead of a propose/accept/reject date negotiation.
 */
export interface RetrievedStockItem {
  id: string;

  caseId?: string;
  crmCase?: string;
  /** 'PLT' or 'RES' — the business context the item was retrieved under. */
  caseUsageContext?: string;
  clientName?: string;
  clientPhone?: string;

  technicianId?: string;
  technicianName?: string;
  sttId?: string;
  sttName?: string;
  zmId?: string;
  zmName?: string;

  equipmentId: string;
  equipmentName?: string;
  articleCode?: string;
  unit?: string;
  /** Always 1 for tracked (serialized) equipment — one serial/IMEI slot per line. */
  quantity: number;
  serialNumber?: string;
  macAddress?: string;
  imei?: string;
  /** Linked tracked-unit id when this is a serialized EquipmentInstance. */
  instanceId?: string;

  disposition?: RecoveryDisposition;
  condition?: ReturnCondition;
  dispositionNote?: string;

  proofFileId?: string;
  proofViewUrl?: string;
  proofDownloadUrl?: string;

  status?: RetrievedStockItemStatus;
  retrievedAt?: string;
  declaredBy?: string;

  sttEmail?: string;

  /** Correct collector (STT). Legacy ZM fields kept for historical documents. */
  collectedBySttId?: string;
  collectedBySttName?: string;
  collectedByZmId?: string;
  collectedByZmName?: string;
  collectedAt?: string;
  collectionNote?: string;

  /** Material Return integration. */
  materialReturnRequestId?: string;
  addedToReturnAt?: string;
  returnedAt?: string;

  createdAt?: string;
  updatedAt?: string;
}

/** One technician's pending-collection queue, for the ZM collection page (grouped by technician). */
export interface TechnicianRetrievedStockGroup {
  technicianId: string;
  technicianName?: string;
  technicianEmail?: string;
  items: RetrievedStockItem[];
}

export interface ConfirmCollectionRequest {
  itemIds: string[];
  note?: string;
}

export interface ConfirmCollectionResponse {
  collectedItems: RetrievedStockItem[];
  collectionBatchId?: string;
}
