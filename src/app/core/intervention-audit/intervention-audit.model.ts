export type InterventionModule = 'ACT' | 'PLT' | 'RES';

export interface ConsumedMaterial {
  equipmentId?: string;
  equipmentName?: string;
  articleCode?: string;
  category?: string;
  quantity: number;
  unit?: string;
  consumedAt?: string;
  consumedByTechName?: string;
  stockBefore?: number;
  stockAfter?: number;
}

export interface MaterialReturnRef {
  id?: string;
  returnCode?: string;
  status?: string;
  reason?: string;
}

export interface InterventionAuditEvent {
  id?: string;
  caseId?: string;
  caseReference?: string;
  eventType?: string;
  category?: string;
  title?: string;
  description?: string;

  actorName?: string;
  actorRole?: string;
  actorEmail?: string;

  targetName?: string;
  targetRole?: string;
  targetEmail?: string;

  previousStatus?: string;
  newStatus?: string;

  occurredAt?: string;

  latitude?: string;
  longitude?: string;
  gpsCapturedAt?: string;
  gpsAccuracyMeters?: number;

  proofFileId?: string;
  proofFilename?: string;

  slaStatus?: string;
  breachAgeMinutes?: number;
}

export interface InterventionAudit {
  auditId?: string;
  caseId?: string;
  caseReference?: string;
  module?: string;
  caseType?: string;
  currentStatus?: string;

  // last action summary
  eventType?: string;
  statusBefore?: string;
  statusAfter?: string;
  actorId?: string;
  actorName?: string;
  actorRole?: string;
  lastActionTitle?: string;
  lastActionAt?: string;

  // assignment chain
  zmId?: string;
  zmName?: string;
  sttId?: string;
  sttName?: string;
  technicianId?: string;
  technicianName?: string;

  // location / customer
  governorate?: string;
  delegation?: string;
  localite?: string;
  customerName?: string;
  customerPhone?: string;

  // timings
  createdAt?: string;
  assignedAt?: string;
  assignedZmAt?: string;
  assignedSttAt?: string;
  assignedTechAt?: string;
  rdvAt?: string;
  startedAt?: string;
  completedAt?: string;
  validatedAt?: string;
  closedAt?: string;

  // sla
  slaStatus?: string;
  slaCategory?: string;
  slaDeadline?: string;
  escalationLevel?: number;

  // proof / gps
  proofPresent?: boolean;
  proofCount?: number;
  proofFileId?: string;
  proofFileName?: string;
  gpsLatitude?: number;
  gpsLongitude?: number;
  gpsAccuracy?: number;

  // materials
  consumedMaterials: ConsumedMaterial[];
  materialCount?: number;
  totalMaterialQuantity?: number;

  // related returns (cross-link only)
  relatedReturns: MaterialReturnRef[];

  // full timeline
  timeline: InterventionAuditEvent[];

  notes?: string;
}

export interface InterventionAuditPage {
  content: InterventionAudit[];
  totalElements: number;
  totalPages: number;
  page: number;
  size: number;
}

export interface InterventionAuditSummary {
  totalInterventions: number;
  completedToday: number;
  slaBreached: number;
  pendingValidation: number;
  proofMissing: number;
  materialsConsumed: number;
}

export interface InterventionAuditFilters {
  search?: string;
  module?: string;
  status?: string;
  eventType?: string;
  slaStatus?: string;
  proofStatus?: string;
  governorate?: string;
  technician?: string;
  from?: string;
  to?: string;
  sort?: string;
  page?: number;
  size?: number;
}
