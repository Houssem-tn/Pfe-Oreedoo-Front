import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../http/api.config';
import {
  CaseConsumption,
  CaseConsumptionFilters,
  CaseConsumptionSummary,
  CaseLimitItem,
  CreatePermissionRequest,
  DeclareTechUsageRequest,
  DeclareTechUsageResponse,
  ConfirmDpmRequest,
  CreateDpmRequest,
  CreateEquipmentRequest,
  DistributableDpm,
  DistributeToTechRequest,
  DpmRequest,
  DpmTracking,
  Equipment,
  ExternalRejectionRequest,
  PendingDistribution,
  RecordExternalApprovalRequest,
  RejectPermissionRequest,
  ReviewPermissionRequest,
  StockAuditEntry,
  StockAuditType,
  StockMovement,
  StockThreshold,
  StockThresholdRequest,
  StockUsagePermission,
  SttDistribution,
  SttStock,
  TeamDistribution,
  TeamDistributionFilters,
  TechStock,
  TechStockUsage,
  ZmStockAudit
} from './stock.model';

@Injectable({ providedIn: 'root' })
export class StockService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);
  private readonly url = `${this.baseUrl}/api/v1/stock`;

  // ── Equipment ─────────────────────────────────────────────────────────────

  getEquipment(): Observable<Equipment[]> {
    return this.http.get<Equipment[]>(`${this.url}/equipment`);
  }

  getEquipmentById(id: string): Observable<Equipment> {
    return this.http.get<Equipment>(`${this.url}/equipment/${id}`);
  }

  createEquipment(data: CreateEquipmentRequest, image?: File): Observable<Equipment> {
    const form = new FormData();
    form.append('data', new Blob([JSON.stringify(data)], { type: 'application/json' }));
    if (image) form.append('image', image, image.name);
    return this.http.post<Equipment>(`${this.url}/equipment`, form);
  }

  updateEquipment(id: string, data: CreateEquipmentRequest, image?: File): Observable<Equipment> {
    const form = new FormData();
    form.append('data', new Blob([JSON.stringify(data)], { type: 'application/json' }));
    if (image) form.append('image', image, image.name);
    return this.http.put<Equipment>(`${this.url}/equipment/${id}`, form);
  }

  deactivateEquipment(id: string): Observable<void> {
    return this.http.delete<void>(`${this.url}/equipment/${id}`);
  }

  // ── DPM (ZM actions) ──────────────────────────────────────────────────────

  createDpm(payload: CreateDpmRequest): Observable<DpmRequest> {
    return this.http.post<DpmRequest>(`${this.url}/dpms`, payload);
  }

  getDpmById(id: string): Observable<DpmRequest> {
    return this.http.get<DpmRequest>(`${this.url}/dpms/${id}`);
  }

  cancelDpm(id: string): Observable<DpmRequest> {
    return this.http.post<DpmRequest>(`${this.url}/dpms/${id}/cancel`, {});
  }

  confirmDpm(id: string, payload: ConfirmDpmRequest): Observable<DpmRequest> {
    return this.http.post<DpmRequest>(`${this.url}/dpms/${id}/confirm`, payload);
  }

  recordExternalApprovalAndRdv(id: string, payload: RecordExternalApprovalRequest): Observable<DpmRequest> {
    return this.http.patch<DpmRequest>(`${this.url}/dpms/${id}/external-approval-and-rdv`, payload);
  }

  recordExternalRejection(id: string, payload: ExternalRejectionRequest): Observable<DpmRequest> {
    return this.http.patch<DpmRequest>(`${this.url}/dpms/${id}/external-rejection`, payload);
  }

  confirmRdv(id: string): Observable<DpmRequest> {
    return this.http.post<DpmRequest>(`${this.url}/dpms/${id}/confirm-rdv`, {});
  }

  // ── ZM scoped ─────────────────────────────────────────────────────────────

  getMyDpms(): Observable<DpmRequest[]> {
    return this.http.get<DpmRequest[]>(`${this.url}/zm/my-dpms`);
  }

  zmGetDpmTracking(id: string): Observable<DpmTracking> {
    return this.http.get<DpmTracking>(`${this.url}/zm/my-dpms/${id}/tracking`);
  }

  zmGetMySttsStocks(): Observable<SttStock[]> {
    return this.http.get<SttStock[]>(`${this.url}/zm/my-stts-stocks`);
  }

  zmGetMyTechsStocks(): Observable<TechStock[]> {
    return this.http.get<TechStock[]>(`${this.url}/zm/my-techs-stocks`);
  }

  // ── STT scoped ────────────────────────────────────────────────────────────

  getIncomingDpms(): Observable<DpmRequest[]> {
    return this.http.get<DpmRequest[]>(`${this.url}/stt/incoming-dpms`);
  }

  getAllDpmsForStt(): Observable<DpmRequest[]> {
    return this.http.get<DpmRequest[]>(`${this.url}/stt/all-dpms`);
  }

  getMySttStock(): Observable<SttStock> {
    return this.http.get<SttStock>(`${this.url}/stt/my-stock`);
  }

  getSttSelfStock(): Observable<TechStock> {
    return this.http.get<TechStock>(`${this.url}/stt/my-self-stock`);
  }

  distributeToTech(payload: DistributeToTechRequest): Observable<SttDistribution> {
    return this.http.post<SttDistribution>(`${this.url}/stt/distribute`, payload);
  }

  getMyDistributions(): Observable<SttDistribution[]> {
    return this.http.get<SttDistribution[]>(`${this.url}/stt/distributions`);
  }

  getMyTechsStocks(): Observable<TechStock[]> {
    return this.http.get<TechStock[]>(`${this.url}/stt/tech-stocks`);
  }

  getDistributableDpms(): Observable<DistributableDpm[]> {
    return this.http.get<DistributableDpm[]>(`${this.url}/stt/distributable-dpms`);
  }

  // ── TECH scoped ───────────────────────────────────────────────────────────

  getMyTechStock(): Observable<TechStock> {
    return this.http.get<TechStock>(`${this.url}/tech/my-stock`);
  }

  declareMyTechUsage(payload: DeclareTechUsageRequest): Observable<DeclareTechUsageResponse> {
    return this.http.post<DeclareTechUsageResponse>(`${this.url}/tech/usage`, payload);
  }

  getMyPendingConfirmations(): Observable<PendingDistribution[]> {
    return this.http.get<PendingDistribution[]>(`${this.url}/tech/pending-confirmations`);
  }

  getPendingConfirmationById(id: string): Observable<PendingDistribution> {
    return this.http.get<PendingDistribution>(`${this.url}/tech/pending-confirmations/${id}`);
  }

  confirmStockReception(id: string): Observable<void> {
    return this.http.post<void>(`${this.url}/tech/pending-confirmations/${id}/confirm`, {});
  }

  // ── Admin scoped ──────────────────────────────────────────────────────────

  adminGetAllDpms(): Observable<DpmRequest[]> {
    return this.http.get<DpmRequest[]>(`${this.url}/admin/dpms`);
  }

  adminGetDpmTracking(id: string): Observable<DpmTracking> {
    return this.http.get<DpmTracking>(`${this.url}/admin/dpms/${id}/tracking`);
  }

  adminGetAllSttStocks(): Observable<SttStock[]> {
    return this.http.get<SttStock[]>(`${this.url}/admin/stt-stocks`);
  }

  adminGetAllTechStocks(): Observable<TechStock[]> {
    return this.http.get<TechStock[]>(`${this.url}/admin/tech-stocks`);
  }

  adminGetAllTechUsages(): Observable<TechStockUsage[]> {
    return this.http.get<TechStockUsage[]>(`${this.url}/admin/tech-usages`);
  }

  adminGetAllMovements(): Observable<StockMovement[]> {
    return this.http.get<StockMovement[]>(`${this.url}/admin/movements`);
  }

  adminGetMovementsByReference(referenceId: string): Observable<StockMovement[]> {
    return this.http.get<StockMovement[]>(`${this.url}/admin/movements/reference/${referenceId}`);
  }

  adminGetAllDistributions(): Observable<SttDistribution[]> {
    return this.http.get<SttDistribution[]>(`${this.url}/admin/distributions`);
  }

  adminGetZmStockAudit(zmId: string): Observable<ZmStockAudit> {
    return this.http.get<ZmStockAudit>(`${this.url}/admin/audit/zm/${zmId}`);
  }

  // ── Team Distribution Tracking (DPM-source-independent) ────────────────────

  /** Admin: all STT→TECH distributions across every team, including null-DPM pooled ones. */
  adminGetTeamDistributions(filters: TeamDistributionFilters = {}): Observable<TeamDistribution[]> {
    return this.http.get<TeamDistribution[]>(`${this.url}/admin/team-distributions`, {
      params: this.teamDistributionParams(filters)
    });
  }

  /** ZM: STT→TECH distributions scoped to the ZM's responsible STTs. */
  zmGetTeamDistributions(filters: TeamDistributionFilters = {}): Observable<TeamDistribution[]> {
    return this.http.get<TeamDistribution[]>(`${this.url}/zm/team-distributions`, {
      params: this.teamDistributionParams(filters)
    });
  }

  private teamDistributionParams(filters: TeamDistributionFilters): Record<string, string> {
    const params: Record<string, string> = {};
    if (filters.zmId)        params['zmId']        = filters.zmId;
    if (filters.sttId)       params['sttId']       = filters.sttId;
    if (filters.techId)      params['techId']      = filters.techId;
    if (filters.equipmentId) params['equipmentId'] = filters.equipmentId;
    if (filters.from)        params['from']        = filters.from;
    if (filters.to)          params['to']          = filters.to;
    if (filters.status)      params['status']      = filters.status;
    return params;
  }

  zmGetMyTechsUsages(): Observable<TechStockUsage[]> {
    return this.http.get<TechStockUsage[]>(`${this.url}/zm/my-techs-usages`);
  }

  /** All DPMs received by STTs under this ZM's responsibility (any creator ZM). */
  zmGetMySttsDpms(): Observable<DpmRequest[]> {
    return this.http.get<DpmRequest[]>(`${this.url}/zm/my-stts-dpms`);
  }

  // ── Case Stock Consumption Audit ──────────────────────────────────────────

  getCaseConsumptions(filters: CaseConsumptionFilters = {}): Observable<CaseConsumption[]> {
    const params: Record<string, string> = {};
    if (filters.caseType)     params['caseType']     = filters.caseType;
    if (filters.crmCase)      params['crmCase']       = filters.crmCase;
    if (filters.zmId)         params['zmId']          = filters.zmId;
    if (filters.sttId)        params['sttId']         = filters.sttId;
    if (filters.technicianId) params['technicianId']  = filters.technicianId;
    if (filters.equipmentId)  params['equipmentId']   = filters.equipmentId;
    if (filters.from)         params['from']          = filters.from;
    if (filters.to)           params['to']            = filters.to;
    return this.http.get<CaseConsumption[]>(`${this.baseUrl}/api/v1/stock-audit/case-consumptions`, { params });
  }

  getCaseConsumptionById(id: string): Observable<CaseConsumption> {
    return this.http.get<CaseConsumption>(`${this.baseUrl}/api/v1/stock-audit/case-consumptions/${id}`);
  }

  getCaseConsumptionByCaseId(caseId: string): Observable<CaseConsumption> {
    return this.http.get<CaseConsumption>(`${this.baseUrl}/api/v1/stock-audit/case-consumptions/by-case/${caseId}`);
  }

  getCaseConsumptionSummary(): Observable<CaseConsumptionSummary> {
    return this.http.get<CaseConsumptionSummary>(`${this.baseUrl}/api/v1/stock-audit/summary`);
  }

  /** Unified Admin audit feed: DPM requests + material returns, newest first. */
  adminGetStockAuditEntries(type: StockAuditType | 'ALL' = 'ALL'): Observable<StockAuditEntry[]> {
    return this.http.get<StockAuditEntry[]>(`${this.baseUrl}/api/v1/stock-audit/entries`, {
      params: { type }
    });
  }

  // ── Stock Thresholds (ZM) ──────────────────────────────────────────────────

  getMyThresholds(): Observable<StockThreshold[]> {
    return this.http.get<StockThreshold[]>(`${this.baseUrl}/api/v1/stock-thresholds/my`);
  }

  upsertThreshold(payload: StockThresholdRequest): Observable<StockThreshold> {
    return this.http.post<StockThreshold>(`${this.baseUrl}/api/v1/stock-thresholds`, payload);
  }

  updateThreshold(id: string, payload: StockThresholdRequest): Observable<StockThreshold> {
    return this.http.put<StockThreshold>(`${this.baseUrl}/api/v1/stock-thresholds/${id}`, payload);
  }

  toggleThreshold(id: string): Observable<StockThreshold> {
    return this.http.patch<StockThreshold>(`${this.baseUrl}/api/v1/stock-thresholds/${id}/toggle`, {});
  }

  getCaseLimits(caseId: string): Observable<CaseLimitItem[]> {
    return this.http.get<CaseLimitItem[]>(`${this.baseUrl}/api/v1/stock-thresholds/effective-case-limits/${caseId}`);
  }

  // ── Stock Usage Permissions ────────────────────────────────────────────────

  createUsagePermission(payload: CreatePermissionRequest): Observable<StockUsagePermission> {
    return this.http.post<StockUsagePermission>(`${this.baseUrl}/api/v1/stock-usage-permissions`, payload);
  }

  getMyPendingPermissions(): Observable<StockUsagePermission[]> {
    return this.http.get<StockUsagePermission[]>(`${this.baseUrl}/api/v1/stock-usage-permissions/my-pending`);
  }

  getPermissionsByCase(caseId: string): Observable<StockUsagePermission[]> {
    return this.http.get<StockUsagePermission[]>(`${this.baseUrl}/api/v1/stock-usage-permissions/case/${caseId}`);
  }

  getMyPermissionRequests(): Observable<StockUsagePermission[]> {
    return this.http.get<StockUsagePermission[]>(`${this.baseUrl}/api/v1/stock-usage-permissions/tech/my-requests`);
  }

  approvePermission(id: string, payload: ReviewPermissionRequest): Observable<StockUsagePermission> {
    return this.http.post<StockUsagePermission>(`${this.baseUrl}/api/v1/stock-usage-permissions/${id}/approve`, payload);
  }

  rejectPermission(id: string, payload: RejectPermissionRequest): Observable<StockUsagePermission> {
    return this.http.post<StockUsagePermission>(`${this.baseUrl}/api/v1/stock-usage-permissions/${id}/reject`, payload);
  }
}
