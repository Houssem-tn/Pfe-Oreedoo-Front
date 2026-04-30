import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { API_BASE_URL } from '../http/api.config';

export interface OcrField<T> {
  value: T;
  confidence?: number;
  confidenceLevel?: string;
  source?: string;
}

export interface RouterSignalScreenData {
  type: 'router_signal_screen';
  imsi?: OcrField<string>;
  imei?: OcrField<string>;
  pci?: OcrField<string>;
  sinr?: OcrField<string>;
  rsrp?: OcrField<string>;
  rssi?: OcrField<string>;
  rsrq?: OcrField<string>;
  needsReview?: boolean;
}

export interface SpeedtestScreenData {
  type: 'speedtest_screen';
  descendant_mbps?: OcrField<number>;
  ascendant_mbps?: OcrField<number>;
  needsReview?: boolean;
}

export type OcrScreenData = RouterSignalScreenData | SpeedtestScreenData;

export interface OcrResponse {
  data: OcrScreenData;
  documentType: string;
  ocrConfidence?: number;
  ocrPass?: string;
  rawText?: string;
  success: boolean;
}

export interface ParsedSignalMetrics {
  sinr: number | null;
  rsrp: number | null;
  rsrq: number | null;
}

export interface ParsedSpeedtestMetrics {
  debitDl: number | null;
  debitUl: number | null;
}

@Injectable({ providedIn: 'root' })
export class OcrService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);
  private readonly extractUrl = `${this.baseUrl}/api/v1/ocr/extract`;

  extract(files: File[]): Observable<OcrResponse[]> {
    const formData = new FormData();
    for (const file of files) {
      formData.append('files', file, file.name);
    }
    return this.http.post<OcrResponse[]>(this.extractUrl, formData);
  }

  parseSignalMetrics(responses: OcrResponse[]): ParsedSignalMetrics {
    const data = this.findScreen<RouterSignalScreenData>(responses, 'router_signal_screen');
    if (!data) {
      return { sinr: null, rsrp: null, rsrq: null };
    }

    return {
      sinr: this.parseDualValue(data.sinr?.value),
      rsrp: this.parseDualValue(data.rsrp?.value),
      rsrq: this.parseDualValue(data.rsrq?.value)
    };
  }

  parseSpeedtestMetrics(responses: OcrResponse[]): ParsedSpeedtestMetrics {
    const data = this.findScreen<SpeedtestScreenData>(responses, 'speedtest_screen');
    if (!data) {
      return { debitDl: null, debitUl: null };
    }

    return {
      debitDl: this.parseSpeedtestValue(data.descendant_mbps?.value),
      debitUl: this.parseSpeedtestValue(data.ascendant_mbps?.value)
    };
  }

  private findScreen<T extends OcrScreenData>(
    responses: OcrResponse[],
    type: T['type']
  ): T | null {
    for (const response of responses ?? []) {
      if (response?.success && response.data?.type === type) {
        return response.data as T;
      }
    }
    return null;
  }

  private parseDualValue(raw: string | null | undefined): number | null {
    if (raw == null) {
      return null;
    }

    const trimmed = String(raw).trim();
    if (!trimmed) {
      return null;
    }

    // Example "7.5dB/23dB" -> split to ["7.5dB", "23dB"]
    // As per requirement, grab the 5G value (usually the second value if two exist)
    const parts = trimmed.split('/');
    const targetPart = parts.length > 1 ? parts[1] : parts[0];

    const cleaned = targetPart.replace(/[~∼]/g, '-').replace(/[^0-9.\-]/g, '');
    if (!cleaned || cleaned === '-' || cleaned === '.') {
      return null;
    }

    const parsed = Number.parseFloat(cleaned);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private parseSpeedtestValue(raw: number | string | null | undefined): number | null {
    if (raw == null) {
      return null;
    }

    if (typeof raw === 'number') {
      return Number.isFinite(raw) ? raw : null;
    }

    const cleaned = String(raw).replace(/[^0-9.\-]/g, '');
    if (!cleaned) {
      return null;
    }

    const parsed = Number.parseFloat(cleaned);
    return Number.isFinite(parsed) ? parsed : null;
  }
}
