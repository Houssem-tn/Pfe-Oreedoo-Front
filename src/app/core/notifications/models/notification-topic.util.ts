import { Role } from '../../auth/models/roles.type';

export function buildNotificationTopic(role: Role): string {
  return `/topic/notifications/${role}`;
}