import { Component, Input } from '@angular/core';
import { IconDirective } from '@coreui/icons-angular';

type SummaryTone = 'primary' | 'success' | 'warning' | 'info';

@Component({
  selector: 'app-field-summary-card',
  standalone: true,
  imports: [IconDirective],
  template: `
    <article class="field-summary-card" [class]="'field-summary-card field-summary-card--' + tone">
      <div class="field-summary-card__icon">
        <svg cIcon [name]="icon"></svg>
      </div>
      <div class="field-summary-card__value">{{ value }}</div>
      <div class="field-summary-card__label">{{ label }}</div>
    </article>
  `
})
export class FieldSummaryCardComponent {
  @Input({ required: true }) label = '';
  @Input({ required: true }) value: string | number = '';
  @Input() icon = 'cilTask';
  @Input() tone: SummaryTone = 'primary';
}
