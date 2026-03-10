import { ApplicationConfig } from '@angular/core';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import {
  provideRouter,
  withEnabledBlockingInitialNavigation,
  withHashLocation,
  withInMemoryScrolling,
  withRouterConfig,
  withViewTransitions
} from '@angular/router';
import { IconSetService } from '@coreui/icons-angular';
import { routes } from './app.routes';

import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { authInterceptor } from './core/auth/auth.interceptor';

import { API_BASE_URL } from './core/http/api.config';

export const appConfig: ApplicationConfig = {
  providers: [
   provideRouter(
  routes,
  withRouterConfig({ onSameUrlNavigation: 'reload' }),
  withInMemoryScrolling({
    scrollPositionRestoration: 'top',
    anchorScrolling: 'enabled'
  }),
  withEnabledBlockingInitialNavigation(),
  withViewTransitions()
),

    // ✅ Provide your backend base URL token
    { provide: API_BASE_URL, useValue: 'http://localhost:8080' },

    // ✅ Http + interceptor
    provideHttpClient(withInterceptors([authInterceptor])),

    IconSetService,
    provideAnimationsAsync()
  ]
};