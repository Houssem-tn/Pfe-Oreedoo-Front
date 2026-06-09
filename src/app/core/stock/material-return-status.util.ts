import { MaterialReturn, MaterialReturnStatus, RETURN_STATUS_LABELS } from './material-return.model';

export const ZM_AWAITING_ACTION_STATUSES: MaterialReturnStatus[] = [
  'PENDING',
  'SUBMITTED',
  'PENDING_ZM_REVIEW',
  'RESCHEDULE_REQUESTED',
  'SCHEDULE_REJECTED_BY_STT',
];

export const ZM_SCHEDULE_PROPOSED_STATUSES: MaterialReturnStatus[] = [
  'SCHEDULE_PROPOSED',
  'PENDING_STT_CONFIRMATION',
  'WAITING_STT_CONFIRMATION',
  'SCHEDULE_PROPOSED_BY_ZM',
];

export const ZM_RESCHEDULE_REQUEST_STATUSES: MaterialReturnStatus[] = [
  'RESCHEDULE_REQUESTED',
  'SCHEDULE_REJECTED_BY_STT',
];

export const ZM_CONFIRMED_STATUSES: MaterialReturnStatus[] = [
  'SCHEDULE_CONFIRMED',
  'APPROVED',
];

export const ZM_REJECTED_STATUSES: MaterialReturnStatus[] = ['REJECTED'];

export const ZM_COMPLETED_STATUSES: MaterialReturnStatus[] = [
  'HANDED_OVER',
  'RECEIVED',
  'COMPLETED',
  'CLOSED',
];

export const STT_WAITING_FOR_ZM_REVIEW_STATUSES: MaterialReturnStatus[] = [
  'PENDING',
  'SUBMITTED',
  'PENDING_ZM_REVIEW',
];

export const STT_ACTION_REQUIRED_STATUSES: MaterialReturnStatus[] = [
  'SCHEDULE_PROPOSED',
  'PENDING_STT_CONFIRMATION',
  'WAITING_STT_CONFIRMATION',
  'SCHEDULE_PROPOSED_BY_ZM',
];

export const STT_CONFIRMED_STATUSES: MaterialReturnStatus[] = [
  'SCHEDULE_CONFIRMED',
  'APPROVED',
];

export const STT_RESCHEDULE_REQUESTED_STATUSES: MaterialReturnStatus[] = [
  'RESCHEDULE_REQUESTED',
  'SCHEDULE_REJECTED_BY_STT',
];

export const STT_REJECTED_STATUSES: MaterialReturnStatus[] = ['REJECTED'];

export const STT_COMPLETED_STATUSES: MaterialReturnStatus[] = [
  'HANDED_OVER',
  'RECEIVED',
  'COMPLETED',
  'CLOSED',
];

export function hasReturnStatus(
  value: MaterialReturn | MaterialReturnStatus | undefined | null,
  statuses: readonly MaterialReturnStatus[],
): boolean {
  const status = typeof value === 'string' ? value : value?.status;
  return !!status && statuses.includes(status);
}

export function isWaitingForZmReview(value: MaterialReturn | MaterialReturnStatus | undefined | null): boolean {
  return hasReturnStatus(value, STT_WAITING_FOR_ZM_REVIEW_STATUSES);
}

export function isWaitingForSttConfirmation(value: MaterialReturn | MaterialReturnStatus | undefined | null): boolean {
  return hasReturnStatus(value, STT_ACTION_REQUIRED_STATUSES);
}

export function isScheduleProposed(value: MaterialReturn | MaterialReturnStatus | undefined | null): boolean {
  return isWaitingForSttConfirmation(value);
}

export function isScheduleConfirmed(value: MaterialReturn | MaterialReturnStatus | undefined | null): boolean {
  return hasReturnStatus(value, STT_CONFIRMED_STATUSES);
}

export function isRescheduleRequested(value: MaterialReturn | MaterialReturnStatus | undefined | null): boolean {
  return hasReturnStatus(value, STT_RESCHEDULE_REQUESTED_STATUSES);
}

export function isRejected(value: MaterialReturn | MaterialReturnStatus | undefined | null): boolean {
  return hasReturnStatus(value, STT_REJECTED_STATUSES);
}

export function isCompleted(value: MaterialReturn | MaterialReturnStatus | undefined | null): boolean {
  return hasReturnStatus(value, STT_COMPLETED_STATUSES);
}

export function canZmProposeSchedule(value: MaterialReturn | MaterialReturnStatus | undefined | null): boolean {
  return hasReturnStatus(value, ZM_AWAITING_ACTION_STATUSES);
}

export function canZmRejectReturn(value: MaterialReturn | MaterialReturnStatus | undefined | null): boolean {
  return hasReturnStatus(value, ZM_AWAITING_ACTION_STATUSES);
}

export function canSttReviewSchedule(value: MaterialReturn | MaterialReturnStatus | undefined | null): boolean {
  return hasReturnStatus(value, STT_ACTION_REQUIRED_STATUSES);
}

export function statusLabelForReturn(value: MaterialReturn | MaterialReturnStatus | undefined | null): string {
  const status = typeof value === 'string' ? value : value?.status;
  if (!status) {
    return 'Unknown';
  }
  return RETURN_STATUS_LABELS[status] ?? status.replace(/_/g, ' ');
}

export function statusBadgeClassForReturn(value: MaterialReturn | MaterialReturnStatus | undefined | null): string {
  if (canSttReviewSchedule(value)) {
    return 'badge badge-action';
  }
  if (canZmProposeSchedule(value)) {
    return 'badge badge-pending';
  }
  if (isScheduleConfirmed(value)) {
    return 'badge badge-confirmed';
  }
  if (isRescheduleRequested(value)) {
    return 'badge badge-warning';
  }
  if (isRejected(value)) {
    return 'badge badge-rejected';
  }
  if (isCompleted(value)) {
    return 'badge badge-completed';
  }
  return 'badge badge-neutral';
}
