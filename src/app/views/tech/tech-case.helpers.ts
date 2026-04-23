import {
  CaseMetrics,
  CaseRdv,
  CaseResponse,
  CaseSlaTracking,
  CaseTimelineEvent,
  CaseWork,
  SlaStatus
} from '../../core/cases/models/case.model';

export interface LiveSlaState {
  status: SlaStatus | null;
  progressPercent: number;
  remainingSeconds: number | null;
  overdueSeconds: number;
  responseDurationSeconds: number | null;
}

const DEFAULT_WARNING_THRESHOLD = 50;

export function resolveLiveSla(item: CaseResponse, nowEpochMs = Date.now()): LiveSlaState {
  return resolveSlaFromTracking(item.slaTracking, nowEpochMs);
}

export function slaStatusLabel(status: SlaStatus | null): string {
  switch (status) {
    case 'ON_TRACK':
      return 'On track';
    case 'WARNING':
      return 'Warning';
    case 'BREACHED':
      return 'Breached';
    case 'COMPLETED_ON_TIME':
      return 'Completed on time';
    case 'COMPLETED_LATE':
      return 'Completed late';
    default:
      return 'Not started';
  }
}

export function slaRemainingLabel(item: CaseResponse, nowEpochMs = Date.now()): string {
  const live = resolveLiveSla(item, nowEpochMs);

  if (live.status === 'COMPLETED_ON_TIME' || live.status === 'COMPLETED_LATE') {
    if (live.responseDurationSeconds == null) {
      return 'Captured';
    }

    return `Responded in ${formatSeconds(live.responseDurationSeconds)}`;
  }

  if (live.remainingSeconds == null) {
    return '-';
  }

  if (live.remainingSeconds <= 0) {
    return live.overdueSeconds > 0
      ? `Overdue by ${formatSeconds(live.overdueSeconds)}`
      : 'Overdue';
  }

  return `${formatSeconds(live.remainingSeconds)} left`;
}

export function extractRdv(item: CaseResponse): CaseRdv {
  if (item.rdv) {
    return item.rdv;
  }

  return {
    joignable: item.joignable,
    datePriseRdv: item.datePriseRdv,
    causeInjoignabilite: item.causeInjoignabilite,
    detail: item.detail,
    cmtRdv: item.cmtRdv,
    abandon: item.abandon,
    causeAbandon: item.causeAbandon
  };
}

export function extractWork(item: CaseResponse): CaseWork {
  if (item.work) {
    return item.work;
  }

  return {
    repTravauxStt: item.repTravauxStt,
    dateFinTrv: item.dateFinTrv,
    cmtTrvStt: item.cmtTrvStt
  };
}

export function extractMetrics(item: CaseResponse): CaseMetrics {
  if (item.metrics) {
    return item.metrics;
  }

  return {
    metrageCable: item.metrageCable,
    nombrePv: item.nombrePv,
    debitDl: item.debitDl,
    debitUl: item.debitUl,
    rsrp: item.rsrp,
    rsrq: item.rsrq,
    sinr: item.sinr
  };
}

export function extractTimeline(item: CaseResponse): CaseTimelineEvent[] {
  const timeline = item.timeline ?? [];

  return [...timeline].sort((left, right) => {
    const leftMs = toEpochMs(left.occurredAt);
    const rightMs = toEpochMs(right.occurredAt);
    return (rightMs ?? 0) - (leftMs ?? 0);
  });
}

export function toDateTimeLocal(value?: string | null): string {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export function toIso(value: string): string {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toISOString();
}

export function toMaybeNumber(value: string | number | null | undefined): number | undefined {
  if (value == null) {
    return undefined;
  }

  const normalized = typeof value === 'number' ? String(value) : value;
  const trimmed = normalized.trim();
  if (!trimmed) {
    return undefined;
  }

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function toInputNumber(value?: number | null): string {
  return value == null ? '' : String(value);
}

function resolveSlaFromTracking(
  sla?: CaseSlaTracking | null,
  nowEpochMs = Date.now()
): LiveSlaState {
  const fallback = fallbackSla(sla);
  if (!sla) {
    return fallback;
  }

  if (sla.status === 'COMPLETED_ON_TIME' || sla.status === 'COMPLETED_LATE') {
    return fallback;
  }

  const startedMs = toEpochMs(sla.startedAt);
  const deadlineMs = toEpochMs(sla.deadlineAt);

  if (startedMs == null || deadlineMs == null || deadlineMs <= startedMs) {
    return fallback;
  }

  const durationMs = Math.max(1000, deadlineMs - startedMs);
  const remainingMs = deadlineMs - nowEpochMs;
  const clampedRemainingMs = Math.max(0, remainingMs);
  const warningThresholdPercent = sla.warningThresholdPercent ?? DEFAULT_WARNING_THRESHOLD;

  const progressPercent = clamp((clampedRemainingMs / durationMs) * 100);
  const remainingSeconds = Math.floor(clampedRemainingMs / 1000);
  const overdueSeconds = Math.floor(Math.max(0, -remainingMs) / 1000);

  let status: SlaStatus = 'ON_TRACK';
  if (progressPercent <= 0) {
    status = 'BREACHED';
  } else if (progressPercent <= warningThresholdPercent) {
    status = 'WARNING';
  }

  return {
    status,
    progressPercent,
    remainingSeconds,
    overdueSeconds,
    responseDurationSeconds: sla.responseDurationSeconds ?? null
  };
}

function fallbackSla(sla?: CaseSlaTracking | null): LiveSlaState {
  return {
    status: sla?.status ?? null,
    progressPercent: clamp(sla?.progressPercent ?? 0),
    remainingSeconds: sla?.remainingSeconds ?? null,
    overdueSeconds: 0,
    responseDurationSeconds: sla?.responseDurationSeconds ?? null
  };
}

function clamp(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function formatSeconds(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) {
    return '<1m';
  }

  const safeSeconds = Math.floor(totalSeconds);
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  if (minutes > 0) {
    return `${minutes}m`;
  }

  return '<1m';
}

function toEpochMs(value?: string | null): number | null {
  if (!value) {
    return null;
  }

  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}
