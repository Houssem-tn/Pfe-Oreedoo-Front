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

import { TUNISIA_GOVERNORATES } from '../../../core/shared/tunisia-governorates';

const REGION_GROUPS: { label: string; govs: string[] }[] = [
  {
    label: 'North',
    govs: ['Tunis', 'Ariana', 'Ben Arous', 'Manouba', 'Nabeul', 'Zaghouan', 'Bizerte', 'Beja', 'Jendouba', 'Kef', 'Siliana']
  },
  {
    label: 'Centre',
    govs: ['Sousse', 'Monastir', 'Mahdia', 'Sfax', 'Kairouan', 'Kasserine', 'Sidi Bouzid']
  },
  {
    label: 'South',
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
    IconDirective
  ],
  templateUrl: './governorate-selector.component.html',
  styleUrl: './governorate-selector.component.scss'
})
export class GovernorateSelectorComponent implements OnChanges {
  @Input() visible = false;
  @Input() selected: string[] = [];
  @Input() governorateOptions: string[] = [...TUNISIA_GOVERNORATES];
  @Input() title = 'Select Governorates';
  @Input() description = '';
  @Input() confirmText = 'Save';
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
    if (!term) return this.governorateOptions;
    return this.governorateOptions.filter(g => g.toLowerCase().includes(term));
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

  isSelected(gov: string): boolean {
    return this.currentSelection().has(gov);
  }

  toggle(gov: string): void {
    this.currentSelection.update(set => {
      const next = new Set(set);
      if (next.has(gov)) {
        next.delete(gov);
      } else {
        next.add(gov);
      }
      return next;
    });
  }

  selectAll(): void {
    this.currentSelection.update(set => {
      const next = new Set(set);
      for (const gov of this.filteredOptions) {
        next.add(gov);
      }
      return next;
    });
  }

  clearAll(): void {
    this.currentSelection.update(set => {
      const next = new Set(set);
      for (const gov of this.filteredOptions) {
        next.delete(gov);
      }
      return next;
    });
  }

  groupItems(regionGovs: string[]): string[] {
    return this.filteredOptions.filter(g => regionGovs.includes(g));
  }

  showRegion(regionGovs: string[]): boolean {
    return this.groupItems(regionGovs).length > 0;
  }

  onSave(): void {
    if (this.currentSelection().size === 0 && !this.allowEmpty) return;
    this.save.emit([...this.currentSelection()]);
    this.visibleChange.emit(false);
  }

  onCancel(): void {
    this.cancel.emit();
    this.visibleChange.emit(false);
  }

  handleVisibleChange(v: boolean): void {
    if (!v) {
      this.cancel.emit();
    }
    this.visibleChange.emit(v);
  }
}
