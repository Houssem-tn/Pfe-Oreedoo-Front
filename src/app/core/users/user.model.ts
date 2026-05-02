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

export type InvitationStatus =
  | 'PENDING_REGISTRATION'
  | 'REGISTERED_PENDING_ZM_APPROVAL'
  | 'APPROVED_BY_ZM'
  | 'REJECTED_BY_ZM'
  | 'EXPIRED'
  | 'CANCELLED';

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

  canCreateDpm?: boolean;

  assignedZmId?: string | null;
  assignedZmEmail?: string | null;
  assignedGovernorates?: string[] | null;
  coveredGovernorates?: string[] | null;
  requestedGovernorates?: string[] | null;

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

export interface UserAuditActor {
  id?: string | null;
  fullName?: string | null;
  email?: string | null;
  role?: Role | string | null;
  status?: AccountStatus | string | null;
  enabled?: boolean | null;
  profileImageUrl?: string | null;
  profileThumbnailUrl?: string | null;
}

export interface UserInvitationAudit {
  id?: string | null;
  status?: InvitationStatus | string | null;
  createdAt?: string | null;
  expiresAt?: string | null;
  registeredAt?: string | null;
  zmDecisionAt?: string | null;
  used?: boolean | null;
}

export interface UserHierarchyAudit {
  directReportCount: number;
  sttCount: number;
  techCount: number;
  directReports: UserAuditActor[];
}

export interface UserRoleProfileDetails {
  boutiqueName?: string | null;
  boutiqueCode?: string | null;
  boutiqueAddress?: string | null;
  serviceCenter?: string | null;
  department?: string | null;
  matricule?: string | null;
  skillSet?: string | null;
  region?: string | null;
  available?: boolean | null;
  zoneName?: string | null;
  zoneCode?: string | null;
  coverage?: string | null;
}

export interface UserAuditDetailsResponse {
  user: AppUser;
  validator?: UserAuditActor | null;
  assignedStt?: UserAuditActor | null;
  assignedZm?: UserAuditActor | null;
  invitedBy?: UserAuditActor | null;
  invitationZm?: UserAuditActor | null;
  invitation?: UserInvitationAudit | null;
  hierarchy?: UserHierarchyAudit | null;
  roleProfile?: UserRoleProfileDetails | null;
  performance?: import('../cases/models/case.model').PerformanceSummaryResponse | null;
}
