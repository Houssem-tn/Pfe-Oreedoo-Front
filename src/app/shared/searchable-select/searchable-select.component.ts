import {
  ChangeDetectorRef,
  Component,
  ElementRef,
  HostListener,
  Input,
  forwardRef,
  inject
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR } from '@angular/forms';
import { TranslocoModule } from '@jsverse/transloco';

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
  imports: [CommonModule, FormsModule, TranslocoModule],
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
  @Input() placeholder = '';
  @Input() placeholderKey = 'common.select';
  @Input() searchPlaceholderKey = 'common.search';
  @Input() searchAriaLabelKey = 'shared.searchableSelect.searchOptions';
  @Input() clearSelectionAriaLabelKey = 'shared.searchableSelect.clearSelection';
  @Input() noResultsKey = 'shared.searchableSelect.noResults';
  @Input() disabled = false;

  searchTerm = '';
  isOpen = false;
  activeIndex = -1;

  private valueInternal = '';
  private onChange: (value: string) => void = () => {};
  private onTouched: () => void = () => {};

  private readonly elementRef = inject(ElementRef<HTMLElement>);
  private readonly changeDetectorRef = inject(ChangeDetectorRef);

  get value(): string {
    return this.valueInternal;
  }

  get selectedOption(): SelectOption | undefined {
    return this.options.find((option) => option.value === this.valueInternal);
  }

  get filtered(): SelectOption[] {
    if (!this.searchTerm.trim()) {
      return this.options;
    }

    const query = this.searchTerm.toLowerCase();
    return this.options.filter((option) =>
      option.label.toLowerCase().includes(query)
      || (option.subtitle?.toLowerCase().includes(query) ?? false)
    );
  }

  writeValue(value: string): void {
    this.valueInternal = value ?? '';
    this.changeDetectorRef.markForCheck();
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
    this.changeDetectorRef.markForCheck();
  }

  open(): void {
    if (this.disabled) {
      return;
    }

    this.isOpen = true;
    this.searchTerm = '';
    this.activeIndex = this.filtered.findIndex((option) => option.value === this.valueInternal);

    setTimeout(() => {
      const searchInput = this.elementRef.nativeElement.querySelector('.ss-search') as HTMLInputElement | null;
      searchInput?.focus();
    }, 30);
  }

  close(): void {
    this.isOpen = false;
    this.onTouched();
  }

  toggle(): void {
    this.isOpen ? this.close() : this.open();
  }

  select(option: SelectOption): void {
    this.valueInternal = option.value;
    this.onChange(option.value);
    this.close();
    this.changeDetectorRef.markForCheck();
  }

  clear(event: Event): void {
    event.stopPropagation();
    this.valueInternal = '';
    this.onChange('');
    this.changeDetectorRef.markForCheck();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (this.isOpen && !this.elementRef.nativeElement.contains(event.target as Node)) {
      this.close();
    }
  }

  onKeydown(event: KeyboardEvent): void {
    const items = this.filtered;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.activeIndex = Math.min(this.activeIndex + 1, items.length - 1);
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.activeIndex = Math.max(this.activeIndex - 1, 0);
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      if (this.activeIndex >= 0 && this.activeIndex < items.length) {
        this.select(items[this.activeIndex]);
      }
      return;
    }

    if (event.key === 'Escape') {
      this.close();
    }
  }

  highlight(text: string): string {
    const safe = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    if (!this.searchTerm.trim()) {
      return safe;
    }

    const query = this.searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return safe.replace(new RegExp(query, 'gi'), (match) => `<mark>${match}</mark>`);
  }
}
