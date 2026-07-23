import { AccountStatus } from '../auth/models/account-status.enum';
import { Role } from '../auth/models/roles.type';
import {
  CaseStatus,
  CaseType,
  ComplaintCategory,
  ExecutionMode,
  ResolutionValidationStatus,
  SlaStatus
} from '../cases/models/case.model';
import { AlertCategory } from '../notifications/models/notification.model';
import {
  DistributionStatus,
  DpmStatus,
  InstanceStatus,
  PermissionStatus,
  StockMovementType,
  TeamDistributionStatus
} from '../stock/stock.model';
import {
  MaterialReturnStatus,
  ReturnCondition,
  ReturnDestination,
  ReturnReason,
  ReturnSource
} from '../stock/material-return.model';

export const ROLE_LABEL_KEYS: Record<Role, string> = {
  ROLE_ADMIN: 'roles.admin',
  ROLE_CRM_BOUTIQUE: 'roles.crmBoutique',
  ROLE_STT: 'roles.stt',
  ROLE_TECH: 'roles.tech',
  ROLE_ZM: 'roles.zm'
};

export const ACCOUNT_STATUS_LABEL_KEYS: Record<AccountStatus, string> = {
  PENDING: 'statuses.account.pending',
  APPROVED: 'statuses.account.approved',
  REJECTED: 'statuses.account.rejected'
};

export const CASE_TYPE_LABEL_KEYS: Record<CaseType, string> = {
  ACTIVATION: 'cases.types.activation',
  PLAINTE: 'cases.types.complaint'
};

export const CASE_MODULE_LABEL_KEYS: Record<'ACT' | 'PLT' | 'RES', string> = {
  ACT: 'cases.modules.activation',
  PLT: 'cases.modules.complaint',
  RES: 'cases.modules.resiliation'
};

export const EXECUTION_MODE_LABEL_KEYS: Record<ExecutionMode, string> = {
  STT_SELF_EXECUTION: 'cases.execution.sttSelfExecution',
  TECH_EXECUTION: 'cases.execution.techExecution'
};

export const COMPLAINT_CATEGORY_LABEL_KEYS: Record<ComplaintCategory, string> = {
  NETWORK_COVERAGE: 'cases.complaintCategory.networkCoverage',
  SERVICE_QUALITY: 'cases.complaintCategory.serviceQuality',
  INSTALLATION: 'cases.complaintCategory.installation',
  EQUIPMENT: 'cases.complaintCategory.equipment',
  BILLING: 'cases.complaintCategory.billing',
  ACTIVATION_FOLLOW_UP: 'cases.complaintCategory.activationFollowUp',
  CUSTOMER_EDUCATION: 'cases.complaintCategory.customerEducation',
  OTHER: 'cases.complaintCategory.other'
};

export const CASE_STATUS_LABEL_KEYS: Record<CaseStatus, string> = {
  CREATED: 'statuses.case.created',
  ASSIGNED_TO_ZM: 'statuses.case.assignedToZm',
  ASSIGNED_TO_STT: 'statuses.case.assignedToStt',
  ASSIGNED_TO_TECH: 'statuses.case.assignedToTech',
  RDV_SET: 'statuses.case.rdvSet',
  DIAGNOSIS_STEP: 'statuses.case.diagnosisStep',
  ESCALATED: 'statuses.case.escalated',
  RESOLUTION_SUBMITTED: 'statuses.case.resolutionSubmitted',
  RETURNED_TO_STT: 'statuses.case.returnedToStt',
  REOPENED: 'statuses.case.reopened',
  NOT_REACHABLE: 'statuses.case.notReachable',
  ABANDONED: 'statuses.case.abandoned',
  WORK_DONE: 'statuses.case.workDone',
  VALIDATED_BY_ZM: 'statuses.case.validatedByZm',
  REJECTED_BY_ZM: 'statuses.case.rejectedByZm',
  CLOSED: 'statuses.case.closed'
};

