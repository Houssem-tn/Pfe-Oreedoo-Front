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

  // assigned role (after approval)
  role: Role | null;

  // role requested during registration
  roleRequested?: Role;

  // approval workflow
  status: AccountStatus;

  enabled: boolean;

 
  validatedAt?: string;
  validatedBy?: string;
  rejectionReason?: string;

  createdAt?: string;
}