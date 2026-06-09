export type AlertLevel = 'CRITICAL' | 'WARNING' | 'INFO';

export type AlertCategory = 'DPM' | 'STOCK' | 'CASE' | 'PERMISSION' | 'USER' | 'SLA' | 'SYSTEM';

export type AlertActionType =
  | 'OPEN_CASE'
  | 'OPEN_DPM'
  | 'OPEN_STOCK'
  | 'OPEN_PERMISSION_REQUEST'
  | 'OPEN_USER'
  | 'OPEN_THRESHOLDS'
  | 'OPEN_MATERIAL_RETURN'
  | 'NONE'
  // Legacy action types — kept for backward compatibility with existing DB records
  | 'OPEN_DPM_REQUEST'
  | 'OPEN_STOCK_PAGE'
  | 'OPEN_STOCK_PERMISSION_REQUEST'
  | 'OPEN_STOCK_THRESHOLDS';

export interface NotificationItem {
  id: string;
  eventType: string;
  title: string;
  message: string;

  entityType?: string;
  entityId?: string;

  status?: string;
  targetRole: string;
  recipientEmail?: string;
  triggeredBy?: string;

  read: boolean;
  createdAt: string;

  data?: Record<string, any>;

  // Alert Center fields (null = legacy notification)
  level?: AlertLevel;
  category?: AlertCategory;
  actionType?: AlertActionType;
  relatedCaseId?: string;
  relatedStockRequestId?: string;
  relatedPermissionRequestId?: string;
}

/** Derive the effective severity level (legacy-safe). */
export function effectiveLevel(n: NotificationItem): AlertLevel {
  if (n.level) return n.level;
  if (n.eventType === 'SLA_BREACHED' || n.eventType === 'SLA_ESCALATED') return 'CRITICAL';
  if (n.eventType === 'SLA_WARNING') return 'WARNING';
  if (n.eventType === 'STOCK_CRITICAL') return 'CRITICAL';
  if (n.eventType === 'STOCK_LOW_WARNING') return 'WARNING';
  return 'INFO';
}

/** Derive the effective business category (legacy-safe). */
export function effectiveCategory(n: NotificationItem): AlertCategory {
  if (n.category) return n.category;
  const et = n.eventType ?? '';
  const at = n.actionType ?? '';
  if (et.startsWith('DPM_') || at === 'OPEN_DPM' || at === 'OPEN_DPM_REQUEST') return 'DPM';
  if (et.startsWith('SLA_'))                                                      return 'SLA';
  if (et.startsWith('CASE_') || et.includes('COMPLAINT'))                        return 'CASE';
  if (et.startsWith('STOCK_USAGE_PERMISSION')
      || at === 'OPEN_PERMISSION_REQUEST'
      || at === 'OPEN_STOCK_PERMISSION_REQUEST')                                  return 'PERMISSION';
  if (et.startsWith('STOCK_')
      || at === 'OPEN_STOCK'
      || at === 'OPEN_STOCK_PAGE'
      || at === 'OPEN_THRESHOLDS'
      || at === 'OPEN_STOCK_THRESHOLDS')                                          return 'STOCK';
  if (et === 'USER_REGISTERED' || at === 'OPEN_USER')                            return 'USER';
  return 'SYSTEM';
}
