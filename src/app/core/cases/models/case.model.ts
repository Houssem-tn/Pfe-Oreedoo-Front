export type CaseType = 'ACTIVATION' | 'PLAINTE';

export type ExecutorRole = 'STT' | 'TECH';

export type ExecutionMode = 'STT_SELF_EXECUTION' | 'TECH_EXECUTION';

export type CaseStatus =
  | 'CREATED'
  | 'ASSIGNED_TO_ZM'
  | 'ASSIGNED_TO_STT'
  | 'ASSIGNED_TO_TECH'
  | 'RDV_SET'
  | 'DIAGNOSIS_STEP'
  | 'ESCALATED'
  | 'RESOLUTION_SUBMITTED'
  | 'RETURNED_TO_STT'
  | 'REOPENED'
  | 'NOT_REACHABLE'
  | 'ABANDONED'
  | 'WORK_DONE'
  | 'VALIDATED_BY_ZM'
  | 'REJECTED_BY_ZM'
  | 'CLOSED';

export type ComplaintCategory =
  | 'NETWORK_COVERAGE'
  | 'SERVICE_QUALITY'
  | 'INSTALLATION'
  | 'EQUIPMENT'
  | 'BILLING'
  | 'ACTIVATION_FOLLOW_UP'
  | 'CUSTOMER_EDUCATION'
  | 'OTHER';

export type ResolutionValidationStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'RETURNED_TO_STT'
  | 'REJECTED'
  | 'REOPENED';

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
  contactCl2?: string | null;
  msisdn: string;
  latitude?: string | null;
  longitude?: string | null;
  localite: string;
  delegation: string;
  gouvernorat: string;
  ownerZmId?: string | null;
  ownerZmName?: string | null;
  assignedSttId?: string | null;
  siteSecteur?: string | null;
  offre?: string | null;
  desPack?: string | null;
  typeOffreSpeed?: string | null;
  typeClient?: string | null;
  source?: string | null;
  /** PLT/RES discriminator for cases created from field-work imports (type=PLAINTE). */
  caseModule?: string | null;
  complaintDetail?: string | null;
  complaintDescription?: string | null;
  openDateActivation?: string | null;
  zmId?: string | null;
  zmEmail?: string | null;
  zmName?: string | null;
  dateAffectationZm?: string | null;
  sttId?: string | null;
  sttName?: string | null;
  sttEmail?: string | null;
  dateAffectationStt?: string | null;
  executorId?: string | null;
  executorRole?: ExecutorRole | null;
  executionMode?: ExecutionMode | null;
  techId?: string | null;
  techEmail?: string | null;
  techName?: string | null;
  dateAffectationTech?: string | null;
  rdv?: CaseRdv | null;
  diagnosis?: CaseDiagnosis | null;
  work?: CaseWork | null;
  resolution?: CaseResolution | null;
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
  completedCasesCount: number;
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
  usedEquipment?: CaseUsedEquipmentItem[] | null;
  stockAppliedTechId?: string | null;
  /** RES only: material retrieved from the client (recovered, not consumed from stock). */
  recoveredEquipment?: CaseRecoveredEquipmentItem[] | null;
  recoveredAt?: string | null;
  recoveredBy?: string | null;
}

export interface CaseUsedEquipmentItem {
  equipmentId: string;
  equipmentName?: string | null;
  unit?: string | null;
  quantity: number;
  /** Exact tracked-unit ids consumed (tracked equipment only; size === quantity). */
  instanceIds?: string[];
}

export interface CaseRecoveredEquipmentItem {
  equipmentId: string;
  equipmentName?: string | null;
  articleCode?: string | null;
  unit?: string | null;
  quantity: number;
  serialNumber?: string | null;
  macAddress?: string | null;
  imei?: string | null;
  condition?: string | null;
  /** Legacy material-return code (older RES-only path only). */
  returnCode?: string | null;
  /** Linked tracked-unit id when this recovered unit is an EquipmentInstance. */
  instanceId?: string | null;
  /** RETRIEVED / DAMAGED / MISSING / NOT_FOUND / ALREADY_RETURNED — plain string, see
   * RecoveredEquipmentRequestItem's own note on why this isn't a shared enum type. */
  disposition?: string | null;
  dispositionNote?: string | null;
  /** Linked RetrievedStockItem id — present only for physically-held dispositions. */
  retrievedStockItemId?: string | null;
}

/**
 * `condition`/`disposition` stay plain strings (not imported from `retrieved-stock.model`'s
 * `RecoveryDisposition`/`ReturnCondition` types) to mirror the backend DTO's own choice of keeping
 * `case_management` decoupled from `stock_management.retrieved_stock` — this model is shared by
 * both the Complaint and Résiliation retrieval flows regardless of which stock subsystem consumes it.
 */
export interface RecoveredEquipmentRequestItem {
  equipmentId: string;
  equipmentName?: string;
  unit?: string;
  quantity: number;
  serialNumber?: string;
  macAddress?: string;
  imei?: string;
  condition?: string;
  /** RETRIEVED (default) / DAMAGED / MISSING / NOT_FOUND / ALREADY_RETURNED. */
  disposition?: string;
  dispositionNote?: string;
}

export interface DeclareClientRecoveryRequest {
  items: RecoveredEquipmentRequestItem[];
  comment?: string;
}

export interface CaseDiagnosis {
  complaintCategory?: ComplaintCategory | null;
  rootCause?: string | null;
  diagnosisComment?: string | null;
  requiresFieldWork?: boolean | null;
  requiresTechIntervention?: boolean | null;
  requiresEscalation?: boolean | null;
  diagnosedAt?: string | null;
  diagnosedBy?: string | null;
}

