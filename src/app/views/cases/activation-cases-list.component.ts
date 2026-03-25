import { CommonModule, DatePipe } from '@angular/common';
import { ChangeDetectorRef, Component, NgZone, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize, firstValueFrom } from 'rxjs';
import Swal from 'sweetalert2';
import { IconDirective } from '@coreui/icons-angular';

import { AuthStore } from '../../core/auth/auth.store';
import { Role } from '../../core/auth/models/roles.type';
import { SwalService } from '../../core/ui/swal.service';
import { TechnicianListItem } from '../../core/stt/models/technician-list-item.model';
import { SttTechnicianApiService } from '../../core/stt/stt-technician-api.service';
import { UserService } from '../../core/users/user.service';
import { CasesService } from '../../core/cases/cases.service';
import {
  CASE_STATUS_UI,
  CaseMetrics,
  CaseRdv,
  CaseResponse,
  CaseStatus,
  CaseWork,
  CaseZmValidation,
  CompleteWorkRequest,
  SetRdvRequest,
  ValidateZmRequest
} from '../../core/cases/models/case.model';

type AssignableUser = { id: string; fullName: string; email: string };

type StatCard = {
  label: string;
  value: number;
  icon: string;
  className: string;
};

@Component({
  selector: 'app-activation-cases-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, DatePipe, IconDirective],
  templateUrl: './activation-cases-list.component.html',
  styleUrl: './activation-cases-list.component.scss'
})
export class ActivationCasesListComponent implements OnInit {
  private readonly casesService = inject(CasesService);
  private readonly userService = inject(UserService);
  private readonly sttTechApi = inject(SttTechnicianApiService);
  private readonly authStore = inject(AuthStore);
  private readonly swal = inject(SwalService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly zone = inject(NgZone);

  cases: CaseResponse[] = [];
  loading = false;
  actionLoadingCaseId: string | null = null;
  error: string | null = null;

  searchTerm = '';
  selectedStatus = '';
  selectedGouvernorat = '';
  selectedDelegation = '';

  currentPage = 1;
  pageSize = 10;

  readonly statusOptions: Array<{ value: '' | CaseStatus; label: string }> = [
    { value: '', label: 'All statuses' },
    { value: 'CREATED', label: 'Created' },
    { value: 'ASSIGNED_TO_ZM', label: 'Assigned to ZM' },
    { value: 'ASSIGNED_TO_STT', label: 'Assigned to STT' },
    { value: 'ASSIGNED_TO_TECH', label: 'Assigned to TECH' },
    { value: 'RDV_SET', label: 'RDV set' },
    { value: 'NOT_REACHABLE', label: 'Not reachable' },
    { value: 'ABANDONED', label: 'Abandoned' },
    { value: 'WORK_DONE', label: 'Work done' },
    { value: 'VALIDATED_BY_ZM', label: 'Validated by ZM' },
    { value: 'REJECTED_BY_ZM', label: 'Rejected by ZM' },
    { value: 'CLOSED', label: 'Closed' }
  ];

  ngOnInit(): void {
    this.loadCases();
  }

  get currentRole(): Role | null {
    return this.authStore.role();
  }

  get canCreateCase(): boolean {
    return this.currentRole === 'ROLE_ADMIN';
  }

  get createRoute(): string {
    return '/admin/cases/activation/new';
  }

  get accessibleCases(): CaseResponse[] {
    return this.cases.filter((item) => this.canAccessCase(item));
  }

  get filteredCases(): CaseResponse[] {
    const term = this.searchTerm.trim().toLowerCase();

    return this.accessibleCases.filter((item) => {
      const matchesSearch =
        !term ||
        item.crmCase.toLowerCase().includes(term) ||
        item.clientName.toLowerCase().includes(term) ||
        item.clientPhone.toLowerCase().includes(term) ||
        (item.zmName ?? '').toLowerCase().includes(term) ||
        (item.sttName ?? '').toLowerCase().includes(term) ||
        (item.techName ?? '').toLowerCase().includes(term) ||
        (item.offre ?? '').toLowerCase().includes(term) ||
        item.localite.toLowerCase().includes(term) ||
        item.delegation.toLowerCase().includes(term) ||
        item.gouvernorat.toLowerCase().includes(term);

      const matchesStatus = !this.selectedStatus || item.status === this.selectedStatus;
      const matchesGouvernorat = !this.selectedGouvernorat || item.gouvernorat === this.selectedGouvernorat;
      const matchesDelegation = !this.selectedDelegation || item.delegation === this.selectedDelegation;

      return matchesSearch && matchesStatus && matchesGouvernorat && matchesDelegation;
    });
  }

  get paginatedCases(): CaseResponse[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.filteredCases.slice(start, start + this.pageSize);
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.filteredCases.length / this.pageSize));
  }

  get pages(): number[] {
    return Array.from({ length: this.totalPages }, (_, i) => i + 1);
  }

  get gouvernoratOptions(): string[] {
    return [...new Set(this.accessibleCases.map((item) => item.gouvernorat).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b));
  }

  get delegationOptions(): string[] {
    return [...new Set(this.accessibleCases.map((item) => item.delegation).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b));
  }

  get statsCards(): StatCard[] {
    const source = this.accessibleCases;
    const workDoneCount = source.filter((c) => ['WORK_DONE', 'VALIDATED_BY_ZM', 'CLOSED'].includes(c.status)).length;

    return [
      { label: 'Total Cases', value: source.length, icon: 'cilDescription', className: 'stat-neutral' },
      { label: 'Assigned to ZM', value: source.filter((c) => !!c.zmId).length, icon: 'cilUser', className: 'stat-primary' },
      { label: 'Assigned to STT', value: source.filter((c) => !!c.sttId).length, icon: 'cilPeople', className: 'stat-info' },
      { label: 'Assigned to TECH', value: source.filter((c) => !!c.techId).length, icon: 'cilUserFollow', className: 'stat-warning' },
      { label: 'Work Done', value: workDoneCount, icon: 'cilTask', className: 'stat-success' },
      { label: 'Closed', value: source.filter((c) => c.status === 'CLOSED').length, icon: 'cilLockLocked', className: 'stat-dark' }
    ];
  }

  loadCases(): void {
    if (this.loading) return;

    this.loading = true;
    this.error = null;

    this.casesService.getActivationCases()
      .pipe(
        finalize(() => {
          this.loading = false;
          this.zone.run(() => this.cdr.detectChanges());
        })
      )
      .subscribe({
        next: (rows) => {
          this.cases = rows ?? [];
          this.currentPage = 1;
        },
        error: (err) => {
          console.error('Failed to load activation cases:', err);
          this.error = err?.error?.message ?? 'Failed to load activation cases';
        }
      });
  }

  onFiltersChange(): void {
    this.currentPage = 1;
  }

  setPage(page: number): void {
    if (page < 1 || page > this.totalPages) return;
    this.currentPage = page;
  }

  resetFilters(): void {
    this.searchTerm = '';
    this.selectedStatus = '';
    this.selectedGouvernorat = '';
    this.selectedDelegation = '';
    this.currentPage = 1;
  }

  statusBadgeClass(status: CaseStatus): string {
    return CASE_STATUS_UI[status]?.badgeClass ?? 'bg-secondary-subtle text-secondary-emphasis';
  }

  statusLabel(status: CaseStatus): string {
    return CASE_STATUS_UI[status]?.label ?? status;
  }

  canAssignZm(item: CaseResponse): boolean {
    if (!this.isAdmin) return false;
    return item.status !== 'CLOSED';
  }

  canAssignStt(item: CaseResponse): boolean {
    if (!this.isZm || !this.isCaseOwnedByZm(item)) return false;
    return ['ASSIGNED_TO_ZM', 'ASSIGNED_TO_STT'].includes(item.status);
  }

  canAssignTech(item: CaseResponse): boolean {
    if (!this.isStt || !this.isCaseOwnedByStt(item)) return false;
    return ['ASSIGNED_TO_STT', 'ASSIGNED_TO_TECH'].includes(item.status);
  }

  canSetRdv(item: CaseResponse): boolean {
    if (!this.isStt || !this.isCaseOwnedByStt(item)) return false;
    return ['ASSIGNED_TO_TECH', 'RDV_SET', 'NOT_REACHABLE'].includes(item.status);
  }

  canUpdateWork(item: CaseResponse): boolean {
    if (!this.isTech || !this.isCaseOwnedByTech(item)) return false;
    return ['RDV_SET', 'ASSIGNED_TO_TECH'].includes(item.status);
  }

  canValidateZm(item: CaseResponse): boolean {
    if (!this.isZm || !this.isCaseOwnedByZm(item)) return false;
    return item.status === 'WORK_DONE';
  }

  canCloseCase(item: CaseResponse): boolean {
    if (!this.isZm || !this.isCaseOwnedByZm(item)) return false;
    return item.status === 'VALIDATED_BY_ZM';
  }

  canView(item: CaseResponse): boolean {
    return this.canAccessCase(item);
  }

  isBusy(caseId: string): boolean {
    return this.actionLoadingCaseId === caseId;
  }

  trackById = (_index: number, item: CaseResponse) => item.id;

  async openAssignZm(item: CaseResponse): Promise<void> {
    this.actionLoadingCaseId = item.id;

    try {
      const zms = (await firstValueFrom(this.userService.getAllZmsForAssignment()))
        .sort((a, b) => a.fullName.localeCompare(b.fullName));

      if (!zms.length) {
        await this.swal.error('No ZM available', 'No approved ZM users were found for assignment.');
        return;
      }

      const result = await this.swal.promptSelect(
        `Assign ZM to CRM ${item.crmCase}`,
        'Choose ZM',
        zms.reduce<Record<string, string>>((acc, zm) => {
          acc[zm.id] = `${zm.fullName} (${zm.email})`;
          return acc;
        }, {}),
        item.zmId ?? '',
        item.zmId ? 'Change ZM' : 'Assign ZM'
      );

      if (!result.isConfirmed || !result.value) {
        return;
      }

      const selectedZmId = result.value;
      await this.runAction(item.id, () => this.casesService.assignZm(item.id, selectedZmId), 'ZM assignment saved');
      console.log('Assign ZM', { caseId: item.id, selectedZmId });
    } catch (err: any) {
      console.error('Failed to assign ZM:', err);
      const message = err?.error?.message ?? 'Failed to assign ZM';
      await this.swal.error('Assignment failed', message);
    } finally {
      this.actionLoadingCaseId = null;
      this.zone.run(() => this.cdr.detectChanges());
    }
  }

  async openAssignStt(item: CaseResponse): Promise<void> {
    this.actionLoadingCaseId = item.id;

    try {
      const stts = await this.loadAssignableStts();

      if (!stts.length) {
        await this.swal.error('No STT available', 'No assignable STT was found for this case.');
        return;
      }

      const result = await this.swal.promptSelect(
        `Assign STT to CRM ${item.crmCase}`,
        'Choose STT',
        stts.reduce<Record<string, string>>((acc, stt) => {
          acc[stt.id] = `${stt.fullName} (${stt.email})`;
          return acc;
        }, {}),
        item.sttId ?? '',
        item.sttId ? 'Change STT' : 'Assign STT'
      );

      if (!result.isConfirmed || !result.value) {
        return;
      }

      const selectedSttId = result.value;
      await this.runAction(item.id, () => this.casesService.assignStt(item.id, selectedSttId), 'STT assignment saved');
      console.log('Assign STT', { caseId: item.id, caseZmId: item.zmId, selectedSttId });
    } catch (err: any) {
      console.error('Failed to assign STT:', err);
      const message = err?.error?.message ?? 'Failed to assign STT';
      await this.swal.error('Assignment failed', message);
    } finally {
      this.actionLoadingCaseId = null;
      this.zone.run(() => this.cdr.detectChanges());
    }

    
  }

  async openAssignTech(item: CaseResponse): Promise<void> {
    this.actionLoadingCaseId = item.id;

    try {
      const techs = await this.loadAssignableTechs();

      if (!techs.length) {
        await this.swal.error('No TECH available', 'No assignable TECH was found for this case.');
        return;
      }

      const result = await this.swal.promptSelect(
        `Assign TECH to CRM ${item.crmCase}`,
        'Choose TECH',
        techs.reduce<Record<string, string>>((acc, tech) => {
          acc[tech.id] = `${tech.fullName} (${tech.email})`;
          return acc;
        }, {}),
        item.techId ?? '',
        item.techId ? 'Change TECH' : 'Assign TECH'
      );

      if (!result.isConfirmed || !result.value) {
        return;
      }

      const selectedTechId = result.value;
      await this.runAction(item.id, () => this.casesService.assignTech(item.id, selectedTechId), 'TECH assignment saved');
      console.log('Assign TECH', { caseId: item.id, caseSttId: item.sttId, selectedTechId });
    } catch (err: any) {
      console.error('Failed to assign TECH:', err);
      const message = err?.error?.message ?? 'Failed to assign TECH';
      await this.swal.error('Assignment failed', message);
    } finally {
      this.actionLoadingCaseId = null;
      this.zone.run(() => this.cdr.detectChanges());
    }
  }

  async openRdvPopup(item: CaseResponse): Promise<void> {
    const rdv = this.extractRdv(item);

    const result = await Swal.fire<SetRdvRequest>({
      title: `Set RDV - CRM ${this.escapeHtml(item.crmCase)}`,
      html: `
        <div class="text-start">
          <label class="form-label fw-semibold">Joignable</label>
          <select id="sw-rdv-joignable" class="swal2-input">
            <option value="true" ${rdv.joignable !== false ? 'selected' : ''}>Yes</option>
            <option value="false" ${rdv.joignable === false ? 'selected' : ''}>No</option>
          </select>

          <label class="form-label fw-semibold mt-2">Date RDV</label>
          <input id="sw-rdv-date" type="datetime-local" class="swal2-input" value="${this.toDateTimeLocal(rdv.datePriseRdv)}" />

          <label class="form-label fw-semibold mt-2">Cause Injoignabilite</label>
          <input id="sw-rdv-cause-inj" class="swal2-input" value="${this.escapeHtml(rdv.causeInjoignabilite ?? '')}" />

          <label class="form-label fw-semibold mt-2">Detail</label>
          <textarea id="sw-rdv-detail" class="swal2-textarea">${this.escapeHtml(rdv.detail ?? '')}</textarea>

          <label class="form-label fw-semibold mt-2">Comment RDV</label>
          <textarea id="sw-rdv-comment" class="swal2-textarea">${this.escapeHtml(rdv.cmtRdv ?? '')}</textarea>

          <label class="form-label fw-semibold mt-2">Abandon</label>
          <select id="sw-rdv-abandon" class="swal2-input">
            <option value="false" ${rdv.abandon ? '' : 'selected'}>No</option>
            <option value="true" ${rdv.abandon ? 'selected' : ''}>Yes</option>
          </select>

          <label class="form-label fw-semibold mt-2">Cause Abandon</label>
          <input id="sw-rdv-cause-abandon" class="swal2-input" value="${this.escapeHtml(rdv.causeAbandon ?? '')}" />
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: 'Save RDV',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#321fdb',
      preConfirm: () => {
        const joignable = this.getElementValue('sw-rdv-joignable') === 'true';
        const datePriseRdv = this.toIso(this.getElementValue('sw-rdv-date'));
        const causeInjoignabilite = this.toNullable(this.getElementValue('sw-rdv-cause-inj'));
        const detail = this.getElementValue('sw-rdv-detail').trim();
        const cmtRdv = this.getElementValue('sw-rdv-comment').trim();
        const abandon = this.getElementValue('sw-rdv-abandon') === 'true';
        const causeAbandon = this.toNullable(this.getElementValue('sw-rdv-cause-abandon'));

        if (!datePriseRdv) {
          Swal.showValidationMessage('Date RDV is required');
          return undefined;
        }

        if (!joignable && !causeInjoignabilite) {
          Swal.showValidationMessage('Cause injoignabilite is required when client is not joignable');
          return undefined;
        }

        if (abandon && !causeAbandon) {
          Swal.showValidationMessage('Cause abandon is required when abandon is true');
          return undefined;
        }

        return {
          joignable,
          datePriseRdv,
          causeInjoignabilite: joignable ? null : causeInjoignabilite,
          detail,
          cmtRdv,
          abandon,
          causeAbandon: abandon ? causeAbandon : null
        };
      }
    });

    if (!result.isConfirmed || !result.value) return;
    const rdvPayload = result.value;
    await this.runAction(item.id, () => this.casesService.setRdv(item.id, rdvPayload), 'RDV saved');
  }

  async openWorkPopup(item: CaseResponse): Promise<void> {
    const work = this.extractWork(item);
    const metrics = this.extractMetrics(item);

    const result = await Swal.fire<CompleteWorkRequest>({
      title: `Update Work - CRM ${this.escapeHtml(item.crmCase)}`,
      width: 760,
      html: `
        <div class="text-start">
          <label class="form-label fw-semibold">Work Result</label>
          <input id="sw-work-result" class="swal2-input" value="${this.escapeHtml(work.repTravauxStt ?? '')}" />

          <label class="form-label fw-semibold mt-2">Date End Work</label>
          <input id="sw-work-date" type="datetime-local" class="swal2-input" value="${this.toDateTimeLocal(work.dateFinTrv)}" />

          <label class="form-label fw-semibold mt-2">Comment</label>
          <textarea id="sw-work-comment" class="swal2-textarea">${this.escapeHtml(work.cmtTrvStt ?? '')}</textarea>

          <div class="row g-2 mt-1">
            <div class="col-6">
              <label class="form-label fw-semibold">Metrage Cable</label>
              <input id="sw-work-metrage" type="number" step="0.01" class="swal2-input" value="${this.toInputNumber(metrics.metrageCable)}" />
            </div>
            <div class="col-6">
              <label class="form-label fw-semibold">Nombre PV</label>
              <input id="sw-work-pv" type="number" step="1" class="swal2-input" value="${this.toInputNumber(metrics.nombrePv)}" />
            </div>
            <div class="col-6">
              <label class="form-label fw-semibold">Debit DL</label>
              <input id="sw-work-dl" type="number" step="0.01" class="swal2-input" value="${this.toInputNumber(metrics.debitDl)}" />
            </div>
            <div class="col-6">
              <label class="form-label fw-semibold">Debit UL</label>
              <input id="sw-work-ul" type="number" step="0.01" class="swal2-input" value="${this.toInputNumber(metrics.debitUl)}" />
            </div>
            <div class="col-4">
              <label class="form-label fw-semibold">RSRP</label>
              <input id="sw-work-rsrp" type="number" step="1" class="swal2-input" value="${this.toInputNumber(metrics.rsrp)}" />
            </div>
            <div class="col-4">
              <label class="form-label fw-semibold">RSRQ</label>
              <input id="sw-work-rsrq" type="number" step="1" class="swal2-input" value="${this.toInputNumber(metrics.rsrq)}" />
            </div>
            <div class="col-4">
              <label class="form-label fw-semibold">SINR</label>
              <input id="sw-work-sinr" type="number" step="1" class="swal2-input" value="${this.toInputNumber(metrics.sinr)}" />
            </div>
          </div>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: 'Submit Work',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#2eb85c',
      preConfirm: () => {
        const repTravauxStt = this.getElementValue('sw-work-result').trim();
        const dateFinTrv = this.toIso(this.getElementValue('sw-work-date'));
        const cmtTrvStt = this.getElementValue('sw-work-comment').trim();

        if (!repTravauxStt || !dateFinTrv || !cmtTrvStt) {
          Swal.showValidationMessage('Work result, date and comment are required');
          return undefined;
        }

        return {
          repTravauxStt,
          dateFinTrv,
          cmtTrvStt,
          metrageCable: this.toMaybeNumber(this.getElementValue('sw-work-metrage')),
          nombrePv: this.toMaybeNumber(this.getElementValue('sw-work-pv')),
          debitDl: this.toMaybeNumber(this.getElementValue('sw-work-dl')),
          debitUl: this.toMaybeNumber(this.getElementValue('sw-work-ul')),
          rsrp: this.toMaybeNumber(this.getElementValue('sw-work-rsrp')),
          rsrq: this.toMaybeNumber(this.getElementValue('sw-work-rsrq')),
          sinr: this.toMaybeNumber(this.getElementValue('sw-work-sinr'))
        };
      }
    });

    if (!result.isConfirmed || !result.value) return;
    const workPayload = result.value;
    await this.runAction(item.id, () => this.casesService.completeWork(item.id, workPayload), 'Work updated');
  }

  async openValidatePopup(item: CaseResponse): Promise<void> {
    const validation = this.extractValidation(item);
    const defaultApproved = validation.approved ?? true;

    const result = await Swal.fire<ValidateZmRequest>({
      title: `ZM Validation - CRM ${this.escapeHtml(item.crmCase)}`,
      html: `
        <div class="text-start">
          <label class="form-label fw-semibold">Decision</label>
          <select id="sw-zm-approved" class="swal2-input">
            <option value="true" ${defaultApproved ? 'selected' : ''}>Approve</option>
            <option value="false" ${defaultApproved ? '' : 'selected'}>Reject</option>
          </select>
          <label class="form-label fw-semibold mt-2">Comment</label>
          <textarea id="sw-zm-comment" class="swal2-textarea">${this.escapeHtml(validation.comment ?? '')}</textarea>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: 'Submit Validation',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#321fdb',
      preConfirm: () => {
        const approved = this.getElementValue('sw-zm-approved') === 'true';
        const comment = this.getElementValue('sw-zm-comment').trim();

        if (!comment) {
          Swal.showValidationMessage('Comment is required');
          return undefined;
        }

        return { approved, comment };
      }
    });

    if (!result.isConfirmed || !result.value) return;
    const validationPayload = result.value;
    await this.runAction(item.id, () => this.casesService.validateZm(item.id, validationPayload), 'Validation saved');
  }

  async openClosePopup(item: CaseResponse): Promise<void> {
    const confirm = await this.swal.confirmAction(
      'Close this case?',
      `CRM ${item.crmCase} will be closed and cannot move forward.`,
      'Close Case'
    );

    if (!confirm.isConfirmed) return;
    await this.runAction(item.id, () => this.casesService.closeCase(item.id), 'Case closed');
  }

  async openDetails(item: CaseResponse): Promise<void> {
    this.actionLoadingCaseId = item.id;

    try {
      const fullCase = await firstValueFrom(this.casesService.getCaseById(item.id));
      const rdv = this.extractRdv(fullCase);
      const work = this.extractWork(fullCase);
      const metrics = this.extractMetrics(fullCase);
      const validation = this.extractValidation(fullCase);

      await Swal.fire({
        title: `Case Details - ${this.escapeHtml(fullCase.crmCase)}`,
        width: 940,
        html: `
          <div class="text-start case-details-modal">
            <div class="row g-2 mb-2">
              <div class="col-md-6"><strong>Type:</strong> ${this.escapeHtml(fullCase.type || '-')}</div>
              <div class="col-md-6"><strong>Status:</strong> ${this.escapeHtml(this.statusLabel(fullCase.status))}</div>
              <div class="col-md-6"><strong>Client:</strong> ${this.escapeHtml(fullCase.clientName || '-')}</div>
              <div class="col-md-6"><strong>Phone:</strong> ${this.escapeHtml(fullCase.clientPhone || '-')}</div>
              <div class="col-md-6"><strong>MSISDN:</strong> ${this.escapeHtml(fullCase.msisdn || '-')}</div>
              <div class="col-md-6"><strong>Offer:</strong> ${this.escapeHtml(fullCase.offre || '-')}</div>
              <div class="col-md-6"><strong>Pack:</strong> ${this.escapeHtml(fullCase.desPack || '-')}</div>
              <div class="col-md-6"><strong>Comment:</strong> ${this.escapeHtml(fullCase.commentaire || '-')}</div>
              <div class="col-md-12"><strong>Location:</strong> ${this.escapeHtml(`${fullCase.localite || '-'}, ${fullCase.delegation || '-'}, ${fullCase.gouvernorat || '-'}`)}</div>
            </div>

            <hr />
            <h6 class="mb-2">Assignment Chain</h6>
            <div class="row g-2 mb-2">
              <div class="col-md-4"><strong>ZM:</strong> ${this.escapeHtml(this.personLabel(fullCase.zmName, fullCase.zmEmail))}</div>
              <div class="col-md-4"><strong>STT:</strong> ${this.escapeHtml(this.personLabel(fullCase.sttName, fullCase.sttEmail))}</div>
              <div class="col-md-4"><strong>TECH:</strong> ${this.escapeHtml(this.personLabel(fullCase.techName, fullCase.techEmail))}</div>
            </div>

            <hr />
            <h6 class="mb-2">RDV</h6>
            <div class="row g-2 mb-2">
              <div class="col-md-4"><strong>Joignable:</strong> ${rdv.joignable == null ? '-' : rdv.joignable ? 'Yes' : 'No'}</div>
              <div class="col-md-4"><strong>Date:</strong> ${this.escapeHtml(this.asDateLabel(rdv.datePriseRdv))}</div>
              <div class="col-md-4"><strong>Abandon:</strong> ${rdv.abandon == null ? '-' : rdv.abandon ? 'Yes' : 'No'}</div>
              <div class="col-md-6"><strong>Cause Injoignabilite:</strong> ${this.escapeHtml(rdv.causeInjoignabilite || '-')}</div>
              <div class="col-md-6"><strong>Cause Abandon:</strong> ${this.escapeHtml(rdv.causeAbandon || '-')}</div>
              <div class="col-md-6"><strong>Detail:</strong> ${this.escapeHtml(rdv.detail || '-')}</div>
              <div class="col-md-6"><strong>Comment:</strong> ${this.escapeHtml(rdv.cmtRdv || '-')}</div>
            </div>

            <hr />
            <h6 class="mb-2">Work</h6>
            <div class="row g-2 mb-2">
              <div class="col-md-4"><strong>Result:</strong> ${this.escapeHtml(work.repTravauxStt || '-')}</div>
              <div class="col-md-4"><strong>Date End:</strong> ${this.escapeHtml(this.asDateLabel(work.dateFinTrv))}</div>
              <div class="col-md-4"><strong>Comment:</strong> ${this.escapeHtml(work.cmtTrvStt || '-')}</div>
            </div>

            <hr />
            <h6 class="mb-2">Technical Metrics</h6>
            <div class="row g-2 mb-2">
              <div class="col-md-3"><strong>Cable:</strong> ${this.asMetric(metrics.metrageCable)}</div>
              <div class="col-md-3"><strong>PV:</strong> ${this.asMetric(metrics.nombrePv)}</div>
              <div class="col-md-3"><strong>DL:</strong> ${this.asMetric(metrics.debitDl)}</div>
              <div class="col-md-3"><strong>UL:</strong> ${this.asMetric(metrics.debitUl)}</div>
              <div class="col-md-4"><strong>RSRP:</strong> ${this.asMetric(metrics.rsrp)}</div>
              <div class="col-md-4"><strong>RSRQ:</strong> ${this.asMetric(metrics.rsrq)}</div>
              <div class="col-md-4"><strong>SINR:</strong> ${this.asMetric(metrics.sinr)}</div>
            </div>

            <hr />
            <h6 class="mb-2">ZM Validation</h6>
            <div class="row g-2">
              <div class="col-md-4"><strong>Approved:</strong> ${validation.approved == null ? '-' : validation.approved ? 'Yes' : 'No'}</div>
              <div class="col-md-8"><strong>Comment:</strong> ${this.escapeHtml(validation.comment || '-')}</div>
            </div>
          </div>
        `,
        confirmButtonText: 'Close',
        confirmButtonColor: '#321fdb'
      });
    } catch (err: any) {
      console.error('Failed to load case details:', err);
      const message = err?.error?.message ?? 'Failed to load case details';
      await this.swal.error('Details unavailable', message);
    } finally {
      this.actionLoadingCaseId = null;
      this.zone.run(() => this.cdr.detectChanges());
    }
  }

  private async runAction(caseId: string, action: () => any, successTitle: string): Promise<void> {
    this.actionLoadingCaseId = caseId;

    try {
      await firstValueFrom(action());
      await this.swal.success(successTitle, 'Operation completed successfully.');
      this.loadCases();
    } catch (err: any) {
      console.error('Case action failed:', err);
      const message = err?.error?.message ?? 'Operation failed';
      await this.swal.error('Request failed', message);
    } finally {
      this.actionLoadingCaseId = null;
      this.zone.run(() => this.cdr.detectChanges());
    }
  }

  private canAccessCase(item: CaseResponse): boolean {
    if (this.isAdmin) return true;
    if (this.isZm) return this.isCaseOwnedByZm(item);
    if (this.isStt) return this.isCaseOwnedByStt(item);
    if (this.isTech) return this.isCaseOwnedByTech(item);
    return false;
  }

  private get isAdmin(): boolean {
    return this.currentRole === 'ROLE_ADMIN';
  }

  private get isZm(): boolean {
    return this.currentRole === 'ROLE_ZM';
  }

  private get isStt(): boolean {
    return this.currentRole === 'ROLE_STT';
  }

  private get isTech(): boolean {
    return this.currentRole === 'ROLE_TECH';
  }

  private get currentUserEmail(): string {
    return (this.authStore.user()?.email ?? '').trim().toLowerCase();
  }

  private isCaseOwnedByZm(item: CaseResponse): boolean {
    return this.sameEmail(item.zmEmail, this.currentUserEmail);
  }

  private isCaseOwnedByStt(item: CaseResponse): boolean {
    return this.sameEmail(item.sttEmail, this.currentUserEmail);
  }

  private isCaseOwnedByTech(item: CaseResponse): boolean {
    return this.sameEmail(item.techEmail, this.currentUserEmail);
  }

  private sameEmail(left?: string | null, right?: string | null): boolean {
    return (left ?? '').trim().toLowerCase() === (right ?? '').trim().toLowerCase();
  }

  private async loadAssignableStts(): Promise<AssignableUser[]> {
    const users = await firstValueFrom(this.userService.getMySttsForZm());
    return (users ?? [])
      .map((u) => ({ id: u.id, fullName: u.fullName, email: u.email }))
      .sort((a, b) => a.fullName.localeCompare(b.fullName));
  }

  private async loadAssignableTechs(): Promise<AssignableUser[]> {
    const myTechs = await firstValueFrom(this.sttTechApi.getMyTechnicians());
    return (myTechs ?? [])
      .filter((u: TechnicianListItem) => u.status === 'APPROVED' && u.enabled)
      .map((u: TechnicianListItem) => ({ id: u.id, fullName: u.fullName, email: u.email }))
      .sort((a, b) => a.fullName.localeCompare(b.fullName));
  }

  private extractRdv(item: CaseResponse): CaseRdv {
    if (item.rdv) return item.rdv;

    return {
      joignable: item.joignable,
      datePriseRdv: item.datePriseRdv,
      causeInjoignabilite: item.causeInjoignabilite,
      detail: item.detail,
      cmtRdv: item.cmtRdv,
      abandon: item.abandon,
      causeAbandon: item.causeAbandon
    };
  }

  private extractWork(item: CaseResponse): CaseWork {
    if (item.work) return item.work;

    return {
      repTravauxStt: item.repTravauxStt,
      dateFinTrv: item.dateFinTrv,
      cmtTrvStt: item.cmtTrvStt
    };
  }

  private extractMetrics(item: CaseResponse): CaseMetrics {
    if (item.metrics) return item.metrics;

    return {
      metrageCable: item.metrageCable,
      nombrePv: item.nombrePv,
      debitDl: item.debitDl,
      debitUl: item.debitUl,
      rsrp: item.rsrp,
      rsrq: item.rsrq,
      sinr: item.sinr
    };
  }

  private extractValidation(item: CaseResponse): CaseZmValidation {
    if (item.zmValidation) return item.zmValidation;

    return {
      approved: item.repZm === 'APPROVED' ? true : item.repZm === 'REJECTED' ? false : null,
      comment: item.commentZm
    };
  }

  private personLabel(name?: string | null, email?: string | null): string {
    const safeName = (name ?? '').trim();
    const safeEmail = (email ?? '').trim();
    if (!safeName && !safeEmail) return '-';
    if (safeName && safeEmail) return `${safeName} (${safeEmail})`;
    return safeName || safeEmail;
  }

  private asMetric(value?: number | null): string {
    return value == null ? '-' : String(value);
  }

  private asDateLabel(value?: string | null): string {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleString();
  }

  private toDateTimeLocal(value?: string | null): string {
    if (!value) return '';

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';

    const offset = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - offset).toISOString().slice(0, 16);
  }

  private toIso(value: string): string {
    if (!value) return '';

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';

    return date.toISOString();
  }

  private toNullable(value?: string | null): string | null {
    const trimmed = (value ?? '').trim();
    return trimmed ? trimmed : null;
  }

  private toMaybeNumber(value: string): number | undefined {
    const trimmed = value.trim();
    if (!trimmed) return undefined;

    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  private toInputNumber(value?: number | null): string {
    return value == null ? '' : String(value);
  }

  private getElementValue(id: string): string {
    const element = document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null;
    return element?.value ?? '';
  }

  private escapeHtml(value: string): string {
    return value
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }
}
