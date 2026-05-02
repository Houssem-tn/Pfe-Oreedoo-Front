export type DpmStatus =
  | 'PENDING_STT_CONFIRMATION'
  | 'PARTIALLY_CONFIRMED'
  | 'FULLY_CONFIRMED'
  | 'REJECTED'
  | 'CANCELLED';

export type StockMovementType =
  | 'DPM_CREATED'
  | 'DPM_CONFIRMED'
  | 'STT_TO_TECH_DISTRIBUTION';

export interface Equipment {
  id: string;
  name: string;
  description?: string;
  unit?: string;
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
}

export interface SttStockItem {
  equipmentId: string;
  equipmentName: string;
  totalReceived: number;
  totalDistributedToTechs: number;
  availableQuantity: number;
  lastReceivedAt?: string;
  lastDistributedAt?: string;
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
  receivedQuantity: number;
  lastReceivedAt?: string;
}

export interface TechStock {
  id?: string;
  techId: string;
  sttId?: string;
  items: TechStockItem[];
  lastUpdatedAt?: string;
}

export interface DistributionItem {
  equipmentId: string;
  equipmentName: string;
  quantity: number;
}

export interface SttDistribution {
  id: string;
  sttId: string;
  techId: string;
  techName: string;
  techEmail?: string;
  items: DistributionItem[];
  distributedAt: string;
  notes?: string;
  distributedBy?: string;
}

export interface StockMovement {
  id: string;
  movementType: StockMovementType;
  fromActorId?: string;
  fromActorRole?: string;
  toActorId?: string;
  toActorRole?: string;
  equipmentId?: string;
  equipmentName?: string;
  quantity: number;
  referenceId?: string;
  performedAt: string;
  performedBy?: string;
}

// ── Request payloads ──────────────────────────────────────────────────────────

export interface CreateEquipmentRequest {
  name: string;
  description?: string;
  unit?: string;
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

export interface DistributionItemRequest {
  equipmentId: string;
  quantity: number;
}

export interface DistributeToTechRequest {
  techId: string;
  items: DistributionItemRequest[];
  notes?: string;
}
