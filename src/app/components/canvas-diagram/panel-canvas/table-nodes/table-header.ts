import { Component, input, output, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Table } from '../../types/table';

@Component({
      selector: 'table-header',
      imports: [CommonModule, FormsModule],
      templateUrl: './table-header.html',
})
export class TableHeader {
      table = input.required<Table>();
      tables = input.required<Table[]>();
      viewMode = input.required<string>();
      isSelected = input<boolean>(false);
      isLocked = input<boolean>(false);
      isExpanded = input<boolean>(false);

      toggleExpand = output<void>();
      updateTable = output<{ field: string; value: any }>();
      config = output<void>();

      isEditing = signal(false);
      editValue = signal('');

      displayValue = signal('');

      constructor() {
            effect(() => {
                  this.displayValue.set(
                        this.viewMode() === 'physical'
                              ? this.table().name
                              : this.table().logicalName,
                  );
            });
      }

      isDuplicate(): boolean {
            if (this.viewMode() !== 'physical') return false;
            const name = this.editValue().trim().toLowerCase();
            return this.tables().some(
                  (t) => t.id !== this.table().id && t.name.toLowerCase() === name,
            );
      }

      handleDoubleClick(e: MouseEvent) {
            // Only stop propagation if we are entering edit mode (Editable).
            // If not editable, we let it bubble so the Table Node can catch it and open Properties.
            if (this.isLocked()) {
                  e.stopPropagation();
                  this.isEditing.set(true);
                  this.editValue.set(
                        this.viewMode() === 'physical'
                              ? this.table().name
                              : this.table().logicalName,
                  );
            }
      }

      handleSubmit() {
            const trimmed = this.editValue().trim();
            if (!trimmed) {
                  this.cancelEdit();
                  return;
            }

            if (this.viewMode() === 'physical') {
                  if (!this.isDuplicate()) {
                        this.updateTable.emit({ field: 'name', value: trimmed.toUpperCase() });
                  } else {
                        // Reset if duplicate
                        this.editValue.set(this.table().name);
                  }
            } else {
                  this.updateTable.emit({ field: 'logicalName', value: trimmed });
            }
            this.isEditing.set(false);
      }

      cancelEdit() {
            this.isEditing.set(false);
            this.editValue.set(
                  this.viewMode() === 'physical' ? this.table().name : this.table().logicalName,
            );
      }

      handleToggleExpand(e: MouseEvent) {
            e.stopPropagation();
            this.toggleExpand.emit();
      }

      handleConfig(e: MouseEvent) {
            e.stopPropagation();
            this.config.emit();
      }

      toggleLock(e: Event) {
            e.stopPropagation();
            this.updateTable.emit({
                  field: 'isManuallyEditable',
                  value: !this.table().isManuallyEditable,
            });
      }
}
