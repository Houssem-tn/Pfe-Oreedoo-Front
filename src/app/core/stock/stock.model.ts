export type DpmStatus =
  // ── New workflow statuses ────────────────────────────────────────────────────
  | 'WAITING_TEAM_STOCK_APPROVAL'
  | 'TEAM_STOCK_REJECTED'
  | 'RDV_SCHEDULED'
  | 'RDV_CONFIRMED_BY_STT'
  | 'MATERIAL_RECEIVED'
  | 'COMPLETED'
  // ── Legacy statuses ──────────────────────────────────────────────────────────
  | 'PENDING_STT_CONFIRMATION'
  | 'PARTIALLY_CONFIRMED'
  | 'FULLY_CONFIRMED'
  | 'REJECTED'
  | 'CANCELLED';

export type StockUnit = 'METERS' | 'PIECES';

export type StockMovementType =
  | 'DPM_CREATED'
  | 'DPM_CONFIRMED'
  | 'STT_TO_TECH_DISTRIBUTION'
  | 'TECH_RECEIVED_FROM_STT'
  | 'CASE_USAGE'
  | 'MATERIAL_RETURN_SUBMITTED'
  | 'MATERIAL_RETURN_APPROVED'
  | 'MATERIAL_RETURN_REJECTED'
  | 'RETURN_TO_USABLE_STOCK'
  | 'RETURN_TO_DAMAGED_STOCK'
  | 'RETURN_TO_REPAIR'
  | 'RETURN_TO_RECONDITIONING'
  | 'RETURN_TO_CENTRAL_WAREHOUSE'
  | 'RETURN_TO_SCRAP';

export type DistributionStatus =
  | 'PENDING_TECH_CONFIRMATION'
  | 'CONFIRMED_BY_TECH'
  | 'CANCELLED';

export type EquipmentCategory = 'CABLE' | 'BOX' | 'ROUTER' | 'ONT' | 'OTHER';

export interface Equipment {
  id: string;
  name: string;
  articleCode?: string;
  description?: string;
  unit?: StockUnit;
  category?: EquipmentCategory;
  imageFileId?: string;
  imageUrl?: string;
  active: boolean;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface DpmItem {
  equipmentId: string;
  equipmentName: string;
  equipmentImageUrl?: string;
  unit?: string;
  requestedQuantity: number;
  confirmedQuantity?: number;
  shortageQuantity?: number;
  confirmationNote?: string;
}

export interface DpmTimelineEvent {
  eventType: string;
  description: string;
  performedBy?: string;
  performedByRole?: string;
  occurredAt: string;
}

export interface DpmRequest {
  id: string;
  dpmNumber: string;
  zmId: string;
  zmName: string;
  zmEmail: string;
  sttId: string;
  sttName: string;
  sttEmail: string;
  status: DpmStatus;
  items: DpmItem[];
  notes?: string;
  deliveryPersonName: string;
  createdAt: string;
  confirmedAt?: string;
  timeline: DpmTimelineEvent[];

  // External Team Stock approval fields
  externalApprovalReference?: string;
  externalApprovalNote?: string;
  externalApprovalMarkedAt?: string;
  externalApprovalMarkedByZmId?: string;

  // RDV fields
  rdvDate?: string;
  rdvLocation?: string;
  rdvNote?: string;
  rdvScheduledAt?: string;
  rdvScheduledByZmId?: string;

