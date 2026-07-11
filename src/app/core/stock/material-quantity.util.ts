export interface MaterialQuantityGroup {
  equipmentId?: string | null;
  equipmentName?: string | null;
  unit?: string | null;
  quantity: number;
}

interface MaterialGroupConfig<T> {
  quantity: (item: T) => number | null | undefined;
  equipmentId?: (item: T) => string | null | undefined;
  equipmentName?: (item: T) => string | null | undefined;
  unit?: (item: T) => string | null | undefined;
}

interface MaterialFormatOptions {
  separator?: string;
  includeEquipmentName?: boolean;
  emptyLabel?: string;
}

const METER_UNITS = new Set(['M', 'METER', 'METERS']);
const PIECE_UNITS = new Set(['PC', 'PCS', 'PIECE', 'PIECES']);

export function normalizeMaterialUnit(unit?: string | null): string {
  const normalized = (unit ?? '').trim().toUpperCase();
  if (!normalized) return 'UNITS';
  if (METER_UNITS.has(normalized)) return 'METERS';
  if (PIECE_UNITS.has(normalized)) return 'PIECES';
  return normalized;
}

export function materialUnitShort(unit?: string | null): string {
  switch (normalizeMaterialUnit(unit)) {
    case 'METERS':
      return 'm';
    case 'PIECES':
      return 'pcs';
    case 'UNITS':
      return 'units';
    default:
      return normalizeMaterialUnit(unit).toLowerCase();
  }
}

export function materialUnitLabel(unit?: string | null): string {
  switch (normalizeMaterialUnit(unit)) {
    case 'METERS':
      return 'Meters';
    case 'PIECES':
      return 'Pieces';
    case 'UNITS':
      return 'Units';
    default:
      return humanizeToken(normalizeMaterialUnit(unit));
  }
}

export function formatMaterialQuantity(quantity: number, unit?: string | null): string {
  return `${formatMaterialNumber(quantity)} ${materialUnitShort(unit)}`;
}

export function groupMaterialQuantities<T>(
  items: readonly T[],
  config: MaterialGroupConfig<T>
): MaterialQuantityGroup[] {
  const groups = new Map<string, MaterialQuantityGroup>();

  for (const item of items) {
    const quantity = Number(config.quantity(item) ?? 0);
    if (!Number.isFinite(quantity) || quantity === 0) continue;

    const equipmentId = clean(config.equipmentId?.(item)) ?? null;
    const equipmentName = clean(config.equipmentName?.(item)) ?? equipmentId ?? null;
    const unit = normalizeMaterialUnit(config.unit?.(item));
    const key = `${equipmentId ?? equipmentName ?? 'material'}::${unit}`;
    const current = groups.get(key);

    if (current) {
      current.quantity += quantity;
      continue;
    }

    groups.set(key, {
      equipmentId,
      equipmentName,
      unit,
      quantity
    });
  }

  return [...groups.values()];
}

export function formatMaterialGroup(
  group: MaterialQuantityGroup,
  options: MaterialFormatOptions = {}
): string {
  const qty = formatMaterialQuantity(group.quantity, group.unit);
  const includeEquipmentName = options.includeEquipmentName ?? true;
  const equipmentName = clean(group.equipmentName);

  if (includeEquipmentName && equipmentName) {
    return `${qty} ${equipmentName}`;
  }

  return qty;
}

export function formatMaterialGroups(
  groups: readonly MaterialQuantityGroup[],
  options: MaterialFormatOptions = {}
): string {
  if (!groups.length) {
    return options.emptyLabel ?? '0';
  }

  const separator = options.separator ?? ' / ';
  return groups.map(group => formatMaterialGroup(group, options)).join(separator);
}

function clean(value?: string | null): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function humanizeToken(value: string): string {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function formatMaterialNumber(value: number): string {
  return Number.isInteger(value)
    ? value.toLocaleString('en-US')
    : value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}
