import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TranslocoService, TranslocoTestingModule } from '@jsverse/transloco';
import { By } from '@angular/platform-browser';

import { ForgotPasswordComponent } from './forgot-password.component';
import { API_BASE_URL } from '../../../core/http/api.config';

// Minimal per-language maps so we can assert the same key renders differently in
// each language and updates live on language switch (no page reload).
const LANGS = {
  en: { forgotPassword: { title: 'Forgot your password?' } },
  fr: { forgotPassword: { title: 'Mot de passe oublié ?' } },
  ar: { forgotPassword: { title: 'هل نسيت كلمة المرور؟' } }
};

describe('ForgotPasswordComponent i18n', () => {
  let fixture: ComponentFixture<ForgotPasswordComponent>;
  let transloco: TranslocoService;

  const title = () => fixture.debugElement.query(By.css('.auth-card__title')).nativeElement.textContent.trim();

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        ForgotPasswordComponent,
        TranslocoTestingModule.forRoot({
          langs: LANGS,
          translocoConfig: { availableLangs: ['en', 'fr', 'ar'], defaultLang: 'en', reRenderOnLangChange: true }
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
    transloco = TestBed.inject(TranslocoService);
    fixture.detectChanges();
  });

  it('renders English translations', () => {
    expect(title()).toBe(LANGS.en.forgotPassword.title);
  });

  it('renders French translations after a language switch (no re-create)', async () => {
    transloco.setActiveLang('fr');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(title()).toBe(LANGS.fr.forgotPassword.title);
  });

  it('renders Arabic (RTL) translations after a language switch', async () => {
    transloco.setActiveLang('ar');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(title()).toBe(LANGS.ar.forgotPassword.title);
  });
});