export interface CaseResolution {
  resolutionType?: string | null;
  resolutionComment?: string | null;
  validationStatus?: ResolutionValidationStatus | null;
  submittedAt?: string | null;
  submittedBy?: string | null;
  validatedAt?: string | null;
  validatedBy?: string | null;
  reopenedAt?: string | null;
  reopenedBy?: string | null;
}

export interface CaseMetrics {
  metrageCable?: number | null;
  nombrePv?: number | null;
  debitDl?: number | null;
  debitUl?: number | null;
  rsrp?: number | null;
  rsrq?: number | null;
  sinr?: number | null;
  modemModel?: string | null;
  macAddress?: string | null;
  serialNumber?: string | null;
  imei?: string | null;
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

export interface EquipmentItemProofPayload {
  modemModel?: string;
  macAddress: string;
  serialNumber: string;
  imei?: string;
  latitude: number;
  longitude: number;
  gpsAccuracy?: number;
  capturedAt?: string;
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
  equipmentProofs?: EquipmentItemProofPayload[];
  locationLatitude?: number;
  locationLongitude?: number;
  locationCapturedAt?: string;
  locationAccuracyMeters?: number;
  usedEquipment?: CaseUsedEquipmentItem[];
}

export interface ValidateZmRequest {
  approved: boolean;
  comment: string;
}

export interface ComplaintDiagnosisRequest {
  complaintCategory: ComplaintCategory;
  rootCause?: string | null;
  diagnosisComment?: string | null;
  requiresFieldWork: boolean;
  requiresTechIntervention: boolean;
  requiresEscalation: boolean;
}

export interface ReopenComplaintRequest {
  comment?: string | null;
}

export interface ComplaintImportResponse {
  sourceFileName: string;
  totalRows: number;
  createdCases: number;
  updatedCases: number;
  skippedRows: number;
  warnings: string[];
}

export interface CaseStatusUi {
  label: string;
  badgeClass: string;
}

/**
 * `label` holds a translation KEY (statuses.case.*), not display text — pass it
 * through TranslocoService.translate() / the `transloco` pipe at render time.
 */
export const CASE_STATUS_UI: Record<CaseStatus, CaseStatusUi> = {
  CREATED: { label: 'statuses.case.created', badgeClass: 'bg-secondary-subtle text-secondary-emphasis' },
  ASSIGNED_TO_ZM: { label: 'statuses.case.assignedToZm', badgeClass: 'bg-primary-subtle text-primary-emphasis' },
  ASSIGNED_TO_STT: { label: 'statuses.case.assignedToStt', badgeClass: 'bg-primary-subtle text-primary-emphasis' },
  ASSIGNED_TO_TECH: { label: 'statuses.case.assignedToTech', badgeClass: 'bg-primary-subtle text-primary-emphasis' },
  RDV_SET: { label: 'statuses.case.rdvSet', badgeClass: 'bg-info-subtle text-info-emphasis' },
  DIAGNOSIS_STEP: { label: 'statuses.case.diagnosisStep', badgeClass: 'bg-info-subtle text-info-emphasis' },
  ESCALATED: { label: 'statuses.case.escalated', badgeClass: 'bg-danger-subtle text-danger-emphasis' },
  RESOLUTION_SUBMITTED: { label: 'statuses.case.resolutionSubmitted', badgeClass: 'bg-success-subtle text-success-emphasis' },
  RETURNED_TO_STT: { label: 'statuses.case.returnedToStt', badgeClass: 'bg-warning-subtle text-warning-emphasis' },
  REOPENED: { label: 'statuses.case.reopened', badgeClass: 'bg-warning-subtle text-warning-emphasis' },
  NOT_REACHABLE: { label: 'statuses.case.notReachable', badgeClass: 'bg-warning-subtle text-warning-emphasis' },
  ABANDONED: { label: 'statuses.case.abandoned', badgeClass: 'bg-danger-subtle text-danger-emphasis' },
  WORK_DONE: { label: 'statuses.case.workDone', badgeClass: 'bg-success-subtle text-success-emphasis' },
  VALIDATED_BY_ZM: { label: 'statuses.case.validatedByZm', badgeClass: 'bg-success-subtle text-success-emphasis' },
  REJECTED_BY_ZM: { label: 'statuses.case.rejectedByZm', badgeClass: 'bg-danger-subtle text-danger-emphasis' },
  CLOSED: { label: 'statuses.case.closed', badgeClass: 'bg-dark-subtle text-dark-emphasis' }
};

/**
 * True when a case is a Résiliation. RES is stored as a PLAINTE case discriminated by its
 * module/import source (there is no dedicated CaseType). Metrics never apply to RES.
 */
export function isResiliationCase(
  item: Pick<CaseResponse, 'type' | 'caseModule' | 'source'> | null | undefined
): boolean {
  if (!item || item.type !== 'PLAINTE') {
    return false;
  }
  return (item.caseModule ?? '').toUpperCase() === 'RES' || item.source === 'RES_TODO_IMPORT';
}

/**
 * Technical metrics apply to Activation and Complaint (PLAINTE non-RES) — never to Résiliation.
 * Use this to gate the metrics section consistently across every case-detail view.
 */
export function caseSupportsMetrics(
  item: Pick<CaseResponse, 'type' | 'caseModule' | 'source'> | null | undefined
): boolean {
  if (!item) {
    return false;
  }
  return item.type === 'ACTIVATION' || (item.type === 'PLAINTE' && !isResiliationCase(item));
}
