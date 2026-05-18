import { CommonModule } from '@angular/common';
import { Component, EventEmitter, inject, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import {
  BadgeComponent,
  ButtonCloseDirective,
  ButtonDirective,
  ModalBodyComponent,
  ModalComponent,
  ModalFooterComponent,
  ModalHeaderComponent,
  ModalTitleDirective
} from '@coreui/angular';
import { IconDirective } from '@coreui/icons-angular';

import {
  CASE_STATUS_UI,
  CaseProofFile,
  CaseResponse,
  CaseStatus,
  CaseTimelineEvent
} from '../../../core/cases/models/case.model';
import { StockService } from '../../../core/stock/stock.service';
import { StockUsagePermission, PermissionStatus } from '../../../core/stock/stock.model';

@Component({
  selector: 'app-case-detail',
  standalone: true,
  imports: [
    CommonModule,
    ModalComponent,
    ModalHeaderComponent,
    ModalTitleDirective,
    ButtonCloseDirective,
    ModalBodyComponent,
    ModalFooterComponent,
    ButtonDirective,
    BadgeComponent,
    IconDirective
  ],
  templateUrl: './case-detail.component.html',
  styleUrl: './case-detail.component.scss'
})
export class CaseDetailComponent implements OnChanges {
  private readonly stockService = inject(StockService);

  @Input() visible = false;
  @Input() caseData: CaseResponse | null = null;

  casePermissions: StockUsagePermission[] = [];
  permissionsLoading = false;

  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() close = new EventEmitter<void>();
  @Output() download = new EventEmitter<CaseResponse>();

  ngOnChanges(changes: SimpleChanges): void {
    if ((changes['visible']?.currentValue === true || changes['caseData']) && this.visible && this.caseData?.id) {
      this.loadPermissions(this.caseData.id);
    }
    if (changes['visible']?.currentValue === false) {
      this.casePermissions = [];
    }
  }

  private loadPermissions(caseId: string): void {
    this.permissionsLoading = true;
    this.stockService.getPermissionsByCase(caseId).subscribe({
      next: (list) => {
        this.casePermissions = list.filter(p => p.status !== 'CANCELLED')
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        this.permissionsLoading = false;
      },
      error: () => { this.permissionsLoading = false; }
    });
  }

  permissionStatusLabel(status: PermissionStatus): string {
    switch (status) {
      case 'PENDING': return 'Pending';
      case 'APPROVED': return 'Approved';
      case 'PARTIALLY_APPROVED': return 'Partially Approved';
      case 'REJECTED': return 'Rejected';
      default: return status;
    }
  }

  permissionStatusColor(status: PermissionStatus): string {
    switch (status) {
      case 'PENDING': return 'warning';
      case 'APPROVED': return 'success';
      case 'PARTIALLY_APPROVED': return 'info';
      case 'REJECTED': return 'danger';
      default: return 'secondary';
    }
  }

  onClose(): void {
    this.close.emit();
    this.visibleChange.emit(false);
  }

  handleVisibleChange(v: boolean): void {
    if (!v) {
      this.close.emit();
    }
    this.visibleChange.emit(v);
  }

  onDownload(): void {
    if (this.caseData) {
      this.download.emit(this.caseData);
    }
  }

  statusBadgeClass(status?: CaseStatus | null): string {
    if (!status) return 'bg-secondary-subtle text-secondary-emphasis';
    return CASE_STATUS_UI[status]?.badgeClass ?? 'bg-secondary-subtle text-secondary-emphasis';
  }

  statusLabel(status?: CaseStatus | null): string {
    if (!status) return '-';
    return CASE_STATUS_UI[status]?.label ?? status;
  }

  val(value: string | null | undefined): string {
    const s = (value ?? '').trim();
    return s || '—';
  }

  numVal(value: number | null | undefined): string {
    if (value == null) return '—';
    return String(value);
  }

  boolVal(value: boolean | null | undefined): string {
    if (value == null) return '—';
    return value ? 'Yes' : 'No';
  }

  dateVal(value: string | null | undefined): string {
    if (!value) return '—';
    try {
      return new Date(value).toLocaleString('fr-TN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return value;
    }
  }

  humanizeStatus(value?: string | null): string {
    if (!value?.trim()) return '—';
    return value.trim().toLowerCase().split('_')
      .map(p => p ? p[0].toUpperCase() + p.slice(1) : '')
      .join(' ');
  }

  get hasLocation(): boolean {
    const c = this.caseData;
    return !!(c?.latitude || c?.longitude);
  }

  get hasWorkLocation(): boolean {
    const work = this.caseData?.work;
    return work?.locationLatitude != null && work?.locationLongitude != null;
  }

  get hasProofs(): boolean {
    return (this.caseData?.workProofs?.length ?? 0) > 0;
  }

  get proofs(): CaseProofFile[] {
    return [...(this.caseData?.workProofs ?? [])];
  }

  get hasMetrics(): boolean {
    const m = this.caseData?.metrics;
    return !!(m?.nombrePv != null ||
              m?.debitDl != null || m?.debitUl != null ||
              m?.rsrp != null || m?.rsrq != null || m?.sinr != null);
  }

  get sortedTimeline(): CaseTimelineEvent[] {
    if (!this.caseData?.timeline?.length) return [];
    return [...this.caseData.timeline].sort((a, b) => {
      return new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime();
    });
  }

  timelineIconName(eventType: string): string {
    const t = eventType?.toLowerCase() ?? '';
    if (t.includes('stock_usage_permission')) return 'cilStorage';
    if (t.includes('assign')) return 'cilUserFollow';
    if (t.includes('rdv') || t.includes('appointment')) return 'cilCalendar';
    if (t.includes('work') || t.includes('complet')) return 'cilTask';
    if (t.includes('validat') || t.includes('approv')) return 'cilCheckCircle';
    if (t.includes('reject') || t.includes('abandon')) return 'cilBan';
    if (t.includes('create')) return 'cilFile';
    if (t.includes('close')) return 'cilLockLocked';
    if (t.includes('escalat')) return 'cilWarning';
    if (t.includes('reopen')) return 'cilReload';
    return 'cilHistory';
  }

  hasProofLocation(proof?: CaseProofFile | null): boolean {
    return proof?.locationLatitude != null && proof?.locationLongitude != null;
  }

  coordinateLabel(latitude?: number | string | null, longitude?: number | string | null): string {
    const normalizedLatitude = this.parseCoordinate(latitude);
    const normalizedLongitude = this.parseCoordinate(longitude);

    if (normalizedLatitude == null || normalizedLongitude == null) {
      return '—';
    }

    return `${normalizedLatitude.toFixed(6)}, ${normalizedLongitude.toFixed(6)}`;
  }

  mapLink(latitude?: number | string | null, longitude?: number | string | null): string | null {
    const normalizedLatitude = this.parseCoordinate(latitude);
    const normalizedLongitude = this.parseCoordinate(longitude);

    if (normalizedLatitude == null || normalizedLongitude == null) {
      return null;
    }

    return `https://maps.google.com/?q=${normalizedLatitude},${normalizedLongitude}`;
  }

  accuracyLabel(value?: number | null): string {
    if (value == null || Number.isNaN(value)) {
      return '—';
    }

    return `${Math.round(value)} m`;
  }

  proofSourceLabel(source?: string | null): string {
    const normalized = (source ?? '').trim().toLowerCase();

    switch (normalized) {
      case 'camera':
        return 'Work proof photo';
      case 'gallery':
        return 'Gallery photo';
      case 'speedtest_screenshot':
        return 'Speedtest screenshot';
      case 'signal_screenshot':
        return 'Signal screenshot';
      default:
        if (!normalized) {
          return 'Attachment';
        }

        return normalized
          .split(/[_-]+/)
          .map((part) => part ? part[0].toUpperCase() + part.slice(1) : '')
          .join(' ');
    }
  }

  proofFileUrl(proof?: CaseProofFile | null): string | null {
    const viewUrl = proof?.viewUrl?.trim();
    const downloadUrl = proof?.downloadUrl?.trim();
    return viewUrl || downloadUrl || null;
  }

  hasProofFile(proof?: CaseProofFile | null): boolean {
    return !!this.proofFileUrl(proof);
  }

  hasProofPreview(proof?: CaseProofFile | null): boolean {
    return this.isImageProof(proof) && !!this.proofFileUrl(proof);
  }

  proofTitle(proof: CaseProofFile, index: number): string {
    const filename = proof.originalFilename?.trim();
    return filename || `Proof ${index + 1}`;
  }

  private isImageProof(proof?: CaseProofFile | null): boolean {
    const contentType = proof?.contentType?.trim().toLowerCase();
    if (contentType) {
      return contentType.startsWith('image/');
    }

    const fileUrl = this.proofFileUrl(proof)?.toLowerCase() ?? '';
    return ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp', '.svg', '.avif']
      .some((extension) => fileUrl.includes(extension));
  }

  private parseCoordinate(value?: number | string | null): number | null {
    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : null;
    }

    const text = (value ?? '').toString().trim();
    if (!text) {
      return null;
    }

    const normalized = Number(text.replace(',', '.'));
    return Number.isFinite(normalized) ? normalized : null;
  }
}
