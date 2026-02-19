import { Component, input, output, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Column } from '../../types/column';
import { ViewOptions } from '../../types/view-options';
import { DbEngine, DB_DATA_TYPES, shouldShowLength, isTypeValid } from '../../utils/dbDataTypes';

@Component({
      selector: 'table-row',
      imports: [CommonModule, FormsModule],
      templateUrl: './table-row.html',
})
export class TableRow {
      col = input.required<Column>();
      index = input.required<number>();
      viewMode = input.required<string>();
      viewOptions = input.required<ViewOptions>();
      isLocked = input<boolean>(false);
      isSelected = input<boolean>(false);
      isConnecting = input<boolean>(false);
      isExpanded = input<boolean>(false);
      dbEngine = input.required<DbEngine>();
      isDragging = input<boolean>(false);

      // Outputs
      dragStart = output<DragEvent>();
      drop = output<DragEvent>();
      startConnection = output<{ side: 'left' | 'right'; event: PointerEvent }>();
      completeConnection = output<PointerEvent>();
      updateColumn = output<{ field: string; value: any }>();
      deleteColumn = output<void>();

      // State for inline edit
      editingField = signal<'name' | 'type' | 'length' | null>(null);
      editValue = signal('');

      // Computed
      showDots = computed(() => this.viewOptions().connectionMode !== 'table');
      isValid = computed(() => isTypeValid(this.col().type, this.dbEngine()));
      showLength = computed(() => shouldShowLength(this.col().type));
      availableTypes = computed(() => DB_DATA_TYPES[this.dbEngine()] || DB_DATA_TYPES['mysql']);

      onDragStart(e: DragEvent) {
            if (this.isConnecting() || !this.isLocked()) {
                  e.preventDefault();
                  return;
            }
            this.dragStart.emit(e);
      }

      onDrop(e: DragEvent) {
            e.stopPropagation();
            this.drop.emit(e);
      }

      handlePointerUp(e: PointerEvent) {
            if (!this.col().isFk) {
                  this.completeConnection.emit(e);
            }
      }

      startEditing(field: 'name' | 'type' | 'length', initialValue: string) {
            this.editingField.set(field);
            this.editValue.set(initialValue);
      }

      // Handle parsing of "type(length)" for inline editor
      handleTypeChange(val: string) {
            const match = val.match(/^([^(]+)\((.+)\)$/);
            if (match) {
                  // If complex type selected, we must update both.
                  this.updateColumn.emit({ field: 'type', value: match[1].trim() });
                  this.updateColumn.emit({ field: 'length', value: match[2].trim() });
                  this.editingField.set(null);
            } else {
                  // Simple type selected
                  this.editValue.set(val);
                  this.saveEdit();

                  // If the new type doesn't support length, clear it explicitly
                  if (!shouldShowLength(val)) {
                        this.updateColumn.emit({ field: 'length', value: '' });
                  }
            }
      }

      saveEdit() {
            if (this.editingField()) {
                  this.updateColumn.emit({ field: this.editingField()!, value: this.editValue() });
                  this.editingField.set(null);
            }
      }

      cancelEdit() {
            this.editingField.set(null);
      }
}
