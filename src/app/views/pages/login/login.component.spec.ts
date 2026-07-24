import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { ButtonModule, CardModule, FormModule, GridModule } from '@coreui/angular';
import { LoginComponent } from './login.component';
import { IconModule, IconSetService } from '@coreui/icons-angular';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { iconSubset } from '../../../icons/icon-subset';
import { By } from '@angular/platform-browser';

describe('LoginComponent', () => {
  let component: LoginComponent;
  let fixture: ComponentFixture<LoginComponent>;
  let iconSetService: IconSetService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
    imports: [
      FormModule,
      CardModule,
      GridModule,
      ButtonModule,
      IconModule,
      LoginComponent,
      TranslocoTestingModule.forRoot({ langs: { fr: {}, 'auth/fr': {} }, translocoConfig: { availableLangs: ['fr'], defaultLang: 'fr' } })
    ],
    providers: [IconSetService, provideRouter([])]
})
    .compileComponents();
  });

  beforeEach(() => {
    iconSetService = TestBed.inject(IconSetService);
    iconSetService.icons = { ...iconSubset };

    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('has a "Forgot password?" link pointing to /forgot-password', () => {
    const link = fixture.debugElement.query(By.css('.login-form__forgot'));
    expect(link).toBeTruthy();
    // RouterLink on the anchor resolves to the /forgot-password href.
    expect(link.nativeElement.getAttribute('href')).toBe('/forgot-password');
  });
});
