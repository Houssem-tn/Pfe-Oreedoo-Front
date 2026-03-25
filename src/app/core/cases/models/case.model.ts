export type CaseType = 'ACTIVATION';

export type CaseStatus =
  | 'CREATED'
  | 'ASSIGNED_TO_ZM'
  | 'ASSIGNED_TO_STT'
  | 'ASSIGNED_TO_TECH'
  | 'RDV_SET'
  | 'NOT_REACHABLE'
  | 'ABANDONED'
  | 'WORK_DONE'
  | 'VALIDATED_BY_ZM'
  | 'REJECTED_BY_ZM'
  | 'CLOSED';

export interface CaseResponse {
  id: string;
  type: CaseType;
  status: CaseStatus;
  crmCase: string;
  commentaire?: string | null;
  dateCreationCrm: string;
  openingDateTimos: string;
  clientName: string;
  clientPhone: string;
  msisdn: string;
  latitude?: string | null;
  longitude?: string | null;
  localite: string;
  delegation: string;
  gouvernorat: string;
  siteSecteur?: string | null;
  offre?: string | null;
  desPack?: string | null;
  zmId?: string | null;
  zmEmail?: string | null;
  zmName?: string | null;
  dateAffectationZm?: string | null;
  sttId?: string | null;
  sttName?: string | null;
  sttEmail?: string | null;
  dateAffectationStt?: string | null;
  techId?: string | null;
  techEmail?: string | null;
  techName?: string | null;
  dateAffectationTech?: string | null;
  rdv?: CaseRdv | null;
  work?: CaseWork | null;
  zmValidation?: CaseZmValidation | null;
  metrics?: CaseMetrics | null;
  joignable?: boolean | null;
  datePriseRdv?: string | null;
  causeInjoignabilite?: string | null;
  detail?: string | null;
  cmtRdv?: string | null;
  abandon?: boolean | null;
  causeAbandon?: string | null;
  repTravauxStt?: string | null;
  dateFinTrv?: string | null;
  cmtTrvStt?: string | null;
  metrageCable?: number | null;
  nombrePv?: number | null;
  debitDl?: number | null;
  debitUl?: number | null;
  rsrp?: number | null;
  rsrq?: number | null;
  sinr?: number | null;
  repZm?: string | null;
  commentZm?: string | null;
  createdBy?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface CaseRdv {
  joignable?: boolean | null;
  datePriseRdv?: string | null;
  causeInjoignabilite?: string | null;
  detail?: string | null;
  cmtRdv?: string | null;
  abandon?: boolean | null;
  causeAbandon?: string | null;
}

export interface CaseWork {
  repTravauxStt?: string | null;
  dateFinTrv?: string | null;
  cmtTrvStt?: string | null;
}

export interface CaseMetrics {
  metrageCable?: number | null;
  nombrePv?: number | null;
  debitDl?: number | null;
  debitUl?: number | null;
  rsrp?: number | null;
  rsrq?: number | null;
  sinr?: number | null;
}

export interface CaseZmValidation {
  approved?: boolean | null;
  comment?: string | null;
}

export interface CreateCaseRequest {
  type: CaseType;
  crmCase: string;
  dateCreationCrm: string;
  openingDateTimos: string;
  clientName: string;
  clientPhone: string;
  msisdn: string;
  commentaire?: string;
  latitude: string;
  longitude: string;
  localite: string;
  delegation: string;
  gouvernorat: string;
  siteSecteur: string;
  offre?: string;
  desPack?: string;
}

export type CreateActivationCaseRequest = Omit<CreateCaseRequest, 'type'>;

export interface AssignSttRequest {
  sttId: string;
  sttEmail?: string;
  sttName?: string;
}

export interface AssignZmRequest {
  zmId: string;
  zmEmail?: string;
  zmName?: string;
}

export interface AssignTechRequest {
  techId: string;
  techEmail?: string;
  techName?: string;
}

export interface SetRdvRequest {
  joignable: boolean;
  datePriseRdv: string;
  causeInjoignabilite: string | null;
  detail: string;
  cmtRdv: string;
  abandon: boolean;
  causeAbandon: string | null;
}

export interface CompleteWorkRequest {
  repTravauxStt: string;
  dateFinTrv: string;
  cmtTrvStt: string;
  metrageCable?: number;
  nombrePv?: number;
  debitDl?: number;
  debitUl?: number;
  rsrp?: number;
  rsrq?: number;
  sinr?: number;
}

export interface ValidateZmRequest {
  approved: boolean;
  comment: string;
}

export interface CaseStatusUi {
  label: string;
  badgeClass: string;
}

export const CASE_STATUS_UI: Record<CaseStatus, CaseStatusUi> = {
  CREATED: { label: 'Created', badgeClass: 'bg-secondary-subtle text-secondary-emphasis' },
  ASSIGNED_TO_ZM: { label: 'Assigned to ZM', badgeClass: 'bg-primary-subtle text-primary-emphasis' },
  ASSIGNED_TO_STT: { label: 'Assigned to STT', badgeClass: 'bg-primary-subtle text-primary-emphasis' },
  ASSIGNED_TO_TECH: { label: 'Assigned to TECH', badgeClass: 'bg-primary-subtle text-primary-emphasis' },
  RDV_SET: { label: 'RDV set', badgeClass: 'bg-info-subtle text-info-emphasis' },
  NOT_REACHABLE: { label: 'Not reachable', badgeClass: 'bg-warning-subtle text-warning-emphasis' },
  ABANDONED: { label: 'Abandoned', badgeClass: 'bg-danger-subtle text-danger-emphasis' },
  WORK_DONE: { label: 'Work done', badgeClass: 'bg-success-subtle text-success-emphasis' },
  VALIDATED_BY_ZM: { label: 'Validated by ZM', badgeClass: 'bg-success-subtle text-success-emphasis' },
  REJECTED_BY_ZM: { label: 'Rejected by ZM', badgeClass: 'bg-danger-subtle text-danger-emphasis' },
  CLOSED: { label: 'Closed', badgeClass: 'bg-dark-subtle text-dark-emphasis' }
};
