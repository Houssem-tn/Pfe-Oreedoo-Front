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
}