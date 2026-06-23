import { Component } from '@angular/core';
import { ContainerComponent } from '@coreui/angular';
import { AlertCenterComponent } from '../../core/notifications/alert-center.component';

@Component({
  selector: 'app-alert-center-page',
  standalone: true,
  imports: [ContainerComponent, AlertCenterComponent],
  template: `
    <c-container fluid class="py-4">
      <app-alert-center />
    </c-container>
  `
})
export class AlertCenterPageComponent {}
