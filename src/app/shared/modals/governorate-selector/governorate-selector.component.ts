import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  ButtonCloseDirective,
  ButtonDirective,
  ModalBodyComponent,
  ModalComponent,
  ModalFooterComponent,
  ModalHeaderComponent,
  ModalTitleDirective
} from '@coreui/angular';
import { IconDirective } from '@coreui/icons-angular';
import { TranslocoModule } from '@jsverse/transloco';

import { TUNISIA_GOVERNORATES } from '../../../core/shared/tunisia-governorates';

const REGION_GROUPS: { labelKey: string; govs: string[] }[] = [
  {
    labelKey: 'shared.governorateSelector.regions.north',
    govs: ['Tunis', 'Ariana', 'Ben Arous', 'Manouba', 'Nabeul', 'Zaghouan', 'Bizerte', 'Beja', 'Jendouba', 'Kef', 'Siliana']
  },
  {
    labelKey: 'shared.governorateSelector.regions.center',
    govs: ['Sousse', 'Monastir', 'Mahdia', 'Sfax', 'Kairouan', 'Kasserine', 'Sidi Bouzid']
  },
  {
    labelKey: 'shared.governorateSelector.regions.south',
    govs: ['Gabes', 'Medenine', 'Tataouine', 'Gafsa', 'Tozeur', 'Kebili']
  }
];

@Component({
  selector: 'app-governorate-selector',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ModalComponent,
    ModalHeaderComponent,
    ModalTitleDirective,
    ButtonCloseDirective,
    ModalBodyComponent,
    ModalFooterComponent,
    ButtonDirective,
    IconDirective,
    TranslocoModule
  ],
  templateUrl: './governorate-selector.component.html',
  styleUrl: './governorate-selector.component.scss'
})
export class GovernorateSelectorComponent implements OnChanges {
  @Input() visible = false;
  @Input() selected: string[] = [];
  @Input() governorateOptions: string[] = [...TUNISIA_GOVERNORATES];
  @Input() title = 'shared.governorateSelector.title';
  @Input() description = '';
  @Input() confirmText = 'common.save';
  @Input() allowEmpty = false;

  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() save = new EventEmitter<string[]>();
  @Output() cancel = new EventEmitter<void>();

  searchTerm = '';
  readonly currentSelection = signal(new Set<string>());

  readonly regions = REGION_GROUPS;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['visible']?.currentValue === true) {
      this.currentSelection.set(new Set(this.selected));
      this.searchTerm = '';
    }
  }

  get filteredOptions(): string[] {
    const term = this.searchTerm.trim().toLowerCase();
    if (!term) {
      return this.governorateOptions;
    }

    return this.governorateOptions.filter((governorate) => governorate.toLowerCase().includes(term));
  }

  get selectedCount(): number {
    return this.currentSelection().size;
  }

  get totalCount(): number {
    return this.governorateOptions.length;
  }

  get useRegionGroups(): boolean {
    return !this.searchTerm.trim() && this.governorateOptions.length === TUNISIA_GOVERNORATES.length;
  }

  isSelected(governorate: string): boolean {
    return this.currentSelection().has(governorate);
  }

  toggle(governorate: string): void {
    this.currentSelection.update((selection) => {
      const next = new Set(selection);
      if (next.has(governorate)) {
        next.delete(governorate);
      } else {
        next.add(governorate);
      }
      return next;
    });
  }

  selectAll(): void {
    this.currentSelection.update((selection) => {
      const next = new Set(selection);
      for (const governorate of this.filteredOptions) {
        next.add(governorate);
      }
      return next;
    });
  }

  clearAll(): void {
    this.currentSelection.update((selection) => {
      const next = new Set(selection);
      for (const governorate of this.filteredOptions) {
        next.delete(governorate);
      }
      return next;
    });
  }

  groupItems(regionGovernorates: string[]): string[] {
    return this.filteredOptions.filter((governorate) => regionGovernorates.includes(governorate));
  }

  showRegion(regionGovernorates: string[]): boolean {
    return this.groupItems(regionGovernorates).length > 0;
  }

  onSave(): void {
    if (this.currentSelection().size === 0 && !this.allowEmpty) {
      return;
    }

    this.save.emit([...this.currentSelection()]);
    this.visibleChange.emit(false);
  }

  onCancel(): void {
    this.cancel.emit();
    this.visibleChange.emit(false);
  }

  handleVisibleChange(visible: boolean): void {
    if (!visible) {
      this.cancel.emit();
    }
    this.visibleChange.emit(visible);
  }
}
