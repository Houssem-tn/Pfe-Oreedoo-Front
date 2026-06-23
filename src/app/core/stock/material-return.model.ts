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
  | 'CLIENT_RECOVERY'
  | 'RESILIATION_RECOVERY'
  | 'DAMAGED_FIELD_RECOVERY'
  | 'UNUSED_FIELD_MATERIAL'
  | 'OTHER';

export const RETURN_STATUS_LABELS: Record<MaterialReturnStatus, string> = {
  SUBMITTED: 'Submitted',
  PENDING: 'Awaiting ZM Review',
  PENDING_ZM_REVIEW: 'Awaiting ZM Review',
  SCHEDULE_PROPOSED: 'Schedule Proposed',
  PENDING_STT_CONFIRMATION: 'Awaiting STT Confirmation',
  WAITING_STT_CONFIRMATION: 'Awaiting STT Confirmation',
  SCHEDULE_PROPOSED_BY_ZM: 'Schedule Proposed',
  RESCHEDULE_REQUESTED: 'Reschedule Requested',
  SCHEDULE_REJECTED_BY_STT: 'Reschedule Requested',
  APPROVED: 'Approved',
  SCHEDULE_CONFIRMED: 'Schedule Confirmed',
  REJECTED: 'Rejected',
  HANDED_OVER: 'Handed Over',
  RECEIVED: 'Received',
  COMPLETED: 'Completed',
  CLOSED: 'Closed',
};

export const RETURN_REASON_LABELS: Record<ReturnReason, string> = {
  DAMAGED: 'Damaged material',
  BROKEN: 'Broken / not working',
  CLIENT_RESILIATION_RECOVERY: 'Recovered after resiliation',
  UNUSED: 'Unused material',
  WRONG_DISTRIBUTION: 'Wrongly distributed',
  REPLACEMENT: 'Replacement material',
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
  RESILIATION_RECOVERY: 'Resiliation recovery',
  DAMAGED_FIELD_RECOVERY: 'Damaged field recovery',
  UNUSED_FIELD_MATERIAL: 'Unused field material',
  OTHER: 'Other / unclassified',
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
  items: ReturnedItemRequest[];
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
