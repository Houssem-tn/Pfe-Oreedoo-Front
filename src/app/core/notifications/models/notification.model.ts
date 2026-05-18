export type AlertLevel = 'CRITICAL' | 'WARNING' | 'INFO';

export type AlertActionType =
  | 'OPEN_CASE'
  | 'OPEN_DPM_REQUEST'
  | 'OPEN_STOCK_PERMISSION_REQUEST'
  | 'OPEN_STOCK_THRESHOLDS'
  | 'OPEN_STOCK_PAGE'
  | 'NONE';

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

  // Alert Center fields (null = legacy notification → treated as INFO)
  level?: AlertLevel;
  actionType?: AlertActionType;
  relatedCaseId?: string;
  relatedStockRequestId?: string;
  relatedPermissionRequestId?: string;
}

/** Derive the effective level from a notification (legacy-safe). */
export function effectiveLevel(n: NotificationItem): AlertLevel {
  if (n.level) return n.level;
  // Map existing event types to levels
  if (n.eventType === 'SLA_BREACHED' || n.eventType === 'SLA_ESCALATED') return 'CRITICAL';
  if (n.eventType === 'SLA_WARNING') return 'WARNING';
  return 'INFO';
}