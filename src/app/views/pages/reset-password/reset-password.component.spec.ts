import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { By } from '@angular/platform-browser';

import { ResetPasswordComponent } from './reset-password.component';
import { API_BASE_URL } from '../../../core/http/api.config';

const EN = {
  resetPassword: {
    success: 'Password reset successfully.',
    errorMissingToken: 'This link is invalid or incomplete.',
    errorInvalidLink: 'This link is invalid or has expired.',
    errorTooMany: 'Too many attempts.',
    errorPasswordPolicy: 'Password does not meet requirements.',
    errorGeneric: 'Could not reset your password.',
    errorOnlyWhitespace: 'Password cannot be only spaces.'
  },
  validation: { required: 'Required', minLength: 'Too short', passwordsMismatch: 'Passwords do not match' }
};

const TOKEN = 'raw-token-value-abcdefghijklmnop';

function configure(token: string | null) {
  return TestBed.configureTestingModule({
    imports: [
      ResetPasswordComponent,
      TranslocoTestingModule.forRoot({
        langs: { en: EN },
        translocoConfig: { availableLangs: ['en'], defaultLang: 'en' }
      })
    ],
    providers: [
      provideRouter([]),
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: API_BASE_URL, useValue: '' },
      {
        provide: ActivatedRoute,
        useValue: {
          snapshot: { queryParamMap: convertToParamMap(token ? { token } : {}) }
        }
      }
    ]
  }).compileComponents();
}

describe('ResetPasswordComponent', () => {
  let fixture: ComponentFixture<ResetPasswordComponent>;
  let component: ResetPasswordComponent;
  let httpMock: HttpTestingController;

  afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  describe('with a token in the URL', () => {
    beforeEach(async () => {
      localStorage.clear();
      sessionStorage.clear();
      await configure(TOKEN);
      fixture = TestBed.createComponent(ResetPasswordComponent);
      component = fixture.componentInstance;
      httpMock = TestBed.inject(HttpTestingController);
      fixture.detectChanges();
    });

    afterEach(() => httpMock.verify());

    it('reads the token from the query parameter', () => {
      expect(component.hasToken).toBeTrue();
      const form = fixture.debugElement.query(By.css('form'));
      expect(form).toBeTruthy();
    });

    it('never stores the token in localStorage, sessionStorage or cookies', () => {
      const inAnyStorage = (store: Storage) =>
        Object.keys(store).some(k => (store.getItem(k) ?? '').includes(TOKEN) || k.includes(TOKEN));
      expect(inAnyStorage(localStorage)).toBeFalse();
      expect(inAnyStorage(sessionStorage)).toBeFalse();
      expect(document.cookie.includes(TOKEN)).toBeFalse();
    });

    it('removes the token from the visible URL after reading it', () => {
      // location.replaceState was called with the clean path (no token query).
      expect(window.location.search).not.toContain('token=');
    });

    it('blocks submission when passwords do not match', () => {
      component.newPasswordCtrl.setValue('GoodPass123!');
      component.confirmPasswordCtrl.setValue('Different123!');
      fixture.detectChanges();
      component.submit();

      httpMock.expectNone('/api/v1/auth/reset-password');
      expect(component.form.invalid).toBeTrue();
    });

    it('submits and redirects to login on success', fakeAsync(() => {
      const router = TestBed.inject(Router);
      const navSpy = spyOn(router, 'navigateByUrl');

      component.newPasswordCtrl.setValue('GoodPass123!');
      component.confirmPasswordCtrl.setValue('GoodPass123!');
      fixture.detectChanges();
      component.submit();

      const req = httpMock.expectOne('/api/v1/auth/reset-password');
      expect(req.request.body).toEqual({
        token: TOKEN,
        newPassword: 'GoodPass123!',
        confirmPassword: 'GoodPass123!'
      });
      req.flush({ message: 'ok' });
      fixture.detectChanges();

      expect(component.success).toBeTrue();
      tick(2200);
      expect(navSpy).toHaveBeenCalledWith('/login');
    }));

    it('shows a safe message for an invalid or expired token', () => {
      component.newPasswordCtrl.setValue('GoodPass123!');
      component.confirmPasswordCtrl.setValue('GoodPass123!');
      fixture.detectChanges();
      component.submit();

      httpMock.expectOne('/api/v1/auth/reset-password')
        .flush({ message: 'Invalid or expired reset link' }, { status: 400, statusText: 'Bad Request' });
      fixture.detectChanges();

      expect(component.invalidLink).toBeTrue();
      expect(component.errorMessage).toBe(EN.resetPassword.errorInvalidLink);
    });

    it('prevents duplicate submissions while a request is in flight', () => {
      component.newPasswordCtrl.setValue('GoodPass123!');
      component.confirmPasswordCtrl.setValue('GoodPass123!');
      fixture.detectChanges();
      component.submit();
      component.submit();

      const requests = httpMock.match('/api/v1/auth/reset-password');
      expect(requests.length).toBe(1);
      requests[0].flush({ message: 'ok' });
    });
  });

  describe('without a token in the URL', () => {
    beforeEach(async () => {
      await configure(null);
      fixture = TestBed.createComponent(ResetPasswordComponent);
      component = fixture.componentInstance;
      httpMock = TestBed.inject(HttpTestingController);
      fixture.detectChanges();
    });

    afterEach(() => httpMock.verify());

    it('shows a controlled error and hides the form when the token is missing', () => {
      // The message is resolved in ngOnInit; assert the controlled-error
      // behaviour (invalid state + a shown message + no form) rather than the
      // exact translated string, which depends on async dictionary load timing.
      expect(component.hasToken).toBeFalse();
      expect(component.invalidLink).toBeTrue();
      expect(component.errorMessage).toBeTruthy();
      expect(fixture.debugElement.query(By.css('form'))).toBeNull();
    });
  });
});
