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

export type SlaStatus =
  | 'ON_TRACK'
  | 'WARNING'
  | 'BREACHED'
  | 'COMPLETED_ON_TIME'
  | 'COMPLETED_LATE';

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
  slaTracking?: CaseSlaTracking | null;
  timeline?: CaseTimelineEvent[] | null;
  workProofs?: CaseProofFile[] | null;
}

export interface CaseSlaTracking {
  startedAt?: string | null;
  deadlineAt?: string | null;
  rdvSetAt?: string | null;
  warningTriggeredAt?: string | null;
  breachedAt?: string | null;
  escalationTriggeredAt?: string | null;
  status?: SlaStatus | null;
  progressPercent?: number | null;
  warningThresholdPercent?: number | null;
  remainingSeconds?: number | null;
  responseDurationSeconds?: number | null;
  warningNotificationSent?: boolean;
  breachNotificationSent?: boolean;
  escalationNotificationSent?: boolean;
}

export interface PerformanceSummaryResponse {
  userId?: string | null;
  userName?: string | null;
  userEmail?: string | null;
  role: string;
  assignedCases: number;
  rdvOnTime: number;
  rdvLate: number;
  rdvOnTimeRate: number;
  slaWarningCount: number;
  slaBreachCount: number;
  slaEscalationCount: number;
  averageResponseMinutes: number;
  averageOverdueMinutes: number;
  workCompletionProgress: number;
  activeTasksCount: number;
}

export interface CaseTimelineEvent {
  id: string;
  occurredAt: string;
  eventType: string;
  title?: string | null;
  details?: string | null;
  actor?: string | null;
  previousStatus?: CaseStatus | null;
  newStatus?: CaseStatus | null;
  data?: Record<string, unknown>;
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
  locationLatitude?: number | null;
  locationLongitude?: number | null;
  locationCapturedAt?: string | null;
  locationAccuracyMeters?: number | null;
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

export interface CaseProofFile {
  fileId: string;
  originalFilename?: string | null;
  contentType?: string | null;
  size?: number | null;
  uploadedBy?: string | null;
  createdAt?: string | null;
  viewUrl?: string | null;
  downloadUrl?: string | null;
  locationLatitude?: number | null;
  locationLongitude?: number | null;
  locationCapturedAt?: string | null;
  locationAccuracyMeters?: number | null;
  captureSource?: string | null;
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
  locationLatitude?: number;
  locationLongitude?: number;
  locationCapturedAt?: string;
  locationAccuracyMeters?: number;
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
