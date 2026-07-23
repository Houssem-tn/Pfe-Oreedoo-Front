import { CommonModule } from '@angular/common';
import { Component, ElementRef, HostListener, inject, input, signal } from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';
import { LanguageService } from '../../core/i18n/language.service';
import { AppLanguage } from '../../core/i18n/language.types';

/**
 * Self-contained language switcher (no CoreUI dropdown dependency) so it can
 * be dropped into both the CoreUI-based default-layout header and the plain
 * mobile field-layout topbar with the same behavior.
 */
@Component({
  selector: 'app-language-selector',
  standalone: true,
  imports: [CommonModule, TranslocoModule],
  templateUrl: './language-selector.component.html',
  styleUrl: './language-selector.component.scss'
})
export class LanguageSelectorComponent {
  private readonly elementRef = inject(ElementRef<HTMLElement>);
  readonly languageService = inject(LanguageService);

  /** Visual variant: 'header' for the desktop CoreUI header, 'field' for the mobile topbar. */
  readonly variant = input<'header' | 'field'>('header');

  readonly isOpen = signal(false);

  toggle(): void {
    this.isOpen.update(open => !open);
  }

  select(lang: AppLanguage): void {
    this.languageService.setLanguage(lang);
    this.isOpen.set(false);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (this.isOpen() && !this.elementRef.nativeElement.contains(event.target as Node)) {
      this.isOpen.set(false);
    }
  }
}
