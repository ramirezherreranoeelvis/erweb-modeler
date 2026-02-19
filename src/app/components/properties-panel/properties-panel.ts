import { Component, input, output, signal, computed, model } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Table } from '../canvas-diagram/types/table';
import {
      DbEngine,
      DB_DATA_TYPES,
      shouldShowLength,
      isTypeValid,
      isLengthRequired,
} from '../canvas-diagram/utils/dbDataTypes';

@Component({
      selector: 'properties-panel',
      imports: [CommonModule, FormsModule],
      templateUrl: './properties-panel.html',
})
export class PropertiesPanel {
      tables = input.required<Table[]>();
      selectedTableId = input.required<string>();
      dbEngine = input.required<DbEngine>();

      updateTable = output<{ id: string; field: string; value: any }>();
      updateColumn = output<{ tableId: string; colId: string; field: string; value: any }>();
      addColumn = output<string>();
      deleteColumn = output<{ tableId: string; colId: string }>();
      moveColumn = output<{ tableId: string; fromIndex: number; toIndex: number }>();
      close = output<void>();

      width = model(350);
      isResizing = signal(false);
      mobileMode = signal(false);
      draggedIndex = signal<number | null>(null);

      selectedTable = computed(() => {
            const t = this.tables().find((t) => t.id === this.selectedTableId());
            if (!t) return null;
            return t;
      });

      availableTypes = computed(() => DB_DATA_TYPES[this.dbEngine()] || []);

      constructor() {
            this.checkMobile();
            window.addEventListener('resize', () => this.checkMobile());
      }

      checkMobile() {
            this.mobileMode.set(window.innerWidth < 768);
      }

      // Helpers
      checkIsLinkedFk(colId: string): boolean {
            const col = this.selectedTable()?.columns.find((c) => c.id === colId);
            return col?.isFk ?? false;
      }

      checkIsTypeValid(type: string): boolean {
            return isTypeValid(type, this.dbEngine());
      }

      checkShowLength(type: string): boolean {
            return shouldShowLength(type);
      }

      checkLengthRequired(type: string): boolean {
            return isLengthRequired(type);
      }

      getPlaceholder(type: string): string {
            const t = type.toUpperCase();
            if (t.includes('CHAR')) return '255';
            if (t === 'ENUM' || t === 'SET') return "'VAL1','VAL2'";
            return '';
      }

      // Handlers
      handleColUpdate(colId: string, field: string, value: any) {
            this.updateColumn.emit({ tableId: this.selectedTableId(), colId, field, value });
      }

      handleTypeChange(colId: string, newType: string) {
            this.handleColUpdate(colId, 'type', newType);
            if (!shouldShowLength(newType)) {
                  this.handleColUpdate(colId, 'length', '');
            }
      }

      handleDragStart(e: DragEvent, index: number) {
            this.draggedIndex.set(index);
            if (e.dataTransfer) {
                  e.dataTransfer.effectAllowed = 'move';
                  e.dataTransfer.setData('text/plain', index.toString());
            }
      }

      handleDrop(e: DragEvent, toIndex: number) {
            e.preventDefault();
            const fromIndex = this.draggedIndex();
            if (fromIndex !== null && fromIndex !== toIndex) {
                  this.moveColumn.emit({ tableId: this.selectedTableId(), fromIndex, toIndex });
            }
            this.draggedIndex.set(null);
      }

      startResize(e: PointerEvent) {
            e.preventDefault();
            this.isResizing.set(true);
            (e.target as HTMLElement).setPointerCapture(e.pointerId);
      }

      handleResize(e: PointerEvent) {
            if (this.isResizing()) {
                  const newWidth = window.innerWidth - e.clientX;
                  if (newWidth > 250 && newWidth < 800) {
                        this.width.set(newWidth);
                  }
            }
      }

      stopResize(e: PointerEvent) {
            this.isResizing.set(false);
            (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      }
}
