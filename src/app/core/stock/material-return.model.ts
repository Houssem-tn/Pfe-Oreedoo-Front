export type MaterialReturnStatus =
  | 'SUBMITTED'
  | 'PENDING'
  | 'PENDING_ZM_REVIEW'
  | 'SCHEDULE_PROPOSED'
  | 'PENDING_STT_CONFIRMATION'
  | 'WAITING_STT_CONFIRMATION'
  | 'SCHEDULE_PROPOSED_BY_ZM'
  | 'RESCHEDULE_REQUESTED'
  | 'SCHEDULE_REJECTED_BY_STT'
  | 'APPROVED'
  | 'SCHEDULE_CONFIRMED'
  | 'REJECTED'
  | 'HANDED_OVER'
  | 'RECEIVED'
  | 'COMPLETED'
  | 'CLOSED';

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

export type ReturnSource =
  | 'STT_STOCK'
  | 'COLLECTED_ITEM_STOCK'
  | 'CLIENT_RECOVERY'
  | 'RESILIATION_RECOVERY'
  | 'DAMAGED_FIELD_RECOVERY'
  | 'UNUSED_FIELD_MATERIAL'
  | 'OTHER';

/**
 * Values are translation KEYS (statuses.materialReturn.*), not display text —
 * pass them through TranslocoService.translate() / the `transloco` pipe.
 */
export const RETURN_STATUS_LABELS: Record<MaterialReturnStatus, string> = {
  SUBMITTED: 'statuses.materialReturn.submitted',
  PENDING: 'statuses.materialReturn.awaitingZmReview',
  PENDING_ZM_REVIEW: 'statuses.materialReturn.awaitingZmReview',
  SCHEDULE_PROPOSED: 'statuses.materialReturn.scheduleProposed',
  PENDING_STT_CONFIRMATION: 'statuses.materialReturn.awaitingSttConfirmation',
  WAITING_STT_CONFIRMATION: 'statuses.materialReturn.awaitingSttConfirmation',
  SCHEDULE_PROPOSED_BY_ZM: 'statuses.materialReturn.scheduleProposed',
  RESCHEDULE_REQUESTED: 'statuses.materialReturn.rescheduleRequested',
  SCHEDULE_REJECTED_BY_STT: 'statuses.materialReturn.rescheduleRequested',
  APPROVED: 'statuses.materialReturn.approved',
  SCHEDULE_CONFIRMED: 'statuses.materialReturn.scheduleConfirmed',
  REJECTED: 'statuses.materialReturn.rejected',
  HANDED_OVER: 'statuses.materialReturn.handedOver',
  RECEIVED: 'statuses.materialReturn.received',
  COMPLETED: 'statuses.materialReturn.completed',
  CLOSED: 'statuses.materialReturn.closed',
};

/** Values are translation keys (statuses.returnReason.*). */
export const RETURN_REASON_LABELS: Record<ReturnReason, string> = {
  DAMAGED: 'statuses.returnReason.damaged',
  BROKEN: 'statuses.returnReason.broken',
  CLIENT_RESILIATION_RECOVERY: 'statuses.returnReason.clientResiliationRecovery',
  UNUSED: 'statuses.returnReason.unused',
  WRONG_DISTRIBUTION: 'statuses.returnReason.wrongDistribution',
  REPLACEMENT: 'statuses.returnReason.replacement',
  OTHER: 'statuses.returnReason.other',
};

/** Values are translation keys (statuses.returnCondition.*). */
export const RETURN_CONDITION_LABELS: Record<ReturnCondition, string> = {
  GOOD: 'statuses.returnCondition.good',
  RECONDITIONABLE: 'statuses.returnCondition.reconditionable',
  DAMAGED: 'statuses.returnCondition.damaged',
  BROKEN: 'statuses.returnCondition.broken',
  LOST: 'statuses.returnCondition.lost',
  UNKNOWN: 'statuses.returnCondition.unknown',
};