  // Rejection fields
  externalRejectionReason?: string;
  externalRejectedAt?: string;
}

export interface SttStockItem {
  equipmentId: string;
  equipmentName: string;
  unit?: string;
  totalReceived: number;
  totalDistributedToTechs: number;
  totalReturned?: number;
  availableQuantity: number;
  lastReceivedAt?: string;
  lastDistributedAt?: string;
  lastReturnedAt?: string;
}

export interface SttStock {
  id?: string;
  sttId: string;
  items: SttStockItem[];
  lastUpdatedAt?: string;
}

export interface TechStockItem {
  equipmentId: string;
  equipmentName: string;
  unit?: string;
  receivedQuantity: number;
  usedQuantity: number;
  remainingQuantity: number;
  lastReceivedAt?: string;
}

export interface TechStock {
  id?: string;
  techId: string;
  sttId?: string;
  items: TechStockItem[];
  lastUpdatedAt?: string;
}

export interface TechStockUsageItem {
  equipmentId: string;
  equipmentName: string;
  unit?: string;
  quantity: number;
}

export interface TechStockUsage {
  id: string;
  techId: string;
  caseId: string;
  caseReference: string;
  items: TechStockUsageItem[];
  declaredAt: string;
  notes?: string;
}

export interface DistributionItem {
  equipmentId: string;
  equipmentName: string;
  unit?: string;
  quantity: number;
}

export interface SttDistribution {
  id: string;
  sttId: string;
  sttName?: string;
  sttEmail?: string;
  techId: string;
  techName: string;
  techEmail?: string;
  dpmId?: string;
  items: DistributionItem[];
  status?: DistributionStatus;
  distributedAt: string;
  confirmedAt?: string;
  confirmedBy?: string;
  notes?: string;
  distributedBy?: string;
}

export interface PendingDistribution {
  id: string;
  sttId: string;
  sttName?: string;
  sttEmail?: string;
  techId: string;
  techName: string;
  dpmId?: string;
  items: DistributionItem[];
  status: DistributionStatus;
  distributedAt: string;
  notes?: string;
}

export interface DpmTracking {
  dpm: DpmRequest;
  techDistributions: SttDistribution[];
}

export interface ZmDpmAuditItem {
  dpm: DpmRequest;
  distributions: SttDistribution[];
  partiallyConfirmed: boolean;
  overDistributed: boolean;
}

export interface ZmStockAudit {
  zmId: string;
  zmName: string;
  zmEmail: string;
  totalDpms: number;
  pendingCount: number;
  confirmedCount: number;
  rejectedCount: number;
  cancelledCount: number;
  warningCount: number;
  dpms: ZmDpmAuditItem[];
}

export interface DistributableDpmItem {
  equipmentId: string;
  equipmentName: string;
  unit?: string;
  confirmedQuantity: number;
  distributedQuantity: number;
  remainingQuantity: number;
}

export interface DistributableDpm {
  id: string;
  dpmNumber: string;
  zmName: string;
  status: DpmStatus;
  createdAt: string;
  confirmedAt?: string;
  items: DistributableDpmItem[];
}

export interface StockMovement {
  id: string;
  movementType: StockMovementType;
  fromActorId?: string;
  fromActorRole?: string;
  toActorId?: string;
  toActorRole?: string;
  technicianId?: string;
  caseId?: string;
  equipmentId?: string;
  equipmentName?: string;
  quantity: number;
  referenceId?: string;
  comment?: string;
  createdAt?: string;
  createdBy?: string;
  performedAt: string;
  performedBy?: string;
}

// ── Case Stock Consumption Audit ─────────────────────────────────────────────

export type CaseType = 'ACTIVATION' | 'PLAINTE';

export interface ConsumedEquipmentItem {
  equipmentId: string;
  equipmentName?: string | null;
  unit?: string | null;
  quantityUsed: number;
  stockBefore: number;
  stockAfter: number;
}

export interface CaseConsumption {
  id: string;
  caseId: string;
  crmCase?: string | null;
  caseType?: CaseType | null;
  technicianId?: string | null;
  technicianName?: string | null;
  sttId?: string | null;
  sttName?: string | null;
  zmId?: string | null;
  zmName?: string | null;
  consumedItems: ConsumedEquipmentItem[];
  totalQuantityUsed: number;
  totalItemTypes: number;
  consumedAt?: string | null;
  notes?: string | null;
}

export interface CaseConsumptionSummary {
  totalConsumptions: number;
  totalItemTypes: number;
  totalQuantityConsumed: number;
  cableTotalMeters: number;
  totalBoxesUsed: number;
  topTechnicianId?: string | null;
  topTechnicianName?: string | null;
  topTechnicianConsumptions: number;
  casesWithoutStockDeclaration: number;
}

export interface CaseConsumptionFilters {
  caseType?: string;
  crmCase?: string;
  zmId?: string;
  sttId?: string;
  technicianId?: string;
  equipmentId?: string;
  from?: string;
  to?: string;
}

// ── Case Usage Limits (TECH proactive detection) ──────────────────────────────

export interface CaseLimitItem {
  itemId: string;
  itemName: string;
  unit?: string;
  caseUsageLimit: number;
  caseUsageLimitEnabled: boolean;
}

// ── Stock Thresholds ─────────────────────────────────────────────────────────

export interface StockThreshold {
  id: string;
  zmId: string;
  zmName: string;
  itemId: string;
  itemName: string;
  itemType?: 'EQUIPMENT' | 'CABLE';
  /** @deprecated Use sttWarningThreshold / techWarningThreshold */
  warningThreshold: number;
  /** @deprecated Use sttCriticalThreshold / techCriticalThreshold */
  criticalThreshold: number;
  unit?: 'PIECE' | 'METER';
  enabled: boolean;
  // STT-specific thresholds
  sttWarningThreshold?: number;
  sttCriticalThreshold?: number;
  sttAlertsEnabled?: boolean;
  // TECH-specific thresholds
  techWarningThreshold?: number;
  techCriticalThreshold?: number;
  techAlertsEnabled?: boolean;
  caseUsageLimit?: number;
  caseUsageLimitEnabled?: boolean;
  createdAt?: string;
  updatedAt?: string;
  updatedBy?: string;
}

export interface StockThresholdRequest {
  itemId: string;
  itemName: string;
  itemType?: string;
  unit?: string;
  enabled: boolean;
  /** @deprecated Use sttWarningThreshold / techWarningThreshold */
  warningThreshold?: number;
  /** @deprecated Use sttCriticalThreshold / techCriticalThreshold */
  criticalThreshold?: number;
  // STT-specific thresholds
  sttWarningThreshold?: number;
  sttCriticalThreshold?: number;
  sttAlertsEnabled?: boolean;
  // TECH-specific thresholds
  techWarningThreshold?: number;
  techCriticalThreshold?: number;
  techAlertsEnabled?: boolean;
  caseUsageLimit?: number;
  caseUsageLimitEnabled?: boolean;
}

// ── Stock Usage Permissions ──────────────────────────────────────────────────

export interface PermissionItemDetail {
  itemId: string;
  itemName: string;
  requestedQuantity: number;
  approvedQuantity: number;
  unit?: string;
}

export type PermissionStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'PARTIALLY_APPROVED'
  | 'REJECTED'
  | 'CANCELLED';

export interface StockUsagePermission {
  id: string;
  caseId: string;
  caseReference?: string;
  techId: string;
  techName: string;
  sttId: string;
  sttName: string;
  zmId?: string;
  zmName?: string;
  status: PermissionStatus;
  reason?: string;
  requestedCableMeters: number;
  approvedCableMeters: number;
  requestedItems?: PermissionItemDetail[];
  approvedItems?: PermissionItemDetail[];
  createdAt: string;
  reviewedAt?: string;
  reviewedBySttId?: string;
  reviewComment?: string;
}

export interface CreatePermissionRequest {
  caseId: string;
  reason?: string;
  requestedCableMeters: number;
  requestedItems?: { itemId: string; itemName: string; requestedQuantity: number; unit?: string }[];
}

export interface ReviewPermissionRequest {
  approvedCableMeters: number;
  approvedItems?: { itemId: string; approvedQuantity: number }[];
  reviewComment?: string;
}

export interface RejectPermissionRequest {
  reviewComment: string;
}

// ── Request payloads ──────────────────────────────────────────────────────────

export interface CreateEquipmentRequest {
  name: string;
  articleCode?: string;
  description?: string;
  unit?: StockUnit;
  category?: EquipmentCategory;
}

export interface DpmItemRequest {
  equipmentId: string;
  requestedQuantity: number;
}

export interface CreateDpmRequest {
  sttId: string;
  deliveryPersonName: string;
  items: DpmItemRequest[];
  notes?: string;
}

export interface DpmItemConfirmation {
  equipmentId: string;
  confirmedQuantity: number;
  confirmationNote?: string;
}

export interface ConfirmDpmRequest {
  items: DpmItemConfirmation[];
  rejectReason?: string;
}

export interface RecordExternalApprovalRequest {
  approvalReference?: string;
  approvalNote?: string;
  rdvDate: string;
  rdvLocation: string;
  rdvNote?: string;
}

export interface ExternalRejectionRequest {
  rejectionReason?: string;
}

export interface DistributionItemRequest {
  equipmentId: string;
  quantity: number;
}

export interface DistributeToTechRequest {
  techId: string;
  dpmId?: string;
  items: DistributionItemRequest[];
  notes?: string;
}

export interface DeclareTechUsageItemRequest {
  equipmentId: string;
  equipmentName?: string;
  unit?: string;
  quantity: number;
}

export interface DeclareTechUsageRequest {
  caseId: string;
  items: DeclareTechUsageItemRequest[];
  notes?: string;
}

export interface DeclareTechUsageResponse {
  stock: TechStock;
  usage: TechStockUsage;
  hasWarnings: boolean;
  warnings: string[];
}
