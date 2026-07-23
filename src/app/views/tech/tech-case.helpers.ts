import {
  CaseUsedEquipmentItem,
  CaseMetrics,
  CaseRdv,
  CaseResponse,
  CaseSlaTracking,
  CaseTimelineEvent,
  CaseWork,
  RecoveredEquipmentRequestItem,
  SlaStatus
} from '../../core/cases/models/case.model';
import { Equipment, TechStockItem } from '../../core/stock/stock.model';

export interface LiveSlaState {
  status: SlaStatus | null;
  progressPercent: number;
  remainingSeconds: number | null;
  overdueSeconds: number;
  responseDurationSeconds: number | null;
}

export interface EquipmentUsageLine {
  equipmentId: string;
  quantity: string | number;
  /** Selected tracked-unit ids for this line (tracked equipment only). */
  instanceIds?: string[];
}

/**
 * One line in the "equipment retrieved from the customer" form, shared by Complaint (PLT — always
 * disposition RETRIEVED, no picker shown) and Résiliation (RES — full disposition picker).
 */
export interface RecoveryLine {
  equipmentId: string;
  quantity: string | number;
  serialNumber: string;
  macAddress: string;
  imei: string;
  condition: string;
  /** RETRIEVED (default) / DAMAGED / MISSING / NOT_FOUND / ALREADY_RETURNED. */
  disposition: string;
  /** Free-text note — mainly used for non-physical dispositions (e.g. why it's missing). */
  dispositionNote: string;
}

export function newRecoveryLine(): RecoveryLine {
  return {
    equipmentId: '', quantity: '', serialNumber: '', macAddress: '', imei: '',
    condition: 'GOOD', disposition: 'RETRIEVED', dispositionNote: ''
  };
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

export function normalizeUsedEquipmentItems(items?: CaseUsedEquipmentItem[] | null): CaseUsedEquipmentItem[] {
  const merged = new Map<string, CaseUsedEquipmentItem>();
  for (const item of items ?? []) {
    const equipmentId = item?.equipmentId?.trim();
    if (!equipmentId || !Number.isFinite(item.quantity) || item.quantity <= 0) {
      continue;
    }

    const existing = merged.get(equipmentId);
    if (existing) {
      existing.quantity += item.quantity;
      if (!existing.equipmentName && item.equipmentName) {
        existing.equipmentName = item.equipmentName;
      }
      if (!existing.unit && item.unit) {
        existing.unit = item.unit;
      }
      continue;
    }

    merged.set(equipmentId, {
      equipmentId,
      equipmentName: item.equipmentName?.trim() || null,
      unit: item.unit?.trim() || null,
      quantity: item.quantity
    });
  }

  return Array.from(merged.values());
}

export function usageLinesFromCaseItems(items?: CaseUsedEquipmentItem[] | null): EquipmentUsageLine[] {
  const normalized = normalizeUsedEquipmentItems(items);
  if (!normalized.length) {
    return [{ equipmentId: '', quantity: '' }];
  }

  return normalized.map((item) => ({
    equipmentId: item.equipmentId,
    quantity: String(item.quantity)
  }));
}

export function buildUsedEquipmentPayload(
  lines: EquipmentUsageLine[],
  stockItems: TechStockItem[],
  existingItems?: CaseUsedEquipmentItem[] | null
): { items: CaseUsedEquipmentItem[]; error: string | null } {
  const mergedExisting = new Map(
    normalizeUsedEquipmentItems(existingItems).map((item) => [item.equipmentId, item])
  );
  const mergedSelected = new Map<string, CaseUsedEquipmentItem>();

  for (const line of lines) {
    const equipmentId = line.equipmentId.trim();
    const quantityText = String(line.quantity ?? '').trim();
    const instanceIds = (line.instanceIds ?? []).filter((id) => !!id && id.trim());

    if (!equipmentId && !quantityText) {
      continue;
    }

    if (!equipmentId || !quantityText) {
      return {
        items: [],
        error: 'Complete or clear every equipment usage line before submitting work.'
      };
    }

    const quantity = Number(quantityText);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      return {
        items: [],
        error: 'Used equipment quantities must be positive numbers.'
      };
    }

    const existing = mergedSelected.get(equipmentId);
    if (existing) {
      existing.quantity += quantity;
      if (instanceIds.length) {
        existing.instanceIds = [...(existing.instanceIds ?? []), ...instanceIds];
      }
      continue;
    }

    mergedSelected.set(equipmentId, {
      equipmentId,
      quantity,
      instanceIds: instanceIds.length ? instanceIds : undefined
    });
  }

  const items: CaseUsedEquipmentItem[] = [];
  for (const selected of mergedSelected.values()) {
    const stockItem = stockItems.find((item) => item.equipmentId === selected.equipmentId);
    if (!stockItem) {
      return {
        items: [],
        error: `The selected equipment ${selected.equipmentId} is not available in the current technician stock. Refresh stock and try again.`
      };
    }

    const previousQuantity = mergedExisting.get(selected.equipmentId)?.quantity ?? 0;
    const maxAllowed = stockItem.remainingQuantity + previousQuantity;
    if (selected.quantity > maxAllowed) {
      return {
        items: [],
        error: `Only ${maxAllowed} ${usageUnitLabel(stockItem.unit)} can be used for ${stockItem.equipmentName} on this case.`
      };
    }

    if (selected.instanceIds && selected.instanceIds.length !== selected.quantity) {
      return {
        items: [],
        error: `Select exactly ${selected.quantity} unit(s) by IMEI/Serial for ${stockItem.equipmentName}.`
      };
    }

    items.push({
      equipmentId: stockItem.equipmentId,
      equipmentName: stockItem.equipmentName,
      unit: stockItem.unit ?? null,
      quantity: selected.quantity,
      instanceIds: selected.instanceIds
    });
  }

  return { items, error: null };
}

