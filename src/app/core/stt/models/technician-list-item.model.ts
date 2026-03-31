export interface TechnicianListItem {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  enabled: boolean;
  createdAt: string | null;
}