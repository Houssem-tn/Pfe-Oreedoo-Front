import { Component } from '@angular/core';
import {
  CardBodyComponent,
  CardComponent,
  ContainerComponent
} from '@coreui/angular';
import { AlertCenterComponent } from '../../core/notifications/alert-center.component';

@Component({
  selector: 'app-alert-center-page',
  standalone: true,
  imports: [ContainerComponent, CardComponent, CardBodyComponent, AlertCenterComponent],
  template: `
    <c-container fluid class="py-3">
      <c-card>
        <c-card-body>
          <app-alert-center />
        </c-card-body>
      </c-card>
    </c-container>
  `
})
export class AlertCenterPageComponent {}