const PHYSICALLY_HELD_DISPOSITIONS = new Set(['RETRIEVED', 'DAMAGED']);

/**
 * Validates and builds the retrieval-declaration payload, mirroring `buildUsedEquipmentPayload`'s
 * `{items, error}` shape. Server-side (`RetrievedStockService.recordRetrieval`) re-validates
 * everything here too — this is client-side defense-in-depth so the technician gets fast feedback
 * before a round-trip, not the source of truth.
 */
export function buildRecoveredEquipmentPayload(
  lines: RecoveryLine[],
  equipmentCatalog: Equipment[]
): { items: RecoveredEquipmentRequestItem[]; error: string | null } {
  const items: RecoveredEquipmentRequestItem[] = [];
  const seenImei = new Set<string>();
  const seenSerial = new Set<string>();

  for (const line of lines) {
    const equipmentId = line.equipmentId.trim();
    const quantityText = String(line.quantity ?? '').trim();
    if (!equipmentId && !quantityText) {
      continue; // fully blank row — skip silently
    }
    if (!equipmentId) {
      return { items: [], error: 'Select the equipment for every recovery line before submitting.' };
    }

    const quantity = Number(quantityText || '1');
    if (!Number.isFinite(quantity) || quantity <= 0) {
      return { items: [], error: 'Recovered quantities must be positive numbers.' };
    }

    const disposition = (line.disposition || 'RETRIEVED').trim().toUpperCase();
    const physicallyHeld = PHYSICALLY_HELD_DISPOSITIONS.has(disposition);
    const equipment = equipmentCatalog.find((e) => e.id === equipmentId);
    const name = equipment?.name ?? equipmentId;
    const trackingMode = equipment?.trackingMode ?? 'NONE';
    const isTracked = trackingMode !== 'NONE';
    const serial = (line.serialNumber ?? '').trim();
    const imei = (line.imei ?? '').trim();

    if (physicallyHeld && isTracked) {
      if (quantity !== 1) {
        return { items: [], error: `${name} is a tracked item: submit one line per unit (quantity must be 1).` };
      }
      const requiresSerial = trackingMode === 'SERIAL_ONLY' || trackingMode === 'SERIAL_AND_IMEI';
      const requiresImei = trackingMode === 'IMEI_ONLY' || trackingMode === 'SERIAL_AND_IMEI';
      const requiresAtLeastOne = trackingMode === 'SERIAL_OR_IMEI';
      if (requiresSerial && !serial) {
        return { items: [], error: `Serial number is required for ${name}.` };
      }
      if (requiresImei && !imei) {
        return { items: [], error: `IMEI is required for ${name}.` };
      }
      if (requiresAtLeastOne && !serial && !imei) {
        return { items: [], error: `Enter at least a serial number or IMEI for ${name}.` };
      }
    }

    if (physicallyHeld) {
      const normImei = imei.toUpperCase();
      const normSerial = serial.toUpperCase();
      if (normImei) {
        if (seenImei.has(normImei)) {
          return { items: [], error: `IMEI '${imei}' is repeated across your recovery lines.` };
        }
        seenImei.add(normImei);
      }
      if (normSerial) {
        if (seenSerial.has(normSerial)) {
          return { items: [], error: `Serial number '${serial}' is repeated across your recovery lines.` };
        }
        seenSerial.add(normSerial);
      }
    }

    items.push({
      equipmentId,
      equipmentName: equipment?.name,
      unit: equipment?.unit,
      quantity,
      serialNumber: serial || undefined,
      macAddress: (line.macAddress ?? '').trim() || undefined,
      imei: imei || undefined,
      condition: line.condition || 'GOOD',
      disposition,
      dispositionNote: (line.dispositionNote ?? '').trim() || undefined
    });
  }

  if (items.length === 0) {
    return { items: [], error: 'Select at least one recovered item before declaring.' };
  }

  return { items, error: null };
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

function usageUnitLabel(unit?: string | null): string {
  if (unit === 'METERS') {
    return 'm';
  }

  if (unit === 'PIECES') {
    return 'pcs';
  }

  return unit?.trim() || 'units';
}