export const SLA_STATUS_LABEL_KEYS: Record<SlaStatus, string> = {
  ON_TRACK: 'statuses.sla.onTrack',
  WARNING: 'statuses.sla.warning',
  BREACHED: 'statuses.sla.breached',
  COMPLETED_ON_TIME: 'statuses.sla.completedOnTime',
  COMPLETED_LATE: 'statuses.sla.completedLate'
};

export const RESOLUTION_VALIDATION_LABEL_KEYS: Record<ResolutionValidationStatus, string> = {
  PENDING: 'statuses.resolutionValidation.pending',
  APPROVED: 'statuses.resolutionValidation.approved',
  RETURNED_TO_STT: 'statuses.resolutionValidation.returnedToStt',
  REJECTED: 'statuses.resolutionValidation.rejected',
  REOPENED: 'statuses.resolutionValidation.reopened'
};

export const MATERIAL_RETURN_STATUS_LABEL_KEYS: Record<MaterialReturnStatus, string> = {
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
  CLOSED: 'statuses.materialReturn.closed'
};

export const RETURN_REASON_LABEL_KEYS: Record<ReturnReason, string> = {
  DAMAGED: 'statuses.returnReason.damaged',
  BROKEN: 'statuses.returnReason.broken',
  CLIENT_RESILIATION_RECOVERY: 'statuses.returnReason.clientResiliationRecovery',
  UNUSED: 'statuses.returnReason.unused',
  WRONG_DISTRIBUTION: 'statuses.returnReason.wrongDistribution',
  REPLACEMENT: 'statuses.returnReason.replacement',
  OTHER: 'statuses.returnReason.other'
};

export const RETURN_CONDITION_LABEL_KEYS: Record<ReturnCondition, string> = {
  GOOD: 'statuses.returnCondition.good',
  RECONDITIONABLE: 'statuses.returnCondition.reconditionable',
  DAMAGED: 'statuses.returnCondition.damaged',
  BROKEN: 'statuses.returnCondition.broken',
  LOST: 'statuses.returnCondition.lost',
  UNKNOWN: 'statuses.returnCondition.unknown'
};

export const RETURN_DESTINATION_LABEL_KEYS: Record<ReturnDestination, string> = {
  USABLE_STOCK: 'statuses.returnDestination.usableStock',
  DAMAGED_STOCK: 'statuses.returnDestination.damagedStock',
  REPAIR_CENTER: 'statuses.returnDestination.repairCenter',
  RECONDITIONING: 'statuses.returnDestination.reconditioning',
  CENTRAL_WAREHOUSE: 'statuses.returnDestination.centralWarehouse',
  SCRAP: 'statuses.returnDestination.scrap'
};

export const RETURN_SOURCE_LABEL_KEYS: Record<ReturnSource, string> = {
  STT_STOCK: 'statuses.returnSource.sttStock',
  COLLECTED_ITEM_STOCK: 'statuses.returnSource.collectedItemStock',
  CLIENT_RECOVERY: 'statuses.returnSource.clientRecovery',
  RESILIATION_RECOVERY: 'statuses.returnSource.resiliationRecovery',
  DAMAGED_FIELD_RECOVERY: 'statuses.returnSource.damagedFieldRecovery',
  UNUSED_FIELD_MATERIAL: 'statuses.returnSource.unusedFieldMaterial',
  OTHER: 'statuses.returnSource.other'
};

export const DPM_STATUS_LABEL_KEYS: Record<DpmStatus, string> = {
  WAITING_TEAM_STOCK_APPROVAL: 'statuses.dpm.waitingTeamStockApproval',
  TEAM_STOCK_REJECTED: 'statuses.dpm.teamStockRejected',
  RDV_SCHEDULED: 'statuses.dpm.rdvScheduled',
  RDV_CONFIRMED_BY_STT: 'statuses.dpm.rdvConfirmedByStt',
  MATERIAL_RECEIVED: 'statuses.dpm.materialReceived',
  COMPLETED: 'statuses.dpm.completed',
  PENDING_STT_CONFIRMATION: 'statuses.dpm.pendingSttConfirmation',
  PARTIALLY_CONFIRMED: 'statuses.dpm.partiallyConfirmed',
  FULLY_CONFIRMED: 'statuses.dpm.fullyConfirmed',
  REJECTED: 'statuses.dpm.rejected',
  CANCELLED: 'statuses.dpm.cancelled'
};

