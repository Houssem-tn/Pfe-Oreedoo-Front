import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
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

export interface AssignableUserItem {
  id: string;
  fullName: string;
  email: string;
  phone?: string | null;
}

@Component({
  selector: 'app-assign-user-modal',
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
  templateUrl: './assign-user-modal.component.html',
  styleUrl: './assign-user-modal.component.scss'
})
export class AssignUserModalComponent implements OnChanges {
  @Input() visible = false;
  @Input() title = 'Assign User';
  @Input() description = '';
  @Input() users: AssignableUserItem[] = [];
  @Input() currentUserId: string | null = null;
  @Input() confirmText = 'Assign';
  @Input() loading = false;

  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() save = new EventEmitter<string>();
  @Output() cancel = new EventEmitter<void>();

  searchTerm = '';
  selectedId: string | null = null;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['visible']?.currentValue === true) {
      this.searchTerm = '';
      this.selectedId = this.currentUserId ?? null;
    }
    if (changes['currentUserId'] && this.visible) {
      this.selectedId = this.currentUserId ?? null;
    }
  }

  get filteredUsers(): AssignableUserItem[] {
    const term = this.searchTerm.trim().toLowerCase();
    if (!term) return this.users;
    return this.users.filter(
      u => u.fullName.toLowerCase().includes(term) || u.email.toLowerCase().includes(term)
    );
  }

  get selectedUser(): AssignableUserItem | null {
    if (!this.selectedId) return null;
    return this.users.find(u => u.id === this.selectedId) ?? null;
  }

  initials(user: AssignableUserItem): string {
    return user.fullName
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map(n => n[0].toUpperCase())
      .join('');
  }

  select(user: AssignableUserItem): void {
    this.selectedId = user.id;
  }

  onSave(): void {
    if (!this.selectedId) return;
    this.save.emit(this.selectedId);
    this.visibleChange.emit(false);
  }

  onCancel(): void {
    this.cancel.emit();
    this.visibleChange.emit(false);
  }

  handleVisibleChange(v: boolean): void {
    if (!v) this.cancel.emit();
    this.visibleChange.emit(v);
  }
}
