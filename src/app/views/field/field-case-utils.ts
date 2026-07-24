import {
  CASE_STATUS_UI,
  CaseResponse,
  CaseStatus
} from '../../core/cases/models/case.model';
import { extractMetrics, extractRdv, extractWork } from '../tech/tech-case.helpers';

export type FieldTone = 'neutral' | 'info' | 'warning' | 'success' | 'danger';

export interface FieldMetricEntry {
  label: string;
  value: string;
}

export function fieldBasePathFromUrl(url: string): string {
  return url.startsWith('/stt/cases/execution') ? '/stt/cases/execution' : '/tech';
}

export function filterFieldCases(
  cases: CaseResponse[],
  currentUserEmail: string,
  role: string | null | undefined
): CaseResponse[] {
  const email = currentUserEmail.trim().toLowerCase();
  if (!email) {
    return [];
  }

  return cases.filter((item) => {
    if (role === 'ROLE_STT') {
      return isSttSelfExecutionCase(item, email);
    }

    return isTechExecutionCase(item, email);
  });
}

export function isTechExecutionCase(item: CaseResponse, currentUserEmail: string): boolean {
  if ((item.techEmail ?? '').trim().toLowerCase() !== currentUserEmail || !item.techId) {
    return false;
  }

  if (!item.executionMode && !item.executorRole && !item.executorId) {
    return true;
  }

  return item.executionMode === 'TECH_EXECUTION'
    && item.executorRole === 'TECH'
    && item.executorId === item.techId;
}

export function isSttSelfExecutionCase(item: CaseResponse, currentUserEmail: string): boolean {
  return (item.sttEmail ?? '').trim().toLowerCase() === currentUserEmail
    && item.executionMode === 'STT_SELF_EXECUTION'
    && item.executorRole === 'STT'
    && !!item.sttId
    && item.executorId === item.sttId;
}

export function isCompletedFieldStatus(status: CaseStatus): boolean {
  return status === 'WORK_DONE'
    || status === 'RESOLUTION_SUBMITTED'
    || status === 'VALIDATED_BY_ZM'
    || status === 'CLOSED';
}

export function isActiveFieldStatus(status: CaseStatus): boolean {
  return !isCompletedFieldStatus(status)
    && status !== 'ABANDONED'
    && status !== 'ESCALATED';
}

export function canUpdateFieldRdv(item: CaseResponse): boolean {
  if (item.type === 'PLAINTE') {
    return item.status === 'ASSIGNED_TO_STT'
      || item.status === 'ASSIGNED_TO_TECH'
      || item.status === 'RDV_SET'
      || item.status === 'NOT_REACHABLE';
  }

  return item.status === 'ASSIGNED_TO_TECH'
    || item.status === 'ASSIGNED_TO_STT'
    || item.status === 'RDV_SET'
    || item.status === 'NOT_REACHABLE';
}

export function canFinishFieldWork(item: CaseResponse): boolean {
  if (item.type === 'PLAINTE') {
    return item.status === 'ASSIGNED_TO_TECH'
      || item.status === 'ASSIGNED_TO_STT'
      || item.status === 'RDV_SET'
      || item.status === 'RETURNED_TO_STT'
      || item.status === 'REOPENED';
  }

  return item.status === 'ASSIGNED_TO_TECH'
    || item.status === 'ASSIGNED_TO_STT'
    || item.status === 'RDV_SET';
}

export function fieldCaseLocation(item: CaseResponse): string {
  return [item.localite, item.delegation, item.gouvernorat].filter(Boolean).join(', ') || 'Location not set';
}

export function fieldCaseOffer(item: CaseResponse): string {
  return [item.offre, item.desPack].filter((value) => !!value?.trim()).join(' | ') || 'Offer not set';
}

export function fieldStatusLabel(status: CaseStatus): string {
  return CASE_STATUS_UI[status]?.label ?? humanizeFieldValue(status);
}

export function fieldStatusTone(status: CaseStatus): FieldTone {
  switch (status) {
    case 'RDV_SET':
    case 'DIAGNOSIS_STEP':
    case 'ASSIGNED_TO_TECH':
    case 'ASSIGNED_TO_STT':
    case 'REOPENED':
      return 'info';
    case 'NOT_REACHABLE':
    case 'RETURNED_TO_STT':
    case 'REJECTED_BY_ZM':
      return 'warning';
    case 'ESCALATED':
    case 'ABANDONED':
      return 'danger';
    case 'WORK_DONE':
    case 'RESOLUTION_SUBMITTED':
    case 'VALIDATED_BY_ZM':
    case 'CLOSED':
      return 'success';
    default:
      return 'neutral';
  }
}

export function fieldStatusClass(status: CaseStatus): string {
  return `field-status field-status--${fieldStatusTone(status)}`;
}

export function fieldMapLink(item: CaseResponse): string {
  if (item.latitude?.trim() && item.longitude?.trim()) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${item.latitude},${item.longitude}`)}`;
  }

  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fieldCaseLocation(item))}`;
}

export function fieldMetricEntries(item: CaseResponse): FieldMetricEntry[] {
  const metrics = extractMetrics(item);

  return [
    { label: 'PV', value: metricValue(metrics.nombrePv) },
    { label: 'DL', value: metricValue(metrics.debitDl) },
    { label: 'UL', value: metricValue(metrics.debitUl) },
    { label: 'RSRP', value: metricValue(metrics.rsrp) },
    { label: 'RSRQ', value: metricValue(metrics.rsrq) },
    { label: 'SINR', value: metricValue(metrics.sinr) }
  ];
}

export function fieldCompletedAt(item: CaseResponse): string | null {
  const work = extractWork(item);
  return work.dateFinTrv ?? item.dateFinTrv ?? item.updatedAt ?? null;
}

export function fieldRdvLabel(item: CaseResponse): string {
  const rdv = extractRdv(item);
  return rdv.datePriseRdv ? new Date(rdv.datePriseRdv).toLocaleString() : 'No RDV';
}

export function fieldWorkLabel(item: CaseResponse): string {
  if (item.type === 'PLAINTE' && item.resolution?.resolutionType?.trim()) {
    return item.resolution.resolutionType.trim();
  }

  const work = extractWork(item);
  return work.repTravauxStt?.trim() || 'Not finished';
}

export function sameLocalDay(value: string | null | undefined, now = new Date()): boolean {
  if (!value) {
    return false;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return false;
  }

  return date.getFullYear() === now.getFullYear()
    && date.getMonth() === now.getMonth()
    && date.getDate() === now.getDate();
}

export function humanizeFieldValue(value?: string | null): string {
  if (!value?.trim()) {
    return '-';
  }

  return value
    .trim()
    .toLowerCase()
    .split('_')
    .map((part) => part ? part[0].toUpperCase() + part.slice(1) : '')
    .join(' ');
}

function metricValue(value?: number | null): string {
  return value == null ? '-' : String(value);
}
