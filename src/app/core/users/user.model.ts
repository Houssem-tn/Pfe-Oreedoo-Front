export type Role =
  | 'ROLE_ADMIN'
  | 'ROLE_STT'
  | 'ROLE_TECH'
  | 'ROLE_CRM_BOUTIQUE'
  | 'ROLE_ZM';

export type AccountStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED';

export interface AppUser {
  id: string;
  fullName: string;
  email: string;
  phone?: string | null;

  role?: string | null;
  roleRequested?: string | null;
  status?: string | null;
  enabled?: boolean;

  assignedSttId?: string | null;
  assignedSttEmail?: string | null;

  assignedZmId?: string | null;
  assignedZmEmail?: string | null;

  validatedAt?: string | null;
  validatedBy?: string | null;
  rejectionReason?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  lastLoginAt?: string | null;

  profileImageFileId?: string | null;
  profileImageUrl?: string | null;
  profileThumbnailUrl?: string | null;
}

export interface UserAuditItem {
  id: string;
  fullName: string;
  email: string;
  role: Role | null;
  status: AccountStatus;
  enabled: boolean;
  createdAt?: string;
  lastLoginAt?: string;
}