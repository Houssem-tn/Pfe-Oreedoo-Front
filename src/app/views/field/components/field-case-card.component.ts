import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IconDirective } from '@coreui/icons-angular';
import { TranslocoModule } from '@jsverse/transloco';

import { CaseResponse } from '../../../core/cases/models/case.model';
import {
  fieldCaseLocation,
  fieldCaseOffer,
  fieldRdvLabel,
  fieldStatusClass,
  fieldStatusLabel
} from '../field-case-utils';

@Component({
  selector: 'app-field-case-card',
  standalone: true,
  imports: [CommonModule, RouterLink, IconDirective, TranslocoModule],
  template: `
    <a class="field-case-card" [routerLink]="detailLink" *ngIf="item">
      <div class="field-case-card__top">
        <div>
          <div class="field-case-card__crm">CRM {{ item.crmCase }}</div>
          <h2 class="field-case-card__client">{{ item.clientName }}</h2>
        </div>
        <span [class]="statusClass">{{ statusLabel | transloco }}</span>
      </div>

      <div class="field-case-card__meta">
        <span>
          <svg cIcon name="cilLocationPin"></svg>
          <span>{{ location }}</span>
        </span>
        <span>
          <svg cIcon name="cilDescription"></svg>
          <span>{{ offer }}</span>
        </span>
        <span *ngIf="showRdv">
          <svg cIcon name="cilCalendar"></svg>
          <span>{{ rdv }}</span>
        </span>
      </div>
    </a>
  `
})
export class FieldCaseCardComponent {
  @Input({ required: true }) item!: CaseResponse;
  @Input() basePath = '/tech';
  @Input() showRdv = true;

  get detailLink(): string {
    return `${this.basePath}/tasks/${this.item.id}`;
  }

  get statusClass(): string {
    return fieldStatusClass(this.item.status);
  }

  get statusLabel(): string {
    return fieldStatusLabel(this.item.status);
  }

  get location(): string {
    return fieldCaseLocation(this.item);
  }

  get offer(): string {
    return fieldCaseOffer(this.item);
  }

  get rdv(): string {
    return fieldRdvLabel(this.item);
  }
}