export const DISTRIBUTION_STATUS_LABEL_KEYS: Record<DistributionStatus, string> = {
  PENDING_TECH_CONFIRMATION: 'statuses.distribution.pendingTechConfirmation',
  CONFIRMED_BY_TECH: 'statuses.distribution.confirmedByTech',
  CANCELLED: 'statuses.distribution.cancelled'
};

export const TEAM_DISTRIBUTION_STATUS_LABEL_KEYS: Record<TeamDistributionStatus, string> = {
  PENDING: 'statuses.teamDistribution.pending',
  CONFIRMED: 'statuses.teamDistribution.confirmed',
  PARTIALLY_USED: 'statuses.teamDistribution.partiallyUsed',
  FULLY_USED: 'statuses.teamDistribution.fullyUsed',
  CANCELLED: 'statuses.teamDistribution.cancelled'
};

export const PERMISSION_STATUS_LABEL_KEYS: Record<PermissionStatus, string> = {
  PENDING: 'statuses.permission.pending',
  APPROVED: 'statuses.permission.approved',
  PARTIALLY_APPROVED: 'statuses.permission.partiallyApproved',
  REJECTED: 'statuses.permission.rejected',
  CANCELLED: 'statuses.permission.cancelled'
};

export const INSTANCE_STATUS_LABEL_KEYS: Record<InstanceStatus, string> = {
  IN_STT_STOCK: 'statuses.instance.inSttStock',
  IN_TECH_STOCK: 'statuses.instance.inTechStock',
  USED_ON_CASE: 'statuses.instance.usedOnCase',
  RECOVERED_FROM_CLIENT: 'statuses.instance.recoveredFromClient',
  RETURNED_TO_DEPOT: 'statuses.instance.returnedToDepot'
};

export const STOCK_MOVEMENT_TYPE_LABEL_KEYS: Record<StockMovementType, string> = {
  DPM_CREATED: 'stock.movement.dpmCreated',
  DPM_CONFIRMED: 'stock.movement.dpmConfirmed',
  STT_TO_TECH_DISTRIBUTION: 'stock.movement.sttToTechDistribution',
  TECH_RECEIVED_FROM_STT: 'stock.movement.techReceivedFromStt',
  CASE_USAGE: 'stock.movement.caseUsage',
  MATERIAL_RETURN_SUBMITTED: 'stock.movement.materialReturnSubmitted',
  MATERIAL_RETURN_APPROVED: 'stock.movement.materialReturnApproved',
  MATERIAL_RETURN_REJECTED: 'stock.movement.materialReturnRejected',
  RETURN_TO_USABLE_STOCK: 'stock.movement.returnToUsableStock',
  RETURN_TO_DAMAGED_STOCK: 'stock.movement.returnToDamagedStock',
  RETURN_TO_REPAIR: 'stock.movement.returnToRepair',
  RETURN_TO_RECONDITIONING: 'stock.movement.returnToReconditioning',
  RETURN_TO_CENTRAL_WAREHOUSE: 'stock.movement.returnToCentralWarehouse',
  RETURN_TO_SCRAP: 'stock.movement.returnToScrap'
};

export const ALERT_CATEGORY_LABEL_KEYS: Record<AlertCategory, string> = {
  DPM: 'notifications.category.dpm',
  STOCK: 'notifications.category.stock',
  MATERIAL_RETURN: 'notifications.category.materialReturn',
  CASE: 'notifications.category.case',
  PERMISSION: 'notifications.category.permission',
  USER: 'notifications.category.user',
  SLA: 'notifications.category.sla',
  SYSTEM: 'notifications.category.system'
};

export function labelKeyFromMap<T extends string>(
  value: T | null | undefined,
  labels: Partial<Record<T, string>>,
  fallback = 'common.unknown'
): string {
  if (!value) {
    return fallback;
  }

  return labels[value] ?? fallback;
}
