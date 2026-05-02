import {
  Component, Input, Output, EventEmitter, forwardRef,
  HostListener, ElementRef, inject, ChangeDetectorRef
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR, FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

export interface SelectOption {
  value: string;
  label: string;
  subtitle?: string;
  badge?: string;
  badgeColor?: 'success' | 'danger' | 'warning' | 'info' | 'secondary';
  imageUrl?: string;
  initials?: string;
  avatarColor?: string;
}

@Component({
  standalone: true,
  selector: 'app-searchable-select',
  imports: [CommonModule, FormsModule],
  templateUrl: './searchable-select.component.html',
  styleUrls: ['./searchable-select.component.scss'],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SearchableSelectComponent),
      multi: true
    }
  ]
})
export class SearchableSelectComponent implements ControlValueAccessor {
  @Input() options: SelectOption[] = [];
  @Input() placeholder = 'Select…';
  @Input() disabled = false;

  searchTerm = '';
  isOpen = false;
  activeIndex = -1;

  private _value = '';
  private onChange: (v: string) => void = () => {};
  private onTouched: () => void = () => {};

  private readonly el = inject(ElementRef);
  private readonly cdr = inject(ChangeDetectorRef);

  get value(): string { return this._value; }

  get selectedOption(): SelectOption | undefined {
    return this.options.find(o => o.value === this._value);
  }

  get filtered(): SelectOption[] {
    if (!this.searchTerm.trim()) return this.options;
    const q = this.searchTerm.toLowerCase();
    return this.options.filter(o =>
      o.label.toLowerCase().includes(q) ||
      (o.subtitle?.toLowerCase().includes(q) ?? false)
    );
  }

  writeValue(v: string): void { this._value = v ?? ''; this.cdr.markForCheck(); }
  registerOnChange(fn: (v: string) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }
  setDisabledState(isDisabled: boolean): void { this.disabled = isDisabled; this.cdr.markForCheck(); }

  open(): void {
    if (this.disabled) return;
    this.isOpen = true;
    this.searchTerm = '';
    this.activeIndex = this.filtered.findIndex(o => o.value === this._value);
    setTimeout(() => {
      (this.el.nativeElement as HTMLElement).querySelector<HTMLInputElement>('.ss-search')?.focus();
    }, 30);
  }

  close(): void {
    this.isOpen = false;
    this.onTouched();
  }

  toggle(): void {
    this.isOpen ? this.close() : this.open();
  }

  select(opt: SelectOption): void {
    this._value = opt.value;
    this.onChange(opt.value);
    this.close();
    this.cdr.markForCheck();
  }

  clear(e: Event): void {
    e.stopPropagation();
    this._value = '';
    this.onChange('');
    this.cdr.markForCheck();
  }

  @HostListener('document:click', ['$event'])
  onDocClick(e: MouseEvent): void {
    if (this.isOpen && !(this.el.nativeElement as HTMLElement).contains(e.target as Node)) {
      this.close();
    }
  }

  onKeydown(e: KeyboardEvent): void {
    const items = this.filtered;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      this.activeIndex = Math.min(this.activeIndex + 1, items.length - 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      this.activeIndex = Math.max(this.activeIndex - 1, 0);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (this.activeIndex >= 0 && this.activeIndex < items.length) {
        this.select(items[this.activeIndex]);
      }
    } else if (e.key === 'Escape') {
      this.close();
    }
  }

  highlight(text: string): string {
    const safe = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    if (!this.searchTerm.trim()) return safe;
    const q = this.searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return safe.replace(new RegExp(q, 'gi'), m => `<mark>${m}</mark>`);
  }
}