/** Values are translation keys (statuses.returnDestination.*). */
export const RETURN_DESTINATION_LABELS: Record<ReturnDestination, string> = {
  USABLE_STOCK: 'statuses.returnDestination.usableStock',
  DAMAGED_STOCK: 'statuses.returnDestination.damagedStock',
  REPAIR_CENTER: 'statuses.returnDestination.repairCenter',
  RECONDITIONING: 'statuses.returnDestination.reconditioning',
  CENTRAL_WAREHOUSE: 'statuses.returnDestination.centralWarehouse',
  SCRAP: 'statuses.returnDestination.scrap',
};

/** Values are translation keys (statuses.returnSource.*). */
export const RETURN_SOURCE_LABELS: Record<ReturnSource, string> = {
  STT_STOCK: 'statuses.returnSource.sttStock',
  COLLECTED_ITEM_STOCK: 'statuses.returnSource.collectedItemStock',
  CLIENT_RECOVERY: 'statuses.returnSource.clientRecovery',
  RESILIATION_RECOVERY: 'statuses.returnSource.resiliationRecovery',
  DAMAGED_FIELD_RECOVERY: 'statuses.returnSource.damagedFieldRecovery',
  UNUSED_FIELD_MATERIAL: 'statuses.returnSource.unusedFieldMaterial',
  OTHER: 'statuses.returnSource.other',
};

export interface ReturnTimelineEvent {
  eventType: string;
  description: string;
  actor: string;
  actorName?: string;
  timestamp: string;
  note?: string;
}

export interface ReturnedItem {
  equipmentId: string;
  equipmentName?: string;
  articleCode?: string;
  unit?: string;
  quantity: number;
  serialNumber?: string;
  macAddress?: string;
  imei?: string;
  instanceId?: string;
  condition?: ReturnCondition;
  retrievedStockItemId?: string;
  originalTechnicianId?: string;
  originalTechnicianName?: string;
  originalTechnicianEmail?: string;
  originalCaseId?: string;
  originalCaseReference?: string;
  originalCaseType?: string;
  originalCustomerName?: string;
  originalCustomerPhone?: string;
  originalRecoveryDate?: string;
  sttCollectedAt?: string;
  proofFileId?: string;
  proofViewUrl?: string;
  proofDownloadUrl?: string;
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
  sourceDpmId?: string | null;
  relatedCaseId?: string;
  relatedCaseType?: string;
  crmCase?: string;
  returnSource?: ReturnSource;
  reason: ReturnReason;
  condition: ReturnCondition;
  destination: ReturnDestination;
  items: ReturnedItem[];
  comment?: string;
  proofImageUrls?: string[];
  status: MaterialReturnStatus;
  proposedHandoverDate?: string;
  proposedHandoverTime?: string;
  proposedHandoverNote?: string;
  scheduleProposedAt?: string;
  sttScheduleResponseComment?: string;
  scheduleConfirmedAt?: string;
  scheduleRejectedAt?: string;
  reviewComment?: string;
  reviewedByZmId?: string;
  reviewedByZmName?: string;
  reviewedAt?: string;
  handedOverAt?: string;
  handedOverNote?: string;
  createdAt?: string;
  submittedAt?: string;
  timeline?: ReturnTimelineEvent[];
}

export interface ReturnedItemRequest {
  equipmentId: string;
  quantity: number;
  serialNumber?: string;
  macAddress?: string;
  imei?: string;
  instanceId?: string;
  retrievedStockItemId?: string;
  condition?: ReturnCondition;
}

export interface CreateMaterialReturnRequest {
  responsibleZmId: string;
  relatedCaseId?: string;
  relatedCaseType?: string;
  crmCase?: string;
  returnSource: ReturnSource;
  reason: ReturnReason;
  condition: ReturnCondition;
  destination: ReturnDestination;
  items?: ReturnedItemRequest[];
  retrievedStockItemIds?: string[];
  comment?: string;
  proofImageUrls?: string[];
}

export interface ProposeHandoverRequest {
  handoverDate: string;
  handoverTime: string;
  handoverNote?: string;
}

export interface ScheduleResponseRequest {
  accepted: boolean;
  comment?: string;
}

export interface ReviewMaterialReturnRequest {
  reviewComment?: string;
}

export interface MarkHandedOverRequest {
  note?: string;
}

export interface EligibleZmOption {
  id: string;
  name: string;
  email: string;
}
