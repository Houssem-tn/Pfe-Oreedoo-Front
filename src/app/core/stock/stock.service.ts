import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../http/api.config';
import {
  ConfirmDpmRequest,
  CreateDpmRequest,
  CreateEquipmentRequest,
  DistributeToTechRequest,
  DpmRequest,
  Equipment,
  StockMovement,
  SttDistribution,
  SttStock,
  TechStock
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

  // ── ZM scoped ─────────────────────────────────────────────────────────────

  getMyDpms(): Observable<DpmRequest[]> {
    return this.http.get<DpmRequest[]>(`${this.url}/zm/my-dpms`);
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

  distributeToTech(payload: DistributeToTechRequest): Observable<SttDistribution> {
    return this.http.post<SttDistribution>(`${this.url}/stt/distribute`, payload);
  }

  getMyDistributions(): Observable<SttDistribution[]> {
    return this.http.get<SttDistribution[]>(`${this.url}/stt/distributions`);
  }

  getMyTechsStocks(): Observable<TechStock[]> {
    return this.http.get<TechStock[]>(`${this.url}/stt/tech-stocks`);
  }

  // ── TECH scoped ───────────────────────────────────────────────────────────

  getMyTechStock(): Observable<TechStock> {
    return this.http.get<TechStock>(`${this.url}/tech/my-stock`);
  }

  // ── Admin scoped ──────────────────────────────────────────────────────────

  adminGetAllDpms(): Observable<DpmRequest[]> {
    return this.http.get<DpmRequest[]>(`${this.url}/admin/dpms`);
  }

  adminGetAllSttStocks(): Observable<SttStock[]> {
    return this.http.get<SttStock[]>(`${this.url}/admin/stt-stocks`);
  }

  adminGetAllTechStocks(): Observable<TechStock[]> {
    return this.http.get<TechStock[]>(`${this.url}/admin/tech-stocks`);
  }

  adminGetAllMovements(): Observable<StockMovement[]> {
    return this.http.get<StockMovement[]>(`${this.url}/admin/movements`);
  }

  adminGetMovementsByReference(referenceId: string): Observable<StockMovement[]> {
    return this.http.get<StockMovement[]>(`${this.url}/admin/movements/reference/${referenceId}`);
  }
}
