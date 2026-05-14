import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IconDirective } from '@coreui/icons-angular';

@Component({
  selector: 'app-field-empty-state',
  standalone: true,
  imports: [CommonModule, RouterLink, IconDirective],
  template: `
    <div class="field-empty">
      <svg cIcon [name]="icon"></svg>
      <strong>{{ title }}</strong>
      <span>{{ message }}</span>
      <a *ngIf="actionLabel && actionLink" class="field-button field-button--ghost" [routerLink]="actionLink">
        {{ actionLabel }}
      </a>
    </div>
  `
})
export class FieldEmptyStateComponent {
  @Input() icon = 'cilTask';
  @Input() title = 'Nothing here';
  @Input() message = 'There are no items to show right now.';
  @Input() actionLabel = '';
  @Input() actionLink = '';
}
