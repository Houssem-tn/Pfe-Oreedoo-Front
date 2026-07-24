import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { By } from '@angular/platform-browser';

import { ForgotPasswordComponent } from './forgot-password.component';
import { API_BASE_URL } from '../../../core/http/api.config';

const EN = {
  forgotPassword: {
    genericSuccess: 'If an account exists for this email, a link has been sent.',
    errorGeneric: 'Something went wrong.'
  },
  validation: { required: 'This field is required', email: 'Enter a valid email address' }
};

describe('ForgotPasswordComponent', () => {
  let fixture: ComponentFixture<ForgotPasswordComponent>;
  let component: ForgotPasswordComponent;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        ForgotPasswordComponent,
        TranslocoTestingModule.forRoot({
          langs: { en: EN },
          translocoConfig: { availableLangs: ['en'], defaultLang: 'en' }
        })
      ],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: '' }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ForgotPasswordComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => httpMock.verify());

  it('creates', () => {
    expect(component).toBeTruthy();
  });

  it('validates the email field and does not call the API when invalid', () => {
    component.emailCtrl.setValue('not-an-email');
    component.submit();

    httpMock.expectNone('/api/v1/auth/forgot-password');
    expect(component.emailCtrl.touched).toBeTrue();
    expect(component.emailError()).toBeTruthy();
  });

  it('requires an email', () => {
    component.emailCtrl.setValue('');
    component.submit();
    httpMock.expectNone('/api/v1/auth/forgot-password');
    expect(component.emailCtrl.hasError('required')).toBeTrue();
  });

  it('normalizes the email and shows the generic success message on success', () => {
    component.emailCtrl.setValue('User@Example.COM');
    component.submit();

    const req = httpMock.expectOne('/api/v1/auth/forgot-password');
    expect(req.request.body).toEqual({ email: 'user@example.com' });
    req.flush({ message: 'ok' });
    fixture.detectChanges();

    expect(component.success).toBeTrue();
    const alert = fixture.debugElement.query(By.css('.auth-alert--success'));
    expect(alert.nativeElement.textContent).toContain(EN.forgotPassword.genericSuccess);
  });

  it('shows the same generic message and never reveals whether the account exists', () => {
    // Backend answers 200 with the generic body for existing AND unknown emails,
    // so the UI outcome is identical.
    component.emailCtrl.setValue('unknown@example.com');
    component.submit();
    httpMock.expectOne('/api/v1/auth/forgot-password').flush({ message: 'ok' });
    fixture.detectChanges();

    expect(component.success).toBeTrue();
    expect(fixture.debugElement.query(By.css('.auth-alert--success'))).toBeTruthy();
  });

  it('prevents duplicate submissions while a request is in flight', () => {
    component.emailCtrl.setValue('user@example.com');
    component.submit();
    component.submit(); // second click while loading — must be ignored

    const requests = httpMock.match('/api/v1/auth/forgot-password');
    expect(requests.length).toBe(1);
    requests[0].flush({ message: 'ok' });
  });
});
